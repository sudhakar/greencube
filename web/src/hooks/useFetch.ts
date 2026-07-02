import { useEffect, useState } from "react";
import { queryCache } from "@/lib/cube/cache";
import { queryCube } from "@/lib/cube/cube";
import type { Query } from "@/lib/cube/types";

type Row = Record<string, unknown>;

interface FetchState {
	data: Row[];
	isLoading: boolean;
	error: string | null;
}

/** `query: null` disables fetching (no cache read, no network, no retain). */
export function useFetch(
	query: Query | null,
): FetchState & { refetch: () => void } {
	const key = query ? JSON.stringify(query) : "";

	const [state, setState] = useState<FetchState>(() => {
		const cached = query ? queryCache.get(query) : null;
		return cached
			? { data: cached, isLoading: false, error: null }
			: { data: [], isLoading: !!query, error: null };
	});

	useEffect(() => {
		if (!query) return;
		queryCache.retain(query);
		let cancelled = false;
		queryCube(query)
			.then(
				(data) =>
					cancelled || setState({ data, isLoading: false, error: null }),
			)
			.catch(
				(err: Error) =>
					cancelled ||
					setState({ data: [], isLoading: false, error: err.message }),
			);
		return () => {
			cancelled = true;
			queryCache.release(query);
		};
		// `key` encodes query content. Using `query` as dep would fire on every ref change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	async function refetch() {
		if (!query) return;
		queryCache.invalidate(query);
		queryCache.retain(query);
		setState((s) => ({ ...s, isLoading: true, error: null }));
		try {
			const data = await queryCube(query);
			setState({ data, isLoading: false, error: null });
		} catch (err) {
			setState({ data: [], isLoading: false, error: (err as Error).message });
		}
	}

	return { ...state, refetch };
}
