import { useState } from "react";
import { cube } from "@/lib/cube/cube";
import { mutator, rowStore } from "@/lib/cube/row-store";
import type { Filter } from "@/lib/cube/types";

type Row = Record<string, unknown>;

export function useMutation() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function pkSupport(cubeName: string, pk: Record<string, unknown>) {
		const meta = await cube.meta();
		const pkFields = meta.cubes.find((cu) => cu.name === cubeName)?.pk;
		if (!pkFields) return undefined;
		const qualify = (f: string) => `${cubeName}.${f}`;
		const key: Record<string, unknown> = {};
		const filters: Filter[] = [];
		for (const f of pkFields) {
			const q = qualify(f);
			key[q] = pk[f];
			filters.push({ member: q, operator: "equals", values: [pk[f]] });
		}
		return { key, filters };
	}

	async function create(cubeName: string, values: Record<string, unknown>): Promise<Row[]> {
		setIsLoading(true);
		setError(null);
		try {
			const res = await mutator.create(cubeName, values);
			if (res.data[0]) rowStore.upsert(cubeName, res.data[0]);
			cube.colStore.invalidateCube(cubeName);
			return res.data;
		} catch (e) {
			const msg = (e as Error).message;
			setError(msg);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}

	async function update(cubeName: string, values: Record<string, unknown>, pk: Record<string, unknown>): Promise<Row[]> {
		const pks = await pkSupport(cubeName, pk);
		const old = pks ? rowStore.get(cubeName, pks.key) : undefined;
		if (old) rowStore.upsert(cubeName, { ...old, ...values });

		setIsLoading(true);
		setError(null);
		try {
			const filters = pks?.filters ?? [];
			const res = await mutator.update(cubeName, values, filters);
			if (res.data[0]) rowStore.upsert(cubeName, res.data[0]);
			cube.colStore.invalidateCube(cubeName);
			return res.data;
		} catch (e) {
			if (old) rowStore.upsert(cubeName, old);
			const msg = (e as Error).message;
			setError(msg);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}

	async function remove(cubeName: string, pk: Record<string, unknown>): Promise<void> {
		const pks = await pkSupport(cubeName, pk);
		const old = pks ? rowStore.get(cubeName, pks.key) : undefined;
		if (old) rowStore.remove(cubeName, pks!.key);

		setIsLoading(true);
		setError(null);
		try {
			const filters = pks?.filters ?? [];
			await mutator.delete(cubeName, filters);
			cube.colStore.invalidateCube(cubeName);
		} catch (e) {
			if (old && pks) rowStore.upsert(cubeName, old);
			const msg = (e as Error).message;
			setError(msg);
			throw e;
		} finally {
			setIsLoading(false);
		}
	}

	return { create, update, remove, isLoading, error, reset: () => setError(null) };
}
