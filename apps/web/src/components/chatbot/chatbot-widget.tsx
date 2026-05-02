import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import {
  chatbotCloseConversation,
  chatbotFetchConversation,
  chatbotSendMessage,
  type ChatbotPostContext,
} from "@/lib/api/services/chatbot";
import { fetchPublicOrderIdsByTrackingToken } from "@/lib/api/services/public-request";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import i18n from "@/i18n/i18n";

type TrackState = "loading" | "failed" | { ownerCode: string; orderId: string; trackingToken: string };

type ChatbotWidgetVariant =
  | { mode: "dashboard" }
  | { mode: "public_request"; ownerCode: string; rtl?: boolean }
  | { mode: "public_order"; ownerCode: string; orderId: string; trackingToken: string; rtl?: boolean }
  | { mode: "track_deep_link"; trackingToken: string; rtl?: boolean };

type Msg = { id: string; role: "user" | "assistant"; content: string };

function bubbleClass(role: Msg["role"]): string {
  return role === "user"
    ? "rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
    : "rounded-2xl border border-muted-foreground/20 bg-muted/40 px-3 py-2 text-foreground";
}

function deriveLocaleShort(): "ar" | "en" | "he" {
  const raw = typeof i18n.resolvedLanguage === "string" ? i18n.resolvedLanguage : i18n.language;
  const lng = typeof raw === "string" ? raw.split("-")[0] : "ar";
  if (lng === "en" || lng === "he") return lng;
  return "ar";
}

/** مساعد عائم؛ يشرح ويعرض فقط بدون تنفيذ إجراءات خطرة على الطلبات أو الأرصدة. */
export function ChatbotWidget(props: ChatbotWidgetVariant & { zIndex?: string }) {
  const { zIndex = "z-[120]" } = props;
  const { t } = useTranslation();
  const tokenDashboard = useAuthStore((s) => s.token);
  const composerId = useId();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [trackState, setTrackState] = useState<TrackState>(
    props.mode === "track_deep_link" ? "loading" : "failed",
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  const rtlPreferred = props.mode !== "dashboard" ? Boolean(props.rtl) : false;

  /** مفتاح تخزين جلسة لكل سطح */
  const publicOwnerKey =
    props.mode === "public_request" || props.mode === "public_order" ? props.ownerCode.trim() : "";
  const publicOrderAnchorKey =
    props.mode === "public_order"
      ? `${props.orderId.trim()}:${props.trackingToken.trim().slice(0, 48)}`
      : "";

  const storageNamespace = useMemo(() => {
    if (props.mode === "dashboard") return `captain-dash:${tokenDashboard ?? "anon"}`;
    if (props.mode === "public_request") return `captain-public:${publicOwnerKey}`;
    if (props.mode === "public_order") {
      const base = `${publicOwnerKey}:${props.orderId.trim()}:${props.trackingToken.trim().slice(0, 48)}`;
      return `captain-public-order:${base}`;
    }

    if (props.mode === "track_deep_link") {
      if (trackState === "loading" || trackState === "failed") return null;
      const base = `${trackState.ownerCode}:${trackState.orderId}:${trackState.trackingToken.slice(0, 48)}`;
      return `captain-public-order:${base}`;
    }

    return null;
  }, [props.mode, tokenDashboard, trackState, publicOwnerKey, publicOrderAnchorKey]);

  useEffect(() => {
    if (!storageNamespace || typeof sessionStorage === "undefined") {
      setConversationId(null);
      return;
    }
    try {
      setConversationId(sessionStorage.getItem(`${storageNamespace}:conv`) ?? null);
    } catch {
      setConversationId(null);
    }
  }, [storageNamespace]);

  const trackingTokenForDeepLink =
    props.mode === "track_deep_link" ? props.trackingToken.trim() : "";

  useEffect(() => {
    if (props.mode !== "track_deep_link" || trackingTokenForDeepLink === "") return;
    let cancelled = false;
    void (async () => {
      try {
        const ids = await fetchPublicOrderIdsByTrackingToken(trackingTokenForDeepLink);
        if (cancelled) return;
        setTrackState({
          ownerCode: ids.ownerCode,
          orderId: ids.orderId,
          trackingToken: trackingTokenForDeepLink,
        });
      } catch {
        if (cancelled) return;
        setTrackState("failed");
        toast.error(t("chatbot.trackResolveFail"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.mode, trackingTokenForDeepLink, t]);

  const postContext = useMemo((): ChatbotPostContext | undefined => {
    if (props.mode === "dashboard") return undefined;

    if (props.mode === "public_request") {
      return { surface: "public_request", ownerCode: props.ownerCode.trim() };
    }

    if (props.mode === "public_order") {
      const tok = props.trackingToken.trim();
      const oid = props.orderId.trim();
      const oc = props.ownerCode.trim();
      return { surface: "public_order", ownerCode: oc, orderId: oid, trackingToken: tok };
    }

    /** track_deep_link — يعتمد بعد جلب المعرفات */
    if (trackState === "loading" || trackState === "failed") return undefined;

    return {
      surface: "public_order",
      ownerCode: trackState.ownerCode.trim(),
      orderId: trackState.orderId.trim(),
      trackingToken: trackState.trackingToken.trim(),
    };
  }, [props, trackState]);

  /** إعادة تمركز الأسفل */
  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (!node) return;
    queueMicrotask(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [open, messages.length]);

  const persistConversation = (cid: string) => {
    if (!storageNamespace || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(`${storageNamespace}:conv`, cid);
    } catch {
      /* ignore quota */
    }
    setConversationId(cid);
  };

  /** استرجاع سجل موجود عند الإغلاق/الإعادة */
  const hydrate = useCallback(async () => {
    const ns = storageNamespace;
    let cid = ns && typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`${ns}:conv`) : null;

    const authTok = props.mode === "dashboard" ? tokenDashboard : undefined;

    if (!cid) {
      setMessages((prev) =>
        prev.length
          ? prev
          : [
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: t("chatbot.welcomeLine"),
              },
            ],
      );
      setQuickTags([]);
      return;
    }

    /** يجب انتظار مفتاح التخزين */
    try {
      const query =
        props.mode === "dashboard"
          ? undefined
          : props.mode === "public_request"
            ? { ownerCode: props.ownerCode.trim() }
            : props.mode === "public_order"
              ? {
                  ownerCode: props.ownerCode.trim(),
                  orderId: props.orderId.trim(),
                  token: props.trackingToken.trim(),
                }
              : trackState !== "loading" && trackState !== "failed"
                ? {
                    ownerCode: trackState.ownerCode.trim(),
                    orderId: trackState.orderId.trim(),
                    token: trackState.trackingToken.trim(),
                  }
                : undefined;

      const data = await chatbotFetchConversation({
        conversationId: cid,
        token: authTok,
        query,
      });

      setConversationId(data.conversationId);
      const mapped = data.messages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
      setMessages(mapped);
    } catch {
      toast.error(t("chatbot.loadHistoryFailed"));
      setConversationId(cid);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t("chatbot.welcomeLine"),
        },
      ]);
    }
  }, [props, storageNamespace, t, tokenDashboard, trackState]);

  /** عند كل فتح */
  useEffect(() => {
    if (!open) return;
    void hydrate();
  }, [open, hydrate, storageNamespace]);

  const blockingHint = (): string | null => {
    if (props.mode === "track_deep_link") {
      if (trackState === "loading") return t("chatbot.trackResolvingHint");
      if (trackState === "failed") return t("chatbot.trackBrokenHint");
    }
    if (!postContext && props.mode !== "dashboard") return t("chatbot.contextMissingHint");
    return null;
  };

  const proofQueryPublic = (): Partial<{ ownerCode: string; orderId: string; token: string }> | undefined => {
    if (props.mode === "dashboard") return undefined;
    if (props.mode === "public_request") return { ownerCode: props.ownerCode.trim() };
    if (props.mode === "public_order")
      return {
        ownerCode: props.ownerCode.trim(),
        orderId: props.orderId.trim(),
        token: props.trackingToken.trim(),
      };

    if (trackState !== "loading" && trackState !== "failed") {
      return {
        ownerCode: trackState.ownerCode.trim(),
        orderId: trackState.orderId.trim(),
        token: trackState.trackingToken.trim(),
      };
    }

    return undefined;
  };

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    const block = blockingHint();

    if (!trimmed || busy) return;
    if (block && props.mode !== "dashboard") {
      toast.info(block);
      return;
    }

    setBusy(true);
    const optimistic: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await chatbotSendMessage({
        token: props.mode === "dashboard" ? tokenDashboard : undefined,
        conversationId: conversationId ?? undefined,
        locale: deriveLocaleShort(),
        message: trimmed,
        context: postContext,
      });
      persistConversation(res.conversationId);
      setQuickTags(Array.isArray(res.quickReplies) ? res.quickReplies.slice(0, 8) : []);

      const replyId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: res.reply }]);
    } catch (e: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(trimmed);
      toast.error(e instanceof ApiError ? e.message : t("chatbot.genericError"));
      return;
    } finally {
      setBusy(false);
    }
  };

  const floatingPosition = rtlPreferred ? `start-6` : `end-6`;

  return (
    <div dir={rtlPreferred ? "rtl" : "ltr"} className={`pointer-events-none fixed bottom-24 ${floatingPosition}`}>
      <div className={`pointer-events-auto relative flex flex-col items-end gap-3 ${zIndex}`}>
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="flex max-h-[min(72vh,540px)] w-[min(calc(100vw-48px),22rem)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border bg-card/95 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 rounded-2xl bg-primary/15 p-1.5 text-primary">
                    <Sparkles className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-foreground">{t("chatbot.panelTitle")}</p>
                    <p className="text-[11px] text-muted">{t("chatbot.panelDisclaimer")}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {conversationId && storageNamespace ? (
                    <Button
                      variant="secondary"
                      type="button"
                      size="sm"
                      className="rounded-xl text-[11px]"
                      disabled={busy}
                      onClick={() => {
                        const ns = storageNamespace;
                        void (async () => {
                          if (conversationId && ns && proofQueryPublic() !== undefined) {
                            await chatbotCloseConversation({
                              conversationId,
                              token: props.mode === "dashboard" ? tokenDashboard : undefined,
                              query: proofQueryPublic(),
                            }).catch(() => undefined);
                          } else if (conversationId && props.mode === "dashboard") {
                            await chatbotCloseConversation({
                              conversationId,
                              token: tokenDashboard ?? undefined,
                            }).catch(() => undefined);
                          }
                          sessionStorage.removeItem(`${ns}:conv`);
                          setConversationId(null);
                          setMessages([
                            {
                              id: crypto.randomUUID(),
                              role: "assistant",
                              content: t("chatbot.welcomeAfterReset"),
                            },
                          ]);
                          setQuickTags([]);
                        })();
                      }}
                    >
                      {t("chatbot.newConversation")}
                    </Button>
                  ) : null}

                  <Button variant="ghost" size="icon" type="button" className="rounded-full" aria-label={t("common.close")} onClick={() => setOpen(false)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              <div
                ref={listRef}
                className="flex max-h-[min(46vh,360px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-3 py-3 text-[13px] leading-relaxed"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.role === "user"
                        ? rtlPreferred
                          ? "justify-start"
                          : "justify-end"
                        : rtlPreferred
                          ? "justify-end"
                          : "justify-start"
                    }`}
                  >
                    <div className={`max-w-[92%] whitespace-pre-wrap text-start ${bubbleClass(m.role)}`}>
                      <span className="sr-only">
                        {m.role === "user" ? `${t("chatbot.you")}: ` : `${t("chatbot.assistantShort")}: `}
                      </span>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>

              {quickTags.length ? (
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto border-t border-border/60 px-3 py-2">
                  {quickTags.map((chip, idx) => (
                    <button
                      type="button"
                      key={`${chip}-${idx}`}
                      disabled={busy}
                      onClick={() => void submitText(chip)}
                      className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/70 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="sr-only" htmlFor={composerId}>
                {t("chatbot.composerLabel")}
              </label>
              <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                <input
                  id={composerId}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={busy ? t("chatbot.busyPlaceholder") : t("chatbot.composerPlaceholder")}
                  disabled={busy || Boolean(blockingHint())}
                  dir="auto"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitText(draft);
                    }
                  }}
                  className="flex-1 rounded-2xl border border-muted-foreground/20 bg-muted/30 px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                />
                <Button
                  type="button"
                  disabled={busy || draft.trim().length === 0 || Boolean(blockingHint())}
                  size="icon"
                  className="rounded-2xl"
                  aria-label={t("chatbot.send")}
                  onClick={() => void submitText(draft)}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="h-14 w-14 shrink-0 rounded-full bg-primary px-4 py-4 text-primary-foreground shadow-xl hover:bg-primary"
          onClick={() => setOpen((v) => !v)}
        >
          <MessageCircle className="size-6" aria-hidden />
          <span className="sr-only">{open ? t("chatbot.hidePanel") : t("chatbot.openPanel")}</span>
        </Button>
      </div>
    </div>
  );
}
