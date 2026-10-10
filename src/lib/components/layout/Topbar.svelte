<script lang="ts">
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { Maximize2, Minimize2, Moon, Plus, RefreshCw, Sun, Terminal as TerminalIcon, X } from '@lucide/svelte';
  import ProfileCard from './ProfileCard.svelte';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import { router } from '$lib/stores/router.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { Skeleton } from '$lib/components/ui';
  import { terminalController } from '$features/terminal';
</script>

<header class="flex h-12 shrink-0 items-center justify-between gap-3 bg-canvas px-3 sm:px-4">
  <div class="flex min-w-0 items-center gap-2">
    <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1.5 text-md">
      {#if router.inWorkspace}
        <span class="text-fg-subtle">Workspace</span>
        <ChevronRight size={14} class="shrink-0 text-fg-faint" />
      {/if}
      <h1 class="truncate font-medium text-fg">{router.title}</h1>
    </nav>
  </div>
  {#if router.current === 'terminal'}
    <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:thin]" aria-label="Terminal sessions">
      {#each terminalController.terminals as item (item.id)}
        <div class={['group flex max-w-44 shrink-0 items-center rounded-md border text-xs transition-colors', item.id === terminalController.activeId ? 'border-line-strong bg-surface text-fg' : 'border-transparent text-fg-subtle hover:bg-surface-hover hover:text-fg']}>
          <button type="button" class="flex min-w-0 items-center gap-1.5 px-2 py-1.5" aria-current={item.id === terminalController.activeId ? 'page' : undefined} title={item.title} onclick={() => terminalController.open(item.id)}>
            <TerminalIcon size={13} strokeWidth={1.8} />
            <span class="truncate">{item.title}</span>
          </button>
          <button type="button" class="mr-1 rounded p-0.5 text-fg-faint opacity-0 hover:bg-surface-active hover:text-fg focus-visible:opacity-100 group-hover:opacity-100" aria-label="Close {item.title}" title="Close session" onclick={(event) => { event.stopPropagation(); void terminalController.close(item.id); }}>
            <X size={12} />
          </button>
        </div>
      {/each}
      <button type="button" class="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-line text-fg-subtle transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg" onclick={() => void terminalController.create()} disabled={terminalController.creating} aria-label="New terminal" title="New terminal">
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
  {/if}
  <div class="flex shrink-0 items-center gap-2">
    {#if router.current === 'terminal'}
      <IconButton label={terminalController.fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onclick={() => (terminalController.fullscreen = !terminalController.fullscreen)}>
        {#if terminalController.fullscreen}<Minimize2 size={15} strokeWidth={1.8} />{:else}<Maximize2 size={15} strokeWidth={1.8} />{/if}
      </IconButton>
    {/if}
    <IconButton label="Refresh" disabled={dashboard.loading} onclick={() => dashboard.refresh()}>
      {#if dashboard.loading}<Skeleton class="size-4" />{:else}<RefreshCw size={15} strokeWidth={1.8} />{/if}
    </IconButton>
    <IconButton label={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onclick={(event) => theme.toggle(event.currentTarget)}>
      {#if theme.current === 'dark'}<Sun size={16} strokeWidth={1.8} />{:else}<Moon size={16} strokeWidth={1.8} />{/if}
    </IconButton>
    <ProfileCard compact placement="bottom" />
  </div>
</header>
