// src/app/api/qa-chat/route.ts
//
// Single clinical-discussion endpoint (coach-to-coach, never patient-facing).
// Modes: summary | chat | draft.
//
// FREE-TIER SAFE: Groq's free tier caps at 8,000 tokens/minute. Long consultation
// transcripts (10k+ tokens) blow past that, so we (a) trim the transcript to a
// safe budget before sending, and (b) return a clear message if we still hit 413.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Without this, Vercel defaults to a 10s function timeout — fine for a single
// Groq call, but chat mode now also does an HF embedding call + Supabase
// lookups before that, which can tip past 10s and get killed mid-request.
export const maxDuration = 60;

import Groq from 'groq-sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { embedText } from '@/lib/embeddings';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const STOP_WORDS = new Set(['the', 'patient', 'is', 'are', 'was', 'with', 'and', 'has', 'have', 'been', 'their', 'they', 'this', 'that', 'from', 'for', 'not', 'but', 'can', 'also', 'more', 'very', 'some', 'into', 'over', 'after', 'what', 'when', 'how', 'why', 'about', 'should', 'would', 'could']);

type KbSource = { title: string; source_type: string };

// Grounds each chat turn in the clinical knowledge base (kb_documents/kb_chunks).
// Vector search first (needs HUGGINGFACE_API_KEY for embeddings), falls back to
// Postgres full-text search on keywords so retrieval still works without it.
// Returns both the context to feed the model AND the sources to show the coach —
// that second part is what lets the UI prove an answer was actually RAG-grounded.
async function retrieveKbContext(queryText: string): Promise<{ kbContext: string; sources: KbSource[] }> {
  const empty = { kbContext: '', sources: [] as KbSource[] };
  if (!queryText.trim()) return empty;

  const t0 = Date.now();
  try {
    let chunks: { content: string; document_id: string }[] = [];

    const embedding = await embedText(queryText.slice(0, 512));
    console.log(`[KB timing] embedText: ${Date.now() - t0}ms`);
    if (embedding && embedding.length === 384) {
      const tRpc = Date.now();
      const { data } = await supabaseAdmin.rpc('match_kb_chunks', {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 6,
      });
      console.log(`[KB timing] match_kb_chunks rpc: ${Date.now() - tRpc}ms`);
      if (data?.length) chunks = data;
    }

    if (!chunks.length) {
      // Without embeddings this is a blunt instrument, so favor precision over
      // recall: AND together the 3 most specific (longest) keywords rather than
      // OR-ing everything — an OR of generic words like "mechanism"/"therapy"
      // pulls in unrelated books (e.g. a habits book) as false "grounding".
      const keywords = [...new Set(
        queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
          .filter((w) => w.length > 4 && !STOP_WORDS.has(w))
      )]
        .sort((a, b) => b.length - a.length)
        .slice(0, 3);

      if (keywords.length >= 2) {
        const tKw = Date.now();
        const { data, error } = await supabaseAdmin
          .from('kb_chunks').select('content, document_id')
          .textSearch('content', keywords.join(' '), { type: 'plain', config: 'english' })
          .limit(6);
        console.log(`[KB timing] keyword textSearch: ${Date.now() - tKw}ms`);
        if (error) console.error('KB keyword search error:', error.message);
        if (data?.length) chunks = data;
      }
    }

    if (!chunks.length) { console.log(`[KB timing] total (no chunks): ${Date.now() - t0}ms`); return empty; }

    const tDocs = Date.now();
    const docIds = [...new Set(chunks.map((c) => c.document_id))];
    const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds);
    console.log(`[KB timing] kb_documents lookup: ${Date.now() - tDocs}ms`);
    const docMap = Object.fromEntries((docs ?? []).map((d: { id: string; title: string; source_type: string }) => [d.id, d]));

    const kbContext = chunks.map((c, i) => `[KB ${i + 1}]: ${c.content.slice(0, 350)}`).join('\n\n');
    const sources: KbSource[] = docIds.map((id) => ({
      title: docMap[id]?.title ?? 'Unknown source',
      source_type: docMap[id]?.source_type ?? 'unknown',
    }));

    console.log(`[KB timing] total: ${Date.now() - t0}ms`);
    return { kbContext, sources };
  } catch (err) {
    console.error('KB retrieval error:', err instanceof Error ? err.message : err, `(after ${Date.now() - t0}ms)`);
    return empty; // retrieval is a bonus, never block the chat reply on it
  }
}

// Two models so we stay under the per-minute token limit:
const MODEL_FAST = 'openai/gpt-oss-20b';    // summaries / drafting — lighter load
const MODEL_CHAT = 'openai/gpt-oss-20b';    // discussion — keep on 20b for free-tier headroom

// Groq's free tier occasionally throws a transient error (brief 5xx/overload)
// that clears up moments later — this was showing up as "could not respond",
// with the coach having to manually resend the exact same message to get a
// reply. Retry once with a short backoff before giving up.
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 800): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      console.error(`Groq call failed (attempt ${attempt + 1}/${retries + 1}), retrying:`, err instanceof Error ? err.message : err);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Rough token budget for the transcript we send. ~1 token ≈ 4 chars.
// Keep well under the 8k TPM limit once the prompt + reply are added.
const MAX_TRANSCRIPT_CHARS = 16000; // ~4,000 tokens
// Gemini's own meeting-summary doc is a secondary reference, not the ground
// truth — give it a smaller budget so it can't crowd out the real transcript.
const MAX_GEMINI_SUMMARY_CHARS = 6000; // ~1,500 tokens

// Trim text to a safe size. Keeps the start (where concerns/history are
// stated) and the end (where plan/next-steps usually land), dropping the middle.
function trimToBudget(t: string, maxChars: number): string {
  if (!t) return '';
  if (t.length <= maxChars) return t;
  const head = t.slice(0, Math.floor(maxChars * 0.7));
  const tail = t.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n\n…[middle trimmed to fit free-tier limit]…\n\n${tail}`;
}

function baseIdentity(patientName: string) {
  return `You are a senior functional-medicine nutritionist at Clinic Living Plus (CLP), talking through a patient case with a fellow coach — like two colleagues thinking out loud together.

The patient is "${patientName}". Always speak ABOUT the patient in the third person ("${patientName} reports…", "her glucose…"). NEVER address the patient ("what is your…") — you are talking to a coach, not the patient.

HOW TO REPLY — this matters most:
- Keep it SHORT and conversational — a few plain sentences, like you're chatting, not writing a report.
- Raise ONE point or idea at a time. Do not dump everything at once.
- After making your point, ASK the coach what they think, or offer a next angle to explore — e.g. "Want me to go deeper on that?" or "Does that match what you're seeing with her?"
- NO tables. NO markdown tables ever. NO long numbered protocols. NO drug dosing charts unless the coach explicitly asks for specifics.
- Plain language. If you use a mechanism, explain it in one short sentence.
- Be a real thinking partner: if the coach's idea has a gap or risk, say so gently and why — then suggest how to adjust. Don't just agree.
- Only go deep or give a full protocol when the coach directly asks for it. Otherwise, keep the conversation flowing one step at a time.`;
}

function friendlyError(err: any) {
  console.error('qa-chat request failed:', err?.message || err, err?.error ?? '');
  const status = err?.status || 500;
  if (status === 413 || status === 429 || err?.error?.error?.code === 'rate_limit_exceeded') {
    return Response.json(
      { error: 'This transcript is long for the free tier. It has been trimmed automatically — if this keeps happening, wait a minute and retry, or shorten the transcript.' },
      { status: 200 } // return 200 so the UI shows the message instead of a hard failure
    );
  }
  return Response.json({ error: 'The clinical co-pilot could not respond. Try again.' }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, patientName = 'the patient', messages = [] } = body;
    const transcript = trimToBudget(body.transcript || '', MAX_TRANSCRIPT_CHARS);
    const geminiSummary = trimToBudget(body.geminiSummary || '', MAX_GEMINI_SUMMARY_CHARS);
    // Gemini's summary is a secondary reference the model cross-checks against the
    // transcript — never trust it alone, and never just restate it.
    const geminiSummaryBlock = geminiSummary
      ? `\n\nGemini's own auto-generated meeting summary (secondary reference — may be incomplete or miss things; cross-check against the transcript above, don't just restate it):\n\n${geminiSummary}`
      : '';

    if (mode === 'summary') {
      try {
        const completion = await withRetry(() => groq.chat.completions.create({
          model: MODEL_FAST,
          temperature: 0.4,
          max_tokens: 1024, // was 700 — too tight for summary + 3-4 starters, caused JSON truncation
          response_format: { type: 'json_object' }, // forces valid, closed JSON instead of prose-wrapped output
          messages: [
            {
              role: 'system',
              content: `${baseIdentity(patientName)}

TASK: You have the full transcript (ground truth) and, if provided, Gemini's own
auto-generated meeting summary (a secondary reference that may be incomplete or
miss things). Cross-check the two: build ONE clean, complete clinical summary
covering every relevant point from the transcript — don't just restate Gemini's
summary, and don't repeat the same point twice. If Gemini's summary is missing
something the transcript covers, fold it in; if Gemini's summary already says
something correctly, don't say it again in different words.

Return STRICT JSON only, no markdown:
{
  "summary": "3-4 sentence clinical summary of ${patientName}'s main concerns and relevant findings, third person",
  "starters": ["3 to 4 specific discussion angles a coaching team should explore to build ${patientName}'s plan — phrased as case-discussion prompts, not questions to the patient"]
}`,
            },
            { role: 'user', content: `Transcript:\n\n${transcript}${geminiSummaryBlock}` },
          ],
        }));
        const raw = completion.choices[0]?.message?.content || '{}';
        let parsed: { summary?: string; starters?: string[] } = {};
        // Robustly pull JSON out even if the model wraps it in prose or ``` fences.
        try {
          const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const match = clean.match(/\{[\s\S]*\}/); // grab the first {...} block
          parsed = JSON.parse(match ? match[0] : clean);
        } catch {
          parsed = {};
        }
        // Guarantee clean shapes — never return raw JSON as the summary text.
        let summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        let starters = Array.isArray(parsed.starters)
          ? parsed.starters.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
          : [];
        // If parsing failed entirely, say so — don't leak the mangled JSON as if it were the summary.
        if (!summary && !starters.length) {
          return Response.json({ error: 'The case summary could not be parsed. Tap retry to regenerate.' });
        }
        return Response.json({ summary, starters });
      } catch (err) { return friendlyError(err); }
    }

    if (mode === 'chat') {
      try {
        // Keep only the last ~8 turns so the running context stays under budget.
        // Strip everything but role/content — the client attaches a "sources"
        // field to assistant messages (for the "Grounded in:" UI), and Groq's
        // API does strict schema validation that 400s on any unrecognized
        // property, permanently breaking every request once one such message
        // enters the conversation history.
        const trimmedMessages = messages.slice(-8).map((m: any) => ({ role: m.role, content: m.content }));
        const latestQuestion = [...trimmedMessages].reverse().find((m: any) => m.role === 'user')?.content || '';
        // KB retrieval is a bonus, not a dependency — under DB load the unindexed
        // fallback path has been observed taking 3.5s-43s+, which must never be
        // allowed to block the actual reply. Race it against a hard cutoff.
        const kbTimeout = new Promise<{ kbContext: string; sources: KbSource[] }>((resolve) =>
          setTimeout(() => resolve({ kbContext: '', sources: [] }), 5000)
        );
        const { kbContext, sources } = await Promise.race([retrieveKbContext(latestQuestion), kbTimeout]);
        const kbBlock = kbContext
          ? `\n\nRelevant excerpts from the clinical knowledge base (use only if actually relevant to the coach's question — don't force it in):\n\n${kbContext}`
          : '';

        const completion = await withRetry(() => groq.chat.completions.create({
          model: MODEL_CHAT,
          temperature: 0.6,
          max_tokens: 350, // keep replies short & conversational, not essays
          messages: [
            { role: 'system', content: `${baseIdentity(patientName)}\n\nConsultation transcript (may be trimmed):\n\n${transcript}${geminiSummaryBlock}${kbBlock}` },
            ...trimmedMessages,
          ],
        }));
        return Response.json({ reply: completion.choices[0]?.message?.content || '', sources });
      } catch (err) { return friendlyError(err); }
    }

    if (mode === 'draft') {
      try {
        const completion = await withRetry(() => groq.chat.completions.create({
          model: MODEL_FAST,
          temperature: 0.3,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content: `${baseIdentity(patientName)}

TASK: Condense the discussion below into clear ROADMAP INSTRUCTIONS for ${patientName} — focus areas, priorities, constraints, and emphasis for the roadmap generator. Directive bullet points, no preamble.`,
            },
            { role: 'user', content: `Discussion:\n\n${messages.slice(-10).map((m: any) => `${m.role === 'user' ? 'Coach' : 'Co-pilot'}: ${m.content}`).join('\n\n')}` },
          ],
        }));
        return Response.json({ instructions: completion.choices[0]?.message?.content || '' });
      } catch (err) { return friendlyError(err); }
    }

    return Response.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('qa-chat error:', err);
    return friendlyError(err);
  }
}