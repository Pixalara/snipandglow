-- =============================================================================
-- Migration 036: Title-case existing names (one-time data cleanup)
--
-- Capitalizes the FIRST letter of each word for existing names so old records
-- match the new auto-formatting applied on create/update in the app. Only the
-- first letter of each word is changed — the rest is left as-is so acronyms and
-- brand casing (e.g. "JK Salon", "L'Oreal") are preserved, not mangled.
--
-- Safe / idempotent: only rows whose value actually changes are updated.
-- A temporary helper function is created and dropped at the end.
-- =============================================================================

CREATE OR REPLACE FUNCTION sg_cap_words(txt text) RETURNS text AS $$
  SELECT CASE
    WHEN txt IS NULL OR btrim(txt) = '' THEN txt
    ELSE (
      SELECT string_agg(
        CASE WHEN w = '' THEN w ELSE upper(left(w, 1)) || substr(w, 2) END,
        ' ' ORDER BY ord
      )
      FROM regexp_split_to_table(regexp_replace(btrim(txt), '\s+', ' ', 'g'), ' ')
        WITH ORDINALITY AS t(w, ord)
    )
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Customers
UPDATE customers SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);

-- Services
UPDATE services SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);
UPDATE services SET category = sg_cap_words(category)
  WHERE category IS DISTINCT FROM sg_cap_words(category);

-- Products (migration 034)
UPDATE products SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);
UPDATE products SET category = sg_cap_words(category)
  WHERE category IS DISTINCT FROM sg_cap_words(category);
UPDATE products SET brand = sg_cap_words(brand)
  WHERE brand IS DISTINCT FROM sg_cap_words(brand);

-- Tenants (salon + owner)
UPDATE tenants SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);
UPDATE tenants SET owner_name = sg_cap_words(owner_name)
  WHERE owner_name IS DISTINCT FROM sg_cap_words(owner_name);

-- Branches
UPDATE branches SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);

-- Employees / staff
UPDATE employees SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);

-- Leads
UPDATE leads SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);

-- Membership plans
UPDATE memberships SET name = sg_cap_words(name)
  WHERE name IS DISTINCT FROM sg_cap_words(name);

DROP FUNCTION sg_cap_words(text);
