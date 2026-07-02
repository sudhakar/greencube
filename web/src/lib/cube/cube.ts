import type { QueryResult } from "../types.ts";
import { QueryCache, queryCache } from "./cache.ts";
import type { Query } from "./types.ts";

let defaultFetch: Promise<(q: object) => Promise<QueryResult>>;

export async function queryCube(
	q: Query,
	fetch?: (q: object) => Promise<QueryResult>,
) {
	const doFetch =
		fetch ??
		(await (defaultFetch ??= import("../api").then((m) => m.executeQuery)));
	const cached = queryCache.get(q);
	if (cached) return cached;

	const need = queryCache.missing(q);
	const fetchQ =
		need.length < QueryCache.selectCols(q).length ? partialQuery(q, need) : q;

	const dedupKey = QueryCache.fingerprint(q) + "|" + need.sort().join(",");
	await queryCache.dedup(dedupKey, () =>
		doFetch(fetchQ).then((res) => {
			queryCache.set(q, res.data);
		}),
	);

	return queryCache.get(q)!;
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
