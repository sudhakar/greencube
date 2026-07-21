# lib/cube

## Usage

The entire frontend consumes cube data through a single hook.

```tsx
import { useCube } from "@/hooks/useCube"
import type { Query } from "@/lib/cube/types"

function Widget({ query }: { query: Query | null }) {
  const { data, isLoading, error, refetch } = useCube(query)

  if (!query) return null
  if (isLoading) return <Skeleton />
  if (error) return <ErrorBar msg={error} onRetry={refetch} />

  return <Chart data={data} />
}
```

- `query: null` → disabled (no fetch, returns empty state)
- `data` — `Record<string, unknown>[]`
- `refetch()` — forces a network call regardless of cache state
- Routing is transparent: `ungrouped: true` hits RowStore, `ungrouped: false` hits ColStore

### Examples

**Widget re-fetches when filters change:**

```tsx
const [filters, setFilters] = useState<Filter[]>([])
const { data, isLoading } = useCube({ measures: ["amount"], filters })
```

**Local mutation + server sync:**

```tsx
import { rowStore, mutator } from "@/lib/cube/row-store"

async function updateRow(id: number, amount: number) {
  rowStore.upsert("Orders", { id, amount })
  try {
    await mutator.update("Orders", { amount }, [{ member: "id", operator: "equals", values: [id] }])
  } catch {
    rowStore.upsert("Orders", { id, amount: previousAmount }) // rollback
  }
}
```

**Invalidate related caches after mutation:**

```tsx
import { cube } from "@/lib/cube/cube"

await mutator.update("Orders", { amount }, [...filters])
cube.colStore.invalidate({ measures: ["amount"], dimensions: ["date"] }) // refresh grouped chart
```

---

## Internals

### Cube

```ts
import { cube } from "@/lib/cube/cube"  // singleton

cube.query(q)       // route: ungrouped→RowStore, grouped→ColStore
cube.refetch(q)     // invalidate correct store + re-fetch
cube.meta()         // CubeMeta (cached, single fetch)
cube.explain(q)     // { sql: string }
cube.colStore       // ColStore instance
cube.rowStore       // RowStore instance
```

`cube.query()` is the routing layer. Both stores live on every Cube — no injection.

### ColStore

Columnar cache for grouped queries. Stores columns (`Map<string, unknown[]>`) not rows.

```ts
cube.colStore.invalidate(q)      // evict one query
cube.colStore.clear()            // evict all
cube.colStore.get(q)             // bypass routing
cube.colStore.set(q, data)       // inject (test/seed)
cube.colStore.missing(q)         // which columns need fetching
cube.colStore.size               // entry count
cube.colStore.retain(q)          // pin entry (prevent eviction)
cube.colStore.release(q)         // unpin (frees materialized rows at 0)
```

All methods no-op when `q.ungrouped` is true. FIFO eviction at 100 entries.

Enables **partial column fetch** — add a measure to a grouped query and only that measure re-fetches:

```ts
cube.query({ measures: ["amount"], dims: ["date"] })   // fetch amount
cube.query({ measures: ["amount", "tax"], dims: ["date"] })  // fetch tax only
```

Static helpers: `ColStore.fingerprint(q)` (cache key), `ColStore.selectCols(q)` (partial-fetch candidates), `ColStore.allCols(q)` (every column). Fingerprint strips measures + sorts keys for stable JSON.

### RowStore

Per-cube index of raw rows keyed by composite key (dimension fields). Auto-seeded from ungrouped query results.

```ts
import { rowStore } from "@/lib/cube/row-store"

// PK operations
rowStore.seed("Orders", ["id"], [{ id: 1, amount: 100 }])
rowStore.get("Orders", { id: 1 })
rowStore.upsert("Orders", { id: 1, amount: 150 })
rowStore.remove("Orders", { id: 1 })
rowStore.all("Orders")
rowStore.isSeeded("Orders")
rowStore.invalidate("Orders")
rowStore.clear()

// Query-level (infer cube + key from Query shape)
rowStore.getByQuery(q)            // null or rows
rowStore.setByQuery(q, data)      // seed
rowStore.invalidateByQuery(q)
```

Only single-cube queries seed (multi-cube can't infer cube name). Queries without dimensions don't seed.

### Mutator

Thin RPC for `POST /mutate`. No cache coupling.

```ts
import { mutator } from "@/lib/cube/row-store"

await mutator.create("Customers", { name: "Alice" })
await mutator.update("Customers", { name: "Bob" }, [{ member: "id", operator: "equals", values: [1] }])
await mutator.delete("Customers", [{ member: "id", operator: "equals", values: [1] }])
```

### Fetcher

```ts
import { fetcher } from "@/lib/cube/fetcher"
import type { Fetcher } from "@/lib/cube/fetcher"

const custom: Fetcher = async (path, body) => {
  const res = await fetch(`http://localhost:3003/cube${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed: ${res.statusText}`)
  return res.json()
}
```

## File map

```
lib/cube/
  cube.ts         — Cube class + singleton
  col-store.ts    — ColStore (columnar, grouped queries)
  row-store.ts    — RowStore (row index) + Mutator (CRUD) + singletons
  fetcher.ts      — Fetcher type + default implementation
  types.ts        — Query, CubeMeta, Filter, Field
  README.md
  __tests__/
    cube.spec.ts
    col-store.spec.ts
    row-store.spec.ts

hooks/
  useCube.ts      — React hook
```
