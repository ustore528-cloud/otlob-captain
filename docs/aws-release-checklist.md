# AWS Release Checklist (Critical Path)

## 1) API runtime env (EC2 service/container)

Use values from `apps/api/.env.production.example`:

- `DATABASE_URL` -> your AWS RDS URL
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` -> long random secrets
- `CORS_ORIGIN` -> your web domain

## 2) RDS connectivity

- RDS status is `Available`
- Security group allows PostgreSQL `5432` from API host/network
- API host can connect to RDS endpoint

## 3) Database migrations

From API deployment environment:

```bash
npm run db:migrate:deploy -w @captain/api
```

Optional seed:

```bash
npm run db:seed -w @captain/api
```

## 4) Build and start API

```bash
npm run build -w @captain/api
npm run start:prod -w @captain/api
```

Health check:

```bash
curl https://YOUR_API_DOMAIN/health
```

## 5) Web production env

Set:

- `apps/web/.env.production` from `apps/web/.env.production.example`

Build:

```bash
npm run build -w @captain/web
```

## 6) Mobile production env + APK

Set:

- `apps/captain-mobile/.env` to `EXPO_PUBLIC_API_URL=https://YOUR_API_DOMAIN`

Build APK:

```bash
cd apps/captain-mobile
npx eas-cli build -p android --profile preview
```

