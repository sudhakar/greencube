import type { CubeMeta, QueryResult } from './types'

const BASE = 'http://localhost:3003/cube'

async function request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(b.error || `Request failed: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchMeta() {
  return request<CubeMeta>('/meta')
}

export async function executeQuery(query: object) {
  return request<QueryResult>('/query', { method: 'POST', body: query })
}

export async function explainQuery(query: object) {
  return request<{ sql: string }>('/explain', { method: 'POST', body: query })
}
