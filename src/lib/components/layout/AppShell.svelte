<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    sidebar: Snippet;
    header: Snippet;
    children: Snippet;
    /** Page fills the viewport and manages its own scrolling (terminal, editor). */
    fill?: boolean;
    /** Use the standard page inset while still filling the available height. */
    compactFill?: boolean;
  }

  let { sidebar, header, children, fill = false, compactFill = false }: Props = $props();
</script>

<!--
  Connected sidebar + top bar share the canvas colour; the content panel sits
  inside with a rounded top-left corner (Linear-style frame).
-->
<div class="flex h-full overflow-hidden bg-canvas text-fg">
  {@render sidebar()}
  <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
    {@render header()}
    <main class="min-h-0 flex-1 overflow-hidden rounded-tl-xl border-l border-t border-line bg-surface">
      <div class={['h-full', fill ? (compactFill ? 'overflow-hidden p-3' : 'overflow-hidden p-3 sm:p-4') : 'overflow-y-auto']}>
        {#if fill}
          {@render children()}
        {:else}
          <div class="w-full p-3">{@render children()}</div>
        {/if}
      </div>
    </main>
  </div>
</div>
