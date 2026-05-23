const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export type MemeIdea = {
  format: string
  caption: string
  topText: string
  bottomText: string
  vibe: string
}

export async function analyzeImage(file: File): Promise<MemeIdea[]> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`)
  const data = await res.json()
  return data.ideas || []
}

export async function saveMeme(imageBase64: string, caption: string): Promise<{ slug: string; shareUrl: string }> {
  const res = await fetch(`${BASE}/api/memes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, contentType: 'image/png', caption })
  })
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
  return res.json()
}

export async function getMeme(slug: string) {
  const res = await fetch(`${BASE}/api/memes/${slug}`)
  if (!res.ok) throw new Error(`get failed: ${res.status}`)
  return res.json()
}

export function imageUrl(slug: string) {
  return `${BASE}/api/memes/${slug}/image`
}

export async function react(slug: string, kind: string) {
  const res = await fetch(`${BASE}/api/memes/${slug}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind })
  })
  if (!res.ok) throw new Error('react failed')
  return res.json()
}

export async function reactionTotals(slug: string) {
  const res = await fetch(`${BASE}/api/memes/${slug}/reactions`)
  return res.json()
}

export function reactionStream(slug: string, onEvent: (totals: any) => void) {
  const es = new EventSource(`${BASE}/api/memes/${slug}/reactions/stream`)
  es.addEventListener('reaction', e => {
    try { onEvent(JSON.parse((e as MessageEvent).data)) } catch {}
  })
  return () => es.close()
}
