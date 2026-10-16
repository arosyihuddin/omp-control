<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft, ChevronDown, Folder, Wrench } from "@lucide/svelte";
  import { EmptyState, Modal, OptionDropdown, Panel, SearchInput } from "$lib/components/ui";
  import MarkdownContent from "$lib/components/MarkdownContent.svelte";
  import { tools } from "$lib/stores/tools.svelte";
  import type { RiskLevel, Tool, ToolCustomRule, ToolPermission, ToolPermissionSection } from "$lib/types";
  import { CustomRuleBuilder, ToolListSkeleton, ToolRow } from "$features/tools";
  import type { ToolInputField } from "$lib/types";
  import RiskBadge from "$lib/components/domain/RiskBadge.svelte";
  type RiskFilter = "all" | RiskLevel;
  const riskOptions = [
    { value: "all", label: "Semua risiko" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "isolated", label: "Isolated" },
  ];
  const permissionOptions = [
    { value: "always_allow", label: "Selalu Izinkan" },
    { value: "require_approval", label: "Perlu Persetujuan" },
    { value: "blocked", label: "Blokir" },
    { value: "custom", label: "Kustom" },
  ];
  const sections: { id: ToolPermissionSection; label: string; description: string }[] = [
    { id: "read_only", label: "Read-only tools", description: "Kebijakan default untuk tool berisiko rendah." },
    { id: "edit_delete", label: "Edit/Delete tools", description: "Kebijakan default untuk tool yang dapat mengubah state." },
    { id: "other", label: "Other tools", description: "Kebijakan default untuk tool terisolasi atau kategori risiko lain." },
  ];
  const categories = [
    { id: "system_diagnostics", label: "System & Diagnostics", description: "Informasi host, hardware, dan kapabilitas sistem." },
    { id: "desktop_automation", label: "Desktop & GUI Automation", description: "Kontrol aplikasi, jendela, mouse, keyboard, dan screenshot." },
    { id: "files_search", label: "Files & Search", description: "Membaca file serta mencari file dan konten." },
    { id: "code_development", label: "Code Development & Debugging", description: "Mengedit kode, analisis sintaks, LSP, dan debugging." },
    { id: "terminal_execution", label: "Terminal & Execution", description: "Menjalankan perintah dan evaluasi kode." },
    { id: "web_research", label: "Web & Research", description: "Pencarian informasi di web." },
    { id: "network_tunnels", label: "Network & Tunnels", description: "Status dan pengelolaan Cloudflare Tunnel." },
    { id: "agent_workflow", label: "Agent Workflow & Context", description: "Task, todo, konteks, dan pengelolaan kemampuan agent." },
  ] as const;
  let search = $state("");
  let risk = $state<RiskFilter>("all");
  let selectedName = $state<string | null>(null);
  type CustomRuleTarget = { kind: "tool"; tool: Tool } | { kind: "section"; section: ToolPermissionSection } | null;
  let customRuleTarget = $state(null as CustomRuleTarget);
  const defaultCustomRule: ToolCustomRule = { version: 1, match: "all", conditions: [], action: "require_approval", fallbackAction: "require_approval" };
  const customRuleInitial = $derived.by(() => {
    const target = customRuleTarget;
    if (target?.kind === "tool") return target.tool.customRule;
    if (target?.kind === "section") return tools.items.find((tool) => tool.section === target.section)?.sectionCustomRule ?? defaultCustomRule;
    return defaultCustomRule;
  });
  const customRuleTitle = $derived.by(() => {
    const target = customRuleTarget;
    if (target?.kind === "tool") return "Aturan kustom: " + target.tool.name;
    if (target?.kind === "section") return "Aturan kustom: " + (sections.find((section) => section.id === target.section)?.label ?? "bagian");
    return "Aturan kustom";
  });
  let expandedSections = $state<ToolPermissionSection[]>(["read_only", "edit_delete", "other"]);
  let expandedCategories = $state<string[]>(categories.map((category) => category.id));
  const toggleSection = (section: ToolPermissionSection) => {
    expandedSections = expandedSections.includes(section)
      ? expandedSections.filter((item) => item !== section)
      : [...expandedSections, section];
  };
  const selectedTool = $derived(tools.items.find((tool) => tool.name === selectedName) ?? null);
  const filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return tools.items.filter((tool) => (risk === "all" || tool.risk === risk) && (!query || (tool.name + " " + tool.description + " " + tool.group + " " + tool.category).toLowerCase().includes(query)));
  });
  const categoryTools = (category: string) => filtered.filter((tool) => tool.category === category);
  const sectionPermission = (section: ToolPermissionSection) => tools.items.find((tool) => tool.section === section)?.sectionPermission ?? (section === "read_only" ? "always_allow" : "require_approval");
  function handleToolPermission(tool: Tool, permission: ToolPermission | null) {
    if (permission === "custom") {
      customRuleTarget = { kind: "tool", tool };
      return;
    }
    void tools.setPermission(tool, permission);
  }
  function handleSectionPermission(section: ToolPermissionSection, permission: ToolPermission) {
    if (permission === "custom") {
      customRuleTarget = { kind: "section", section };
      return;
    }
    void tools.setSectionPermission(section, permission);
  }
  async function saveCustomRule(rule: ToolCustomRule): Promise<boolean> {
    const target = customRuleTarget;
    if (!target) return false;
    const saved = target.kind === "tool"
      ? await tools.setPermission(target.tool, "custom", rule)
      : await tools.setSectionPermission(target.section, "custom", rule);
    if (saved) {
      customRuleTarget = null;
    }
    return saved;
  }
  function getCustomRuleFields(): ToolInputField[] {
    const target = customRuleTarget;
    if (!target) return [];
    if (target.kind === "tool") return target.tool.inputFields ?? [];
    const sectionTools = tools.items.filter((tool) => tool.section === target.section);
    const first = sectionTools[0];
    if (!first) return [];
    return first.inputFields.filter((field) => sectionTools.every((tool) => tool.inputFields.some((candidate) => candidate.path === field.path && candidate.type === field.type)));
  }
  onMount(() => void tools.load());
</script>

  <Panel title="Tool permissions" description="Atur izin eksekusi dan exposure tool.">
    {#if tools.loading}
      <ToolListSkeleton />
    {:else}
      <div class="flex flex-col gap-3 bg-surface-raised px-4 py-4 sm:flex-row sm:items-center"><SearchInput class="flex-1" bind:value={search} placeholder="Cari nama atau deskripsi tool…" label="Search tools" /><OptionDropdown label="Filter risiko" class="w-full rounded-lg border-line/70 bg-surface-raised sm:w-40" width="w-48" value={risk} options={riskOptions} onchange={(value) => risk = value as RiskFilter} /></div>
      {#if tools.error}<p class="border-b border-line px-4 py-2 text-sm text-danger" role="alert">{tools.error}</p>{/if}
      {#if filtered.length}
        <div class="space-y-4 px-3 pb-3 sm:px-4 sm:pb-4">
          <section class="rounded-lg border border-line/70 bg-surface-raised p-3 sm:p-4">
            <div class="mb-3">
              <h3 class="text-sm font-medium text-fg">Kebijakan izin default</h3>
              <p class="mt-0.5 text-xs text-fg-subtle">Kebijakan ini tetap mengikuti kelompok risiko, bukan kategori fungsional di bawah.</p>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              {#each sections as section (section.id)}
                {@const policyItems = tools.items.filter((tool) => tool.section === section.id)}
                <div class="min-w-0 rounded-md border border-line/70 p-3">
                  <p class="text-sm font-medium text-fg">{section.label}</p>
                  <p class="mt-1 min-h-8 text-xs leading-4 text-fg-subtle">{section.description}</p>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <OptionDropdown label={"Kebijakan izin " + section.label} class="w-full text-xs" width="trigger" placement="auto" value={sectionPermission(section.id)} disabled={policyItems.some((tool) => tools.updating.has(tool.name))} options={permissionOptions} onchange={(value) => handleSectionPermission(section.id, value as ToolPermission)} />
                    {#if sectionPermission(section.id) === "custom"}
                      <button type="button" class="min-h-8 rounded-md border border-line px-2 text-xs text-fg-subtle hover:bg-surface-hover hover:text-fg" disabled={policyItems.some((tool) => tools.updating.has(tool.name))} onclick={() => customRuleTarget = { kind: "section", section: section.id }}>Aturan</button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </section>
          {#each categories as category (category.id)}
            {@const items = categoryTools(category.id)}
            {#if items.length}
              <section class="w-full overflow-hidden rounded-lg border border-line/70 bg-surface-raised transition-colors">
                <div class="flex w-full items-center gap-3 bg-surface-hover/50 px-3 py-3 transition-colors sm:px-4">
                  <button
                    type="button"
                    class={["flex min-w-0 flex-1 items-center gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent", expandedCategories.includes(category.id) ? "text-fg" : "text-fg-subtle"]}
                    aria-expanded={expandedCategories.includes(category.id)}
                    aria-controls={"tools-category-" + category.id}
                    onclick={() => expandedCategories = expandedCategories.includes(category.id) ? expandedCategories.filter((item) => item !== category.id) : [...expandedCategories, category.id]}
                  >
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-active/70 text-fg-subtle"><Folder size={16} strokeWidth={1.8} /></span>
                    <span class="min-w-0 flex-1">
                      <span class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-medium text-fg">{category.label}</span>
                        <span class="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-active/70 px-2 py-0.5 text-xs tabular-nums text-fg-muted">{items.length}</span>
                      </span>
                      <span class="mt-0.5 block truncate text-xs text-fg-subtle">{category.description}</span>
                    </span>
                  </button>
                  <button type="button" class="rounded-md p-1 text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg" aria-label={(expandedCategories.includes(category.id) ? "Ciutkan " : "Buka ") + category.label} aria-expanded={expandedCategories.includes(category.id)} onclick={() => expandedCategories = expandedCategories.includes(category.id) ? expandedCategories.filter((item) => item !== category.id) : [...expandedCategories, category.id]}>
                    <ChevronDown size={16} strokeWidth={1.8} class={["transition-transform duration-200", expandedCategories.includes(category.id) ? "rotate-180" : "rotate-0"]} />
                  </button>
                </div>
                {#if expandedCategories.includes(category.id)}
                  <div id={"tools-category-" + category.id} class="border-t border-line/50 bg-surface-raised pb-2">
                    <div class="px-1 sm:px-2">
                      {#each items as tool (tool.name)}
                        <ToolRow {tool} updating={tools.updating.has(tool.name)} ontoggle={(item: Tool) => tools.toggleExposure(item)} onpermission={handleToolPermission} ondetail={(item: Tool) => selectedName = item.name} />
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

  <Modal open={selectedTool !== null} title={selectedTool?.name ?? "Detail tool"} description="Informasi tool dan parameter" onclose={() => selectedName = null} width="max-w-3xl">
    {#if selectedTool}
      <div class="space-y-5 p-4 sm:p-5">
      <div class="flex flex-wrap items-center gap-2"><span class="rounded-md border border-line bg-surface-muted px-2 py-1 font-mono text-sm text-fg">{selectedTool.name}</span><RiskBadge risk={selectedTool.risk} /><span class="text-xs text-fg-subtle">{selectedTool.group}</span></div>
      <MarkdownContent content={selectedTool.description || "Tidak ada deskripsi untuk tool ini."} class="max-w-3xl text-sm leading-6 text-fg-subtle" />
      <section class="rounded-lg border border-line">
        <div class="border-b border-line px-4 py-3"><h3 class="text-sm font-medium text-fg">Parameter yang tersedia</h3><p class="mt-1 text-xs leading-5 text-fg-subtle">Penjelasan parameter yang digunakan saat tool dijalankan.</p></div>
        {#if selectedTool.inputFields?.length}
          <div class="divide-y divide-line">
            {#each selectedTool.inputFields as field (field.path)}
              <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div class="min-w-0 sm:w-1/3"><p class="text-sm font-medium text-fg">{field.path.split(".").map((part) => part.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toLocaleUpperCase())).join(" › ")}</p><p class="mt-0.5 text-xs text-fg-faint">{field.type === "boolean" ? "Ya atau tidak" : field.type === "integer" ? "Bilangan bulat" : field.type === "number" ? "Angka" : field.type === "array" ? "Daftar nilai" : field.type === "object" ? "Sekumpulan properti" : field.type === "enum" ? "Pilihan yang tersedia" : field.type === "string" ? "Teks" : "Nilai"}{field.required ? " · Harus diisi" : " · Opsional"}</p></div>
                <div class="min-w-0 flex-1"><MarkdownContent content={field.description || (field.path.split(".").at(-1) ?? field.path).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toLocaleUpperCase()) + " yang digunakan tool ini."} class="text-sm leading-5 text-fg-subtle" />{#if field.enum?.length}<p class="mt-1 text-xs text-fg-faint">Pilihan: {field.enum.join(", ")}</p>{/if}</div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="px-4 py-4 text-sm text-fg-subtle">Tool ini tidak menyediakan metadata parameter.</p>
        {/if}
      </section>
      </div>
    {/if}
   </Modal>
<CustomRuleBuilder
  open={customRuleTarget !== null}
  title={customRuleTitle}
  initialRule={customRuleInitial}
  fields={getCustomRuleFields()}
  oncancel={() => { customRuleTarget = null; }}
  onsave={saveCustomRule}
/>
