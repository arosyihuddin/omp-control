<script lang="ts" generics="T extends string">
  import { Check, ChevronDown } from "@lucide/svelte";
  import Menu from "./Menu.svelte";
  import MenuItem from "./MenuItem.svelte";

  interface Option { value: T; label: string; description?: string; }
  interface Props {
    options: Option[];
    value: T;
    label: string;
    disabled?: boolean;
    width?: string;
    placement?: "bottom" | "top" | "auto";
    offsetX?: number;
    class?: string;
    onchange?: (value: T) => void;
  }
  let { options, value, label, disabled = false, width = "w-64", placement = "bottom", offsetX = 0, class: className = "", onchange }: Props = $props();
  let open = $state(false);
  const selectedLabel = $derived(options.find((option) => option.value === value)?.label ?? value);
  function choose(next: T, close: () => void) {
    close();
    if (next !== value) onchange?.(next);
  }
</script>

<Menu bind:open align="right" {placement} {width} {offsetX}>
  {#snippet trigger({ toggle, open: menuOpen })}
    <button
      type="button"
      class={[
        "inline-flex min-h-8 items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-left text-sm text-fg transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
        menuOpen && "border-line-strong bg-surface-hover",
        className,
      ]}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      {disabled}
      onclick={toggle}
    >
      <span class="min-w-0 truncate">{selectedLabel}</span>
      <ChevronDown size={14} class={["shrink-0 text-fg-faint transition-transform", menuOpen && "rotate-180"]} />
    </button>
  {/snippet}
  {#snippet children({ close })}
    {#each options as option (option.value)}
      <MenuItem class={["gap-2.5 py-2 text-sm", value === option.value && "bg-surface-hover text-fg"]} aria-current={value === option.value ? "true" : undefined} onclick={() => choose(option.value, close)}>
        <span class="flex size-4 shrink-0 items-center justify-center">{#if value === option.value}<Check size={14} strokeWidth={2} />{/if}</span>
        <span class="min-w-0 flex-1">
          <span class="block">{option.label}</span>
        </span>
      </MenuItem>
    {/each}
  {/snippet}
</Menu>
