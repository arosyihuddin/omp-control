import { dashboardApi } from '$lib/api';
import { onServerEvent } from '$lib/api/events';
import type { Approval, HostTelemetry, RiskLevel, SystemTelemetry, ServiceTelemetry } from '$lib/types';

const parse = <T>(event: MessageEvent): T | null => {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
};

const jakartaDayKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
};

/** App-wide live state: host telemetry, sessions, tool counts, pending approvals. */
class DashboardStore {
  host = $state<HostTelemetry>({});
  toolCount = $state(0);
  toolRiskCounts = $state<Partial<Record<RiskLevel, number>>>({});
  pendingApprovals = $state(0);
  toolCallsToday = $state(0);
  toolCallsDay = $state(jakartaDayKey(new Date()));
  connected = $state(false);
  loading = $state(true);

  async refresh() {
    this.loading = true;
    try {
      const data = await dashboardApi.snapshot();
      this.host = data.host ?? {};
      this.toolCount = data.toolCount ?? 0;
      this.toolRiskCounts = data.toolRiskCounts ?? {};
      this.pendingApprovals = data.approvalCount ?? 0;
      this.toolCallsToday = data.toolCallsToday ?? 0;
      this.toolCallsDay = jakartaDayKey(new Date());
      this.connected = true;
    } catch {
      this.connected = false;
    } finally {
      this.loading = false;
    }
  }

  private syncToolCallsDay() {
    const today = jakartaDayKey(new Date());
    if (this.toolCallsDay !== today) {
      this.toolCallsDay = today;
      this.toolCallsToday = 0;
    }
  }

  /** Subscribe to realtime events. Returns a cleanup function. */
  connect() {
    const off = [
      onServerEvent('telemetry.updated', (e) => {
        this.syncToolCallsDay();
        const data = parse<{ system?: SystemTelemetry; service?: ServiceTelemetry }>(e);
        if (!data) return;
        this.host = { system: data.system ?? this.host.system, service: data.service ?? this.host.service };
        this.connected = true;
      }),
      onServerEvent('dashboard.snapshot', (e) => {
        const data = parse<{ approvals?: Approval[]; toolCallsToday?: number }>(e);
        if (!data) return;
        this.pendingApprovals = (data.approvals ?? []).filter((a) => a.status === 'pending').length;
        if (typeof data.toolCallsToday === 'number') this.toolCallsToday = data.toolCallsToday;
        this.toolCallsDay = jakartaDayKey(new Date());
      }),
      onServerEvent('tool_call.created', (e) => {
        this.syncToolCallsDay();
        const data = parse<{ timestamp?: string }>(e);
        if (!data?.timestamp) return;
        if (jakartaDayKey(new Date(data.timestamp)) === jakartaDayKey(new Date())) this.toolCallsToday += 1;
      }),
      onServerEvent('approval.created', () => (this.pendingApprovals += 1)),
      onServerEvent('approval.updated', (e) => {
        const data = parse<{ status?: string }>(e);
        if (data && data.status !== 'pending') this.pendingApprovals = Math.max(0, this.pendingApprovals - 1);
      }),
      onServerEvent('approval.cleared', () => (this.pendingApprovals = 0)),
    ];
    return () => off.forEach((fn) => fn());
  }

}

export const dashboard = new DashboardStore();
