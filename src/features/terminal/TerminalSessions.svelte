<script lang="ts">
  import { Terminal as TerminalIcon, X } from '@lucide/svelte';
  import { Skeleton } from '$lib/components/ui';
  import type { TerminalInfo } from '$lib/types';

  interface Props {
    terminals: TerminalInfo[];
    activeId: string;
    loading: boolean;
    onopen: (id: string) => void;
    onclose: (id: string) => void;
  }

  let { terminals, activeId, loading, onopen, onclose }: Props = $props();
  let expanded = $state(false);
</script>

 <aside onmouseenter={() => (expanded = true)} onmouseleave={() => (expanded = false)} class={['flex shrink-0 flex-col overflow-hidden border-l border-line bg-canvas/50 transition-[width] duration-200', expanded ? 'w-52' : 'w-11']}>
   <div class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2">
     {#if loading}
       {#each Array(3) as _, index (index)}<Skeleton class="h-8 w-full rounded-md" />{/each}
     {:else if terminals.length === 0}
       <div class="px-2 py-3 text-center text-xs text-fg-faint">No sessions</div>
    {:else}
      {#each terminals as item, index (item.id)}
        <div class={['group flex min-w-0 items-center rounded-md transition-colors', item.id === activeId ? 'bg-surface-active text-fg' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg']}>
          <button type="button" class="flex h-8 min-w-0 flex-1 items-center gap-2 px-2.5 text-left" title={`${index + 1}. ${item.title}`} aria-label={`Open terminal ${index + 1}: ${item.title}`} onclick={() => onopen(item.id)}>
            <span class="relative flex size-4 shrink-0 items-center justify-center"><TerminalIcon size={14} strokeWidth={1.7} /></span>
            {#if expanded}<span class="min-w-0 flex-1 truncate text-sm">{item.title}</span>{/if}
          </button>
          {#if expanded}<button type="button" class="mr-1 rounded p-1 text-fg-faint opacity-0 transition hover:bg-surface-active hover:text-fg focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Close terminal ${item.title}`} title="Close terminal" onclick={() => onclose(item.id)}><X size={12} strokeWidth={1.8} /></button>{/if}
        </div>
      {/each}
    {/if}
  </div>
</aside>
