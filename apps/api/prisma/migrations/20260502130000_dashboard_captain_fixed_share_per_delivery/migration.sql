-- Fixed captain net share per delivery (ILS) — used with delivery fee to compute captain balance deduction.
ALTER TABLE "dashboard_settings" ADD COLUMN "captain_fixed_share_per_delivery" DECIMAL(12,2) NOT NULL DEFAULT 10;
