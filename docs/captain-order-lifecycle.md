# اطلب كابتن — دورة حياة الطلب (مرجع الكابتن)

هذا المستند يصف **حالات الطلب** في `schema.prisma` (`enum OrderStatus`) وسلوك التوزيع والقبول/الرفض كما هو منفَّذ في الـ Backend الحالي (`orders.service`, `distribution-engine`, `order-captain-status`).

**نطاق المستند:** منظور **الكابتن** + ما يهم تطبيق الموبايل؛ مع إشارة موجزة لمن يغيّر الحالة من لوحة التحكم.

---

## 1. جميع حالات الطلب (OrderStatus)

القيم حرفيًا كما في Prisma:

| الحالة | معنى مختصر |
|--------|------------|
| `PENDING` | الطلب جديد أو عاد للانتظار بعد رفض/مهلة/إيقاف توزيع (حسب المسار). |
| `CONFIRMED` | جاهز للتوزيع لكن لم يُعرض بعد على كابتن في مسار AUTO الحالي. |
| `ASSIGNED` | يوجد عرض نشط (`OrderAssignmentLog` = `PENDING`) لكابتن؛ بانتظار قبول/رفض/انتهاء مهلة. |
| `ACCEPTED` | كابتن قبل العرض؛ جاهز لمسار التسليم. |
| `PICKED_UP` | تم الاستلام من نقطة الاستلام. |
| `IN_TRANSIT` | قيد التوصيل. |
| `DELIVERED` | تم التسليم. |
| `CANCELLED` | ملغى. |

---

## 2. من يملك حق تغيير حالة الطلب؟

### 2.1 عبر `PATCH /api/v1/orders/:id/status` (لوحة التحكم + كابتن عبر مسار الويب)

| الدور | يمكنه استدعاء التحديث؟ | قيود المنطق |
|--------|-------------------------|-------------|
| `ADMIN` | نعم | لا يوجد في الكود قيد انتقال بين الحالات؛ أي `OrderStatus` مسموح تقنيًا. |
| `DISPATCHER` | نعم | مثل `ADMIN`. |
| `STORE` | نعم | فقط إذا كان الطلب لمتجره (`storeId` في التوكن يطابق طلب المتجر). |
| `CAPTAIN` | نعم | يجب أن يكون هو **الكابتن المعيَّن** (`assignedCaptainId` = كابتن المستخدم)، والانتقال **فقط** ضمن سلسلة التسليم (القسم 3.2). |

### 2.2 عبر تطبيق الكابتن (`PATCH /api/v1/mobile/captain/orders/:orderId/status`)

- فقط الحالات: `PICKED_UP` | `IN_TRANSIT` | `DELIVERED` في الـ body (Zod)، مع نفس قيود الكابتن أعلاه وسلسلة التسليم.

### 2.3 تغييرات لا يمرّ بها الكابتن مباشرة

| إلى الحالة | الطريقة النموذجية |
|------------|-------------------|
| `ASSIGNED` | محرك التوزيع أو تعيين يدوي/سحب-وإفلات/إعادة تعيين من لوحة التحكم. |
| `ACCEPTED` | `accept` من الكابتن فقط (ليس PATCH عام للحالة من الموبايل بهذه الطريقة). |
| `PENDING` | بعد رفض في وضع MANUAL، أو timeout في وضع غير AUTO+ASSIGNED، أو استنفاد التوزيع، إلخ. |

---

## 3. الانتقالات المسموحة

### 3.1 الكابتن المعيَّن بعد القبول (مسار التسليم)

مفعّل في `assertCaptainOrderStatusTransition`:

| من | إلى |
|----|-----|
| `ACCEPTED` | `PICKED_UP` |
| `PICKED_UP` | `IN_TRANSIT` |
| `IN_TRANSIT` | `DELIVERED` |

- إعادة نفس الحالة: يُعاد الطلب كما هو بدون تحديث DB جديد لنفس التغيير (idempotent عند التطابق).
- أي انتقال آخر من الكابتن: **`409`** مع رمز **`INVALID_STATUS_TRANSITION`**.

### 3.2 قبول العرض (Accept)

- الانتقال على مستوى الطلب: **`ASSIGNED` → `ACCEPTED`** (يحدث داخل `acceptByCaptain`).
- لا يُستخدم PATCH لتحويل `ASSIGNED` إلى `ACCEPTED` من مسار الموبايل؛ الاستدعاء هو **`POST .../accept`**.

### 3.3 أدوار غير الكابتن

- `ADMIN` / `DISPATCHER` / `STORE`: لا يوجد ملف انتقالات حالة موحّد في الكود؛ التغيير ممكن عمليًا لأي `OrderStatus` مسموح به من ناحية Prisma (مع تحقق المتجر لطلبات متجره).

---

## 4. ماذا يحدث عند Accept؟

**المسار:** `POST /api/v1/orders/:id/accept` أو `POST /api/v1/mobile/captain/orders/:orderId/accept`

1. البحث عن `Captain` بحسب `userId` من JWT.
2. البحث عن `OrderAssignmentLog` لهذا `orderId` و`captainId` و`responseStatus = PENDING`.
3. تحديث هذا السجل إلى **`ACCEPTED`**.
4. إلغاء أي سجلات **`PENDING`** أخرى لنفس الطلب (لكباتن آخرين): **`CANCELLED`** مع الملاحظة النصية **`Another captain accepted`**.
5. تحديث الطلب: **`status = ACCEPTED`**, **`assignedCaptainId`** = هذا الكابتن.
6. تسجيل نشاط: **`ORDER_ACCEPTED_BY_CAPTAIN`**.
7. بعد نجاح المعاملة: بث **`order:updated`** للموزّعين، و **`captain:order:updated`** لنفس الكابتن (حسب `realtime/order-emits`).

---

## 5. ماذا يحدث عند Reject؟

**المسار:** `POST .../reject`

1. نفس التحقق من وجود `PENDING` log لهذا الكابتن.
2. تحديث السجل إلى **`REJECTED`**.
3. استدعاء **`afterCaptainRejectTx`** داخل المعاملة:
   - إذا **`distributionMode = AUTO`**: استدعاء **`offerNextAutoCaptainTx`** (عرض على الكابتن التالي بالدور، أو إرجاع `PENDING` إن لم يوجد كابتن / انتهت المحاولات).
   - إذا **`MANUAL`**: **`status = PENDING`**, **`assignedCaptainId = null`**.
4. تسجيل **`ORDER_REJECTED_BY_CAPTAIN`**.
5. بعد المعاملة: **`order:updated`** إن وُجد الطلب، و **`captain:assignment:ended`** للكابتن الرافض مع **`reason: "REJECTED"`**.

---

## 6. ماذا يحدث عند Timeout؟

**المشغّل:** `DistributionEngine.processDueTimeouts` يُستدعى دوريًا من `server.ts` (حسب `DISTRIBUTION_POLL_MS`).

1. جلب سجلات `OrderAssignmentLog` حيث **`PENDING`** و **`expiredAt <= الآن`**.
2. داخل معاملة مع قفل الطلب:
   - تعيين السجل إلى **`EXPIRED`** مع ملاحظة مهلة.
   - قراءة الطلب:
     - إذا **`distributionMode = AUTO`** و **`status = ASSIGNED`**: استدعاء **`offerNextAutoCaptainTx`** (عرض للتالي أو `PENDING` إن تعذّر).
     - وإلا: **`status = PENDING`**, **`assignedCaptainId = null`**.

**ملاحظة تنفيذية (Socket):** مسار **`processDueTimeouts`** يستدعي المحرك مباشرة ولا يمر دائمًا بطبقة `distributionService` التي تبث `captain:assignment` بعد العروض اليدوية/إعادة الإرسال. لذلك **قد لا يصل حدث Socket لعرض الكابتن التالي** بعد انتهاء المهلة تلقائيًا، بينما **منطق قاعدة البيانات** (عرض تلقائي جديد) يبقى فعّالًا. للاعتماد الكامل على الإشعارات اللحظية بعد المهلة، راجع مزامنة البث مع هذا المسار في الإصدارات القادمة.

---

## 7. ماذا يحدث عند Resend to Distribution؟

**المسار:** `POST /api/v1/orders/:id/distribution/resend`

1. قفل الطلب.
2. إلغاء كل **`PENDING`** logs للطلب → **`CANCELLED`** (ملاحظة: resend to distribution).
3. تحديث الطلب: **`PENDING`**, **`assignedCaptainId = null`**, **`distributionMode = AUTO`**, **`lastDistributionResetAt = now`**.
4. تسجيل **`ORDER_RESEND_DISTRIBUTION`**.
5. **`offerNextAutoCaptainTx`** داخل نفس المعاملة.
6. عند استخدام **`distributionService.resendToDistribution`** من المتحكّم: بعد نجاح المعاملة يُبث عبر Socket **`captain:assignment`** للكابتن المعروض و **`order:updated`** للموزّعين (طبقة `services/distribution/index.ts`).

---

## 8. ماذا يحدث عند Manual Assignment؟

**المسار:** `POST /api/v1/orders/:id/distribution/manual`  
ينفّذ **`assignManualOverride`** مع **`assignmentType = MANUAL`**.

1. الطلب يجب أن يكون **`PENDING` أو `CONFIRMED` أو `ASSIGNED`**؛ وإلا **`409 INVALID_STATE`**.
2. التحقق من أهلية الكابتن (`captainEligibleForManualOverride`).
3. إلغاء **`PENDING`** الحالية → **`CANCELLED`**.
4. إنشاء log جديد: **`MANUAL`**, **`PENDING`**, **`expiredAt`** من الآن + ثابت المهلة.
5. تحديث الطلب: **`ASSIGNED`**, **`assignedCaptainId`**, **`distributionMode = MANUAL`**.
6. إشعار للكابتن + **`ORDER_MANUAL_ASSIGN`** في السجل.
7. عبر **`distributionService`**: بث **`captain:assignment`** (`kind: "OFFER"`) و **`order:updated`**.

---

## 9. ماذا يحدث عند Drag‑Drop Assignment؟

**المسار:** `POST /api/v1/orders/:id/distribution/drag-drop`  
نفس **`assignManualOverride`** مع **`assignmentType = DRAG_DROP`**.

- الفرق الوحيد المهم في البيانات: نوع السجل **`DRAG_DROP`** ونصوص الإشعار/العنوان تختلف قليلًا عن التعيين اليدوي العادي.
- باقي الخطوات مثل القسم 8 (حالة الطلب، `MANUAL` mode، مهلة، إلخ).

---

## 10. ملخص لتطبيق الكابتن

| الإجراء | النتيجة على الطلب / السجل |
|---------|----------------------------|
| عرض جديد | غالبًا `ASSIGNED` + log `PENDING` حتى يقرر الكابتن. |
| قبول | `ACCEPTED` + إلغاء عروض `PENDING` الأخرى. |
| رفض | log `REJECTED` + متابعة AUTO أو العودة `PENDING` (MANUAL). |
| مهلة | log `EXPIRED` + AUTO يعرض التالي أو يصبح `PENDING`. |
| تسليم | فقط عبر السلسلة `PICKED_UP` → `IN_TRANSIT` → `DELIVERED` للكابتن المعيَّن. |

**أحداث Socket ذات الصلة بالكابتن** (أسماء ثابتة في السيرفر):

- `captain:assignment` — عرض/إعادة تعيين (عند المرور بـ `distributionService` بعد العمليات التي تغلفها).
- `captain:assignment:ended` — مثلًا بعد رفض الكابتن (`reason: "REJECTED"`).
- `captain:order:updated` — تحديث حالة الطلب يهم الكابتن المعيَّن.

لتفاصيل REST و Socket للموبايل راجع أيضًا: `docs/mobile-captain-api.md`.
