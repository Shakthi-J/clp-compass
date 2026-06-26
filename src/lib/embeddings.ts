/* eslint-disable @typescript-eslint/no-explicit-any */
import { pipeline } from '@xenova/transformers'

let embedder: any = null

async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model (first time only — downloads ~25MB)...')
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    console.log('Embedding model ready.')
  }
  return embedder
}

export async function getEmbedding(text: string): Promise<number[]> {
  const results = await getEmbeddings([text])
  return results[0]
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const embed = await getEmbedder()
  const results: number[][] = []

  for (const text of texts) {
    const output = await embed(text, { pooling: 'mean', normalize: true })
    results.push(Array.from(output.data as Float32Array))
  }

  return results
}

export function chunkText(text: string, chunkSize = 400, overlap = 60): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim().length > 50) chunks.push(chunk.trim())
    if (i + chunkSize >= words.length) break
  }

  return chunks
}
