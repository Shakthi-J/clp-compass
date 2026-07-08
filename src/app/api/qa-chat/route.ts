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

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Two models so we stay under the per-minute token limit:
const MODEL_FAST = 'openai/gpt-oss-20b';    // summaries / drafting — lighter load
const MODEL_CHAT = 'openai/gpt-oss-20b';    // discussion — keep on 20b for free-tier headroom

// Rough token budget for the transcript we send. ~1 token ≈ 4 chars.
// Keep well under the 8k TPM limit once the prompt + reply are added.
const MAX_TRANSCRIPT_CHARS = 16000; // ~4,000 tokens

// Trim a transcript to a safe size. Keeps the start (where concerns/history are
// stated) and the end (where plan/next-steps usually land), dropping the middle.
function trimTranscript(t: string): string {
  if (!t) return '';
  if (t.length <= MAX_TRANSCRIPT_CHARS) return t;
  const head = t.slice(0, Math.floor(MAX_TRANSCRIPT_CHARS * 0.7));
  const tail = t.slice(-Math.floor(MAX_TRANSCRIPT_CHARS * 0.3));
  return `${head}\n\n…[middle of transcript trimmed to fit free-tier limit]…\n\n${tail}`;
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
  const status = err?.status || 500;
  if (status === 413 || err?.error?.error?.code === 'rate_limit_exceeded') {
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
    const transcript = trimTranscript(body.transcript || '');

    if (mode === 'summary') {
      try {
        const completion = await groq.chat.completions.create({
          model: MODEL_FAST,
          temperature: 0.4,
          max_tokens: 700,
          messages: [
            {
              role: 'system',
              content: `${baseIdentity(patientName)}

TASK: Read the consultation transcript. Return STRICT JSON only, no markdown:
{
  "summary": "3-4 sentence clinical summary of ${patientName}'s main concerns and relevant findings, third person",
  "starters": ["3 to 4 specific discussion angles a coaching team should explore to build ${patientName}'s plan — phrased as case-discussion prompts, not questions to the patient"]
}`,
            },
            { role: 'user', content: `Transcript:\n\n${transcript}` },
          ],
        });
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
        // If parsing failed entirely, fall back to plain text (still not raw JSON braces).
        if (!summary && !starters.length) {
          summary = raw.replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
        }
        return Response.json({ summary, starters });
      } catch (err) { return friendlyError(err); }
    }

    if (mode === 'chat') {
      try {
        // Keep only the last ~8 turns so the running context stays under budget.
        const trimmedMessages = messages.slice(-8);
        const completion = await groq.chat.completions.create({
          model: MODEL_CHAT,
          temperature: 0.6,
          max_tokens: 350, // keep replies short & conversational, not essays
          messages: [
            { role: 'system', content: `${baseIdentity(patientName)}\n\nConsultation transcript (may be trimmed):\n\n${transcript}` },
            ...trimmedMessages,
          ],
        });
        return Response.json({ reply: completion.choices[0]?.message?.content || '' });
      } catch (err) { return friendlyError(err); }
    }

    if (mode === 'draft') {
      try {
        const completion = await groq.chat.completions.create({
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
        });
        return Response.json({ instructions: completion.choices[0]?.message?.content || '' });
      } catch (err) { return friendlyError(err); }
    }

    return Response.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('qa-chat error:', err);
    return friendlyError(err);
  }
}