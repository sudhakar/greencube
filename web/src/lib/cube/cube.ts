import { QueryCache } from "./cache.ts";
import type { Mutation, Query } from "./types.ts";
import type { CubeMeta, QueryResult } from "./types.ts";
import { type Fetcher, fetcher } from "./fetcher.ts";

type Row = Record<string, unknown>;

export class Cube {
	cache = new QueryCache();
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
		const cached = this.cache.get(q);
		if (cached) return cached;

		const need = this.cache.missing(q);
		const fetchQ =
			need.length < QueryCache.selectCols(q).length
				? partialQuery(q, need)
				: q;

		const dedupKey =
			QueryCache.fingerprint(q) + "|" + need.sort().join(",");
		await this.cache.dedup(dedupKey, () =>
			this.fetch<QueryResult>("/query", fetchQ).then((res) => {
				this.cache.set(q, res.data);
			}),
		);

		return this.cache.get(q)!;
	}

	async explain(q: Query): Promise<{ sql: string }> {
		return this.fetch<{ sql: string }>("/explain", q);
	}

	async mutate(m: Mutation): Promise<QueryResult> {
		return this.fetch<QueryResult>("/mutate", m);
	}
}

function partialQuery(q: Query, need: string[]) {
	const needSet = new Set(need);
	const fq = { ...q };

	if (q.measures) {
		const m = q.measures.filter((x) => needSet.has(x));
		if (m.length) fq.measures = m;
	}

	if (q.dimensions) {
		fq.dimensions = q.ungrouped
			? q.dimensions.filter((x) => needSet.has(x))
			: q.dimensions;
	}

	if (q.timeDimensions) {
		fq.timeDimensions = q.ungrouped
			? q.timeDimensions.filter((x) => needSet.has(x.dimension))
			: q.timeDimensions;
	}

	return fq;
}

export const cube = new Cube();
