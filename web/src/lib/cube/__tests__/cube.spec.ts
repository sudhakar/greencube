import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Cube } from "../cube.ts";
import type { Fetcher } from "../fetcher.ts";

type Row = Record<string, unknown>;

describe("Cube", () => {
	let calls: { path: string; body?: object }[];
	let cube: Cube;

	beforeEach(() => {
		calls = [];
		const fetch = ((path: string, body?: object) => {
			calls.push({ path, body });
			if (path === "/meta") {
				return Promise.resolve({
					cubes: [],
					samples: [],
					routes: [],
				});
			}
			if (path === "/explain") {
				return Promise.resolve({ sql: "SELECT 1" });
			}
			if (path === "/mutate") {
				return Promise.resolve({ data: [{ id: 1, name: "created" }] });
			}
			const q = body as any;
			const cols: string[] = [
				...(q?.measures ?? []),
				...(q?.dimensions ?? []),
				...(q?.timeDimensions ?? []).map((td: any) => td.dimension),
			];
			const row: Row = {};
			for (const c of cols) row[c] = 1;
			return Promise.resolve({ data: [row] });
		}) as Fetcher;
		cube = new Cube(fetch);
	});

	describe("query", () => {
		it("returns cached data on hit", async () => {
			cube.cache.set({ measures: ["a"] }, [{ a: 1 }]);
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
			cube.cache.set({ measures: ["a"], filters: [] }, [{ a: 1 }]);
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
			cube.cache.set({ measures: ["a"], filters: [] }, [{ a: 10 }]);
			const r = await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(r[0].a, 10); // preserved from original
			assert.equal(r[0].b, 1); // from partial fetch
		});

		it("returns same ref on repeated partial queries", async () => {
			cube.cache.set({ measures: ["a"], filters: [] }, [{ a: 1 }]);
			await cube.query({ measures: ["a", "b"], filters: [] });
			const r1 = await cube.query({ measures: ["a", "b"], filters: [] });
			const r2 = await cube.query({ measures: ["a", "b"], filters: [] });
			assert.equal(r1, r2);
		});

		it("grouped vs ungrouped use different fingerprints", async () => {
			await cube.query({ measures: ["a"], dimensions: ["d"] });
			await cube.query({ measures: ["a"], dimensions: ["d"], ungrouped: true });
			assert.equal(calls.length, 2);
		});

		it("partial hit in ungrouped mode fetches only missing dimensions", async () => {
			cube.cache.set(
				{ dimensions: ["d1"], ungrouped: true, filters: [] },
				[{ d1: "x" }],
			);
			await cube.query(
				{ dimensions: ["d1", "d2"], ungrouped: true, filters: [] },
			);
			assert.equal(calls.length, 1);
			const fetchQ = calls[0].body as any;
			assert.deepEqual(fetchQ.dimensions, ["d2"]);
		});

		it("rejects when fetch fails", async () => {
			const c = new Cube(() => Promise.reject(new Error("network error")));
			await assert.rejects(
				c.query({ measures: ["err"] }),
				/network error/,
			);
		});

		it("does not populate cache on fetch failure", async () => {
			const c = new Cube(() => Promise.reject(new Error("fail")));
			const q = { measures: ["x"], filters: [] };
			await c.query(q).catch(() => {});
			assert.equal(c.cache.get(q), null);
		});

		it("allows re-fetch after previous failure", async () => {
			let fail = true;
			const flakyFetch = (() => {
				return fail ? Promise.reject(new Error("nope")) : Promise.resolve({ data: [{ x: 1 }] });
			}) as Fetcher;
			const c = new Cube(flakyFetch);
			const q = { measures: ["x"], filters: [] };
			await c.query(q).catch(() => {});
			assert.equal(c.cache.get(q), null);
			fail = false;
			const r = await c.query(q);
			assert.deepEqual(r, [{ x: 1 }]);
		});
	});

	describe("meta", () => {
		it("fetches and caches meta", async () => {
			const m = await cube.meta();
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/meta");
			assert.ok(m.cubes);
			const m2 = await cube.meta();
			assert.equal(calls.length, 1); // cached, no second fetch
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

	describe("mutate", () => {
		it("posts mutation and returns data", async () => {
			const result = await cube.mutate({
				cube: "Customers",
				operation: "create",
				values: { name: "new" },
			});
			assert.equal(calls.length, 1);
			assert.equal(calls[0].path, "/mutate");
			assert.deepEqual(calls[0].body, {
				cube: "Customers",
				operation: "create",
				values: { name: "new" },
			});
			assert.deepEqual(result, { data: [{ id: 1, name: "created" }] });
		});

		it("sends update with filters", async () => {
			await cube.mutate({
				cube: "Customers",
				operation: "update",
				values: { country: "CA" },
				filters: [{ member: "name", operator: "equals", values: ["Alice"] }],
			});
			assert.equal(calls[0].path, "/mutate");
			assert.deepEqual(calls[0].body, {
				cube: "Customers",
				operation: "update",
				values: { country: "CA" },
				filters: [{ member: "name", operator: "equals", values: ["Alice"] }],
			});
		});

		it("sends delete with filters", async () => {
			await cube.mutate({
				cube: "Customers",
				operation: "delete",
				filters: [{ member: "name", operator: "equals", values: ["Grace"] }],
			});
			assert.equal(calls.length, 1);
			assert.equal((calls[0].body as any).operation, "delete");
		});
	});
});
