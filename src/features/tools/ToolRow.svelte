<script lang="ts">
  import { Ban, Info, ShieldAlert, ShieldCheck, SlidersHorizontal } from "@lucide/svelte";
  import { Switch } from "$lib/components/ui";
  import type { Tool, ToolPermission } from "$lib/types";
  interface Props {
    tool: Tool;
    updating?: boolean;
    ontoggle: (tool: Tool) => void;
    onpermission: (tool: Tool, permission: ToolPermission | null) => void;
    ondetail: (tool: Tool) => void;
  }
  let { tool, updating = false, ontoggle, onpermission, ondetail }: Props = $props();
  const activePermission = $derived(tool.permissionOverride ?? tool.permission);
</script>
<div class="group flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-hover/60 sm:px-3">
  <div class="min-w-0 flex-1">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span class="truncate font-mono text-sm text-fg" title={tool.name}>{tool.name}</span>
      <span class={["inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none", tool.section === "read_only" ? "bg-success/10 text-success" : tool.section === "edit_delete" ? "bg-warning/10 text-warning" : "bg-surface-hover text-fg-muted"]}>{tool.section === "read_only" ? "Read-only" : tool.section === "edit_delete" ? "Edit/Delete" : "Other"}</span>
    </div>
  </div>
  <div class="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-hover/70 p-0.5" role="group" aria-label={"Permission for " + tool.name}>
    <button type="button" class={["flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40", activePermission === "always_allow" ? "bg-surface-raised text-success shadow-sm" : "text-fg-faint hover:bg-surface-hover hover:text-fg"]} aria-label={"Always allow " + tool.name} title="Always allow" aria-pressed={activePermission === "always_allow"} disabled={updating} onclick={() => onpermission(tool, "always_allow")}><ShieldCheck size={15} strokeWidth={1.8} /></button>
    <button type="button" class={["flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40", activePermission === "require_approval" ? "bg-surface-raised text-warning shadow-sm" : "text-fg-faint hover:bg-surface-hover hover:text-fg"]} aria-label={"Require approval for " + tool.name} title="Require approval" aria-pressed={activePermission === "require_approval"} disabled={updating} onclick={() => onpermission(tool, "require_approval")}><ShieldAlert size={15} strokeWidth={1.8} /></button>
    <button type="button" class={["flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40", activePermission === "blocked" ? "bg-surface-raised text-danger shadow-sm" : "text-fg-faint hover:bg-surface-hover hover:text-danger"]} aria-label={"Block " + tool.name} title="Block" aria-pressed={activePermission === "blocked"} disabled={updating} onclick={() => onpermission(tool, "blocked")}><Ban size={15} strokeWidth={1.8} /></button>
    <button type="button" class={["flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40", activePermission === "custom" ? "bg-surface-raised text-accent shadow-sm" : "text-fg-faint hover:bg-surface-hover hover:text-fg"]} aria-label={"Custom permission for " + tool.name} title="Aturan kustom" aria-pressed={activePermission === "custom"} disabled={updating} onclick={() => onpermission(tool, "custom")}><SlidersHorizontal size={15} strokeWidth={1.8} /></button>
  </div>
  <div class="flex w-9 shrink-0 justify-center"><Switch checked={tool.exposed} disabled={updating} label={tool.exposed ? "Disable " + tool.name : "Enable " + tool.name} onchange={() => ontoggle(tool)} /></div>
  <button type="button" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-faint opacity-70 transition-colors hover:bg-surface-hover hover:text-fg hover:opacity-100" aria-label={"Details for " + tool.name} title="Tool details" onclick={() => ondetail(tool)}><Info size={15} strokeWidth={1.8} /></button>
</div>
