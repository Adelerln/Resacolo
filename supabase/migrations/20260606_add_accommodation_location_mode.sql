ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS location_mode text,
  ADD COLUMN IF NOT EXISTS itinerant_zone text;

ALTER TABLE accommodations
  DROP CONSTRAINT IF EXISTS accommodations_location_mode_check;

ALTER TABLE accommodations
  ADD CONSTRAINT accommodations_location_mode_check
  CHECK (location_mode IS NULL OR location_mode IN ('france', 'abroad', 'itinerant'));

UPDATE accommodations
SET location_mode = 'itinerant'
WHERE location_mode IS NULL
  AND accommodation_type IS NOT NULL
  AND (
    lower(accommodation_type) = 'mixte'
    OR lower(accommodation_type) LIKE 'mixte|%'
    OR lower(accommodation_type) LIKE 'mixte:%'
  );

UPDATE accommodations
SET itinerant_zone = region_text
WHERE location_mode = 'itinerant'
  AND itinerant_zone IS NULL
  AND region_text IS NOT NULL
  AND trim(region_text) <> '';

UPDATE accommodations
SET location_mode = 'abroad'
WHERE location_mode IS NULL
  AND country IS NOT NULL
  AND lower(trim(country)) NOT IN ('', 'france');

UPDATE accommodations
SET location_mode = 'france'
WHERE location_mode IS NULL
  AND (
    country IS NULL
    OR lower(trim(country)) IN ('', 'france')
    OR city IS NOT NULL
    OR address_text IS NOT NULL
  );
