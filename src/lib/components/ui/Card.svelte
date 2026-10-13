<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    children?: Snippet;
  }

  let { class: className, children, ...rest }: Props = $props();
</script>

<div class={['rounded-xl border border-line bg-surface-raised', className]} {...rest}>
  {@render children?.()}
</div>
