<script lang="ts">
  import { Badge, Panel } from "$lib/components/ui";
  import type { SystemTelemetry } from "$lib/types";

  interface Props {
    system: SystemTelemetry;
  }

  let { system }: Props = $props();

  const runtimes = $derived(Object.entries(system.runtime ?? {}));
  const interfaces = $derived(system.network?.interfaces ?? []);
  const activeInterfaces = $derived(
    interfaces.filter((network) => network.up).length,
  );
</script>

<Panel
  title="Runtime & Network"
  description="Detected runtimes and network interfaces."
  tag="LIVE"
  tagTone="success"
>
  <div class="grid gap-4 p-4 sm:grid-cols-2">
    <section class="min-w-0">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-fg-faint"
        >
          Runtimes
        </h3>
        <span class="text-xs text-fg-faint">{runtimes.length}</span>
      </div>
      <dl class="space-y-2">
        {#each runtimes as [name, version] (name)}
          <div
            class="flex min-w-0 items-center justify-between gap-3 rounded-md border border-line bg-surface px-2.5 py-2 text-sm"
          >
            <dt class="truncate text-fg-subtle">{name}</dt>
            <dd class="shrink-0 font-medium text-fg-muted">
              {version ?? "not installed"}
            </dd>
          </div>
        {:else}
          <p class="text-sm text-fg-subtle">No runtimes detected.</p>
        {/each}
      </dl>
    </section>
    <section class="min-w-0">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-fg-faint"
        >
          Network interfaces
        </h3>
        <span class="text-xs text-fg-faint"
          >{activeInterfaces} / {interfaces.length} up</span
        >
      </div>
      <ul class="max-h-[343px] space-y-2 overflow-y-auto pr-1">
        {#each interfaces as network (network.name)}
          <li class="rounded-md border border-line bg-surface px-2.5 py-2">
            <div
              class="flex min-w-0 items-center justify-between gap-2 text-sm"
            >
              <span class="truncate font-medium text-fg-muted"
                >{network.name}</span
              >
              <Badge tone={network.up ? "success" : "neutral"}
                >{network.up ? "up" : "down"}</Badge
              >
            </div>
            <div class="mt-1 text-xs text-fg-faint">
              {network.address_count} addresses · {(
                network.families ?? []
              ).join(", ") || "—"}
            </div>
          </li>
        {:else}
          <li
            class="rounded-md border border-dashed border-line px-3 py-5 text-center text-sm text-fg-subtle"
          >
            No network interfaces detected.
          </li>
        {/each}
      </ul>
    </section>
  </div>
</Panel>
