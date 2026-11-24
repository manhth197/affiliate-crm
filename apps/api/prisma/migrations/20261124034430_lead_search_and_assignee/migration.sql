-- Accent-insensitive lead search (contract v0.3) and LeadActivity.assignee.

-- AlterTable
ALTER TABLE "lead_activities" ADD COLUMN     "assignee_id" UUID;

-- customer_name_search is maintained by the API (see src/common/search-text.ts).
-- Add it as nullable, backfill existing rows with the same rule in SQL
-- (lower-case + strip Vietnamese diacritics), then make it NOT NULL.
ALTER TABLE "leads" ADD COLUMN     "customer_name_search" TEXT;
UPDATE "leads" SET "customer_name_search" = translate(lower("customer_name"),
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd');
ALTER TABLE "leads" ALTER COLUMN "customer_name_search" SET NOT NULL;

-- Before this migration the assignee's name was stored in note on ASSIGNED
-- entries; link it to the user when the name is unambiguous.
UPDATE "lead_activities" a
SET "assignee_id" = u."id", "note" = NULL
FROM "users" u
WHERE a."type" = 'ASSIGNED' AND a."assignee_id" IS NULL AND u."full_name" = a."note"
  AND (SELECT count(*) FROM "users" x WHERE x."full_name" = a."note") = 1;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
