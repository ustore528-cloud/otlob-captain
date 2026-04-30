INSERT INTO delivery_settings (
  id,
  company_id,
  delivery_pricing_mode,
  fixed_delivery_fee,
  base_delivery_fee,
  price_per_km,
  delivery_fee_rounding_mode,
  default_delivery_fee,
  created_at,
  updated_at
)
SELECT
  'ds_' || REPLACE(c.id, '-', ''),
  c.id,
  'FIXED',
  15,
  NULL,
  NULL,
  'CEIL',
  15,
  NOW(),
  NOW()
FROM companies c
WHERE c.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM delivery_settings ds WHERE ds.company_id = c.id
  );

UPDATE delivery_settings
SET delivery_pricing_mode = 'FIXED'
WHERE delivery_pricing_mode IS NULL;

UPDATE delivery_settings
SET delivery_fee_rounding_mode = 'CEIL'
WHERE delivery_fee_rounding_mode IS NULL;

UPDATE delivery_settings
SET fixed_delivery_fee = COALESCE(fixed_delivery_fee, default_delivery_fee, 15)
WHERE delivery_pricing_mode = 'FIXED' AND fixed_delivery_fee IS NULL;

UPDATE delivery_settings
SET base_delivery_fee = COALESCE(base_delivery_fee, default_delivery_fee, 15)
WHERE delivery_pricing_mode = 'DISTANCE_BASED' AND base_delivery_fee IS NULL;

UPDATE delivery_settings
SET price_per_km = COALESCE(price_per_km, 3)
WHERE delivery_pricing_mode = 'DISTANCE_BASED' AND price_per_km IS NULL;
