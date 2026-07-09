-- Support for bulk-ingesting scraped websites + YouTube transcripts into the
-- knowledge base:
--   1. source_type only allowed book/podcast/article/gemini-note/guideline —
--      add 'website' and 'youtube' so new content can be categorized properly.
--   2. source_url lets the ingestion script check "have I already imported
--      this one" so bulk imports are safe to re-run/resume as more channels
--      or pages get added later, without creating duplicate documents.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'kb_documents' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%source_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE kb_documents DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE kb_documents ADD CONSTRAINT kb_documents_source_type_check
    CHECK (source_type IN ('book', 'podcast', 'article', 'gemini-note', 'guideline', 'website', 'youtube'));
END $$;

ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE INDEX IF NOT EXISTS kb_documents_source_url_idx ON kb_documents (source_url);
