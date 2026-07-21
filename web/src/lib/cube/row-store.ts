import type { Query } from "./types.ts";

export class RowStore {
	private data = new Map<string, Map<string, Record<string, unknown>>>();
	private keyFields = new Map<string, string[]>();

	private compositeKey(
		row: Record<string, unknown>,
		keys: string[],
	): string {
		return keys.map((k) => String(row[k] ?? "")).join("|");
	}

	get size(): number {
		return this.data.size;
	}

	get totalRows(): number {
		let n = 0;
		for (const idx of this.data.values()) n += idx.size;
		return n;
	}

	isSeeded(cube: string): boolean {
		return this.data.has(cube);
	}

	seed(
		cube: string,
		fields: string[],
		rows: Record<string, unknown>[],
	) {
		const idx = new Map<string, Record<string, unknown>>();
		for (const row of rows) {
			idx.set(this.compositeKey(row, fields), row);
		}
		this.data.set(cube, idx);
		this.keyFields.set(cube, fields);
	}

	get(
		cube: string,
		key: Record<string, unknown>,
	): Record<string, unknown> | undefined {
		const idx = this.data.get(cube);
		if (!idx) return;
		const kf = this.keyFields.get(cube);
		if (!kf) return;
		return idx.get(this.compositeKey(key, kf));
	}

	/** Query-level get: return all rows if cube is seeded, else null. */
	getByQuery(q: Query): Record<string, unknown>[] | null {
		const name = cubeFromQuery(q);
		if (!name) return null;
		const rows = this.all(name);
		return rows.length ? rows : null;
	}

	/** Query-level set: infer cube + key fields from query and seed. */
	setByQuery(q: Query, rows: Record<string, unknown>[]) {
		if (!rows.length) return;
		const fields = [
			...(q.dimensions ?? []),
			...(q.timeDimensions?.map((td) => td.dimension) ?? []),
		];
		if (fields.length === 0) return;
		const name = cubeFromQuery(q);
		if (name) this.seed(name, fields, rows);
	}

	/** Query-level invalidate: drop cube inferred from query. */
	invalidateByQuery(q: Query) {
		const name = cubeFromQuery(q);
		if (name) this.invalidate(name);
	}

	upsert(cube: string, row: Record<string, unknown>) {
		const idx = this.data.get(cube);
		const kf = this.keyFields.get(cube);
		if (idx && kf) idx.set(this.compositeKey(row, kf), row);
	}

	remove(cube: string, key: Record<string, unknown>) {
		const idx = this.data.get(cube);
		const kf = this.keyFields.get(cube);
		if (idx && kf) idx.delete(this.compositeKey(key, kf));
	}

	invalidate(cube: string) {
		this.data.delete(cube);
		this.keyFields.delete(cube);
	}

	clear() {
		this.data.clear();
		this.keyFields.clear();
	}

	all(cube: string): Record<string, unknown>[] {
		return Array.from(this.data.get(cube)?.values() ?? []);
	}
}

function cubeFromQuery(q: Query): string | null {
	const fields = [
		...(q.dimensions ?? []),
		...(q.timeDimensions?.map((td) => td.dimension) ?? []),
	];
	if (fields.length === 0) return null;
	const cubes = new Set(fields.map((f) => f.split(".")[0]));
	return cubes.size === 1 ? cubes.values().next().value! : null;
}

export const rowStore = new RowStore();
