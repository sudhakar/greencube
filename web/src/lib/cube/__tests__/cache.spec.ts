import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { QueryCache } from "../cache.ts";

// ── fingerprint ──────────────────────────────────────────────────────────────

describe("fingerprint", () => {
	it("strips measures", () => {
		assert.equal(
			QueryCache.fingerprint({ measures: ["a"], filters: [] }),
			QueryCache.fingerprint({ measures: ["a", "b"], filters: [] }),
		);
	});

	it("includes dimensions in grouped mode", () => {
		assert.notEqual(
			QueryCache.fingerprint({ measures: ["a"], dimensions: ["d"] }),
			QueryCache.fingerprint({ measures: ["a"] }),
		);
	});

	it("excludes dimensions when ungrouped", () => {
		assert.equal(
			QueryCache.fingerprint({ measures: ["a"], dimensions: ["d"], ungrouped: true }),
			QueryCache.fingerprint({ measures: ["a"], ungrouped: true }),
		);
	});

	it("excludes timeDimensions when ungrouped", () => {
		assert.equal(
			QueryCache.fingerprint({
				measures: ["a"],
				timeDimensions: [{ dimension: "d", granularity: "month" }],
				ungrouped: true,
			}),
			QueryCache.fingerprint({ measures: ["a"], ungrouped: true }),
		);
	});

	it("sorts keys", () => {
		assert.equal(
			QueryCache.fingerprint({ order: { x: "asc" }, filters: [] }),
			QueryCache.fingerprint({ filters: [], order: { x: "asc" } }),
		);
	});
});

// ── selectCols ───────────────────────────────────────────────────────────────

describe("selectCols", () => {
	it("returns measures in grouped mode", () => {
		assert.deepEqual(
			QueryCache.selectCols({ measures: ["a", "b"], dimensions: ["c"] }),
			["a", "b"],
		);
	});

	it("includes dims + timeDims when ungrouped", () => {
		assert.deepEqual(
			QueryCache.selectCols({
				measures: ["m"],
				dimensions: ["d"],
				timeDimensions: [{ dimension: "d", granularity: "month" }],
				ungrouped: true,
			}),
			["m", "d", "d"], // timeDim.dimension duplicates dims entry
		);
	});

	it("returns empty for empty query", () => {
		assert.deepEqual(QueryCache.selectCols({}), []);
	});
});

// ── allCols ──────────────────────────────────────────────────────────────────

describe("allCols", () => {
	it("returns measures + dims + timeDims", () => {
		assert.deepEqual(
			QueryCache.allCols({
				measures: ["m"],
				dimensions: ["d"],
				timeDimensions: [{ dimension: "t", granularity: "month" }],
			}),
			["m", "d", "t"],
		);
	});

	it("includes dimensions in grouped mode", () => {
		assert.deepEqual(
			QueryCache.allCols({ measures: ["m"], dimensions: ["d"] }),
			["m", "d"],
		);
	});
});

// ── QueryCache instance ──────────────────────────────────────────────────────

describe("QueryCache", () => {
	let c: QueryCache;

	beforeEach(() => {
		c = new QueryCache();
	});

	describe("get / set", () => {
		it("get returns null for cold cache", () => {
			assert.equal(c.get({ measures: ["a"] }), null);
		});

		it("set then get returns data", () => {
			c.set({ measures: ["a"] }, [{ a: 1 }, { a: 2 }]);
			assert.deepEqual(c.get({ measures: ["a"] }), [
				{ a: 1 },
				{ a: 2 },
			]);
		});

		it("get returns same reference on repeated call", () => {
			c.set({ measures: ["a"] }, [{ a: 1 }]);
			assert.equal(c.get({ measures: ["a"] }), c.get({ measures: ["a"] }));
		});

		it("merged columns from partial fill", () => {
			const q1 = { measures: ["a"], filters: [] };
			const q2 = { measures: ["a", "b"], filters: [] };
			c.set(q1, [{ a: 1 }, { a: 2 }]);
			c.set(q2, [{ b: 10 }, { b: 20 }]);
			assert.deepEqual(c.get(q2), [
				{ a: 1, b: 10 },
				{ a: 2, b: 20 },
			]);
		});

		it("returns dimensions in grouped mode", () => {
			c.set(
				{ measures: ["x", "y"], dimensions: ["d"], filters: [] },
				[{ x: 10, y: 20, d: "a" }, { x: 30, y: 40, d: "b" }],
			);
			assert.deepEqual(
				c.get({ measures: ["x", "y"], dimensions: ["d"], filters: [] }),
				[{ x: 10, y: 20, d: "a" }, { x: 30, y: 40, d: "b" }],
			);
		});

		it("empty data does not store", () => {
			c.set({ measures: ["a"] }, []);
			assert.equal(c.get({ measures: ["a"] }), null);
		});

		it("keeps multiple materialized subsets after pure partial fill", () => {
			const fp = (q: object) => QueryCache.fingerprint(q);
			const rows = (q: object) => (c as any).entries.get(fp(q)).rows;

			c.set({ measures: ["a"], filters: [] }, [{ a: 1 }]);
			c.get({ measures: ["a"], filters: [] }); // materialize ["a"]
			c.set({ measures: ["a", "b"], filters: [] }, [{ b: 10 }]);
			c.get({ measures: ["a", "b"], filters: [] }); // materialize ["a","b"]

			assert.equal(rows({ measures: ["a"], filters: [] }).size, 2,
				"rows should hold both the subset and the superset keys");
		});

		it("grouped partial fill keeps subset for original columns", () => {
			const fp = (q: object) => QueryCache.fingerprint(q);
			const rows = (q: object) => (c as any).entries.get(fp(q)).rows;

			const q1 = { measures: ["a"], dimensions: ["d"], filters: [] };
			const q2 = { measures: ["a", "b"], dimensions: ["d"], filters: [] };

			c.set(q1, [{ a: 1, d: "x" }, { a: 2, d: "y" }]);
			c.get(q1); // materialize ["a","d"]
			c.set(q2, [{ a: 1, b: 10, d: "x" }, { a: 2, b: 20, d: "y" }]);
			c.get(q2); // materialize ["a","b","d"]

			// both subset and superset should coexist in rows
			assert.equal(rows(q1).size, 2,
				"rows should hold both the subset and the superset keys in grouped mode");
		});
	});

	describe("missing", () => {
		it("returns all selectCols for cold entry", () => {
			assert.deepEqual(c.missing({ measures: ["a", "b"] }), ["a", "b"]);
		});

		it("returns only uncached columns after partial set", () => {
			c.set({ measures: ["a", "b"], filters: [] }, [{ a: 1, b: 2 }]);
			assert.deepEqual(
				c.missing({ measures: ["a", "b", "c"], filters: [] }),
				["c"],
			);
		});

		it("returns empty when all selectCols cached", () => {
			c.set({ measures: ["a"] }, [{ a: 1 }]);
			assert.deepEqual(c.missing({ measures: ["a"] }), []);
		});
	});

	describe("invalidate", () => {
		it("removes entry from get", () => {
			c.set({ measures: ["z"] }, [{ z: 1 }]);
			assert.ok(c.get({ measures: ["z"] }));
			c.invalidate({ measures: ["z"] });
			assert.equal(c.get({ measures: ["z"] }), null);
		});

		it("clears associated inflight promises", async () => {
			const q = { measures: ["x"], filters: [] };
			const fp = QueryCache.fingerprint(q);
			c.dedup(fp + "|x", async () => "old");
			c.invalidate(q);
			const val = await c.dedup(fp + "|x", async () => "new");
			assert.equal(val, "new");
		});
	});

	describe("dedup", () => {
		it("returns same promise for same key", () => {
			let count = 0;
			const p1 = c.dedup("k", async () => { count++; return "a" });
			assert.equal(count, 1);
			const p2 = c.dedup("k", async () => { count++; return "b" });
			assert.equal(p1, p2);
			assert.equal(count, 1);
		});

		it("cleans up after completion", async () => {
			await c.dedup("clean", async () => "done");
			let count = 0;
			await c.dedup("clean", async () => { count++; return "again" });
			assert.equal(count, 1);
		});
	});

	describe("eviction", () => {
		it("FIFO when over max entries", () => {
			const c2 = new QueryCache(2);
			c2.set({ measures: ["a"], filters: [{ member: "a" }] }, [{ a: 1 }]);
			c2.set({ measures: ["b"], filters: [{ member: "b" }] }, [{ b: 2 }]);
			c2.set({ measures: ["c"], filters: [{ member: "c" }] }, [{ c: 3 }]);
			assert.equal(c2.get({ measures: ["a"], filters: [{ member: "a" }] }), null);
			assert.ok(c2.get({ measures: ["b"], filters: [{ member: "b" }] }));
			assert.ok(c2.get({ measures: ["c"], filters: [{ member: "c" }] }));
		});
	});

	describe("clear", () => {
		it("removes all entries", () => {
			c.set({ measures: ["x"] }, [{ x: 1 }]);
			c.set({ measures: ["y"] }, [{ y: 2 }]);
			c.clear();
			assert.equal(c.get({ measures: ["x"] }), null);
			assert.equal(c.get({ measures: ["y"] }), null);
			assert.equal(c.size, 0);
		});
	});

	describe("retain / release", () => {
		it("retain creates entry with ref", () => {
			c.retain({ measures: ["a"], filters: [] });
			assert.equal(c.size, 1);
		});

		it("two retains require two releases to free row", () => {
			const q = { measures: ["a"], filters: [] };
			c.retain(q);
			c.retain(q);
			c.set(q, [{ a: 1 }]);
			c.get(q); // materialize
			const fp = QueryCache.fingerprint(q);
			const ck = QueryCache.allCols(q).sort().join(",");
			c.release(q); // ref 2→1, row stays
			assert.ok((c as any).entries.get(fp).rows.get(ck));
			c.release(q); // ref 1→0, row deleted
			assert.equal((c as any).entries.get(fp).rows.size, 0);
		});

		it("release at ref=1 removes row but keeps entry with cols", () => {
			const q = { measures: ["a"], filters: [] };
			c.retain(q);
			c.set(q, [{ a: 1 }]);
			c.get(q); // materialize
			c.release(q);
			const e = (c as any).entries.get(QueryCache.fingerprint(q));
			assert.ok(e);
			assert.ok(e.cols.get("a"));
			assert.equal(e.rows.size, 0);
			assert.equal(e.refs.size, 0);
		});

		it("release on non-existent entry is no-op", () => {
			c.release({ measures: ["ghost"] });
			assert.equal(c.size, 0);
		});

		it("different colKeys tracked independently", () => {
			const q1 = { measures: ["a"], filters: [] };
			const q2 = { measures: ["a", "b"], filters: [] };
			c.retain(q1);
			c.retain(q2);
			c.set(q1, [{ a: 1 }]);
			c.set(q2, [{ b: 10 }]);
			c.get(q1);
			c.get(q2);
			const fp = QueryCache.fingerprint(q1);
			c.release(q1);
			// q1's row freed, q2's row remains
			const e = (c as any).entries.get(fp);
			const ck1 = QueryCache.allCols(q1).sort().join(",");
			const ck2 = QueryCache.allCols(q2).sort().join(",");
			assert.equal(e.rows.has(ck1), false);
			assert.ok(e.rows.get(ck2));
		});

		it("re-retain after release gives new materialization", () => {
			const q = { measures: ["a"], filters: [] };
			c.retain(q);
			c.set(q, [{ a: 1 }]);
			const r1 = c.get(q);
			c.release(q);
			c.retain(q);
			const r2 = c.get(q);
			assert.notEqual(r1, r2);
			assert.deepEqual(r1, r2);
		});
	});
});
