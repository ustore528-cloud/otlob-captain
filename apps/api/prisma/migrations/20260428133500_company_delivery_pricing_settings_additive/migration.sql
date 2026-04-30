-- Delivery pricing settings per company (additive)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryPricingMode') THEN
    CREATE TYPE "DeliveryPricingMode" AS ENUM ('FIXED', 'DISTANCE_BASED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryFeeRoundingMode') THEN
    CREATE TYPE "DeliveryFeeRoundingMode" AS ENUM ('CEIL', 'ROUND', 'NONE');
  END IF;
END $$;

ALTER TABLE "delivery_settings"
ADD COLUMN "delivery_pricing_mode" "DeliveryPricingMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "fixed_delivery_fee" DECIMAL(12,2),
ADD COLUMN "base_delivery_fee" DECIMAL(12,2),
ADD COLUMN "price_per_km" DECIMAL(12,2),
ADD COLUMN "delivery_fee_rounding_mode" "DeliveryFeeRoundingMode" NOT NULL DEFAULT 'CEIL';
