import type { CubeMeta, Field } from './cube/types'
import { cube } from './cube/cube'

export function resolveField(meta: CubeMeta, qualifiedName?: string): Field | undefined {
  if (!qualifiedName) return undefined
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
  if (!metaPromise) metaPromise = cube.meta()
  metaCache = await metaPromise
  return metaCache
}

export function fieldType(name?: string): string | undefined {
  if (!name || !metaCache) return undefined
  return resolveField(metaCache, name)?.type
}

export function fieldTitle(name?: string): string {
  if (!name || !metaCache) return name ?? ''
  const field = resolveField(metaCache, name)
  return field?.title ?? name
}
