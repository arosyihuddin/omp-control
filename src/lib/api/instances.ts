import { postJson, request } from "./http";
export type InstanceStatus = "unknown" | "online" | "degraded" | "offline";
export interface Instance { id: string; name: string; baseUrl: string; status: InstanceStatus; version?: string; lastSeenAt?: string; createdAt: string; updatedAt: string; }
export interface HealthResult { status: InstanceStatus; checkedAt: string; latencyMs: number; error?: string; }
export const instancesApi = {
  list: () => request<{ instances: Instance[] }>("/control/v1/instances"),
  create: (body: { name: string; baseUrl: string; credential?: string }) => postJson<{ instance: Instance }>("/control/v1/instances", body),
  update: (id: string, body: Partial<{ name: string; baseUrl: string; credential: string }>) => request<{ instance: Instance }>("/control/v1/instances/" + encodeURIComponent(id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  remove: (id: string) => request<void>("/control/v1/instances/" + encodeURIComponent(id), { method: "DELETE" }),
  health: (id: string) => postJson<HealthResult>("/control/v1/instances/" + encodeURIComponent(id) + "/health-check"),
};
