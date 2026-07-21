import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import { cube } from "@/lib/cube/cube";
import type { Query } from "@/lib/cube/types";

type Row = Record<string, unknown>;

interface FetchState {
	data: Row[];
	isLoading: boolean;
	error: string | null;
}

/** `query: null` disables fetching (no cache read, no network). */
export function useCube(
	query: Query | null,
): FetchState & { refetch: () => void } {
	const key = query ? JSON.stringify(query) : "";

	const subscribe = useCallback(
		(cb: () => void) => cube.colStore.subscribe(cb),
		[],
	);
	const getVersion = useCallback(
		() => cube.colStore.getVersion(),
		[],
	);
	const version = useSyncExternalStore(subscribe, getVersion);

	const [state, setState] = useState<FetchState>(() => {
		if (!query) return { data: [], isLoading: false, error: null };
		const cached = cube.colStore.get(query) ?? cube.rowStore.getByQuery(query);
		return cached
			? { data: cached, isLoading: false, error: null }
			: { data: [], isLoading: true, error: null };
	});

	useEffect(() => {
		if (!query) return;
		let cancelled = false;
		cube.query(query).then(
			(data) => cancelled || setState({ data, isLoading: false, error: null }),
			(err: Error) =>
				cancelled || setState({ data: [], isLoading: false, error: err.message }),
		);
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, version]);

	async function refetch() {
		if (!query) return;
		setState((s) => ({ ...s, isLoading: true, error: null }));
		try {
			const data = await cube.refetch(query);
			setState({ data, isLoading: false, error: null });
		} catch (err) {
			setState({ data: [], isLoading: false, error: (err as Error).message });
		}
	}

	return { ...state, refetch };
}
