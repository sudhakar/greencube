export interface TimeDim {
	dimension: string;
	granularity: string;
}

export type FilterOperator =
	| "equals" | "notEquals" | "contains" | "notContains"
	| "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte"
	| "inDateRange" | "notInDateRange" | "set" | "notSet"
	| "beforeDate" | "afterDate";

export interface Filter {
	member: string;
	operator?: FilterOperator;
	values?: unknown[];
}

export type MutationOp = "create" | "update" | "delete";

export interface Mutation {
	cube: string;
	operation: MutationOp;
	values?: Record<string, unknown>;
	filters?: Filter[];
	returning?: string[];
}

export interface Query {
	measures?: string[];
	dimensions?: string[];
	timeDimensions?: TimeDim[];
	filters?: Filter[];
	order?: Record<string, string>;
	limit?: number;
	offset?: number;
	ungrouped?: boolean;
}

export interface Field {
	name: string;
	title: string;
	type: string;
}

export interface Cube {
	name: string;
	measures: Field[];
	dimensions: Field[];
	timeDimensions: Field[];
}

export interface CubeMeta {
	cubes: Cube[];
	samples: { name: string; json: object }[];
	routes: { method: string; path: string; description: string }[];
}

export interface QueryResult {
	data: Record<string, unknown>[];
}
