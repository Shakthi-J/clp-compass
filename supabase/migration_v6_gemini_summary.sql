-- Gemini also auto-generates its own meeting-summary doc (separate from the
-- full transcript in gemini_doc_raw). We store it so the case summary can
-- merge both sources instead of just repeating what Gemini already noted.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gemini_summary_raw TEXT;
