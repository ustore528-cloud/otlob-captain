## اطلب كابتن — تشغيل محلي

### المتطلبات
- Node.js 20+
- PostgreSQL

### الإعداد
1. انسخ `apps/api/.env.example` إلى `apps/api/.env` وعدّل القيم حسب بيئتك.
2. ثبّت الحزم من الجذر:
   ```bash
   npm install
   ```
3. أنشئ قاعدة البيانات وطبّق المخطط:
   ```bash
   npm run db:push
   ```
4. بيانات تجريبية:
   ```bash
   npm run db:seed
   ```

### التشغيل أثناء التطوير
- من الجذر:
  ```bash
  npm run dev
  ```
  - web: `http://localhost:5173`
  - api: `http://localhost:4000`

### البناء للإنتاج
```bash
npm run build
```

### iOS Push Setup Requirements
- Apple Developer account is required (without it, APNs credentials and iOS signing cannot be completed).
- Configure iOS credentials with EAS:
  ```bash
  cd apps/captain-mobile
  npx eas credentials -p ios
  ```
- Set up APNs key/push credentials during the EAS credentials flow.
- Build iOS production app:
  ```bash
  npx eas build -p ios --profile production
  ```
- Verify in TestFlight:
  1. install build on iPhone
  2. login as captain and allow notifications
  3. open Notifications screen and tap `تفعيل الإشعارات من جديد`
  4. confirm token registration with `platform: ios` and `locale: ar|en|he`
  5. run test push and verify ticket/receipt success
  6. test background/locked-screen live new-order notification delivery

