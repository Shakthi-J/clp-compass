const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2'

async function getEmbeddingHF(text: string): Promise<number[]> {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new Error('HUGGINGFACE_API_KEY not set')

  const res = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`HF API ${res.status}: ${await res.text()}`)
  const result = await res.json()
  if (Array.isArray(result[0])) return result[0] as number[]
  return result as number[]
}

export async function getEmbedding(text: string): Promise<number[]> {
  const hfKey = process.env.HUGGINGFACE_API_KEY

  // Always use HF API if key is available (works on Vercel + local)
  if (hfKey) {
    return await getEmbeddingHF(text)
  }

  // Only try xenova if no HF key and not on Vercel
  if (process.env.VERCEL) {
    throw new Error('HUGGINGFACE_API_KEY must be set on Vercel')
  }

  // Local fallback — xenova
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { pipeline } = await import('@xenova/transformers') as any
  const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  const output = await embed(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const text of texts) {
    results.push(await getEmbedding(text))
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