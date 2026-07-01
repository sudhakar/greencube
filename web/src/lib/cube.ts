import type { QueryResult } from "./types";

type Row = Record<string, unknown>;

export interface TimeDim {
	dimension: string;
	granularity: string;
}

export interface QueryLike {
	measures?: string[];
	dimensions?: string[];
	timeDimensions?: TimeDim[];
	filters?: unknown;
	order?: Record<string, string>;
	limit?: number;
	offset?: number;
	ungrouped?: boolean;
}

interface Entry {
	cols: Map<string, unknown[]>;
	rows: Map<string, Row[]>;
	refs: Map<string, number>;
}

export class QueryCache {
	private entries = new Map<string, Entry>();
	private inflight = new Map<string, Promise<unknown>>();
	private maxEntries: number;

	constructor(maxEntries = 100) {
		this.maxEntries = maxEntries;
	}

	/** Row-context key: everything that determines row count + order */
	static fingerprint(q: object): string {
		const ctx: Record<string, unknown> = { ...(q as Record<string, unknown>) };
		delete ctx.measures;
		if (ctx.ungrouped) {
			delete ctx.dimensions;
			delete ctx.timeDimensions;
		}
		const keys = Object.keys(ctx).sort();
		const ordered: Record<string, unknown> = {};
		for (const k of keys) ordered[k] = ctx[k];
		return JSON.stringify(ordered);
	}

	/** Column names that can be partial-fetched */
	static selectCols(q: object): string[] {
		const qq = q as QueryLike;
		const cols: string[] = [...(qq.measures ?? [])];
		if (qq.ungrouped) {
			for (const d of qq.dimensions ?? []) cols.push(d);
			for (const td of qq.timeDimensions ?? []) cols.push(td.dimension);
		}
		return cols;
	}

	/** All column names the query requests (measures + dims + timeDims) */
	static allCols(q: object): string[] {
		const qq = q as QueryLike;
		const cols: string[] = [...(qq.measures ?? [])];
		for (const d of qq.dimensions ?? []) cols.push(d);
		for (const td of qq.timeDimensions ?? []) cols.push(td.dimension);
		return cols;
	}

	/** Full hit → rows (same ref until set() replaces data), else null */
	get(q: object): Row[] | null {
		const e = this.entries.get(QueryCache.fingerprint(q));
		if (!e) return null;

		const cols = QueryCache.allCols(q);
		for (const c of cols) {
			if (!e.cols.has(c)) return null;
		}

		const mk = cols.sort().join(",");
		let rows = e.rows.get(mk);
		if (!rows) {
			rows = this.materialize(e, cols);
			e.rows.set(mk, rows);
		}
		return rows;
	}

	/** Store or merge query result (row-oriented → columnar) */
	set(q: object, data: Row[]): void {
		if (!data.length) return;
		const fp = QueryCache.fingerprint(q);

		let e = this.entries.get(fp);
		if (!e) {
			e = { cols: new Map(), rows: new Map(), refs: new Map() };
			this.entries.set(fp, e);
			if (this.entries.size > this.maxEntries) {
				const first = this.entries.keys().next().value!;
				this.entries.delete(first);
			}
		}

		const replacedExisting = Object.keys(data[0]).some((n) => e.cols.has(n));
		for (const name of Object.keys(data[0])) {
			e.cols.set(
				name,
				data.map((r) => r[name]),
			);
		}
		if (replacedExisting) {
			e.rows.clear();
		}
	}

	/** Columns requested but not yet cached */
	missing(q: object): string[] {
		const e = this.entries.get(QueryCache.fingerprint(q));
		if (!e) return QueryCache.selectCols(q);
		return QueryCache.selectCols(q).filter((m) => !e.cols.has(m));
	}

	invalidate(q: object): void {
		const fp = QueryCache.fingerprint(q);
		this.entries.delete(fp);
		for (const k of this.inflight.keys()) {
			if (k.startsWith(fp)) this.inflight.delete(k);
		}
	}

	dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
		if (!this.inflight.has(key)) {
			this.inflight.set(
				key,
				fn().finally(() => this.inflight.delete(key)),
			);
		}
		return this.inflight.get(key) as Promise<T>;
	}

	get size(): number {
		return this.entries.size;
	}

	clear(): void {
		this.entries.clear();
		this.inflight.clear();
	}

	retain(q: object): void {
		const fp = QueryCache.fingerprint(q);
		let e = this.entries.get(fp);
		if (!e) {
			e = { cols: new Map(), rows: new Map(), refs: new Map() };
			this.entries.set(fp, e);
			if (this.entries.size > this.maxEntries) {
				const first = this.entries.keys().next().value!;
				this.entries.delete(first);
			}
		}
		const ck = QueryCache.allCols(q).sort().join(",");
		e.refs.set(ck, (e.refs.get(ck) ?? 0) + 1);
	}

	release(q: object): void {
		const fp = QueryCache.fingerprint(q);
		const e = this.entries.get(fp);
		if (!e) return;
		const ck = QueryCache.allCols(q).sort().join(",");
		const n = e.refs.get(ck);
		if (n === 1) {
			e.refs.delete(ck);
			e.rows.delete(ck);
			if (e.refs.size === 0 && e.cols.size === 0) {
				this.entries.delete(fp);
			}
		} else if (n && n > 1) {
			e.refs.set(ck, n - 1);
		}
	}

	private materialize(e: Entry, cols: string[]): Row[] {
		const n = cols.reduce(
			(max, c) => Math.max(max, e.cols.get(c)?.length ?? 0),
			0,
		);
		const rows = new Array<Row>(n);
		for (let i = 0; i < n; i++) {
			const row: Row = {};
			for (const c of cols) row[c] = e.cols.get(c)![i];
			rows[i] = row;
		}
		return rows;
	}
}

export const queryCache = new QueryCache();

// ── Public fetch function ────────────────────────────────────────────────────

let _defaultFetch: ((q: object) => Promise<QueryResult>) | undefined;

async function loadDefaultFetch(): Promise<(q: object) => Promise<QueryResult>> {
	if (!_defaultFetch) {
		const mod = await import("./api");
		_defaultFetch = (q: object) => mod.executeQuery(q);
	}
	return _defaultFetch;
}

export async function queryCube(
	q: object,
	fetch?: (q: object) => Promise<QueryResult>,
): Promise<Row[]> {
	const doFetch = fetch ?? (await loadDefaultFetch());
	const cached = queryCache.get(q);
	if (cached) return cached;

	const need = queryCache.missing(q);
	const qq = q as QueryLike;
	const needSet = new Set(need);

	// Build fetch query: copy row-context fields, fill in missing columns
	const fetchQ: Record<string, unknown> = {};
	for (const key of [
		"filters",
		"order",
		"limit",
		"offset",
		"ungrouped",
	] as const) {
		if (qq[key] !== undefined) fetchQ[key] = qq[key];
	}

	if (needSet.size < QueryCache.selectCols(q).length) {
		// Partial hit — only fetch uncached columns
		if (!qq.ungrouped) {
			if (qq.dimensions !== undefined) fetchQ.dimensions = qq.dimensions;
			if (qq.timeDimensions !== undefined)
				fetchQ.timeDimensions = qq.timeDimensions;
		}
		if (qq.measures) {
			const m = qq.measures.filter((x) => needSet.has(x));
			if (m.length) fetchQ.measures = m;
		}
		if (qq.ungrouped) {
			if (qq.dimensions) {
				const d = qq.dimensions.filter((x) => needSet.has(x));
				if (d.length) fetchQ.dimensions = d;
			}
			if (qq.timeDimensions) {
				const td = qq.timeDimensions.filter((x) => needSet.has(x.dimension));
				if (td.length) fetchQ.timeDimensions = td;
			}
		}
	} else {
		// Full miss — fetch everything
		Object.assign(fetchQ, qq);
	}

	const fetchKey = QueryCache.fingerprint(q) + "|" + need.sort().join(",");
	await queryCache.dedup(fetchKey, async () => {
		const res = await doFetch(fetchQ);
		const stripped =
			needSet.size < QueryCache.selectCols(q).length
				? res.data.map((r: Row) => {
						const p: Row = {};
						for (const c of need) p[c] = r[c];
						return p;
					})
				: res.data;
		queryCache.set(q, stripped);
	});

	return queryCache.get(q)!;
}
