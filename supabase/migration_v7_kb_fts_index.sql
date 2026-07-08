-- The case-discussion chat's keyword-search fallback (used whenever HF vector
-- search is unavailable, e.g. it can't reach the embeddings API) was calling
-- .textSearch() on kb_chunks.content with no supporting index — Postgres was
-- computing to_tsvector(content) fresh for every row on every query, a full
-- sequential scan that measured 3.5s-43s+ depending on load. This index lets
-- Postgres use the precomputed tsvector instead, which should bring keyword
-- search down to milliseconds.
CREATE INDEX IF NOT EXISTS kb_chunks_content_fts_idx
  ON kb_chunks USING GIN (to_tsvector('english', content));
