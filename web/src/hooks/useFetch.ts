import { useState, useEffect } from "react";
import { queryCache, queryCube, type QueryLike } from "@/lib/cube";

type Row = Record<string, unknown>;

interface FetchState {
	data: Row[];
	isLoading: boolean;
	error: string | null;
}

export function useFetch(query: QueryLike): FetchState & { refetch: () => void } {
	const key = JSON.stringify(query);

	const [state, setState] = useState<FetchState>(() => {
		const cached = queryCache.get(query);
		return cached ? { data: cached, isLoading: false, error: null } : { data: [], isLoading: true, error: null };
	});

	useEffect(() => {
		queryCache.retain(query);
		const cached = queryCache.get(query);
		if (cached) return () => queryCache.release(query);
		let cancelled = false;
		queryCube(query).then((data) => {
			if (!cancelled) setState({ data, isLoading: false, error: null });
		}).catch((err) => {
			if (!cancelled) setState({ data: [], isLoading: false, error: (err as Error).message });
		});
		return () => {
			cancelled = true;
			queryCache.release(query);
		};
		// `key` encodes query content. Using `query` as dep would fire on every ref change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	async function refetch() {
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

	return { data: state.data, isLoading: state.isLoading, error: state.error, refetch };
}
