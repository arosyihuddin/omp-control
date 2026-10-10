<script lang="ts">
  import { CheckCircle2, CircleAlert, Info, X } from '@lucide/svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const icons = { success: CheckCircle2, error: CircleAlert, info: Info };
</script>

<div class="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1.5" aria-label="Notifications" aria-live="polite">
  {#each toast.items as item (item.id)}
    {@const Icon = icons[item.tone]}
    <div role={item.tone === 'error' ? 'alert' : 'status'} class="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface-raised px-3 py-2.5 shadow-lg">
      <Icon size={16} class={item.tone === 'success' ? 'mt-0.5 shrink-0 text-success' : item.tone === 'error' ? 'mt-0.5 shrink-0 text-danger' : 'mt-0.5 shrink-0 text-accent'} />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-fg">{item.title}</p>
        {#if item.message}<p class="mt-0.5 break-words text-xs leading-4 text-fg-subtle">{item.message}</p>{/if}
      </div>
      <button type="button" aria-label="Dismiss notification" class="rounded p-0.5 text-fg-faint hover:bg-surface-hover hover:text-fg" onclick={() => toast.dismiss(item.id)}><X size={13}/></button>
    </div>
  {/each}
</div>
