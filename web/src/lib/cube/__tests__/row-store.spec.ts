import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RowStore } from "../row-store.ts";

describe("RowStore", () => {
	let store: RowStore;

	beforeEach(() => {
		store = new RowStore();
	});

	it("starts empty", () => {
		assert.equal(store.size, 0);
		assert.equal(store.totalRows, 0);
		assert.equal(store.isSeeded("Customers"), false);
	});

	it("seed populates rows by composite key", () => {
		store.seed("Customers", ["id"], [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		assert.equal(store.size, 1);
		assert.equal(store.totalRows, 2);
		assert.equal(store.isSeeded("Customers"), true);
	});

	it("get returns row by key", () => {
		store.seed("Customers", ["id"], [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		assert.deepEqual(store.get("Customers", { id: 1 }), {
			id: 1,
			name: "Alice",
		});
		assert.equal(store.get("Customers", { id: 99 }), undefined);
	});

	it("get with multi-field composite key", () => {
		store.seed("Orders", ["id", "date"], [
			{ id: 1, date: "2024-01-01", amount: 100 },
			{ id: 1, date: "2024-02-01", amount: 200 },
		]);
		assert.deepEqual(
			store.get("Orders", { id: 1, date: "2024-02-01" }),
			{ id: 1, date: "2024-02-01", amount: 200 },
		);
	});

	it("upsert adds new row", () => {
		store.seed("Customers", ["id"], [{ id: 1, name: "Alice" }]);
		store.upsert("Customers", { id: 2, name: "Bob" });
		assert.equal(store.totalRows, 2);
		assert.deepEqual(store.get("Customers", { id: 2 }), {
			id: 2,
			name: "Bob",
		});
	});

	it("upsert updates existing row", () => {
		store.seed("Customers", ["id"], [{ id: 1, name: "Alice" }]);
		store.upsert("Customers", { id: 1, name: "Alice Updated" });
		assert.equal(store.totalRows, 1);
		assert.deepEqual(
			store.get("Customers", { id: 1 }),
			{ id: 1, name: "Alice Updated" },
		);
	});

	it("remove deletes a row", () => {
		store.seed("Customers", ["id"], [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		store.remove("Customers", { id: 1 });
		assert.equal(store.totalRows, 1);
		assert.equal(store.get("Customers", { id: 1 }), undefined);
	});

	it("invalidate clears all rows for a cube", () => {
		store.seed("Customers", ["id"], [{ id: 1, name: "Alice" }]);
		store.seed("Orders", ["id"], [{ id: 1, amount: 100 }]);
		store.invalidate("Customers");
		assert.equal(store.isSeeded("Customers"), false);
		assert.equal(store.isSeeded("Orders"), true);
	});

	it("clear removes everything", () => {
		store.seed("Customers", ["id"], [{ id: 1, name: "Alice" }]);
		store.seed("Orders", ["id"], [{ id: 1, amount: 100 }]);
		store.clear();
		assert.equal(store.size, 0);
		assert.equal(store.totalRows, 0);
	});

	it("all returns all rows for a cube", () => {
		store.seed("Customers", ["id"], [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		const rows = store.all("Customers");
		assert.equal(rows.length, 2);
	});

	it("all returns empty array for unknown cube", () => {
		assert.deepEqual(store.all("Ghost"), []);
	});

	it("upsert on unseeded cube is no-op", () => {
		store.upsert("Ghost", { id: 1 });
		assert.equal(store.totalRows, 0);
	});

	it("remove on unseeded cube is no-op", () => {
		store.remove("Ghost", { id: 1 });
		assert.equal(store.totalRows, 0);
	});
});

describe("RowStore query-level methods", () => {
	let store: RowStore;

	beforeEach(() => {
		store = new RowStore();
	});

	it("getByQuery returns null for cold store", () => {
		assert.equal(
			store.getByQuery({
				measures: ["Orders.amount"],
				dimensions: ["Orders.id"],
				ungrouped: true,
			}),
			null,
		);
	});

	it("setByQuery then getByQuery returns rows", () => {
		store.setByQuery(
			{ dimensions: ["Orders.id"], ungrouped: true },
			[{ "Orders.id": 1, amount: 100 }],
		);
		const r = store.getByQuery({
			measures: ["Orders.amount"],
			dimensions: ["Orders.id"],
			ungrouped: true,
		});
		assert.ok(r);
		assert.equal(r!.length, 1);
	});

	it("setByQuery infers cube name from dimension prefix", () => {
		store.setByQuery(
			{ dimensions: ["Customers.id"], ungrouped: true },
			[{ "Customers.id": 1 }],
		);
		assert.ok(store.isSeeded("Customers"));
	});

	it("setByQuery does not seed multi-cube query", () => {
		store.setByQuery(
			{ dimensions: ["A.id", "B.id"], ungrouped: true },
			[{ "A.id": 1, "B.id": 2 }],
		);
		assert.equal(store.size, 0);
	});

	it("setByQuery does not seed query without dimensions", () => {
		store.setByQuery(
			{ measures: ["Orders.amount"], ungrouped: true },
			[{ "Orders.amount": 100 }],
		);
		assert.equal(store.size, 0);
	});

	it("setByQuery empty data does not seed", () => {
		store.setByQuery(
			{ dimensions: ["Orders.id"], ungrouped: true },
			[],
		);
		assert.equal(store.size, 0);
	});

	it("invalidateByQuery drops cube", () => {
		store.seed("Orders", ["id"], [{ id: 1 }]);
		store.invalidateByQuery({
			measures: ["Orders.amount"],
			dimensions: ["Orders.id"],
		});
		assert.equal(store.isSeeded("Orders"), false);
	});

	it("invalidateByQuery on unknown cube is no-op", () => {
		store.invalidateByQuery({
			measures: ["Ghost.id"],
			dimensions: ["Ghost.name"],
		});
		assert.equal(store.size, 0);
	});

	it("setByQuery re-seeds same cube", () => {
		store.setByQuery(
			{ dimensions: ["Orders.id"], ungrouped: true },
			[{ "Orders.id": 1 }],
		);
		store.setByQuery(
			{ dimensions: ["Orders.id"], ungrouped: true },
			[{ "Orders.id": 2 }],
		);
		assert.equal(store.totalRows, 1);
		assert.deepEqual(store.get("Orders", { "Orders.id": 2 }), {
			"Orders.id": 2,
		});
	});
});

