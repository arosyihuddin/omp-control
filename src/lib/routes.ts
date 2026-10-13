import {
  Activity,
  Brain,
  Code2,
  Cpu,
  Folder,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Network,
  Palette,
  Plug,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Terminal as TerminalIcon,
  Wrench,
  type LucideIcon,
} from '@lucide/svelte';

export type ConfigSection = 'all' | 'model' | 'interaction' | 'appearance' | 'providers' | 'context' | 'memory' | 'files' | 'tools' | 'shell' | 'tasks' | 'internal';

export type RouteId =
  | 'overview' | 'tools' | 'approvals' | 'sessions' | 'omp-config'
  | 'omp-config-model' | 'omp-config-interaction' | 'omp-config-appearance'
  | 'omp-config-providers' | 'omp-config-context' | 'omp-config-memory'
  | 'omp-config-files' | 'omp-config-tools' | 'omp-config-shell'
  | 'omp-config-tasks' | 'omp-config-internal'
  | 'terminal' | 'logs' | 'tunnels'
  | 'workspace-favorites' | 'workspace-files' | 'workspace-editor';

export interface RouteDef {
  id: RouteId;
  path: string;
  title: string;
  icon: LucideIcon;
}

/** Single source of truth for URLs, titles and navigation icons. */
export const routes: Record<RouteId, RouteDef> = {
  overview: { id: 'overview', path: '/overview', title: 'Overview', icon: LayoutDashboard },
  tools: { id: 'tools', path: '/tools', title: 'Tools', icon: Wrench },
  approvals: { id: 'approvals', path: '/approvals', title: 'Approvals', icon: ShieldCheck },
  'omp-config': { id: 'omp-config', path: '/omp/configuration', title: 'All settings', icon: SlidersHorizontal },
  'omp-config-model': { id: 'omp-config-model', path: '/omp/configuration/model', title: 'Model', icon: Cpu },
  'omp-config-interaction': { id: 'omp-config-interaction', path: '/omp/configuration/interaction', title: 'Interaction', icon: MessageSquare },
  'omp-config-appearance': { id: 'omp-config-appearance', path: '/omp/configuration/appearance', title: 'Appearance', icon: Palette },
  'omp-config-providers': { id: 'omp-config-providers', path: '/omp/configuration/providers', title: 'Providers', icon: Plug },
  'omp-config-context': { id: 'omp-config-context', path: '/omp/configuration/context', title: 'Context', icon: Network },
  'omp-config-memory': { id: 'omp-config-memory', path: '/omp/configuration/memory', title: 'Memory', icon: Brain },
  'omp-config-files': { id: 'omp-config-files', path: '/omp/configuration/files', title: 'Files', icon: Folder },
  'omp-config-tools': { id: 'omp-config-tools', path: '/omp/configuration/tools', title: 'Tools', icon: Wrench },
  'omp-config-shell': { id: 'omp-config-shell', path: '/omp/configuration/shell', title: 'Shell', icon: TerminalIcon },
  'omp-config-tasks': { id: 'omp-config-tasks', path: '/omp/configuration/tasks', title: 'Tasks', icon: ListChecks },
  'omp-config-internal': { id: 'omp-config-internal', path: '/omp/configuration/internal', title: 'Internal', icon: Code2 },
  sessions: { id: 'sessions', path: '/sessions', title: 'Sessions', icon: Activity },
  terminal: { id: 'terminal', path: '/terminal', title: 'Terminal', icon: TerminalIcon },
  logs: { id: 'logs', path: '/logs', title: 'Logs', icon: ScrollText },
  tunnels: { id: 'tunnels', path: '/tunnels', title: 'Tunnels', icon: Network },
  'workspace-favorites': { id: 'workspace-favorites', path: '/workspace/favorites', title: 'Favorites', icon: Star },
  'workspace-files': { id: 'workspace-files', path: '/workspace/files', title: 'Files', icon: Folder },
  'workspace-editor': { id: 'workspace-editor', path: '/workspace/editor', title: 'Editor', icon: Code2 },
};

export const configNav: RouteId[] = [
  'omp-config', 'omp-config-model', 'omp-config-interaction', 'omp-config-appearance',
  'omp-config-providers', 'omp-config-context', 'omp-config-memory', 'omp-config-files',
  'omp-config-tools', 'omp-config-shell', 'omp-config-tasks', 'omp-config-internal',
];
export const mainNav: RouteId[] = ['overview', 'tools', 'approvals', 'terminal', 'logs', 'tunnels'];
export const workspaceNav: RouteId[] = ['workspace-favorites', 'workspace-files', 'workspace-editor'];

const byPath = new Map<string, RouteId>(Object.values(routes).map((route) => [route.path, route.id]));
byPath.set('/workspace', 'workspace-files');

export function resolveRoute(pathname: string): RouteId {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return byPath.get(normalized) ?? 'overview';
}

export const isWorkspaceRoute = (id: RouteId) => id.startsWith('workspace-');
export const isOmpConfigRoute = (id: RouteId) => id === 'omp-config' || id.startsWith('omp-config-');
