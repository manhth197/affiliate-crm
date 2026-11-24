# 005 — API: accent-insensitive lead search with a normalised column

## Context
Vietnamese names carry diacritics ("Nguyễn Đức Mạnh"). Staff often type without them ("nguyen duc manh"), so contract v0.3 requires `q` on `GET /leads` to be case- and accent-insensitive. A plain `ILIKE '%nguyen%'` does not match "Nguyễn".

## Decision
- Store a second column, `leads.customer_name_search`, holding the name lower-cased with diacritics removed. The API fills it on insert with `toSearchText()` (`src/common/search-text.ts`): `toLowerCase()` → Unicode NFD (splits "ễ" into "e" + combining marks) → remove marks U+0300–U+036F → map "đ" to "d" (it has no decomposition).
- The query normalises `q` the same way and uses `customer_name_search LIKE '%…%'` through normal Prisma filters.
- The migration that adds the column backfills existing rows with the same rule in SQL (`translate(lower(name), 'àá…đ', 'aa…d')`), then sets `NOT NULL`.

## Alternatives
- Postgres `unaccent` extension in the query: needs raw SQL for every search (Prisma filters cannot call functions) and an `IMMUTABLE` wrapper to be indexable.
- A generated column `GENERATED ALWAYS AS (unaccent(...))`: `unaccent` is not immutable, and Prisma cannot model generated columns, so later migrations would fight it.
- Full-text search (`tsvector`): better ranking for long text, overkill for short names.

## Consequences
- Every write path that sets `customerName` must also set `customerNameSearch` (today only lead creation; names are not editable).
- `LIKE '%x%'` cannot use a B-tree index. Fine at this scale (thousands of leads); if needed, add a `pg_trgm` GIN index on the column without changing the code.
