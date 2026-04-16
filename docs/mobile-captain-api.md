## اطلب كابتن — توثيق API لتطبيق الكابتن (Mobile)

هذه الوثيقة تشرح جميع مسارات REST و Socket.IO الخاصة بتطبيق الكابتن تحت المسار:

- Base URL (افتراضيًا محليًا): `http://localhost:4000`
- Base path: `/api/v1/mobile/captain`

> ملاحظة: جميع الأمثلة تستخدم JSON، ويمكن استهلاكها مباشرة من Flutter (Dio/http) أو React Native (fetch/axios).

---

## 0. صيغة الاستجابة الموحّدة

### نجاح (2xx)

```json
{
  "success": true,
  "data": {}
}
```

### خطأ

```json
{
  "success": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

- **`code`**: ثابت آلي (مثل `INVALID_CREDENTIALS`, `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`).
- **`details`**: يظهر غالبًا عند `VALIDATION_ERROR` (مخرجات Zod `flatten()`).
- **HTTP status**: يطابق الحالة (مثل `400` للتحقق، `401` للمصادقة، `403` للصلاحية، `404` للغياب، `409` لتعارض الحالة).

**رأس الطلب للمسارات المحمية:**

```http
Authorization: Bearer <accessToken>
```

---

## 1. المصطلحات والأدوار

- **Captain User**: مستخدم في جدول `users` بدور `CAPTAIN`، وله سجل في جدول `captains`.
- **Access Token**: JWT من نوع `access` في الـ `Authorization: Bearer <token>`.
- **Refresh Token**: JWT من نوع `refresh` يستخدم لتجديد الـ Access Token.
- **Order Status (حالات الطلب)**:
  - `PENDING`, `CONFIRMED`, `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`
- **سلسلة حالات الكابتن المسموح بها**:
  - `ACCEPTED → PICKED_UP → IN_TRANSIT → DELIVERED`

---

## 2. المصادقة (Auth)

### 2.1 تسجيل دخول الكابتن

- **Method**: `POST`
- **URL**: `/api/v1/mobile/captain/auth/login`
- **Auth required**: لا

#### Request Body

```json
{
  "phone": "+9665XXXXXXXX",
  "password": "PlainTextPassword"
}
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT_ACCESS_TOKEN",
    "refreshToken": "JWT_REFRESH_TOKEN",
    "tokenType": "Bearer",
    "expiresIn": "15m",
    "user": {
      "id": "user-id",
      "fullName": "كابتن تجريبي",
      "phone": "+9665...",
      "role": "CAPTAIN"
    },
    "captain": {
      "id": "captain-id",
      "vehicleType": "motorcycle",
      "area": "الرياض",
      "availabilityStatus": "AVAILABLE",
      "isActive": true
    }
  }
}
```

#### Error Cases

- `401 INVALID_CREDENTIALS` — رقم/كلمة مرور خاطئة أو مستخدم غير فعّال.
- `403 FORBIDDEN_ROLE` — المستخدم ليس بدور `CAPTAIN`.
- `403 FORBIDDEN` — لا يوجد سجل `captain` لهذا المستخدم.

---

### 2.2 تجديد التوكن (Refresh Token)

- **Method**: `POST`
- **URL**: `/api/v1/mobile/captain/auth/refresh`
- **Auth required**: لا

#### Request Body

```json
{
  "refreshToken": "JWT_REFRESH_TOKEN"
}
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "NEW_ACCESS_TOKEN",
    "refreshToken": "NEW_REFRESH_TOKEN",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```

#### Error Cases

- `401 INVALID_REFRESH` — Refresh Token غير صالح أو منتهي أو يخص مستخدمًا غير فعّال.

---

## 3. الكابتن الحالية (Profile)

### 3.1 بيانات الكابتن / المستخدم

- **Method**: `GET`
- **URL**: `/api/v1/mobile/captain/me`
- **Auth required**: نعم (Bearer Access Token بدور `CAPTAIN`)

#### Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "fullName": "كابتن تجريبي",
      "phone": "+9665...",
      "email": "captain@example.com",
      "isActive": true
    },
    "captain": {
      "id": "captain-id",
      "vehicleType": "motorcycle",
      "area": "الرياض",
      "availabilityStatus": "AVAILABLE",
      "isActive": true,
      "lastSeenAt": "2025-01-01T12:34:56.000Z"
    }
  }
}
```

#### Error Cases

- `404 NOT_FOUND` — لا يوجد سجل `captain` لهذا المستخدم.
- `401 UNAUTHORIZED` — توكن ناقص/خاطئ.

---

### 3.2 تحديث حالة التوفر (Availability)

لتفعيل/إيقاف الظهور في التوزيع (قيم `CaptainAvailabilityStatus` من الـ schema): `OFFLINE`, `AVAILABLE`, `BUSY`, `ON_DELIVERY`.

- **Method**: `PATCH`
- **URL**: `/api/v1/mobile/captain/me/availability`
- **Auth required**: نعم (CAPTAIN)

#### Request Body

```json
{
  "availabilityStatus": "AVAILABLE"
}
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "captain": {
      "id": "captain-id",
      "availabilityStatus": "AVAILABLE",
      "lastSeenAt": "2025-01-01T12:34:56.000Z"
    }
  }
}
```

#### Error Cases

- `404 NOT_FOUND` — لا يوجد ملف كابتن.
- `400 VALIDATION_ERROR` — قيمة غير ضمن الـ enum.

---

## 4. التعيين الحالي (Current Assignment)

### 4.1 الحصول على التعيين الحالي

- **Method**: `GET`
- **URL**: `/api/v1/mobile/captain/me/assignment`
- **Auth required**: نعم (CAPTAIN)

#### Response Shapes

الحقل الرئيسي: `data.state` ويمكن أن يكون:

1. **لا يوجد شيء**:

```json
{
  "success": true,
  "data": {
    "state": "NONE"
  }
}
```

2. **عرض جديد (OFFER)** — الطلب عُرض على الكابتن بانتظار القبول/الرفض:

```json
{
  "success": true,
  "data": {
    "state": "OFFER",
    "timeoutSeconds": 30,
    "log": {
      "id": "assignment-log-id",
      "assignedAt": "2025-01-01T12:34:56.000Z",
      "expiresAt": "2025-01-01T12:35:26.000Z"
    },
    "order": { /* OrderDetailDto — انظر قسم 5.0 / 5.1 */ }
  }
}
```

3. **طلب جاري (ACTIVE)** — الكابتن معيَّن على طلب بحالة `ACCEPTED` أو `PICKED_UP` أو `IN_TRANSIT`:

```json
{
  "success": true,
  "data": {
    "state": "ACTIVE",
    "order": { /* OrderDetailDto — انظر قسم 5.0 / 5.1 */ }
  }
}
```

#### Error Cases

- `404 NOT_FOUND` — لا يوجد ملف كابتن.

---

## 5. الطلبات (Orders)

### 5.0 تفاصيل طلب واحد (شاشة تفاصيل / إشعار / deep link)

- **Method**: `GET`
- **URL**: `/api/v1/mobile/captain/orders/:orderId`
- **Auth required**: نعم (CAPTAIN)

#### URL Params

- `orderId` — `cuid`

#### Response (200)

نفس شكل `OrderDetailDto` الموضح في **5.1** (كائن طلب كامل مع `store`, `assignmentLogs`, …).

#### Error Cases

- `403 FORBIDDEN` — الطلب لا يخص هذا الكابتن (ليس معيَّنًا ولم يُعرض له سابقًا).
- `404 NOT_FOUND` — الطلب غير موجود.
- `401 UNAUTHORIZED` — توكن ناقص/منتهٍ.

---

### 5.1 قبول طلب (Accept Order)

- **Method**: `POST`
- **URL**: `/api/v1/mobile/captain/orders/:orderId/accept`
- **Auth required**: نعم (CAPTAIN)

#### URL Params

- `orderId` — `cuid` للطلب الذي لديه عرض PENDING لهذا الكابتن.

#### Request Body

لا يوجد body.

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "order-id",
    "orderNumber": "ORD-2025-0001",
    "status": "ACCEPTED",
    "customerName": "العميل",
    "customerPhone": "+9665...",
    "pickupAddress": "عنوان الاستلام",
    "dropoffAddress": "عنوان التسليم",
    "area": "الرياض",
    "amount": "100.00",
    "cashCollection": "0.00",
    "notes": null,
    "store": {
      "id": "store-id",
      "name": "متجر تجريبي",
      "area": "الرياض — الشمال",
      "phone": "+9665..."
    },
    "createdAt": "2025-01-01T12:00:00.000Z",
    "updatedAt": "2025-01-01T12:01:00.000Z",
    "assignmentLogs": [
      {
        "id": "log-id",
        "captainId": "captain-id",
        "assignmentType": "AUTO",
        "assignedAt": "2025-01-01T12:00:10.000Z",
        "responseStatus": "ACCEPTED",
        "expiredAt": "2025-01-01T12:00:40.000Z",
        "notes": null
      }
    ]
  }
}
```

#### Error Cases

- `404 NOT_FOUND` — لا يوجد كابتن أو طلب.
- `409 INVALID_STATE` — لا يوجد `OrderAssignmentLog` بحالة `PENDING` لهذا الكابتن على هذا الطلب (انتهت المهلة أو تم رفضه/قبوله من قبل).

---

### 5.2 رفض طلب (Reject Order)

- **Method**: `POST`
- **URL**: `/api/v1/mobile/captain/orders/:orderId/reject`
- **Auth required**: نعم (CAPTAIN)

#### URL Params

- `orderId`: معرف الطلب.

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "order-id",
    "orderNumber": "ORD-2025-0001",
    "status": "PENDING",
    "customerName": "...",
    "customerPhone": "...",
    "area": "...",
    "amount": "100.00",
    "cashCollection": "0.00",
    "store": {
      "id": "store-id",
      "name": "متجر تجريبي",
      "area": "..."
    },
    "createdAt": "2025-01-01T12:00:00.000Z",
    "updatedAt": "2025-01-01T12:01:00.000Z",
    "assignmentLogs": [
      {
        "id": "log-id",
        "captainId": "captain-id",
        "assignmentType": "AUTO",
        "assignedAt": "2025-01-01T12:00:10.000Z",
        "responseStatus": "REJECTED",
        "expiredAt": "2025-01-01T12:00:40.000Z",
        "notes": null
      }
    ]
  }
}
```

> ملاحظة: بعد رفض الكابتن، محرك التوزيع إمّا:
> - ينتقل للكابتن التالي (AUTO)، أو
> - يعيد الطلب لحالة `PENDING` بدون كابتن معيَّن (MANUAL).

#### Error Cases

- نفس حالات القبول (`NOT_FOUND`, `INVALID_STATE`).

---

### 5.3 تحديث حالة الطلب من تطبيق الكابتن

- **Method**: `PATCH`
- **URL**: `/api/v1/mobile/captain/orders/:orderId/status`
- **Auth required**: نعم (CAPTAIN)

#### القيود (Status Transitions)

- الانتقالات المسموحة للكابتن فقط:
  - من `ACCEPTED` إلى `PICKED_UP`
  - من `PICKED_UP` إلى `IN_TRANSIT`
  - من `IN_TRANSIT` إلى `DELIVERED`
- أي انتقال آخر سيُرفض.
- يجب أن يكون الكابتن هو الكابتن المعيَّن على الطلب (`assignedCaptainId`).

#### Request Body

```json
{
  "status": "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"
}
```

#### Response (200)

نفس شكل `OrderDetailDto` الموضح في 5.1 مع الحالة الجديدة في الحقل `status`.

#### Error Cases

- `403 FORBIDDEN`:
  - المستخدم ليس CAPTAIN.
  - الكابتن الحالي ليس المعيَّن على الطلب.
- `409 INVALID_STATUS_TRANSITION`:
  - محاولة تغيير الحالة إلى قيمة غير مسموحة من الحالة الحالية.

---

### 5.4 تاريخ الطلبات للكابتن (Order History)

- **Method**: `GET`
- **URL**: `/api/v1/mobile/captain/orders/history`
- **Auth required**: نعم (CAPTAIN)

#### Query Params

- `page` (اختياري، افتراضيًا `1`)
- `pageSize` (اختياري، افتراضيًا `20`, حد أقصى `100`)
- `status` (اختياري) — أي `OrderStatus` (مثل: `DELIVERED`)
- `from` (اختياري) — تاريخ ISO لفلترة حسب `createdAt >= from`
- `to` (اختياري) — تاريخ ISO لفلترة حسب `createdAt <= to`

#### Response (200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "order-id",
        "orderNumber": "ORD-2025-0001",
        "status": "DELIVERED",
        "customerName": "العميل",
        "customerPhone": "+9665...",
        "area": "الرياض",
        "amount": "100.00",
        "cashCollection": "0.00",
        "store": {
          "id": "store-id",
          "name": "متجر تجريبي",
          "area": "الرياض — الشمال"
        },
        "createdAt": "2025-01-01T12:00:00.000Z",
        "updatedAt": "2025-01-01T12:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### 5.5 ملخص الأرباح (Earnings Summary)

- **Method**: `GET`
- **URL**: `/api/v1/mobile/captain/earnings/summary`
- **Auth required**: نعم (CAPTAIN)

#### Query Params

- `from` (اختياري) — تاريخ ISO، يطبَّق على `updatedAt >= from`
- `to` (اختياري) — تاريخ ISO، يطبَّق على `updatedAt <= to`

> يتم احتساب الربح من الطلبات:
> - `status = DELIVERED`
> - `assignedCaptainId = الكابتن الحالي`

#### Response (200)

```json
{
  "success": true,
  "data": {
    "deliveredCount": 12,
    "totalAmount": "1200.00",
    "totalCashCollection": "800.00"
  }
}
```

---

## 6. تتبع الموقع (Location Tracking)

### 6.1 تحديث موقع الكابتن

> هذه المسار موجود أيضًا في الـ API العام تحت `/api/v1/tracking/me/location`، ولكن هنا موثّق من منظور الموبايل.

- **Method**: `POST`
- **URL**: `/api/v1/mobile/captain/me/location`
- **Auth required**: نعم (CAPTAIN)

#### Request Body

```json
{
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "location-id",
    "captainId": "captain-id",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "recordedAt": "2025-01-01T12:34:56.000Z"
  }
}
```

#### Error Cases

- `404 NOT_FOUND` — لا يوجد ملف كابتن.
- `400 VALIDATION_ERROR` — الإحداثيات غير صحيحة.

---

## 7. Socket.IO — أحداث الكابتن

### 7.1 الاتصال (Connection)

- **Endpoint**: نفس الدومين الخاص بالـ API، مثال:
  - `ws://localhost:4000/socket.io` (يتعامل معه Socket.IO client تلقائيًا)
- **المصادقة**:
  - يجب إرسال الـ Access Token في `auth` أو كـ Query:

#### مثال React Native / JavaScript

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  auth: {
    token: "JWT_ACCESS_TOKEN"
  }
});
```

إذا كان الدور `CAPTAIN`، سيتم إضافة المستخدم تلقائيًا إلى الغرفة:

- `captain:<userId>`

---

### 7.2 أحداث الكابتن (Captain Events)

أسماء الأحداث معرّفة في السيرفر في `CAPTAIN_SOCKET_EVENTS`، وتُرسل دومًا إلى غرفة `captain:<userId>`.

#### 7.2.1 حدث عرض/تعيين طلب جديد

- **Event name**: `captain:assignment`
- **متى يُرسل؟**
  - عند:
    - عرض طلب على الكابتن (AUTO أو MANUAL أو DRAG_DROP).
    - إعادة تعيين الطلب إلى الكابتن.
- **Payload Example**

```json
{
  "kind": "OFFER" | "REASSIGNED",
  "orderId": "order-id",
  "orderNumber": "ORD-2025-0001",
  "status": "ASSIGNED",
  "timeoutSeconds": 30
}
```

#### 7.2.2 انتهاء العرض (رفض / انتهاء مهلة / إلغاء)

- **Event name**: `captain:assignment:ended`
- **متى يُرسل؟**
  - بعد أن يرفض الكابتن، أو ينتهي وقت العرض، أو يُلغى العرض بسبب قبول كابتن آخر أو إعادة تعيين.
- **Payload Example**

```json
{
  "orderId": "order-id",
  "reason": "REJECTED" | "EXPIRED" | "CANCELLED"
}
```

> ملاحظة: في حالة الرفض عبر API، يتم إرسال `reason = "REJECTED"`. في حالات المهلة/الإلغاء قد يستخدم النظام قيمًا أخرى مثل `"EXPIRED"` أو `"CANCELLED"` حسب منطق التوزيع.

#### 7.2.3 تحديث حالة الطلب

- **Event name**: `captain:order:updated`
- **متى يُرسل؟**
  - عند تغيير حالة الطلب من قبل النظام أو جهة أخرى (مثلاً من لوحة التوزيع أو المتجر)، إذا كان الكابتن معيَّنًا على الطلب.
- **Payload Example**

```json
{
  "orderId": "order-id",
  "orderNumber": "ORD-2025-0001",
  "status": "ACCEPTED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "PENDING" | "ASSIGNED"
}
```

---

## 8. ملخص تدفق الحالة للكابتن (Status Flow)

### 8.1 من منظور الكابتن

1. **استقبال عرض**:
   - Socket event: `captain:assignment` مع `kind = "OFFER"` أو `"REASSIGNED"`.
   - يمكن قراءة التفاصيل من `GET /me/assignment`.

2. **قبول عرض**:
   - `POST /orders/:orderId/accept`
   - حالة الطلب تنتقل إلى `ACCEPTED`.
   - يمكن أن يستقبل تحديثًا عبر `captain:order:updated`.

3. **تقدم في الرحلة**:
   - `PATCH /orders/:orderId/status`:
     - من `ACCEPTED` → `PICKED_UP`
     - من `PICKED_UP` → `IN_TRANSIT`
     - من `IN_TRANSIT` → `DELIVERED`

4. **رفض عرض**:
   - `POST /orders/:orderId/reject`
   - Socket event: `captain:assignment:ended` مع `reason = "REJECTED"`.

5. **تتبع الموقع**:
   - استدعاء دوري لـ `POST /me/location` مع إحداثيات GPS.
   - هذه الإحداثيات تظهر في Dashboard وتُرسل إلى لوحة التوزيع عبر Socket.

---

## 9. الإشعارات داخل التطبيق (Notifications)

مسارات الإشعارات **ليست** تحت `/mobile/captain`؛ تستخدم نفس الـ JWT:

| Method | URL | ملاحظات |
|--------|-----|---------|
| `GET` | `/api/v1/notifications` | `page`, `pageSize`, `isRead` (اختياري) |
| `PATCH` | `/api/v1/notifications/:id/read` | تعليم إشعار كمقروء |
| `POST` | `/api/v1/notifications/read-all` | تعليم الكل كمقروء |

الاستجابة بنفس غلاف `{ success, data }`.

---

## 10. مراجعة مطوّر موبايل (ملخص)

| الموضوع | التقييم |
|---------|---------|
| **Endpoints كافية؟** | نعم: مصادقة، ملف، تعيين حالي، **تفاصيل طلب**، قبول/رفض، تحديث حالة التسليم، **توفر**، موقع، تاريخ، أرباح؛ الإشعارات عبر `/api/v1/notifications`. |
| **أسماء الحقول** | ثابتة في الـ DTO؛ المبالغ كنص عشري؛ التواريخ ISO 8601. |
| **Responses للموبايل** | مناسبة: JSON + `pagination` للقوائم. |
| **أخطاء واضحة؟** | نعم: `success: false` + `error.code` + `message` (+ `details` للتحقق). |
| **Socket كافٍ؟** | لعروض التوزيع عبر `distributionService`: `captain:assignment`, `captain:order:updated`, `captain:assignment:ended`. **ملاحظة:** مسار انتهاء المهلة الدوري قد لا يبث عرضًا جديدًا عبر Socket — استخدم `GET /me/assignment` كنسخة احتياطية؛ راجع `docs/captain-order-lifecycle.md`. |

