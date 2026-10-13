export type RiskLevel = 'low' | 'medium' | 'high' | 'isolated';

export type ToolPermission = 'always_allow' | 'require_approval' | 'blocked' | 'custom';
export type ToolPermissionSection = 'read_only' | 'edit_delete' | 'other';
export type ToolCustomRule = 'approval' | 'high_risk' | 'block_high_risk';

export interface Tool {
  name: string;
  group: string;
  risk: RiskLevel;
  description: string;
  exposed: boolean;
  section: ToolPermissionSection;
  permission: ToolPermission;
  permissionOverride: ToolPermission | null;
  sectionPermission: ToolPermission;
  customRule: ToolCustomRule;
  sectionCustomRule: ToolCustomRule;
}

interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
  toolName?: string;
  toolCallId?: string;
  arguments?: string;
  result?: string;
  status?: "running" | "completed" | "failed";
  isError?: boolean;
}

export interface Session {
  sessionId: string;
  status: string;
  model?: string;
  task?: string;
  cwd?: string;
  createdAt?: string;
  updatedAt?: string;
  collab?: { webUrl?: string; viewUrl?: string; instanceId?: string };
  result?: string;
  error?: string;
  output?: string[];
  messages?: SessionMessage[];
}

type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';
export type ApprovalDecision = 'approve' | 'approve-session' | 'deny';

export interface Approval {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  risk: 'medium' | 'high';
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  sessionId?: string;
  requestId: string | number;
  reason?: string;
}

export interface ToolCallLog {
  id: string;
  timestamp: string;
  requestId: string | null;
  sessionId: string | null;
  toolName: string;
  status: string;
  approval: string | null;
  durationMs: number | null;
  arguments: string | null;
  result: string | null;
  error: string | null;
}

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  scope?: 'general' | 'project';
  workspaceRoot?: string;
  status: 'running' | 'exited';
  createdAt: string;
  updatedAt: string;
  exitCode?: number;
}

export interface WorkspaceItem {
  name: string;
  type: 'directory' | 'file';
  size: number | null;
  modified: string;
  ignored?: boolean;
}

interface GpuDevice {
  name?: string;
  utilization_gpu_percent?: number;
  temperature_c?: number;
  memory_used_mib?: number;
  memory_total_mib?: number;
  power_draw_w?: number;
}

export interface SystemTelemetry {
  os?: { hostname?: string; pretty_name?: string; platform?: string; architecture?: string; kernel?: string };
  desktop?: { environment?: string; display_server?: string };
  cpu?: { logical_cores?: number; usage_percent?: number | null; load_average?: Record<'1m' | '5m' | '15m', number> };
  memory?: { used_bytes?: number; total_bytes?: number; usage_percent?: number };
  disk?: { path?: string; used_bytes?: number; total_bytes?: number; usage_percent?: number };
  gpu?: { devices?: GpuDevice[] };
  runtime?: Record<string, string | null>;
  network?: {
    interfaces?: { name: string; up: boolean; address_count: number; families?: string[] }[];
  };
}

export interface ServiceTelemetry {
  transport?: string;
  httpPort?: number | string;
}

export interface HostTelemetry {
  system?: SystemTelemetry;
  service?: ServiceTelemetry;
}

export interface DashboardSnapshot {
  host?: HostTelemetry;
  toolCount?: number;
  toolRiskCounts?: Partial<Record<RiskLevel, number>>;
  sessions?: Session[];
  approvalCount?: number;
}

export interface Profile {
  id: string;
  displayName: string;
  role: string | null;
  avatarColor: string | null;
}
export interface PinEntry {
  path: string;
  name: string;
  sortOrder: number;
}
export interface FavoriteEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
}
export interface RecentEntry {
  path: string;
  name: string;
  openedAt: string;
}
export interface WorkspaceStat {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number | null;
  created: string;
  modified: string;
  mode: string;
  children?: number;
}
export interface WorkspaceState {
  pins: PinEntry[];
  favorites: FavoriteEntry[];
  recents: RecentEntry[];
  prefs: Record<string, string>;
}
export interface EditorSession {
  root: string;
  tabs: string[];
  activePath: string | null;
}
