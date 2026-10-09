<script lang="ts">
  import { tick } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends HTMLInputAttributes {
    value?: string;
  }

  let { value = $bindable(''), class: className, autofocus = false, ...rest }: Props = $props();
  let input = $state<HTMLInputElement>();

  $effect(() => {
    if (!autofocus || !input) return;
    void tick().then(() => input?.focus());
  });
</script>

<input
  bind:this={input}
  bind:value
  class={[
    'h-8 w-full rounded-md border border-line bg-surface px-2.5 text-base text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-line-strong focus-visible:border-accent/60 focus-visible:ring-1 focus-visible:ring-accent/40',
    className,
  ]}
  {...rest}
/>
