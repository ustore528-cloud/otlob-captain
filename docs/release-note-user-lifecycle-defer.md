# Release Note — Deferred User Lifecycle Scope

For this release checkpoint, the following user lifecycle features are explicitly deferred:

1. Generic edit user profile (name / phone / email) for all roles.
2. Role reassignment for existing users.

## Rationale

- Current release blocker phase focuses on production safety and operator clarity.
- UI has been aligned to avoid exposing unsupported create-user actions to unauthorized roles.
- No partial UI for role reassignment is shown, to prevent false expectations.

## Current supported user lifecycle in this release

- Create user (`SUPER_ADMIN` only).
- Toggle user active/inactive (authorized roles only).
- Customer profile update flow (authorized operator roles only, customer role target only).

## Post-release follow-up (separate scope)

- Add audited APIs + UI for safe user profile edit and role reassignment.
- Include role-change audit logging and tenant-scope constraints in that phase.
