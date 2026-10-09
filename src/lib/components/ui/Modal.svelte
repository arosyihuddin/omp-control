<script lang="ts">
  import { tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    open: boolean;
    title: string;
    description?: string;
    onclose: () => void;
    /** Max width utility, e.g. `max-w-3xl`. */
    width?: string;
    /** Fixed responsive height utility, e.g. `h-[min(70vh,600px)]`. */
    height?: string;
    /** Render the default header (title + close button). */
    header?: boolean;
    footer?: Snippet;
    children?: Snippet;
    autofocus?: boolean;
  }

  let { open, title, description, onclose, width = 'max-w-2xl', height, header = true, footer, children, autofocus = false }: Props = $props();

  let dialog = $state<HTMLDivElement>();
  let restoreTo: HTMLElement | null = null;

  // Move focus into the dialog on open and restore it on close.
  $effect(() => {
    if (!open) return;
    restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void tick().then(() => {
      if (autofocus) dialog?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus();
      else dialog?.focus();
    });
    return () => restoreTo?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      onclose();
    }
  }

  // Move the overlay to document.body so transformed/overflow-hidden parents
  // (such as the sidebar) cannot trap or clip a fixed-position modal.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    use:portal
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    transition:fade={{ duration: 150 }}
    role="presentation"
    onmousedown={(event) => event.target === event.currentTarget && onclose()}
  >
    <div
      bind:this={dialog}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      class={['flex max-h-[min(82vh,760px)] w-full flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-pop outline-none', width, height]}
      transition:fly={{ y: 12, duration: 180, easing: (t) => 1 - Math.pow(1 - t, 3) }}
    >
      {#if header}
        <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div class="min-w-0">
            <h3 class="truncate text-md font-medium text-fg">{title}</h3>
            {#if description}<p class="mt-0.5 truncate font-mono text-xs text-fg-faint">{description}</p>{/if}
          </div>
          <IconButton label="Close" size="sm" onclick={onclose}><X size={15} /></IconButton>
        </div>
      {/if}
      <div class="min-h-0 flex-1 overflow-auto">{@render children?.()}</div>
      {#if footer}<div class="flex justify-end gap-2 border-t border-line px-4 py-3">{@render footer()}</div>{/if}
    </div>
  </div>
{/if}
