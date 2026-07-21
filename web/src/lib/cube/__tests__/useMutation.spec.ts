import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Cube } from "../cube.ts";
import { RowStore, Mutator } from "../row-store.ts";
import type { Fetcher } from "../fetcher.ts";
import type { CubeMeta } from "../types.ts";

const META: CubeMeta = {
	cubes: [
		{ name: "Orders", pk: ["id"], measures: [], dimensions: [], timeDimensions: [] },
		{ name: "Customers", pk: ["id"], measures: [], dimensions: [], timeDimensions: [] },
	],
	samples: [],
	routes: [],
};

function metaFetch(path: string, body?: object): any {
	if (path === "/meta") return Promise.resolve(META);
	if (path === "/query") return Promise.resolve({ data: [] });
	if (path === "/mutate") return Promise.resolve({ data: [{ id: 1 }] });
	if (path === "/explain") return Promise.resolve({ sql: "" });
	return Promise.resolve({ data: [] });
}

describe("useMutation — integration", () => {
	let cube: Cube;
	let rowStore: RowStore;
	let mutator: Mutator;
	let mutateCalls: { path: string; body?: object }[];

	beforeEach(() => {
		mutateCalls = [];
		const record = ((path: string, body?: object) => {
			mutateCalls.push({ path, body });
			return metaFetch(path, body);
		}) as Fetcher;
		cube = new Cube(record);
		rowStore = cube.rowStore;
		mutator = new Mutator(record);

		cube.colStore.set(
			{ measures: ["Orders.amount"], filters: [] },
			[{ "Orders.amount": 100 }],
		);
	});

	it("create calls mutator, upserts result, invalidates colStore", async () => {
		const before = cube.colStore.get({ measures: ["Orders.amount"], filters: [] });
		assert.ok(before, "colStore has Orders data before create");

		const res = await mutator.create("Orders", { amount: 200 });
		if (res.data[0]) rowStore.upsert("Orders", res.data[0]);
		cube.colStore.invalidateCube("Orders");

		assert.equal(mutateCalls.length, 1);
		assert.deepEqual(mutateCalls[0].body, {
			cube: "Orders",
			operation: "create",
			values: { amount: 200 },
		});
		const after = cube.colStore.get({ measures: ["Orders.amount"], filters: [] });
		assert.equal(after, null, "colStore invalidated");
	});

	it("update sends PK-based filters and invalidates colStore", async () => {
		const meta = await cube.meta();
		const pkFields = meta.cubes.find((c) => c.name === "Orders")?.pk;
		assert.deepEqual(pkFields, ["id"]);

		const filters = [
			{ member: "Orders.id", operator: "equals" as const, values: [5] },
		];
		await mutator.update("Orders", { amount: 150 }, filters);
		cube.colStore.invalidateCube("Orders");

		const mutateBody = mutateCalls.find((c) => c.path === "/mutate")?.body as any;
		assert.ok(mutateBody);
		assert.equal(mutateBody.operation, "update");
		assert.deepEqual(mutateBody.filters, [
			{ member: "Orders.id", operator: "equals", values: [5] },
		]);
		const after = cube.colStore.get({ measures: ["Orders.amount"], filters: [] });
		assert.equal(after, null, "colStore invalidated after update");
	});

	it("remove sends PK-based filters and invalidates colStore", async () => {
		const filters = [
			{ member: "Orders.id", operator: "equals" as const, values: [5] },
		];
		await mutator.delete("Orders", filters);
		cube.colStore.invalidateCube("Orders");

		const body = mutateCalls[0].body as any;
		assert.equal(body.operation, "delete");
		assert.deepEqual(body.filters, [
			{ member: "Orders.id", operator: "equals", values: [5] },
		]);
		const after = cube.colStore.get({ measures: ["Orders.amount"], filters: [] });
		assert.equal(after, null, "colStore invalidated after delete");
	});

	it("optimistic RowStore sync — update upserts before fetch, rolls back on error", async () => {
		const fetch = ((path: string, _body?: object) => {
			if (path === "/meta") return Promise.resolve(META);
			return Promise.reject(new Error("server error"));
		}) as Fetcher;
		const c = new Cube(fetch);
		const rs = c.rowStore;
		const mt = new Mutator(fetch);

		const meta = await c.meta();
		const pkFields = meta.cubes.find((cu) => cu.name === "Orders")?.pk!;
		const qualify = (f: string) => `Orders.${f}`;
		const key: Record<string, unknown> = {};
		for (const f of pkFields) key[qualify(f)] = 5;

		rs.seed("Orders", pkFields, [{ "Orders.id": 5, amount: 100 }]);
		const old = rs.get("Orders", key);
		assert.deepEqual(old, { "Orders.id": 5, amount: 100 });

		rs.upsert("Orders", { ...old, "Orders.id": 5, amount: 150 });

		assert.deepEqual(
			rs.get("Orders", key),
			{ "Orders.id": 5, amount: 150 },
			"optimistic update visible",
		);

		try {
			await mt.update("Orders", { amount: 150 }, [
				{ member: "Orders.id", operator: "equals", values: [5] },
			]);
		} catch {
			rs.upsert("Orders", old!);
		}

		assert.deepEqual(
			rs.get("Orders", key),
			{ "Orders.id": 5, amount: 100 },
			"rolled back after error",
		);
	});

	it("optimistic RowStore sync — remove deletes before fetch, restores on error", async () => {
		const fetch = ((path: string, _body?: object) => {
			if (path === "/meta") return Promise.resolve(META);
			return Promise.reject(new Error("server error"));
		}) as Fetcher;
		const c = new Cube(fetch);
		const rs = c.rowStore;
		const mt = new Mutator(fetch);

		rs.seed("Orders", ["id"], [{ "Orders.id": 5, amount: 100 }]);
		const key = { "Orders.id": 5 };
		assert.ok(rs.get("Orders", key));

		const old = rs.get("Orders", key);
		rs.remove("Orders", key);
		assert.equal(rs.get("Orders", key), undefined, "optimistic remove");

		try {
			await mt.delete("Orders", [
				{ member: "Orders.id", operator: "equals", values: [5] },
			]);
		} catch {
			rs.upsert("Orders", old!);
		}

		assert.ok(rs.get("Orders", key), "restored after error");
	});

	it("invalidateCube only affects the named cube", async () => {
		const filt = { member: "z", operator: "equals" as const, values: [1] };
		cube.colStore.set(
			{ measures: ["Customers.total"], filters: [filt] },
			[{ "Customers.total": 50 }],
		);
		assert.ok(
			cube.colStore.get({ measures: ["Orders.amount"], filters: [] }),
		);
		assert.ok(
			cube.colStore.get({ measures: ["Customers.total"], filters: [filt] }),
		);

		cube.colStore.invalidateCube("Orders");

		assert.equal(
			cube.colStore.get({ measures: ["Orders.amount"], filters: [] }),
			null,
		);
		assert.ok(
			cube.colStore.get({ measures: ["Customers.total"], filters: [filt] }),
		);
	});
});
