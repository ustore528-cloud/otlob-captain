import { ChatbotAudience, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import type { ChatbotPublicContextBody } from "../validators/chatbot.schemas.js";
import { isSuperAdminRole } from "../lib/rbac-roles.js";
import {
  buildAssistantReply,
  detectChatIntent,
  type ChatbotIntent,
  type ChatbotLocale,
} from "./chatbot/rules-engine.js";

type PostBodyShape = {
  conversationId?: string;
  locale?: ChatbotLocale;
  message: string;
  context?: ChatbotPublicContextBody;
};

export type ChatbotConversationProof =
  | { ownerCode: string; orderId?: undefined; token?: undefined }
  | { ownerCode: string; orderId: string; token: string };

async function resolveCompanyScopePayload(user: NonNullable<Express.Request["user"]>): Promise<{
  companyScopeId: string | null;
  dashboardUserId: string;
}> {
  const dashboardUserId = user.id;
  if (isSuperAdminRole(user.role)) return { companyScopeId: null, dashboardUserId };
  if (user.companyId?.trim())
    return { companyScopeId: user.companyId.trim(), dashboardUserId };
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { companyId: true } });
  return { companyScopeId: row?.companyId ?? null, dashboardUserId };
}

async function fetchPublicOrderFacts(
  ctx: Extract<ChatbotPublicContextBody, { surface: "public_order" }>,
): Promise<{ status: OrderStatus; assignedCaptainId: string | null } | null> {
  const order = await prisma.order.findFirst({
    where: {
      id: ctx.orderId.trim(),
      orderPublicOwnerCode: ctx.ownerCode.trim(),
      publicTrackingToken: ctx.trackingToken.trim(),
    },
    select: { status: true, assignedCaptainId: true },
  });
  return order;
}

async function validatePublicOwnerExists(ownerCode: string): Promise<void> {
  const exists = await prisma.user.findFirst({
    where: {
      publicOwnerCode: ownerCode.trim(),
      role: "COMPANY_ADMIN",
      isActive: true,
      companyId: { not: null },
    },
    select: { id: true },
  });
  if (!exists) throw new AppError(404, "رابط الطلب غير متاح.", "PUBLIC_CONTEXT_INVALID");
}

async function ensureDashboardConversation(open: {
  conversationId?: string;
  dashboardUserId: string;
  companyScopeId: string | null;
}) {
  if (open.conversationId?.trim()) {
    const conv = await prisma.chatbotConversation.findUnique({ where: { id: open.conversationId.trim() } });
    if (!conv || conv.audience !== ChatbotAudience.DASHBOARD) {
      throw new AppError(404, "محادثة غير موجودة أو غير مخصصة لهذا الوضع.", "CHAT_CONVERSATION_NOT_FOUND");
    }
    if (conv.dashboardUserId !== open.dashboardUserId) {
      throw new AppError(403, "غير مصرح بعرض هذه المحادثة.", "FORBIDDEN");
    }
    if (conv.closedAt != null)
      throw new AppError(
        400,
        "المحادثة مغلقة — ابدأ محادثة جديدة بحذف معرف المحادثة المحلي أو تنظيف المتصفّح لهذه الصفحة.",
        "CHAT_CONVERSATION_CLOSED",
      );
    return conv;
  }

  return prisma.chatbotConversation.create({
    data: {
      audience: ChatbotAudience.DASHBOARD,
      dashboardUserId: open.dashboardUserId,
      companyScopeId: open.companyScopeId ?? undefined,
    },
  });
}

async function ensurePublicConversation(open: {
  conversationId?: string;
  snapshot: Extract<ChatbotPublicContextBody, { surface: "public_request" } | { surface: "public_order" }>;
}) {
  const snap = open.snapshot;

  const basePublicOrderId = snap.surface === "public_request" ? null : snap.orderId.trim();
  const basePublicTrackingToken = snap.surface === "public_request" ? null : snap.trackingToken.trim();

  const verifySnapshotMatchesDb = async () => {
    if (snap.surface === "public_order") {
      const alive = await fetchPublicOrderFacts(snap);
      if (!alive)
        throw new AppError(
          404,
          "الطلب غير موجود أو رمز التتبع لا يتوافق — لا يمكن تشغيل المساعد على هذا الزوج.",
          "PUBLIC_ORDER_MISMATCH",
        );
      return alive;
    }
    await validatePublicOwnerExists(snap.ownerCode);
    return null as null;
  };

  if (open.conversationId?.trim()) {
    const conv = await prisma.chatbotConversation.findUnique({ where: { id: open.conversationId.trim() } });
    if (!conv || conv.audience !== ChatbotAudience.CUSTOMER_PUBLIC) {
      throw new AppError(404, "محادثة غير متاحة.", "CHAT_CONVERSATION_NOT_FOUND");
    }

    await verifySnapshotMatchesDb();

    if (conv.closedAt != null)
      throw new AppError(
        400,
        "محادثة مغلقة — أزل معرف المحادثة لتبدأ واحدة طازجة ضمن هذا السياق.",
        "CHAT_CONVERSATION_CLOSED",
      );

    const matchPublic =
      conv.publicOwnerCode?.trim() === snap.ownerCode.trim() &&
      conv.publicOrderId === basePublicOrderId &&
      conv.publicTrackingToken === basePublicTrackingToken;

    if (!matchPublic)
      throw new AppError(403, "معرف المحادثة لا يتوافق مع سياق الصفحة الحالي.", "CHAT_CONVERSATION_SCOPE_MISMATCH");

    return conv;
  }

  /** محادثة جديدة */
  await verifySnapshotMatchesDb();

  return prisma.chatbotConversation.create({
    data: {
      audience: ChatbotAudience.CUSTOMER_PUBLIC,
      publicOwnerCode: snap.ownerCode.trim(),
      publicOrderId: basePublicOrderId,
      publicTrackingToken: basePublicTrackingToken,
    },
  });
}

function mapOrderFacts(
  order: { status: OrderStatus; assignedCaptainId: string | null } | null | undefined,
): { status: OrderStatus; hasAssignedCaptain: boolean } | null {
  if (!order) return null;
  return { status: order.status, hasAssignedCaptain: Boolean(order.assignedCaptainId) };
}

export async function postChatbotMessage(input: {
  user?: Express.Request["user"];
  body: PostBodyShape;
}): Promise<{
  conversationId: string;
  reply: string;
  quickReplies: string[];
  intent: ChatbotIntent;
}> {
  const localeRaw = input.body.locale;
  const locale: ChatbotLocale =
    localeRaw === "en" || localeRaw === "he" ? localeRaw : "ar";

  const message = input.body.message.trim();
  let conversationIdTrim = input.body.conversationId?.trim();

  if (input.user) {
    const { companyScopeId, dashboardUserId } = await resolveCompanyScopePayload(input.user);

    const conv = await ensureDashboardConversation({
      conversationId: conversationIdTrim,
      dashboardUserId,
      companyScopeId,
    });

    conversationIdTrim = conv.id;

    const intent = detectChatIntent(message, locale);

    const { assistantText, quickReplies } = buildAssistantReply({
      intent,
      locale,
      surface: "dashboard",
      orderFacts: null,
    });

    await prisma.chatbotMessage.createMany({
      data: [
        { conversationId: conv.id, role: "user", content: message },
        { conversationId: conv.id, role: "assistant", content: assistantText },
      ],
    });

    return { conversationId: conv.id, reply: assistantText, quickReplies, intent };
  }

  /** العميل العام */
  const ctx = input.body.context;
  if (!ctx) {
    throw new AppError(
      400,
      "يرجى تمرير `context.surface` وبيانات الصفحة (رمز المتجر، وإطار الطلب وتتبّعه إن لم تكن لا تزال في صفحة متابعة نشطة).",
      "CHATBOT_CONTEXT_REQUIRED",
    );
  }

  const conv = await ensurePublicConversation({ conversationId: conversationIdTrim, snapshot: ctx });
  conversationIdTrim = conv.id;

  const orderFacts = ctx.surface === "public_order" ? await fetchPublicOrderFacts(ctx) : undefined;

  const intent = detectChatIntent(message, locale);

  const { assistantText, quickReplies } = buildAssistantReply({
    intent,
    locale,
    surface: ctx.surface === "public_order" ? "customer_public_order" : "customer_public_only",
    orderFacts: mapOrderFacts(orderFacts),
  });

  await prisma.chatbotMessage.createMany({
    data: [
      { conversationId: conv.id, role: "user", content: message },
      { conversationId: conv.id, role: "assistant", content: assistantText },
    ],
  });

  return { conversationId: conv.id, reply: assistantText, quickReplies, intent };
}

async function conversationWithMessages(convId: string) {
  return prisma.chatbotConversation.findUnique({
    where: { id: convId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 120 } },
  });
}

/** GET المحادثة — يحقّق دليل المتجر أو التتبع أو JWT اللوحة */
export async function getChatConversation(input: {
  user?: Express.Request["user"];
  conversationId: string;
  proof?: ChatbotConversationProof | undefined;
}): Promise<{
  conversationId: string;
  closedAt: string | null;
  messages: { role: string; content: string; createdAt: string }[];
}> {
  const conv = await conversationWithMessages(input.conversationId.trim());
  if (!conv) throw new AppError(404, "محادثة غير موجودة.", "NOT_FOUND");

  if (conv.audience === ChatbotAudience.DASHBOARD) {
    const u = input.user;
    if (!u?.id) throw new AppError(401, "مطلوب تسجيل دخول لمشاهدة محادثة لوحة التشغيل.", "UNAUTHORIZED");
    if (conv.dashboardUserId !== u.id)
      throw new AppError(403, "محادثة مستخدم مختلفة عن الحساب الحالي.", "FORBIDDEN");
  } else {
    /** عميل عمومًا */
    const proof = input.proof;
    if (!proof?.ownerCode?.trim())
      throw new AppError(
        400,
        'يُنشأ السؤال الآن بحقل مساعد المتصفح؛ لعرض المحادثة خارج اللوحة أضِف `ownerCode=&orderId=&token=` (أو المتجر وحده إن لم تُنشأ رسائل طلب).',
        "CHATBOT_PROOF_OWNER_REQUIRED",
      );

    const hasOrderAnchors =
      typeof conv.publicOrderId === "string" &&
      conv.publicOrderId.length > 0 &&
      typeof conv.publicTrackingToken === "string" &&
      conv.publicTrackingToken.length > 0;

    if (hasOrderAnchors) {
      if (!(proof.ownerCode.trim() === conv.publicOwnerCode?.trim()))
        throw new AppError(403, "رمز المتجر مختلف عن المحادثة.", "FORBIDDEN");

      let orderProof: { ownerCode: string; orderId: string; token: string };
      if ("orderId" in proof && "token" in proof && proof.orderId && proof.token)
        orderProof = { ownerCode: proof.ownerCode.trim(), orderId: proof.orderId.trim(), token: proof.token.trim() };
      else
        throw new AppError(
          400,
          "مطلوب `orderId` و`token` القصيرين المتطابقَين لتتبع هذا الطلب عند قراءة الأرشيف.",
          "CHATBOT_PROOF_REQUIRED",
        );

      await fetchPublicOrderFacts({
        surface: "public_order",
        ownerCode: orderProof.ownerCode,
        orderId: orderProof.orderId,
        trackingToken: orderProof.token,
      }).then((o) => {
        if (!o) throw new AppError(403, "دليل التتبّع لم يمر — لا عرض.", "PUBLIC_ORDER_MISMATCH");
      });

      if (
        orderProof.ownerCode !== conv.publicOwnerCode?.trim() ||
        orderProof.orderId !== conv.publicOrderId?.trim() ||
        orderProof.token !== conv.publicTrackingToken?.trim()
      )
        throw new AppError(403, "دليل التتبع لا يطابق المحادثة.", "FORBIDDEN");
    } else {
      if (proof.ownerCode.trim() !== conv.publicOwnerCode?.trim())
        throw new AppError(403, "رمز المتجر لا يخص هذه المحادثة.", "FORBIDDEN");

      /** إعادة فحّص المتجر ظاهر نشطًا */
      await validatePublicOwnerExists(proof.ownerCode.trim());
    }
  }

  return {
    conversationId: conv.id,
    closedAt: conv.closedAt?.toISOString() ?? null,
    messages: conv.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function closeChatConversation(input: {
  user?: Express.Request["user"];
  conversationId: string;
  proof?: ChatbotConversationProof | undefined;
}): Promise<{ ok: true }> {
  const conv = await prisma.chatbotConversation.findUnique({ where: { id: input.conversationId.trim() } });
  if (!conv) throw new AppError(404, "المحادثة غير متاحة.", "NOT_FOUND");
  if (conv.closedAt != null) return { ok: true as const };

  if (conv.audience === ChatbotAudience.DASHBOARD) {
    const u = input.user;
    if (!u?.id || conv.dashboardUserId !== u.id) throw new AppError(403, "لا يمكنك إنهاء هذه المحادثة.", "FORBIDDEN");
  } else {
    /** إغلاق المسار العام */
    const proof = input.proof;
    const hasAnchors =
      typeof conv.publicOrderId === "string" &&
      conv.publicOrderId.length > 0 &&
      typeof conv.publicTrackingToken === "string" &&
      conv.publicTrackingToken.length > 0;

    if (hasAnchors) {
      let orderProof: { ownerCode: string; orderId: string; token: string };
      if (proof?.ownerCode && "orderId" in proof && "token" in proof && proof.orderId && proof.token)
        orderProof = {
          ownerCode: proof.ownerCode.trim(),
          orderId: proof.orderId.trim(),
          token: proof.token.trim(),
        };
      else throw new AppError(400, "لم يُتلق دليل الطلب لمغلقة المحادثة المرتبطة.", "CHATBOT_PROOF_REQUIRED");

      if (
        orderProof.ownerCode !== conv.publicOwnerCode?.trim() ||
        orderProof.orderId !== conv.publicOrderId?.trim() ||
        orderProof.token !== conv.publicTrackingToken?.trim()
      )
        throw new AppError(403, "رمز المتجر أو الطلب لا يخص هذه المحادثة.", "FORBIDDEN");

      await fetchPublicOrderFacts({
        surface: "public_order",
        ownerCode: orderProof.ownerCode,
        orderId: orderProof.orderId,
        trackingToken: orderProof.token,
      }).then((o) => {
        if (!o) throw new AppError(403, "رمز الوصول لم يمس الحفظ الآمن لهذه المحادثة.", "PUBLIC_ORDER_MISMATCH");
      });
    } else {
      const oCode = proof?.ownerCode.trim();
      if (!oCode || oCode !== conv.publicOwnerCode?.trim()) throw new AppError(403, "رمز المتجر مختلف.", "FORBIDDEN");
      await validatePublicOwnerExists(oCode);
    }
  }

  await prisma.chatbotConversation.update({
    where: { id: conv.id },
    data: { closedAt: new Date() },
  });
  return { ok: true as const };
}
