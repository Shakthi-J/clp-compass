-- ============================================================
-- CLP COMPASS — Day 1 Schema
-- Run this entire file in your Supabase SQL editor
-- ============================================================

-- Enable pgvector for Knowledge Base embeddings (Day 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────
-- 1. PATIENTS
-- ─────────────────────────────────────────
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  medical_history TEXT,
  primary_concern TEXT,
  assigned_nutritionist TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. SESSIONS (one per meeting)
-- ─────────────────────────────────────────
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ DEFAULT NOW(),
  session_type TEXT CHECK (session_type IN ('first-meet', 'follow-up', 'review')) DEFAULT 'first-meet',
  gemini_doc_raw TEXT,            -- pasted Gemini meeting doc
  pre_meeting_notes TEXT,         -- nutritionist writes before meeting
  post_meeting_notes TEXT,        -- nutritionist writes after meeting
  follow_up_notes TEXT,           -- added during next follow-up
  status TEXT CHECK (status IN ('pending', 'notes-added', 'interpreted', 'pdf-ready')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. ROADMAPS (interpretation output)
-- ─────────────────────────────────────────
CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  overview TEXT,                  -- the manifestation board narrative
  lifestyle_guidelines TEXT,
  nutritionist_guidelines TEXT,   -- doctor-facing, clinical tone
  weekly_schedule JSONB,          -- array of WeeklyPlan objects
  duration_months INTEGER DEFAULT 3,
  status TEXT CHECK (status IN ('draft', 'final')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 4. KNOWLEDGE BASE DOCUMENTS
-- ─────────────────────────────────────────
CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('book', 'podcast', 'article', 'gemini-note', 'guideline')),
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 5. KNOWLEDGE BASE CHUNKS (for RAG / pgvector)
-- ─────────────────────────────────────────
CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),         -- text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX ON kb_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────
-- 6. NUTRITIONISTS (coaches)
-- ─────────────────────────────────────────
CREATE TABLE nutritionists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation TEXT,
  bio TEXT,                       -- used in the PDF "coach intro" section
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- RLS — enable but allow all for now (add auth later)
-- ─────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutritionists ENABLE ROW LEVEL SECURITY;

-- Open policies for MVP (lock down with auth in Phase 2)
CREATE POLICY "allow_all_patients" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_roadmaps" ON roadmaps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_kb_documents" ON kb_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_kb_chunks" ON kb_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_nutritionists" ON nutritionists FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- 7. VECTOR SIMILARITY SEARCH FUNCTION (Day 2 ready)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    kb_chunks.id,
    kb_chunks.document_id,
    kb_chunks.content,
    1 - (kb_chunks.embedding <=> query_embedding) AS similarity
  FROM kb_chunks
  WHERE 1 - (kb_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
