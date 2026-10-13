import type {
  Approval,
  EditorSession,
  FavoriteEntry,
  PinEntry,
  Profile,
  RecentEntry,
  WorkspaceState,
  WorkspaceStat,
  ApprovalDecision,
  DashboardSnapshot,
  Session,
  TerminalInfo,
  Tool,
  ToolCustomRule,
  ToolCallLog,
  WorkspaceItem,
} from '$lib/types';
import { postJson, request } from './http';
import { runtimeUrl } from './runtime-url';

export { errorMessage } from './http';

const enc = encodeURIComponent;


type TunnelStatus = 'starting' | 'active' | 'stopping' | 'stopped' | 'error';
export interface TunnelInfo {
  id: string;
  targetUrl: string;
  status: TunnelStatus;
  publicUrl: string | null;
  createdAt: string;
  logs: string[];
  error: string | null;
}
export interface CloudflaredStatus { installed: boolean; path: string | null; version: string | null; available?: boolean; reason?: string; }
interface RuntimeTunnel {
  id: string;
  target: string;
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  publicUrl?: string;
  createdAt: string;
  logs: string[];
  error?: string;
}
export function normalizeTunnelInfo(tunnel: RuntimeTunnel): TunnelInfo {
  return {
    id: tunnel.id,
    targetUrl: tunnel.target,
    status: tunnel.state === 'running' ? 'active' : tunnel.state,
    publicUrl: tunnel.publicUrl ?? null,
    createdAt: tunnel.createdAt,
    logs: tunnel.logs ?? [],
    error: tunnel.error ?? null,
  };
}
export const tunnelsApi = {
  list: async () => (await request<{ tunnels: RuntimeTunnel[] }>('/api/tunnels')).tunnels.map(normalizeTunnelInfo),
  status: () => request<CloudflaredStatus>('/api/tunnels/status'),
  eventsUrl: () => runtimeUrl('/api/tunnels/events'),
  start: async (targetUrl: string) => normalizeTunnelInfo((await postJson<{ tunnel: RuntimeTunnel }>('/api/tunnels', { target: targetUrl })).tunnel),
  stop: async (id: string) => normalizeTunnelInfo((await postJson<{ tunnel: RuntimeTunnel }>('/api/tunnels/' + enc(id) + '/stop')).tunnel),
};

export const dashboardApi = {
  snapshot: () => request<DashboardSnapshot>('/api/dashboard'),
};

export interface OmpSetting {
  id: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'array' | 'record';
  label: string;
  description: string;
  tab: string;
  group: string;
  warning?: string;
  condition?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  runtimeOptions?: boolean;
  enumValues?: string[];
  defaultValue: unknown;
  value: unknown;
  configured: boolean;
  hasValue: boolean;
  secret: boolean;
  provenance: 'env' | 'runtime' | 'overlay' | 'project' | 'global' | 'default';
  envName: string | null;
  envFallback: boolean | 'blank';
}

export const ompConfigApi = {
  list: () => request<{ configPath: string; settings: OmpSetting[] }>('/api/omp/config'),
  update: async (id: string, value: unknown) =>
    (await request<{ setting: OmpSetting }>('/api/omp/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, value }),
    })).setting,
  reset: async (id: string) =>
    (await postJson<{ setting: OmpSetting }>('/api/omp/config/reset', { id })).setting,
};

export const toolsApi = {
  list: async () => (await request<{ tools: Tool[] }>('/api/tools')).tools ?? [],
  setExposed: async (name: string, exposed: boolean) =>
    (await request<{ tool: Tool }>(`/api/tools/${enc(name)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ exposed }),
    })).tool,
  setPermission: async (name: string, permission: Tool['permission'] | null, customRule?: ToolCustomRule) =>
    (await request<{ tool: Tool }>(`/api/tools/${enc(name)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ permission, ...(customRule ? { customRule } : {}) }),
    })).tool,
  setSectionPermission: async (section: Tool['section'], permission: Tool['permission'], customRule?: ToolCustomRule) =>
    request<{ tools: Tool[]; sectionPermissions: Record<Tool['section'], Tool['permission']>; sectionCustomRules: Record<Tool['section'], ToolCustomRule> }>(`/api/tools/sections/${section}/permission`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ permission, ...(customRule ? { customRule } : {}) }),
    }),
};

export const approvalsApi = {
  list: async () => (await request<{ approvals: Approval[] }>('/api/approvals')).approvals ?? [],
  decide: (id: string, decision: ApprovalDecision) => postJson(`/api/approvals/${enc(id)}/${decision}`),
  clear: () => postJson('/api/approvals/clear'),
};

export interface OmpModelOption {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
}

export const sessionsModelsApi = {
  list: (cwd: string) => request<{ models: OmpModelOption[]; defaultModel: string | null }>(`/api/models?cwd=${enc(cwd)}`),
};

export const sessionsApi = {
  create: (input: { task: string; cwd: string; model?: string }) =>
    postJson<{ session: Session }>('/api/sessions', input).then((data) => data.session),
  resume: (sessionId: string, task: string) =>
    postJson<{ session: Session }>(`/api/sessions/${enc(sessionId)}/resume`, { task }).then((data) => data.session),
  act: (sessionId: string, action: 'interrupt' | 'dispose') =>
    postJson<Session | { session_id: string; disposed: boolean }>(`/api/sessions/${enc(sessionId)}/${action}`),
};

export const logsApi = {
  list: async (limit = 200) => (await request<{ logs: ToolCallLog[] }>(`/api/logs?limit=${limit}`)).logs ?? [],
};

export type TerminalScope = 'general' | 'project';

export const terminalsApi = {
  list: async (scope: TerminalScope, workspaceRoot?: string) => {
    const params = new URLSearchParams({ scope });
    if (workspaceRoot) params.set('workspaceRoot', workspaceRoot);
    return (await request<{ terminals: TerminalInfo[] }>(`/api/terminals?${params.toString()}`)).terminals ?? [];
  },
  create: async (input: { scope: TerminalScope; cwd?: string; title?: string; workspaceRoot?: string }) =>
    (await postJson<{ terminal: TerminalInfo }>('/api/terminals', input)).terminal,
  close: (id: string) => request(`/api/terminals/${enc(id)}`, { method: 'DELETE' }),
  socketUrl: (id: string) => (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + runtimeUrl('/api/terminal/socket?id=' + enc(id)),
};

export const workspaceApi = {
  list: (path: string) => request<{ path: string; items: WorkspaceItem[] }>(`/api/workspace?path=${enc(path)}`),
  remove: (path: string) => request(`/api/workspace?path=${enc(path)}`, { method: 'DELETE' }),
  readFile: async (path: string) =>
    (await request<{ content?: string }>(`/api/workspace/file?path=${enc(path)}`)).content ?? '',
  writeFile: (path: string, content: string) =>
    request(`/api/workspace/file?path=${enc(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: content,
    }),
  previewUrl: (path: string) => runtimeUrl('/api/workspace/preview?path=' + enc(path)),
  create: (path: string, type: 'file' | 'directory') => postJson<{ path: string }>('/api/workspace/create', { path, type }),
  rename: (path: string, newName: string) => postJson<{ path: string; name: string }>('/api/workspace/rename', { path, newName }),
  duplicate: (path: string) => postJson<{ path: string; name: string }>('/api/workspace/duplicate', { path }),
  move: (path: string, destDir: string) => postJson<{ path: string }>('/api/workspace/move', { path, destDir }),
  stat: (path: string) => request<WorkspaceStat>(`/api/workspace/stat?path=${enc(path)}`),
  downloadUrl: (path: string) => runtimeUrl('/api/workspace/download?path=' + enc(path)),
};

export const profileApi = {
  get: () => request<Profile>('/api/profile'),
  update: (input: Partial<Pick<Profile, 'displayName' | 'role' | 'avatarColor'>>) =>
    request<Profile>('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
};

const put = <T>(url: string, body: unknown) =>
  request<T>(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const workspaceStateApi = {
  state: () => request<WorkspaceState>('/api/workspace/state'),
  addPin: (path: string, name: string) => postJson<{ pins: PinEntry[] }>('/api/workspace/pins', { path, name }),
  removePin: (path: string) => request<{ pins: PinEntry[] }>(`/api/workspace/pins?path=${enc(path)}`, { method: 'DELETE' }),
  reorderPins: (paths: string[]) => put<{ pins: PinEntry[] }>('/api/workspace/pins/order', { paths }),
  addFavorite: (path: string, name: string, type: 'file' | 'directory') =>
    postJson<{ favorites: FavoriteEntry[] }>('/api/workspace/favorites', { path, name, type }),
  removeFavorite: (path: string) =>
    request<{ favorites: FavoriteEntry[] }>(`/api/workspace/favorites?path=${enc(path)}`, { method: 'DELETE' }),
  touchRecent: (path: string, name: string) => postJson<{ recents: RecentEntry[] }>('/api/workspace/recents', { path, name }),
  clearRecents: () => request<{ recents: RecentEntry[] }>('/api/workspace/recents', { method: 'DELETE' }),
  setPref: (key: string, value: string) => put<{ prefs: Record<string, string> }>('/api/workspace/prefs', { key, value }),
  getEditorSession: async (root: string) =>
    (await request<{ session: EditorSession | null }>(`/api/workspace/editor-session?root=${enc(root)}`)).session,
  saveEditorSession: (root: string, tabs: string[], activePath: string | null) =>
    put<{ session: EditorSession | null }>('/api/workspace/editor-session', { root, tabs, activePath }),
};
