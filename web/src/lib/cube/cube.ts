import { ColStore } from "./col-store.ts";
import { type Fetcher, fetcher } from "./fetcher.ts";
import { RowStore } from "./row-store.ts";
import type { CubeMeta, Query, QueryResult } from "./types.ts";

type Row = Record<string, unknown>;

export class Cube {
	public colStore = new ColStore();
	public rowStore = new RowStore();
	private fetch: Fetcher;
	private metaPromise: Promise<CubeMeta> | null = null;

	constructor(fetch?: Fetcher) {
		this.fetch = fetch ?? fetcher();
	}

	async meta(): Promise<CubeMeta> {
		if (!this.metaPromise)
			this.metaPromise = this.fetch<CubeMeta>("/meta");
		return await this.metaPromise;
	}

	async query(q: Query): Promise<Row[]> {
		if (q.ungrouped) return this.queryUngrouped(q);
		return this.queryGrouped(q);
	}

	private async queryUngrouped(q: Query): Promise<Row[]> {
		const cached = this.rowStore.getByQuery(q);
		if (cached) return cached;
		const res = await this.fetch<QueryResult>("/query", q);
		this.rowStore.setByQuery(q, res.data);
		return res.data;
	}

	private async queryGrouped(q: Query): Promise<Row[]> {
		const cached = this.colStore.get(q);
		if (cached) return cached;

		const need = this.colStore.missing(q);
		const fetchQ =
			need.length < ColStore.selectCols(q).length
				? partialQuery(q, need)
				: q;

		const dedupKey =
			ColStore.fingerprint(q) + "|" + need.sort().join(",");
		await this.colStore.dedup(dedupKey, () =>
			this.fetch<QueryResult>("/query", fetchQ).then((res) => {
				this.colStore.set(q, res.data);
			}),
		);

		return this.colStore.get(q)!;
	}

	async refetch(q: Query): Promise<Row[]> {
		if (q.ungrouped) {
			this.rowStore.invalidateByQuery(q);
		} else {
			this.colStore.invalidate(q);
		}
		return this.query(q);
	}

	async explain(q: Query): Promise<{ sql: string }> {
		return this.fetch<{ sql: string }>("/explain", q);
	}
}

function partialQuery(q: Query, need: string[]) {
	const needSet = new Set(need);
	const fq = { ...q };
	if (q.measures) {
		fq.measures = q.measures.filter((x) => needSet.has(x));
	}
	return fq;
}

export const cube = new Cube();
