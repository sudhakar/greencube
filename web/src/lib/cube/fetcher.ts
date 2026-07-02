export type Fetcher = <T>(path: string, body?: object) => Promise<T>;

const BASE = "http://localhost:3003/cube";

export function fetcher(baseUrl: string = BASE): Fetcher {
	return async (path, body) => {
		const url = `${baseUrl}${path}`;
		const opts: RequestInit = {
			method: body ? "POST" : "GET",
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		};
		const res = await fetch(url, opts);
		if (!res.ok) {
			const b = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(b.error ?? `Request failed: ${res.statusText}`);
		}
		return res.json();
	};
}
