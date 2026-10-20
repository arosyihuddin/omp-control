<script lang="ts">
  import { tick, type Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    align?: 'left' | 'right';
    /** Open below, above, or choose based on available viewport space. */
    placement?: 'bottom' | 'top' | 'auto';
    width?: string;
    offsetX?: number;
    /** Receives the current open state and a toggle function. */
    trigger: Snippet<[{ open: boolean; toggle: () => void }]>;
    children?: Snippet<[{ close: () => void }]>;
  }

  let { open = $bindable(false), align = 'right', placement = 'bottom', width = 'w-44', offsetX = 0, trigger, children }: Props = $props();
  let root = $state<HTMLDivElement>();
  let menu = $state<HTMLDivElement>();
  let actualPlacement = $state<'bottom' | 'top'>('bottom');
  let menuStyle = $state('top: 0px; left: 0px; visibility: hidden;');

  const toggle = () => (open = !open);
  const close = () => (open = false);

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  async function positionMenu() {
    await tick();
    if (!root || !menu) return;
    const triggerElement = root.querySelector('button');
    const rect = (triggerElement ?? root).getBoundingClientRect();
    if (!triggerElement) return;
    const triggerWidth = width === 'trigger';

    if (triggerWidth) {
      menuStyle = `top: 0px; left: 0px; width: ${rect.width}px; visibility: hidden;`;
      await tick();
    }

    const menuRect = menu.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    actualPlacement = placement === 'auto'
      ? (menuRect.height + 8 > spaceBelow && spaceAbove > spaceBelow ? 'top' : 'bottom')
      : placement;

    const top = actualPlacement === 'top'
      ? Math.max(8, rect.top - menuRect.height - 4)
      : Math.min(window.innerHeight - menuRect.height - 8, rect.bottom + 4);
    const left = align === 'right'
      ? Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right - menuRect.width - 4 + offsetX))
      : Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.left - 4 + offsetX));
    menuStyle = `top: ${top}px; left: ${left}px; ${triggerWidth ? `width: ${rect.width}px;` : ''} visibility: visible;`;
  }

  $effect(() => {
    if (open) void positionMenu();
  });

  function onPointerDown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node) && menu && !menu.contains(event.target as Node)) close();
  }
  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') close();
  }
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKeydown} />

<div bind:this={root} class={['relative', open && 'z-40']}>
  {@render trigger({ open, toggle })}
  {#if open}
    <div
      use:portal
      bind:this={menu}
      role="menu"
      style={menuStyle}
      class={[
        'fixed z-[60] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-lg border border-line-strong bg-surface-raised p-1 shadow-lg',
        width !== 'trigger' && width,
      ]}
    >
      {@render children?.({ close })}
    </div>
  {/if}
</div>
