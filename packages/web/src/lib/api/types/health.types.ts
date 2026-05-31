export type HealthResponse = { status: "ok" };

export interface HealthRequestOptions {
	signal?: AbortSignal;
}
