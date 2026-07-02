export interface TimeDim {
	dimension: string;
	granularity: string;
}

export interface Query {
	measures?: string[];
	dimensions?: string[];
	timeDimensions?: TimeDim[];
	filters?: unknown;
	order?: Record<string, string>;
	limit?: number;
	offset?: number;
	ungrouped?: boolean;
}
