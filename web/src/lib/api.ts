import type { CubeMeta, QueryResult } from './types'

const BASE = 'http://localhost:3003/cube'

export async function fetchMeta(): Promise<CubeMeta> {
  const res = await fetch(`${BASE}/meta`)
  if (!res.ok) throw new Error(`Failed to fetch meta: ${res.statusText}`)
  return res.json()
}

export async function executeQuery(query: object): Promise<QueryResult> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Query failed: ${res.statusText}`)
  }
  return res.json()
}

export async function explainQuery(query: object): Promise<{ sql: string }> {
  const res = await fetch(`${BASE}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(`Explain failed: ${res.statusText}`)
  return res.json()
}
