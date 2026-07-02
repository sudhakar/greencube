import { useEffect, useState } from "react";
import { cube } from "@/lib/cube/cube";
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
		const cached = query ? cube.cache.get(query) : null;
		return cached
			? { data: cached, isLoading: false, error: null }
			: { data: [], isLoading: !!query, error: null };
	});

	useEffect(() => {
		if (!query) return;
		cube.cache.retain(query);
		let cancelled = false;
		cube.query(query).then(
			(data) => cancelled || setState({ data, isLoading: false, error: null }),
			(err: Error) =>
				cancelled || setState({ data: [], isLoading: false, error: err.message }),
		);
		return () => {
			cancelled = true;
			cube.cache.release(query);
		};
		// `key` encodes query content. Using `query` as dep would fire on every ref change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	async function refetch() {
		if (!query) return;
		cube.cache.invalidate(query);
		cube.cache.retain(query);
		setState((s) => ({ ...s, isLoading: true, error: null }));
		try {
			const data = await cube.query(query);
			setState({ data, isLoading: false, error: null });
		} catch (err) {
			setState({ data: [], isLoading: false, error: (err as Error).message });
		}
	}

	return { ...state, refetch };
}
