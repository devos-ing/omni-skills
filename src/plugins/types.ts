export interface RuntimePlugin {
  id: string;
  displayName: string;
  kind: "worker_adapter" | "evidence_source" | "review_integration";
  description: string;
}
