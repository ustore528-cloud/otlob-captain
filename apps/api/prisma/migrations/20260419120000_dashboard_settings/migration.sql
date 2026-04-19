-- Singleton row for admin dashboard configuration (map defaults, etc.)
CREATE TABLE "dashboard_settings" (
    "id" TEXT NOT NULL,
    "map_country" VARCHAR(160),
    "map_city_region" VARCHAR(200),
    "map_default_lat" DOUBLE PRECISION,
    "map_default_lng" DOUBLE PRECISION,
    "map_default_zoom" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "dashboard_settings" ("id", "map_country", "map_city_region", "map_default_lat", "map_default_lng", "map_default_zoom", "updated_at")
VALUES ('default', NULL, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP);
