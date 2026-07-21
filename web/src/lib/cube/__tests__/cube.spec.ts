import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Cube } from "../cube.ts";
import type { Fetcher } from "../fetcher.ts";

type Row = Record<string, unknown>;

function makeFetch(
	override?: Partial<{ data: Row[]; meta: any; sql: string }>,
): Fetcher {
	const meta = override?.meta ?? { cubes: [], samples: [], routes: [] };
	const sql = override?.sql ?? "SELECT 1";
	return ((path: string, body?: object) => {
		if (path === "/meta") return Promise.resolve(meta);
		if (path === "/explain") return Promise.resolve({ sql });
		const q = body as any;
		const cols: string[] = [
			...(q?.measures ?? []),
			...(q?.dimensions ?? []),
			...(q?.timeDimensions ?? []).map((td: any) => td.dimension),
		];
		const raw = override?.data;
		const rows = raw
			? raw.map((row) => {
					const r: Row = {};
					for (const c of cols) r[c] = c in row ? row[c] : 1;
					return r;
				})
			: [(() => { const r: Row = {}; for (const c of cols) r[c] = 1; return r; })()];
		return Promise.resolve({ data: rows });
	}) as Fetcher;
}

describe("Cube", () => {
	let calls: { path: string; body?: object }[];
	let cube: Cube;

	beforeEach(() => {
		calls = [];
		const fetch = makeFetch();
		const recorded = ((path: string, body?: object) => {
			calls.push({ path, body });
			return fetch(path, body);
		}) as Fetcher;
		cube = new Cube(recorded);
	});

	describe("query", () => {
		it("returns cached data on hit", async () => {
			cube.colStore.set({ measures: ["a"] }, [{ a: 1 }]);
			const r = await cube.query({ measures: ["a"] });
			assert.deepEqual(r, [{ a: 1 }]);
			assert.equal(calls.length, 0);
		});

		it("fetches and caches on miss", async () => {
			const r = await cube.query({ measures: ["a"] });
			assert.deepEqual(r, [{ a: 1 }]);
			assert.equal(calls.length, 1);
			const r2 = await cube.query({ measures: ["a"] });
			assert.equal(r, r2);
			assert.equal(calls.length, 1);
		});

		it("partial hit fetches only missing columns", async () => {
			cube.colStore.set({ measures: ["a"], filters: [] }, [{ a: 1 }]);
			await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(calls.length, 1);
			const fetchQ = calls[0].body as any;
			assert.deepEqual(fetchQ.measures, ["b"]);
		});

		it("full miss fetches entire query", async () => {
			await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(calls.length, 1);
			const fetchQ = calls[0].body as any;
			assert.deepEqual(fetchQ.measures, ["a", "b"]);
		});

		it("partial fetch merges with cached columns", async () => {
			cube.colStore.set({ measures: ["a"], filters: [] }, [{ a: 10 }]);
			const r = await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(r[0].a, 10);
			assert.equal(r[0].b, 1);
		});

		it("returns same ref on repeated partial queries", async () => {
			cube.colStore.set({ measures: ["a"], filters: [] }, [{ a: 1 }]);
			await cube.query({ measures: ["a", "b"], filters: [] });
			const r1 = await cube.query({ measures: ["a", "b"], filters: [] });
			const r2 = await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(r1, r2);
		});

		it("grouped vs ungrouped use different stores", async () => {
			await cube.query({ measures: ["a"], dimensions: ["d"] });
			await cube.query({ measures: ["a"], dimensions: ["d"], ungrouped: true });
			assert.equal(calls.length, 2);
		});

		it("rejects when fetch fails", async () => {
			const c = new Cube(() => Promise.reject(new Error("network error")));
			await assert.rejects(
				c.query({ measures: ["err"] }),
				/network error/,
			);
		});

		it("does not populate colStore on fetch failure", async () => {
			const c = new Cube(() => Promise.reject(new Error("fail")));
			const q = { measures: ["x"], filters: [] };
			await c.query(q).catch(() => {});
			assert.equal(c.colStore.get(q), null);
		});

		it("allows re-fetch after previous failure", async () => {
			let fail = true;
			const flakyFetch = (() => {
				return fail ? Promise.reject(new Error("nope")) : Promise.resolve({ data: [{ x: 1 }] });
			}) as Fetcher;
			const c = new Cube(flakyFetch);
			const q = { measures: ["x"], filters: [] };
			await c.query(q).catch(() => {});
			assert.equal(c.colStore.get(q), null);
			fail = false;
			const r = await c.query(q);
			assert.deepEqual(r, [{ x: 1 }]);
		});

		it("ungrouped query seeds and caches in rowStore", async () => {
			const c = new Cube(makeFetch({ data: [{ "Orders.id": 1, "Orders.amount": 100 }] }));
			const q = { measures: ["Orders.amount"], dimensions: ["Orders.id"], ungrouped: true };
			const r = await c.query(q);
			assert.deepEqual(r, [{ "Orders.id": 1, "Orders.amount": 100 }]);
			assert.ok(c.rowStore.isSeeded("Orders"));
			assert.deepEqual(c.rowStore.get("Orders", { "Orders.id": 1 }), {
				"Orders.id": 1,
				"Orders.amount": 100,
			});
		});

		it("ungrouped second call returns from rowStore", async () => {
			let count = 0;
			const fetch = ((path: string, body?: object) => {
				count++;
				return makeFetch({ data: [{ "Orders.id": 1 }] })(path, body);
			}) as Fetcher;
			const c = new Cube(fetch);
			const q = { measures: ["Orders.amount"], dimensions: ["Orders.id"], ungrouped: true };
			await c.query(q);
			await c.query(q);
			assert.equal(count, 1);
		});

		it("grouped query does not seed rowStore", async () => {
			await cube.query({ measures: ["a"], dimensions: ["d"] });
			assert.equal(cube.rowStore.size, 0);
		});

		it("multi-cube ungrouped query does not seed rowStore", async () => {
			const c = new Cube(makeFetch());
			await c.query({
				measures: ["Orders.amount", "Customers.total"],
				dimensions: ["Orders.id", "Customers.name"],
				ungrouped: true,
			});
			assert.equal(c.rowStore.size, 0);
		});

		it("empty result does not seed rowStore", async () => {
			const c = new Cube(makeFetch({ data: [] }));
			await c.query({
				measures: ["Orders.amount"],
				dimensions: ["Orders.id"],
				ungrouped: true,
			});
			assert.equal(c.rowStore.size, 0);
		});

		it("ungrouped without dimensions does not seed", async () => {
			const c = new Cube(makeFetch());
			await c.query({ measures: ["Orders.amount"], ungrouped: true });
			assert.equal(c.rowStore.size, 0);
		});

		it("timeDimensions as key fields", async () => {
			const c = new Cube(
				makeFetch({ data: [{ "Orders.ts": "2024-01-01", "Orders.amount": 50 }] }),
			);
			await c.query({
				measures: ["Orders.amount"],
				timeDimensions: [{ dimension: "Orders.ts", granularity: "day" }],
				ungrouped: true,
			});
			assert.ok(c.rowStore.isSeeded("Orders"));
			assert.deepEqual(
				c.rowStore.get("Orders", { "Orders.ts": "2024-01-01" }),
				{ "Orders.ts": "2024-01-01", "Orders.amount": 50 },
			);
		});
	});

	describe("refetch", () => {
		it("forces a new fetch for grouped query", async () => {
			const q = { measures: ["a"] };
			await cube.query(q);
			assert.equal(calls.filter((c) => c.path === "/query").length, 1);
			await cube.refetch(q);
			assert.equal(calls.filter((c) => c.path === "/query").length, 2);
		});

		it("forces a new fetch for ungrouped query", async () => {
			let count = 0;
			const fetch = ((path: string, body?: object) => {
				count++;
				return makeFetch({ data: [{ "Orders.id": 1 }] })(path, body);
			}) as Fetcher;
			const c = new Cube(fetch);
			const q = { measures: ["Orders.amount"], dimensions: ["Orders.id"], ungrouped: true };
			await c.query(q);
			await c.query(q); // rowStore hit
			assert.equal(count, 1);
			await c.refetch(q);
			assert.equal(count, 2);
			assert.ok(c.rowStore.isSeeded("Orders"));
		});
	});

	describe("meta", () => {
		it("fetches and caches meta", async () => {
			const m = await cube.meta();
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/meta");
			assert.ok(m.cubes);
			const m2 = await cube.meta();
			assert.equal(calls.length, 1);
			assert.equal(m, m2);
		});
	});

	describe("explain", () => {
		it("posts query and returns sql", async () => {
			const result = await cube.explain({ measures: ["a"] });
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/explain");
			assert.deepEqual(calls[0].body, { measures: ["a"] });
			assert.deepEqual(result, { sql: "SELECT 1" });
		});
	});
});
