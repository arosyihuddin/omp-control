<script lang="ts">
  import { onMount } from 'svelte';
  import { Maximize2, Minimize2, Plus, Terminal as TerminalIcon, X } from '@lucide/svelte';
  import { Button, EmptyState } from '$lib/components/ui';
  import { terminalController, TerminalViewport } from '$features/terminal';

  const controller = terminalController;

  let viewport = $state<ReturnType<typeof TerminalViewport>>();

  $effect(() => {
    controller.fullscreen;
    requestAnimationFrame(() => {
      viewport?.refit();
      viewport?.focus();
    });
  });


  onMount(() => {
    controller.attach({
      write: (data) => viewport?.write(data),
      reset: () => viewport?.reset(),
      focus: () => viewport?.focus(),
      refit: () => viewport?.refit(),
    });
    void controller.init();
    return () => {
      controller.dispose();
    };
  });
</script>


<div
  class={[
    'flex h-full min-h-0 flex-col overflow-hidden bg-surface-raised',
    controller.fullscreen ? 'fixed inset-0 z-50' : 'rounded-xl border border-line shadow-card',
  ]}
>
  <header class="flex min-h-11 shrink-0 items-center gap-2 border-b border-line px-2 py-1.5">
    <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:thin]" aria-label="Terminal sessions">
      {#each controller.terminals as item (item.id)}
        <div class={['group flex max-w-44 shrink-0 items-center rounded-md border text-xs transition-colors', item.id === controller.activeId ? 'border-line-strong bg-surface-raised text-fg' : 'border-transparent text-fg-subtle hover:bg-surface-hover hover:text-fg']}>
          <button type="button" class="flex min-w-0 items-center gap-1.5 px-2 py-1.5" aria-current={item.id === controller.activeId ? 'page' : undefined} title={item.title + ' · Switch: Ctrl+PageUp / Ctrl+PageDown'} onclick={() => controller.open(item.id)}>
            <TerminalIcon size={13} strokeWidth={1.8} />
            <span class="truncate">{item.title}</span>
          </button>
          <button type="button" class="mr-1 rounded p-0.5 text-fg-faint opacity-0 hover:bg-surface-active hover:text-fg focus-visible:opacity-100 group-hover:opacity-100" aria-label={'Close ' + item.title} title="Close session (Ctrl+Shift+X)" onclick={(event) => { event.stopPropagation(); void controller.close(item.id); }}>
            <X size={12} />
          </button>
        </div>
      {/each}
      <button type="button" class="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-line text-fg-subtle transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg" onclick={() => void controller.create()} disabled={controller.creating} aria-label="New terminal" title="New terminal (Ctrl+Shift+`) ">
        <Plus size={14} strokeWidth={1.8} />
      </button>
    </div>
    <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg" aria-label={controller.fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={(controller.fullscreen ? 'Exit fullscreen' : 'Fullscreen') + ' (Ctrl+Shift+F)'} onclick={() => (controller.fullscreen = !controller.fullscreen)}>
      {#if controller.fullscreen}<Minimize2 size={15} strokeWidth={1.8} />{:else}<Maximize2 size={15} strokeWidth={1.8} />{/if}
    </button>
  </header>

  <div class="relative min-h-0 min-w-0 flex-1 bg-surface-raised">
    <TerminalViewport bind:this={viewport} ondata={controller.sendInput} onresize={controller.sendResize} />

    {#if !controller.active && !controller.loading}
      <div class="absolute inset-0 flex items-center justify-center bg-surface-raised">
        <EmptyState
          icon={TerminalIcon}
          title="No terminal sessions"
          description="Create a terminal session from this header to open an interactive shell."
        >
          <Button variant="primary" onclick={() => controller.create()} disabled={controller.creating}>
            <Plus size={13} strokeWidth={2} /> New terminal
          </Button>
        </EmptyState>
      </div>
    {/if}

    {#if controller.error}
      <button
        type="button"
        class="absolute inset-x-4 bottom-4 rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-left text-sm text-fg-muted shadow-pop"
        onclick={() => (controller.error = '')}
        title="Dismiss"
      >
        {controller.error}
      </button>
    {/if}
  </div>

</div>
