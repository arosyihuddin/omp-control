<script lang="ts">
  import { untrack } from 'svelte';
  import { Panel, StatCard, StatusDot } from '$lib/components/ui';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import { router } from '$lib/stores/router.svelte';
  import OverviewSkeleton from '$features/overview/OverviewSkeleton.svelte';
  import ResourcePanel from '$features/overview/ResourcePanel.svelte';
  import RiskPanel from '$features/overview/RiskPanel.svelte';
  import RuntimePanel from '$features/overview/RuntimePanel.svelte';
  import StoragePanel from '$features/overview/StoragePanel.svelte';
  import SystemPanel from '$features/overview/SystemPanel.svelte';
  import { SessionList } from '$features/sessions';

  type ResourceSample = { time: string; cpu: number | null; memory: number | null; disk: number | null; gpu: number | null };
  const system = $derived(dashboard.host.system ?? {});
  const service = $derived(dashboard.host.service ?? {});
  const running = $derived(dashboard.sessions.filter((session) => session.status === 'running').length);
  const memoryPercent = $derived(system.memory?.usage_percent ?? null);
  const diskPercent = $derived(system.disk?.usage_percent ?? null);
  const gpu = $derived(system.gpu?.devices?.[0]);
  let resourceHistory = $state<ResourceSample[]>([]);
  $effect(() => {
    const cores = system.cpu?.logical_cores ?? 0;
    const load = system.cpu?.load_average?.['1m'];
    const sample: ResourceSample = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpu: load == null || cores <= 0 ? null : Math.max(0, Math.min(100, load / cores * 100)),
      memory: memoryPercent == null ? null : Math.max(0, Math.min(100, memoryPercent)),
      disk: diskPercent == null ? null : Math.max(0, Math.min(100, diskPercent)),
      gpu: gpu?.utilization_gpu_percent == null ? null : Math.max(0, Math.min(100, gpu.utilization_gpu_percent)),
    };
    const previous = untrack(() => resourceHistory.at(-1));
    if (previous && previous.cpu === sample.cpu && previous.memory === sample.memory && previous.disk === sample.disk && previous.gpu === sample.gpu) return;
    resourceHistory = [...untrack(() => resourceHistory).slice(-29), sample];
  });
  const linePoints = (key: 'cpu' | 'memory' | 'disk' | 'gpu') => resourceHistory
    .map((sample, index) => sample[key] == null ? null : `${resourceHistory.length < 2 ? 0 : index / (resourceHistory.length - 1) * 100},${100 - (sample[key] ?? 0)}`)
    .filter((point): point is string => point !== null).join(' ');
  const latest = (key: 'cpu' | 'memory' | 'disk' | 'gpu') => resourceHistory.at(-1)?.[key] ?? null;
</script>

{#if dashboard.loading}
  <OverviewSkeleton />
{:else}
  <div class="space-y-5 sm:space-y-6">
    <section class="rounded-xl border border-line bg-surface-raised p-4 shadow-card sm:p-5 lg:p-6">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <p class="eyebrow">OPERATIONS CENTER</p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Overview</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-fg-subtle">Ringkasan kondisi server, resource host, aktivitas agent, dan approval yang membutuhkan perhatian.</p>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span class="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-fg-muted"><span class="h-1.5 w-1.5 shrink-0 rounded-full" class:bg-emerald-400={dashboard.connected} class:bg-fg-faint={!dashboard.connected}></span><span class="truncate">{system.os?.hostname ?? 'OMP-MCP server'}</span></span>
            <span class="text-fg-faint">{system.os?.pretty_name ?? system.os?.platform ?? 'Host telemetry'}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
          <span class={['inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-medium lg:self-end', dashboard.connected ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500' : 'border-line bg-surface text-fg-subtle']}>
            <StatusDot tone={dashboard.connected ? 'success' : 'muted'} pulse={dashboard.connected} />
            {dashboard.connected ? 'Telemetry connected' : 'Connection unavailable'}
          </span>
          <span class="text-xs text-fg-faint">Live updates via server events</span>
        </div>
      </div>
    </section>

    <section aria-label="Key metrics" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <a href="/tools" class="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"><StatCard label="Registered tools" value={dashboard.toolCount} hint="Available system capabilities" /></a>
      <a href="/approvals" class="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"><StatCard label="Pending approvals" value={dashboard.pendingApprovals} hint={dashboard.pendingApprovals ? 'Action required · review requests' : 'No requests waiting'} /></a>
      <a href="/sessions" class="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"><StatCard label="Active agents" value={running} hint={`${dashboard.sessions.length} total sessions`} /></a>
      <StatCard label="Server status" hint="Remote telemetry connection">
        {#snippet valueSlot()}
          <span class="flex items-center gap-2 text-xl sm:text-2xl"><StatusDot tone={dashboard.connected ? 'success' : 'muted'} pulse={dashboard.connected} />{dashboard.connected ? 'Connected' : 'Offline'}</span>
        {/snippet}
      </StatCard>
    </section>
    <section class="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2" aria-label="Resource visualizations">
      <div class="min-w-0 rounded-xl border border-line bg-surface-raised p-4 shadow-card sm:p-5">
        <div class="flex items-start justify-between gap-3"><div><h2 class="text-sm font-semibold text-fg">CPU load trend</h2><p class="mt-1 text-xs text-fg-subtle">Load average 1m relative to logical cores</p></div><span class="rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-faint">{system.cpu?.logical_cores ?? '—'} cores</span></div>
        <div class="mt-4 rounded-lg bg-surface/70 p-2">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-36 w-full overflow-visible" role="img" aria-label="CPU load history line chart">
            {#each [0, 25, 50, 75, 100] as tick}<line x1="0" x2="100" y1={tick} y2={tick} stroke="currentColor" stroke-opacity="0.1" stroke-width="0.5" vector-effect="non-scaling-stroke" />{/each}
            {#if resourceHistory.length > 1}<polyline points={linePoints('cpu')} fill="none" stroke="#60a5fa" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />{/if}
          </svg>
        </div>
        <div class="mt-2 flex items-center justify-between text-xs text-fg-faint"><span>{resourceHistory[0]?.time ?? 'Waiting for telemetry'}</span><span>{resourceHistory.at(-1)?.time ?? '—'}</span></div>
        <div class="mt-3 flex items-baseline justify-between"><span class="text-sm text-fg-subtle">Current normalized load</span><span class="text-lg font-semibold tabular-nums text-fg">{latest('cpu') == null ? '—' : `${latest('cpu')!.toFixed(1)}%`}</span></div>
        <p class="mt-2 text-xs leading-5 text-fg-faint">Tren bertambah saat telemetry berubah. Ini load average per core, bukan CPU utilization.</p>
      </div>
      <div class="min-w-0 rounded-xl border border-line bg-surface-raised p-4 shadow-card sm:p-5">
        <div class="flex items-start justify-between gap-3"><div><h2 class="text-sm font-semibold text-fg">Resource utilization trend</h2><p class="mt-1 text-xs text-fg-subtle">Riwayat pemakaian resource (%)</p></div><span class="text-xs text-fg-faint">{resourceHistory.length} samples</span></div>
        <div class="mt-4 rounded-lg bg-surface/70 p-2">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-36 w-full overflow-visible" role="img" aria-label="Memory, disk and GPU utilization line chart">
            {#each [0, 25, 50, 75, 100] as tick}<line x1="0" x2="100" y1={tick} y2={tick} stroke="currentColor" stroke-opacity="0.1" stroke-width="0.5" vector-effect="non-scaling-stroke" />{/each}
            {#if resourceHistory.length > 1}
              <polyline points={linePoints('memory')} fill="none" stroke="#38bdf8" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
              <polyline points={linePoints('disk')} fill="none" stroke="#a78bfa" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
              {#if gpu}<polyline points={linePoints('gpu')} fill="none" stroke="#fbbf24" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />{/if}
            {/if}
          </svg>
        </div>
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <span class="inline-flex items-center gap-1.5 text-fg-subtle"><span class="h-2 w-2 rounded-full bg-sky-400"></span>Memory {latest('memory') == null ? '—' : `${latest('memory')!.toFixed(1)}%`}</span>
          <span class="inline-flex items-center gap-1.5 text-fg-subtle"><span class="h-2 w-2 rounded-full bg-violet-400"></span>Disk {latest('disk') == null ? '—' : `${latest('disk')!.toFixed(1)}%`}</span>
          {#if gpu}<span class="inline-flex items-center gap-1.5 text-fg-subtle"><span class="h-2 w-2 rounded-full bg-amber-400"></span>GPU {latest('gpu') == null ? '—' : `${latest('gpu')!.toFixed(1)}%`}</span>{/if}
        </div>
        <div class="mt-2 flex items-center justify-between text-xs text-fg-faint"><span>{resourceHistory[0]?.time ?? 'Waiting for telemetry'}</span><span>{resourceHistory.at(-1)?.time ?? '—'}</span></div>
      </div>
    </section>
    <section>
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 class="text-base font-semibold text-fg">Host health</h2><p class="mt-0.5 text-sm text-fg-subtle">Resource usage and system environment</p></div>
        <span class="text-xs text-fg-faint">{system.cpu?.logical_cores ?? '—'} logical CPU cores</span>
      </div>
      <div class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <SystemPanel {system} {service} />
        <ResourcePanel {system} />
        <StoragePanel {system} />
      </div>
    </section>

    <section class="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
      <RuntimePanel {system} />
      <RiskPanel counts={dashboard.toolRiskCounts} total={dashboard.toolCount} />
    </section>

    <Panel title="Recent OMP sessions" description="Latest agent sessions and their current state.">
      {#snippet actions()}
        <a href="/sessions" class="rounded px-1.5 py-1 text-sm text-fg-subtle transition-colors hover:text-fg" onclick={(event) => router.link(event, 'sessions')}>View all <span aria-hidden="true">→</span></a>
      {/snippet}
      <SessionList sessions={dashboard.sessions} limit={5} emptyText="No OMP sessions are currently registered." />
    </Panel>
  </div>
{/if}
