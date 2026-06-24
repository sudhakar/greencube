import { allCubes } from '../cubes.ts'
import type { MutationOp } from './mutate.ts'

// ── Derive cube names and writable fields from cube definitions ──

type CubeDefs = typeof allCubes
export type CubeName = CubeDefs[number]['name']

type CubeFields<C extends CubeName> =
  Extract<CubeDefs[number], { name: C }>['dimensions']

type WritableField<C extends CubeName> = keyof CubeFields<C>

// ── Permission type per cube ──

interface CubePermission<C extends CubeName = CubeName> {
  ops: MutationOp[]
  denyFields?: WritableField<C>[]
}

type RolePermissions = {
  [role: string]: {
    [C in CubeName]?: CubePermission<C>
  }
}

// ── Runtime permission config ──

const PERMISSIONS = {
  admin: {
    Employees:           { ops: ['create', 'update', 'delete'] },
    Departments:         { ops: ['create', 'update', 'delete'] },
    Offices:             { ops: ['create', 'update', 'delete'] },
    Productivity:        { ops: ['create', 'update', 'delete'] },
    PerformanceReviews:  { ops: ['create', 'update', 'delete'] },
    PREvents:            { ops: ['create', 'update', 'delete'] },
    Teams:               { ops: ['create', 'update', 'delete'] },
    EmployeeTeams:       { ops: ['create', 'update', 'delete'] },
    Skills:              { ops: ['create', 'update', 'delete'] },
    EmployeeSkills:      { ops: ['create', 'update', 'delete'] },
  },
  editor: {
    Employees: {
      ops: ['create', 'update'],
      denyFields: ['email', 'managerId'],
    },
    Productivity: {
      ops: ['create', 'update'],
    },
  },
  viewer: {},
} as const satisfies RolePermissions

export function checkPermission(
  role: string | undefined,
  cubeName: string,
  operation: MutationOp,
  values?: Record<string, unknown>,
): boolean {
  if (!role) return false

  const perms = PERMISSIONS as Record<string, Record<string, { ops: readonly MutationOp[]; denyFields?: readonly string[] }>>
  const cubePerm = perms[role]?.[cubeName]
  if (!cubePerm) return false
  if (!(cubePerm.ops as readonly MutationOp[]).includes(operation)) return false

  if (cubePerm.denyFields && values) {
    const attempted = Object.keys(values)
    if (attempted.some(f => (cubePerm.denyFields as readonly string[]).includes(f))) {
      return false
    }
  }

  return true
}
