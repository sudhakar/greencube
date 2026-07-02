import type { Query } from "./types.ts";

type Row = Record<string, unknown>;

interface Entry {
	cols: Map<string, unknown[]>;
	rows: Map<string, Row[]>;
	refs: Map<string, number>;
}

const sortFn = (_: string, val: unknown) =>
	val?.constructor === Object
		? Object.fromEntries(
				Object.entries(val).sort(([a], [b]) => a.localeCompare(b)),
			)
		: val;

/** True if two column arrays are element-wise equal. */
function isEqual(a: unknown[], b: unknown[]) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export class QueryCache {
	private entries = new Map<string, Entry>();
	private inflight = new Map<string, Promise<unknown>>();
	private maxEntries: number;

	constructor(maxEntries = 100) {
		this.maxEntries = maxEntries;
	}

	/** Row-context key: everything that determines row count + order */
	static fingerprint({ ...ctx }: Query) {
		delete ctx.measures;
		if (ctx.ungrouped) {
			delete ctx.dimensions;
			delete ctx.timeDimensions;
		}
		return JSON.stringify(ctx, sortFn);
	}

	/** Column names that can be partial-fetched */
	static selectCols(q: Query) {
		const cols = [...(q.measures ?? [])];
		if (q.ungrouped) {
			for (const d of q.dimensions ?? []) cols.push(d);
			for (const td of q.timeDimensions ?? []) cols.push(td.dimension);
		}
		return cols;
	}

	/** All column names the query requests (measures + dims + timeDims) */
	static allCols(q: Query) {
		const cols = [...(q.measures ?? [])];
		for (const d of q.dimensions ?? []) cols.push(d);
		for (const td of q.timeDimensions ?? []) cols.push(td.dimension);
		return cols;
	}

	/** Full hit → rows (same ref until set() replaces data), else null */
	get(q: Query) {
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
	set(q: Query, data: Row[]) {
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

		const cols = Object.keys(data[0]);
		let changed = false;
		for (const name of cols) {
			const incoming = data.map((r) => r[name]);
			const prev = e.cols.get(name);
			// New columns don't invalidate subsets; only an existing column whose
			// values differ does. Re-fetching an unchanged dimension is a no-op.
			if (prev && !isEqual(prev, incoming)) changed = true;
			e.cols.set(name, incoming);
		}
		if (changed) e.rows.clear();
	}

	/** Columns requested but not yet cached */
	missing(q: Query) {
		const e = this.entries.get(QueryCache.fingerprint(q));
		if (!e) return QueryCache.selectCols(q);
		return QueryCache.selectCols(q).filter((m) => !e.cols.has(m));
	}

	invalidate(q: Query) {
		const fp = QueryCache.fingerprint(q);
		this.entries.delete(fp);
		for (const k of this.inflight.keys()) {
			if (k.startsWith(fp)) this.inflight.delete(k);
		}
	}

	dedup<T>(key: string, fn: () => Promise<T>) {
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

	clear() {
		this.entries.clear();
		this.inflight.clear();
	}

	retain(q: Query) {
		const fp = QueryCache.fingerprint(q);
		let e = this.entries.get(fp);
		if (!e) {
			e = { cols: new Map(), rows: new Map(), refs: new Map() };
			this.entries.set(fp, e);
		}
		const ck = QueryCache.allCols(q).sort().join(",");
		e.refs.set(ck, (e.refs.get(ck) ?? 0) + 1);
	}

	release(q: Query) {
		const fp = QueryCache.fingerprint(q);
		const e = this.entries.get(fp);
		if (!e) return;
		const ck = QueryCache.allCols(q).sort().join(",");
		const n = e.refs.get(ck);
		if (n === 1) {
			e.refs.delete(ck);
			e.rows.delete(ck);
		} else if (n && n > 1) {
			e.refs.set(ck, n - 1);
		}
	}

	private materialize(e: Entry, cols: string[]) {
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


