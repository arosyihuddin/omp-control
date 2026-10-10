<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Terminal as TerminalIcon } from '@lucide/svelte';
  import { Button, EmptyState, StatusDot } from '$lib/components/ui';
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
    // Delegate lazily so the handle stays valid however bind:this settles.
    controller.attach({
      write: (data) => viewport?.write(data),
      reset: () => viewport?.reset(),
      focus: () => viewport?.focus(),
      refit: () => viewport?.refit(),
    });
    void controller.init();
    return () => controller.dispose();
  });
</script>

<div
  class={[
    'flex h-full min-h-0 flex-col overflow-hidden bg-surface',
    controller.fullscreen ? 'fixed inset-0 z-50' : 'rounded-lg border border-line shadow-card',
  ]}
>
  <header class="flex h-11 shrink-0 items-center gap-3 border-b border-line px-3">
    {#if controller.active}
      <div class="hidden max-w-72 items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-fg-subtle md:flex">
        <StatusDot tone={controller.socketState === 'connected' ? 'success' : 'muted'} />
        <span class="truncate font-mono">{controller.active.cwd}</span>
      </div>
    {/if}
  </header>

  <div class="relative min-h-0 min-w-0 flex-1 bg-surface">
    <TerminalViewport bind:this={viewport} ondata={controller.sendInput} onresize={controller.sendResize} />

    {#if !controller.active && !controller.loading}
      <div class="absolute inset-0 flex items-center justify-center bg-surface">
        <EmptyState
          icon={TerminalIcon}
          title="No terminal sessions"
          description="Create a terminal session from the top bar to open an interactive shell."
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
