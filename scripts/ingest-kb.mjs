// One-off local script to bulk-ingest scraped websites + YouTube transcripts
// into the kb_documents/kb_chunks knowledge base. NOT part of the deployed
// app — run manually from your machine:
//
//   node scripts/ingest-kb.mjs
//
// Requires migration_v8_kb_bulk_ingest.sql to already be applied (adds the
// 'website'/'youtube' source types and the source_url column used here for
// dedup). Safe to stop (Ctrl+C) and re-run later — anything already in the
// DB (matched by source_url) is skipped, so partial progress isn't lost.
//
// Embeddings run LOCALLY via @xenova/transformers (same all-MiniLM-L6-v2
// model already used elsewhere in this project), not the remote Hugging
// Face API — no network flakiness, no rate limits, just CPU time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local (this script runs outside Next.js, so nothing loads it for us) ──
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Config ──
const SCRAPE_DIR = 'D:/Nutritionalist/nutritionfacts/nutrition_scraper/scarping';
const CHUNK_WORDS = 400;
const CHUNK_OVERLAP = 60;
const EMBED_BATCH_SIZE = 16;
const OEMBED_DELAY_MS = 250;
// Optional cap for validation runs, e.g. `TEST_LIMIT=5 node scripts/ingest-kb.mjs`
// — processes at most this many items per source before moving to the next.
// Leave unset for the real full run.
const TEST_LIMIT = process.env.TEST_LIMIT ? parseInt(process.env.TEST_LIMIT, 10) : Infinity;

function chunkText(text, chunkSize = CHUNK_WORDS, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    if (i + chunkSize >= words.length) break;
  }
  return chunks.length ? chunks : [text];
}

// Falls back to a readable title derived from the URL when the scraped
// title is missing or the scraper's generic "Untitled Node" placeholder.
function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    return slug
      .replace(/\.\w+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || u.hostname;
  } catch {
    return url;
  }
}

// ── Local embeddings ──
let embedderPromise = null;
function getEmbedder() {
  if (!embedderPromise) embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return embedderPromise;
}

async function embedBatch(texts) {
  const model = await getEmbedder();
  const output = await model(texts, { pooling: 'mean', normalize: true });
  const dim = output.dims[output.dims.length - 1];
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)));
  }
  return vectors;
}

// ── Dedup: load every already-ingested source_url once, check in-memory ──
async function loadIngestedUrls() {
  const urls = new Set();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('kb_documents').select('source_url')
      .not('source_url', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`loadIngestedUrls: ${error.message}`);
    for (const row of data) urls.add(row.source_url);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return urls;
}

async function ingestDocument({ title, sourceUrl, sourceType, content, tags = [] }) {
  content = content.replace(/\s+/g, ' ').trim();
  if (content.length < 50) return { skipped: 'too short' };

  const { data: doc, error: docErr } = await supabase
    .from('kb_documents')
    .insert({ title, source_type: sourceType, content, tags, source_url: sourceUrl })
    .select('id').single();
  if (docErr) return { error: docErr.message };

  const chunks = chunkText(content);
  const chunkRows = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedBatch(batch);
    batch.forEach((c, j) => {
      chunkRows.push({ document_id: doc.id, chunk_index: i + j, content: c, embedding: `[${vectors[j].join(',')}]` });
    });
  }
  const { error: chunkErr } = await supabase.from('kb_chunks').insert(chunkRows);
  if (chunkErr) return { error: `chunks: ${chunkErr.message}` };
  return { chunks: chunks.length };
}

async function ingestJsonFile(filePath, sourceType, seenUrls, counters) {
  const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\n=== ${path.basename(filePath)}: ${items.length} items ===`);
  let ingestedThisFile = 0;
  for (const item of items) {
    if (ingestedThisFile >= TEST_LIMIT) { console.log(`  TEST_LIMIT (${TEST_LIMIT}) reached, stopping this file.`); break; }
    counters.total++;
    if (!item.url || seenUrls.has(item.url)) { counters.skipped++; continue; }
    const title = (!item.title || item.title === 'Untitled Node') ? titleFromUrl(item.url) : item.title;
    const result = await ingestDocument({
      title, sourceUrl: item.url, sourceType, content: item.payload || '',
      tags: item.category ? [item.category] : [],
    });
    seenUrls.add(item.url);
    if (result.error) { counters.errors++; console.error(`  ERROR ${item.url}: ${result.error}`); }
    else if (result.skipped) { counters.skipped++; }
    else { counters.ingested++; ingestedThisFile++; console.log(`  OK "${title}" (${result.chunks} chunks)`); }
    if (counters.total % 50 === 0) {
      console.log(`  ...${counters.total} processed (ingested ${counters.ingested}, skipped ${counters.skipped}, errors ${counters.errors})`);
    }
  }
}

const titleCache = new Map();
async function getYoutubeMeta(videoId) {
  if (titleCache.has(videoId)) return titleCache.get(videoId);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const meta = res.ok ? await res.json() : null;
    const result = { title: meta?.title || videoId, channel: meta?.author_name || null };
    titleCache.set(videoId, result);
    return result;
  } catch {
    return { title: videoId, channel: null };
  }
}

async function ingestYoutubeFolder(folderPath, seenUrls, counters) {
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.txt'));
  console.log(`\n=== YouTube transcripts: ${files.length} files ===`);
  let ingestedThisRun = 0;
  for (const file of files) {
    if (ingestedThisRun >= TEST_LIMIT) { console.log(`  TEST_LIMIT (${TEST_LIMIT}) reached, stopping.`); break; }
    counters.total++;
    const videoId = path.basename(file, '.txt');
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (seenUrls.has(sourceUrl)) { counters.skipped++; continue; }

    const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
    const { title, channel } = await getYoutubeMeta(videoId);
    await new Promise((r) => setTimeout(r, OEMBED_DELAY_MS));

    const result = await ingestDocument({
      title, sourceUrl, sourceType: 'youtube', content, tags: channel ? [channel] : [],
    });
    seenUrls.add(sourceUrl);
    if (result.error) { counters.errors++; console.error(`  ERROR ${videoId}: ${result.error}`); }
    else if (result.skipped) { counters.skipped++; }
    else { counters.ingested++; ingestedThisRun++; console.log(`  OK "${title}" (${result.chunks} chunks)`); }
    if (counters.total % 25 === 0) {
      console.log(`  ...${counters.total}/${files.length} processed (ingested ${counters.ingested}, skipped ${counters.skipped}, errors ${counters.errors})`);
    }
  }
}

async function main() {
  console.log('Loading already-ingested source_urls for dedup...');
  const seenUrls = await loadIngestedUrls();
  console.log(`Found ${seenUrls.size} already ingested — will be skipped.`);

  const counters = { total: 0, ingested: 0, skipped: 0, errors: 0 };

  await ingestJsonFile(path.join(SCRAPE_DIR, 'nutritionfacts.json'), 'website', seenUrls, counters);
  await ingestJsonFile(path.join(SCRAPE_DIR, 'pcrm_complete_database.json'), 'website', seenUrls, counters);
  await ingestYoutubeFolder(SCRAPE_DIR, seenUrls, counters);

  console.log(`\n=== DONE: ${counters.total} processed, ${counters.ingested} ingested, ${counters.skipped} skipped, ${counters.errors} errors ===`);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
