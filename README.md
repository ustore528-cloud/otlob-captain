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

