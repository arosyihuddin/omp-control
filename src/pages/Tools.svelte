<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft, ChevronDown, Folder, Wrench } from "@lucide/svelte";
  import { EmptyState, IconButton, OptionDropdown, Panel, SearchInput, SegmentedControl } from "$lib/components/ui";
  import { tools } from "$lib/stores/tools.svelte";
  import type { RiskLevel, Tool, ToolCustomRule, ToolPermission, ToolPermissionSection } from "$lib/types";
  import { ToolListSkeleton, ToolRow } from "$features/tools";
  import RiskBadge from "$lib/components/domain/RiskBadge.svelte";
  type RiskFilter = "all" | RiskLevel;
  const riskOptions = (["all", "low", "medium", "high", "isolated"] as const).map((value) => ({ value, label: value }));
  const permissionOptions = [
    { value: "always_allow", label: "Selalu Izinkan" },
    { value: "require_approval", label: "Perlu Persetujuan" },
    { value: "blocked", label: "Blokir" },
    { value: "custom", label: "Kustom" },
  ];
  const customRuleOptions = [
    { value: "approval", label: "Persetujuan setiap panggilan" },
    { value: "high_risk", label: "Persetujuan hanya untuk risiko tinggi" },
    { value: "block_high_risk", label: "Blokir risiko tinggi" },
  ];
  const sections: { id: ToolPermissionSection; label: string; description: string }[] = [
    { id: "read_only", label: "Read-only tools", description: "Membaca informasi tanpa mengubah state." },
    { id: "edit_delete", label: "Edit/Delete tools", description: "Mengubah data atau memengaruhi sistem." },
    { id: "other", label: "Other tools", description: "Tool di luar dua kategori utama." },
  ];
  let search = $state("");
  let risk = $state<RiskFilter>("all");
  let selectedName = $state<string | null>(null);
  let expandedSections = $state<ToolPermissionSection[]>(["read_only", "edit_delete", "other"]);
  const toggleSection = (section: ToolPermissionSection) => {
    expandedSections = expandedSections.includes(section)
      ? expandedSections.filter((item) => item !== section)
      : [...expandedSections, section];
  };
  const selectedTool = $derived(tools.items.find((tool) => tool.name === selectedName) ?? null);
  const filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return tools.items.filter((tool) => (risk === "all" || tool.risk === risk) && (!query || (tool.name + " " + tool.description + " " + tool.group).toLowerCase().includes(query)));
  });
  const sectionTools = (section: ToolPermissionSection) => filtered.filter((tool) => tool.section === section);
  const sectionPermission = (section: ToolPermissionSection) => tools.items.find((tool) => tool.section === section)?.sectionPermission ?? (section === "read_only" ? "always_allow" : "require_approval");
  onMount(() => void tools.load());
</script>

{#if selectedTool}
  <Panel title={selectedTool.name} description="Detail dan pengaturan tool">
    <div class="border-b border-line px-4 py-3"><IconButton label="Kembali ke daftar tools" size="sm" onclick={() => selectedName = null}><ArrowLeft size={16} /></IconButton></div>
    <div class="space-y-5 p-4 sm:p-5">
      <div class="flex flex-wrap items-center gap-2"><span class="rounded-md border border-line bg-surface-muted px-2 py-1 font-mono text-sm text-fg">{selectedTool.name}</span><RiskBadge risk={selectedTool.risk} /><span class="text-xs text-fg-subtle">{selectedTool.group}</span></div>
      <p class="max-w-3xl text-sm leading-6 text-fg-subtle">{selectedTool.description || "Tidak ada deskripsi untuk tool ini."}</p>
      <section class="max-w-2xl rounded-lg border border-line">
        <div class="border-b border-line px-4 py-3"><h3 class="text-sm font-medium text-fg">Izin eksekusi</h3><p class="mt-0.5 text-xs text-fg-subtle">Atur bagaimana backend menangani pemanggilan tool ini.</p></div>
        <div class="space-y-3 p-4">
          <div class="flex flex-col gap-1.5 text-sm text-fg-subtle">
            <span>Mode izin</span>
            <OptionDropdown label="Mode izin" class="w-full" width="w-72" value={selectedTool.permissionOverride ?? "inherit"} disabled={tools.updating.has(selectedTool.name)} options={[{ value: "inherit", label: "Ikuti kebijakan bagian", description: "Gunakan izin default kategori" }, ...permissionOptions]} onchange={(value) => void tools.setPermission(selectedTool, value === "inherit" ? null : value as ToolPermission)} />
          </div>
          {#if (selectedTool.permissionOverride ?? selectedTool.permission) === "custom"}
            <div class="flex flex-col gap-1.5 text-sm text-fg-subtle">
              <span>Aturan kustom</span>
              <OptionDropdown label="Aturan kustom" class="w-full" width="w-80" value={selectedTool.customRule} disabled={tools.updating.has(selectedTool.name)} options={customRuleOptions} onchange={(value) => void tools.setPermission(selectedTool, "custom", value as ToolCustomRule)} />
            </div>
          {/if}
        </div>
      </section>
      <section class="flex max-w-2xl items-center justify-between gap-4 rounded-lg border border-line p-4">
        <div><h3 class="text-sm font-medium text-fg">Exposure ke MCP clients</h3><p class="mt-0.5 text-xs text-fg-subtle">{selectedTool.exposed ? "Tool tersedia untuk client." : "Tool disembunyikan dari client."}</p></div>
        <button type="button" role="switch" aria-checked={selectedTool.exposed} aria-label="Toggle exposure" disabled={tools.updating.has(selectedTool.name)} onclick={() => void tools.toggleExposure(selectedTool)} class={["relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", selectedTool.exposed ? "bg-accent" : "bg-line-strong"]}><span class={["inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", selectedTool.exposed ? "translate-x-[16px]" : "translate-x-[2px]"]}></span></button>
      </section>
    </div>
  </Panel>
{:else}
  <Panel title="Tool permissions" description="Atur izin eksekusi dan exposure tool.">
    {#if tools.loading}
      <ToolListSkeleton />
    {:else}
      <div class="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center"><SearchInput class="flex-1" bind:value={search} placeholder="Cari tool…" label="Search tools" /><SegmentedControl label="Filter by risk" options={riskOptions} bind:value={risk} /></div>
      {#if tools.error}<p class="border-b border-line px-4 py-2 text-sm text-danger" role="alert">{tools.error}</p>{/if}
      {#if filtered.length}
        <div class="divide-y divide-line">
          {#each sections as section (section.id)}
            {@const items = sectionTools(section.id)}
            {#if items.length}
              <section class="w-full">
                <button
                  type="button"
                  class={[
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                    expandedSections.includes(section.id) ? "bg-surface-muted/50 text-fg" : "text-fg-subtle",
                  ]}
                  aria-expanded={expandedSections.includes(section.id)}
                  aria-controls={"tools-section-" + section.id}
                  onclick={() => toggleSection(section.id)}
                >
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-fg-subtle">
                    <Folder size={16} strokeWidth={1.8} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-fg">{section.label}</span>
                    <span class="mt-0.5 block truncate text-xs text-fg-subtle">{section.description}</span>
                  </span>
                  <span class="inline-flex min-w-6 items-center justify-center rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs tabular-nums text-fg-subtle">{items.length}</span>
                  <ChevronDown size={16} strokeWidth={1.8} class={["shrink-0 text-fg-faint transition-transform duration-200", expandedSections.includes(section.id) ? "rotate-180" : "rotate-0"]} />
                </button>

                {#if expandedSections.includes(section.id)}
                  <div id={"tools-section-" + section.id} class="border-t border-line bg-surface/40">
                    <div class="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:pl-16">
                      <div class="flex items-center gap-2 text-xs text-fg-subtle">
                        <span class="h-1.5 w-1.5 rounded-full bg-fg-faint"></span>
                        Kebijakan izin bagian
                      </div>
                      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                        <OptionDropdown label={"Kebijakan izin " + section.label} class="min-w-44 text-xs" width="w-64" value={sectionPermission(section.id)} disabled={items.some((tool) => tools.updating.has(tool.name))} options={permissionOptions} onchange={(value) => void tools.setSectionPermission(section.id, value as ToolPermission)} />
                        {#if sectionPermission(section.id) === "custom"}
                          <OptionDropdown label={"Aturan kustom " + section.label} class="min-w-52 text-xs" width="w-80" value={items[0]?.customRule ?? "approval"} disabled={items.some((tool) => tools.updating.has(tool.name))} options={customRuleOptions} onchange={(value) => void tools.setSectionPermission(section.id, "custom", value as ToolCustomRule)} />
                        {/if}
                      </div>
                    </div>
                    <div class="ml-7 border-l border-line sm:ml-12">
                      {#each items as tool (tool.name)}
                        <ToolRow {tool} updating={tools.updating.has(tool.name)} ontoggle={(item: Tool) => tools.toggleExposure(item)} onpermission={(item: Tool, permission: ToolPermission | null) => tools.setPermission(item, permission)} ondetail={(item: Tool) => selectedName = item.name} />
                      {/each}
                    </div>
                  </div>
                {/if}
              </section>
            {/if}
          {/each}
        </div>
      {:else}
        <EmptyState icon={Wrench} title="Tidak ada tool yang cocok" description="Coba kata kunci atau filter risiko yang berbeda." />
      {/if}
    {/if}
  </Panel>
{/if}
