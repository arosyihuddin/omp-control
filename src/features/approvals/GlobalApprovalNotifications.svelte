<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { BellRing, CircleCheck, CircleX, Eye, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui';
  import { approvals } from '$features/approvals/approvals.svelte';
  import { router } from '$lib/stores/router.svelte';
  import { formatTime } from '$lib/utils/format';
  import type { Approval } from '$lib/types';
  import ApprovalDetailsModal from './ApprovalDetailsModal.svelte';

  const TOAST_DURATION = 8_000;
  let stopWatching: (() => void) | undefined;
  let initialized = false;
  const seenIds = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let toastItems = $state<Approval[]>([]);
  let selectedApproval = $state<Approval | null>(null);

  onMount(() => {
    stopWatching = approvals.watch();
    void approvals.load();
    return () => {
      stopWatching?.();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  });

  function dismiss(id: string) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    toastItems = toastItems.filter((item) => item.id !== id);
  }

  function startTimer(id: string) {
    const previous = timers.get(id);
    if (previous) clearTimeout(previous);
    timers.set(id, setTimeout(() => dismiss(id), TOAST_DURATION));
  }

  function pauseTimer(id: string) {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  }

  function decide(id: string, decision: 'approve' | 'deny') {
    void approvals.decide(id, decision).finally(() => dismiss(id));
  }

  function openDetails(approval: Approval) {
    dismiss(approval.id);
    selectedApproval = approval;
  }

  function decideFromDetails(id: string, decision: 'approve' | 'deny') {
    void approvals.decide(id, decision).then(() => { selectedApproval = null; });
  }

  // Existing requests establish the baseline; only genuinely new pending IDs create toasts.
  $effect(() => {
    const loading = approvals.loading;
    const items = approvals.items;
    if (loading) return;

    if (!initialized) {
      items.forEach((item) => seenIds.add(item.id));
      initialized = true;
      return;
    }

    const newlyPending = items.filter((item) => item.status === 'pending' && !seenIds.has(item.id));
    items.forEach((item) => seenIds.add(item.id));

    const currentToasts = untrack(() => toastItems);
    const pendingIds = new Set(items.filter((item) => item.status === 'pending').map((item) => item.id));
    const nextToasts = [
      ...(newlyPending.length ? [...newlyPending].reverse() : []),
      ...currentToasts,
    ].filter((item) => pendingIds.has(item.id)).slice(0, 3);

    if (newlyPending.length) {
      for (const item of newlyPending) {
        if (!timers.has(item.id)) startTimer(item.id);
      }
    }
    toastItems = nextToasts;
    for (const id of timers.keys()) {
      if (!pendingIds.has(id)) {
        const timer = timers.get(id);
        if (timer) clearTimeout(timer);
        timers.delete(id);
      }
    }
  });
</script>

{#if router.current !== 'approvals' && toastItems.length > 0}
  <section class="fixed bottom-4 right-4 z-[70] flex max-h-[min(75vh,680px)] w-[min(92vw,420px)] flex-col gap-3 overflow-y-auto" aria-label="New approval notifications" aria-live="polite">
    {#each toastItems as approval (approval.id)}
      <article
        class="overflow-hidden rounded-xl border border-warning/30 bg-surface-raised shadow-pop"
        onmouseenter={() => pauseTimer(approval.id)}
        onmouseleave={() => startTimer(approval.id)}
      >
        <header class="flex items-start gap-3 border-b border-line px-3 py-3">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning"><BellRing size={16} /></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-fg">Approval required</h2>
              <span class="rounded-full border border-warning/30 px-2 py-0.5 text-xs text-warning">{approval.risk}</span>
            </div>
            <button type="button" class="mt-1 block max-w-full truncate text-left font-mono text-sm text-fg hover:underline" onclick={() => openDetails(approval)}>{approval.tool}</button>
            <p class="mt-1 text-xs text-fg-subtle">Request {approval.requestId} · {formatTime(approval.createdAt)}</p>
          </div>
          <button type="button" aria-label="Dismiss notification" class="rounded p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg" onclick={() => dismiss(approval.id)}><X size={14} /></button>
        </header>
        <div class="space-y-3 p-3">
          <button type="button" class="block w-full text-left" onclick={() => openDetails(approval)}><p class="line-clamp-2 text-sm text-fg-muted">{approval.reason || 'This operation requires confirmation before execution.'}</p><span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent"><Eye size={12} /> View arguments and details</span></button>
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs text-fg-faint">Closes after 8 seconds</span>
            <div class="flex justify-end gap-2">
              <Button size="sm" variant="danger" disabled={approvals.actingId === approval.id} onclick={() => decide(approval.id, 'deny')}><CircleX size={13} /> Deny</Button>
              <Button size="sm" variant="primary" disabled={approvals.actingId === approval.id} onclick={() => decide(approval.id, 'approve')}><CircleCheck size={13} /> Allow</Button>
            </div>
          </div>
        </div>
      </article>
    {/each}
  </section>
{/if}

<ApprovalDetailsModal approval={selectedApproval} busy={Boolean(selectedApproval && approvals.actingId === selectedApproval.id)} onclose={() => (selectedApproval = null)} ondecide={decideFromDetails} />
