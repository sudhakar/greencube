import type { CubeMeta, Field } from './types'
import { fetchMeta } from './api'

export function resolveField(meta: CubeMeta, qualifiedName: string): Field | undefined {
  const [cubeName] = qualifiedName.split('.')
  const cube = meta.cubes.find((c) => c.name === cubeName)
  if (!cube) return undefined
  return (
    cube.measures.find((m) => m.name === qualifiedName) ??
    cube.dimensions.find((d) => d.name === qualifiedName) ??
    cube.timeDimensions.find((t) => t.name === qualifiedName)
  )
}

export function getCubeName(qualifiedName: string): string {
  return qualifiedName.split('.')[0]
}

export function getFieldName(qualifiedName: string): string {
  return qualifiedName.split('.')[1] ?? qualifiedName
}

export function getAllFields(meta: CubeMeta): Field[] {
  return meta.cubes.flatMap((c) => [...c.measures, ...c.dimensions, ...c.timeDimensions])
}

let metaCache: CubeMeta | null = null
let metaPromise: Promise<CubeMeta> | null = null

export async function ensureMeta(): Promise<CubeMeta> {
  if (metaCache) return metaCache
  if (!metaPromise) metaPromise = fetchMeta()
  metaCache = await metaPromise
  return metaCache
}

export function fieldTitle(name: string): string {
  if (!metaCache) return name
  const field = resolveField(metaCache, name)
  return field?.title ?? name
}
