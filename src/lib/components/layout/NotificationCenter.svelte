<script lang="ts">
  import { Bell, Check, ExternalLink, Eye, ShieldAlert, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui';
  import Menu from '$lib/components/ui/Menu.svelte';
  import { approvals } from '$features/approvals/approvals.svelte';
  import { formatTime } from '$lib/utils/format';
  import type { Approval } from '$lib/types';
  import ApprovalDetailsModal from '$features/approvals/ApprovalDetailsModal.svelte';

  let selectedApproval = $state<Approval | null>(null);
  let dismissedNotificationIds = $state<Set<string>>(new Set());

  const visiblePending = $derived(approvals.pending.filter((approval) => !dismissedNotificationIds.has(approval.id)));

  function openDetails(approval: Approval, closeMenu: () => void) {
    dismissedNotificationIds = new Set([...dismissedNotificationIds, approval.id]);
    selectedApproval = approval;
    closeMenu();
  }

  const decide = (id: string, decision: 'approve' | 'deny') => {
    void approvals.decide(id, decision).then(() => { selectedApproval = null; });
  };

  const statusLabel: Record<string, string> = {
    approved: 'Allowed',
    denied: 'Denied',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
</script>

<Menu align="right" placement="bottom" width="w-[min(92vw,420px)]">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      class="relative flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
      aria-label={approvals.pending.length ? `Notifications, ${approvals.pending.length} pending approvals` : 'Notifications'}
      aria-expanded={open}
      aria-haspopup="true"
      onclick={toggle}
    >
      <Bell size={17} />
      {#if approvals.pending.length > 0}
        <span class="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
          {approvals.pending.length > 99 ? '99+' : approvals.pending.length}
        </span>
      {/if}
    </button>
  {/snippet}
  {#snippet children({ close })}
    <section class="flex max-h-[min(75vh,620px)] flex-col" aria-label="Notifications">
      <header class="flex items-center justify-between border-b border-line px-3 py-3">
        <div>
          <h2 class="text-sm font-semibold text-fg">Notifications</h2>
          <p class="mt-0.5 text-xs text-fg-subtle">{approvals.pending.length} pending approval{approvals.pending.length === 1 ? '' : 's'}</p>
        </div>
        <a href="/approvals" onclick={close} class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-hover hover:text-fg">
          View all <ExternalLink size={12} />
        </a>
      </header>

      <div class="min-h-0 overflow-y-auto p-2">
        <h3 class="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Pending approvals</h3>
        {#if visiblePending.length === 0}
          <div class="px-3 py-6 text-center">
            <Check size={22} class="mx-auto text-success" />
            <p class="mt-2 text-sm font-medium text-fg">You're all caught up</p>
            <p class="mt-1 text-xs text-fg-subtle">New approval requests will appear here.</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each visiblePending as approval (approval.id)}
              <article class="rounded-lg border border-warning/25 bg-surface p-3">
                <div class="flex items-start gap-2">
                  <ShieldAlert size={15} class="mt-0.5 shrink-0 text-warning" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <button type="button" class="max-w-full truncate text-left text-sm font-semibold text-fg hover:underline" onclick={() => openDetails(approval, close)}>{approval.tool}</button>
                      <span class="shrink-0 rounded-full border border-warning/30 px-1.5 py-0.5 text-[10px] text-warning">{approval.risk}</span>
                    </div>
                    <button type="button" class="mt-1 block w-full text-left" onclick={() => openDetails(approval, close)}><p class="line-clamp-2 text-xs text-fg-muted">{approval.reason || 'This operation requires confirmation before execution.'}</p><span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent"><Eye size={12} /> View arguments and details</span></button>
                    <p class="mt-1 text-[11px] text-fg-faint">Request {approval.requestId} · {formatTime(approval.createdAt)}</p>
                  </div>
                </div>
                <div class="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="danger" disabled={approvals.actingId === approval.id} onclick={() => decide(approval.id, 'deny')}><X size={12} /> Deny</Button>
                  <Button size="sm" variant="primary" disabled={approvals.actingId === approval.id} onclick={() => decide(approval.id, 'approve')}><Check size={12} /> Allow</Button>
                </div>
              </article>
            {/each}
          </div>
        {/if}

        {#if approvals.history.length > 0}
          <h3 class="px-2 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Recent activity</h3>
          <div class="space-y-1">
            {#each approvals.history.slice(0, 5) as approval (approval.id)}
              <div class="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-hover">
                <div class="min-w-0">
                  <p class="truncate text-sm text-fg-muted">{approval.tool}</p>
                  <p class="mt-0.5 text-xs text-fg-faint">{formatTime(approval.updatedAt)}</p>
                </div>
                <span class="shrink-0 text-xs text-fg-subtle">{statusLabel[approval.status] ?? approval.status}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/snippet}
</Menu>

<ApprovalDetailsModal approval={selectedApproval} busy={Boolean(selectedApproval && approvals.actingId === selectedApproval.id)} onclose={() => (selectedApproval = null)} ondecide={decide} />
