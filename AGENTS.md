# GreenCube

## Repo structure

```
  server/ — Hono API, ts on bare node (--watch), no build step needed for dev
  web/    — Vite + React 19 SPA, all UI
```

Both have own `package.json`. Root is a no-op.

## Server

```
  npm run dev   — node --watch src/server.ts
```

Hono + @hono/node-server. All state in-memory (no DB). `POST /cube/query` accepts GreenCube queries. `GET /cube/meta` returns available cubes/fields/types/titles. Runs on `http://localhost:3003`.

## Web

### Commands

```
  npm run dev       — vite dev server (HMR, no manual refresh needed)
  npm run build     — tsc -b && vite build  (typecheck before bundle; only for CI/deploy)
  npm run lint      — eslint .
  npm run preview   — vite preview
```

For day-to-day work, just `npm run dev` — Vite HMR catches changes instantly. Skip `npm run build` during development; run it only to verify CI or deploy. Build order matters when you do run it: `tsc -b` first, so fix type errors _before_ build errors.

### Paths

`@/` → `src/` (vite alias). All imports use `@/lib/...`, `@/components/...`, etc.

### Key files

- `src/lib/api.ts` — `fetchMeta()`, `executeQuery(query)`, `explainQuery(query)`. Target: `http://localhost:3003/cube/...`.
- `src/lib/storage.ts` — localStorage key `greencube-reports`. CRUD for reports/widgets/layout. Cross-tab sync via `storage` event.
- `src/lib/meta.ts` — caches `/cube/meta` at module scope. `ensureMeta()` called in `main.tsx` before React mount. `fieldTitle(name)` resolves `Cube.field` to display title.
- `src/lib/types.ts` — `WidgetType`, `LayoutItem`, `WidgetInstance`, `Report`, `CubeMeta`, `Field`.
- `src/context/ReportContext.tsx` — single context, provides `reports`, `activeId`, `patchLayout`, `removeWidget`, `duplicateWidget`.
- `src/hooks/useWidgetData.ts` — fetches data per widget via `executeQuery`. Query stability via `JSON.stringify` in deps.
- `src/widgets/` — one component per `WidgetType` (Bar, Line, Area, Pie, Number, Gauge, Metric, Table). Each accepts `{ data, config }`. Shared chart theming in `widget-theme.ts`.
- `src/components/report-grid.tsx` — react-grid-layout. Resize handles: all 8 (`e w s n se sw ne nw`). Stale `resizeHandles` on layout items (from old per-item code) are stripped via `cleanLayout()` before passing to RGL.
- `src/components/report-list.tsx` — sidebar. Add Widget icon button (Plus) before Trash2 on each row.
- `src/components/theme-toggle.tsx` — in sidebar header next to "GreenCube". Light/dark via CSS variables only.
- `src/components/add-widget-dialog.tsx` — 4-step shadcn Dialog (type → query → RJSF config → layout).
- `src/components/widget-frame.tsx` — shared chrome: title, menu, loading skeleton, error+retry, empty state.

### Widget config interfaces

Match SPEC.md §3 exactly. No shared config types, no ColumnSettings. Each widget has its own config interface in its component file: `NumberConfig`, `GaugeConfig`, `CartesianConfig` (shared by Bar/Line/Area), `PieConfig`, `TableConfig`, `MetricConfig`. RJSF generates forms from JSON Schema derived from these.

### CSS / theming

- Tailwind CSS v4. Light/dark mode via `:root` / `.dark` CSS variables (oklch).
- Card background: `oklch(0.985 0.01 250)` (subtle blue tint).
- Edge resize handles (e/w/s/n): 6px hit area, 2px line on hover (`color-mix(in oklch, var(--foreground) 30%, transparent)`). Edges shortened 6px from each end to clear rounded corners.
- Corner handles (se/sw/ne/nw): RGL defaults, invisible (default bracket stripped via `::after { all: unset }`).

### RGL config

```
  cols: 40, rowHeight: 12, margin: [2, 2], containerPadding: [0, 0]
  resizeConfig.handles: ['e', 'w', 's', 'n', 'se', 'sw', 'ne', 'nw']
```

`cleanLayout()` strips any extra props (e.g. stale `resizeHandles`) from layout items before passing to GridLayout and before saving to localStorage.

### Meta / No server

`POST /cube/query` — `measures` only required field. Filter operators match SPEC.md. Multi-cube queries supported (server resolves joins). Error 400 returns `{ "error": "..." }`.
