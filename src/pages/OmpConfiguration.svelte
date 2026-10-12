<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertCircle, Check, RefreshCw, Search, Settings2, SlidersHorizontal } from '@lucide/svelte';
  import { ompConfigApi, type OmpSetting } from '$lib/api';
  import Button from '$lib/components/ui/Button.svelte';
  import OmpSettingRow from '$features/configuration/OmpSettingRow.svelte';

  const tabs = [
    { id: 'all', label: 'All settings' },
    { id: 'model', label: 'Model' },
    { id: 'interaction', label: 'Interaction' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'providers', label: 'Providers' },
    { id: 'context', label: 'Context' },
    { id: 'memory', label: 'Memory' },
    { id: 'files', label: 'Files' },
    { id: 'tools', label: 'Tools' },
    { id: 'shell', label: 'Shell' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'internal', label: 'Internal' },
  ] as const;

  const tabLabels: Record<string, string> = Object.fromEntries(tabs.map((tab) => [tab.id, tab.label]));
  let settings = $state<OmpSetting[]>([]);
  let configPath = $state('');
  let activeTab = $state('model');
  let search = $state('');
  let loading = $state(true);
  let loadError = $state('');
  let notice = $state('');
  let noticeError = $state(false);

  const tabCounts = $derived(
    Object.fromEntries(tabs.map((tab) => [
      tab.id,
      tab.id === 'all' ? settings.length : settings.filter((setting) => setting.tab === tab.id).length,
    ])),
  );

  const visibleSettings = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return settings.filter((setting) => {
      if (activeTab !== 'all' && !query && setting.tab !== activeTab) return false;
      if (!query) return true;
      return [setting.id, setting.label, setting.description, setting.group, setting.tab]
        .some((value) => value.toLowerCase().includes(query));
    });
  });

  const groups = $derived.by(() => {
    const grouped = new Map<string, { key: string; title: string; settings: OmpSetting[] }>();
    const includeTab = activeTab === 'all' || search.trim().length > 0;
    for (const setting of visibleSettings) {
      const title = includeTab
        ? `${tabLabels[setting.tab] ?? setting.tab} · ${setting.group || 'General'}`
        : setting.tab === 'internal'
          ? setting.id.split('.')[0]
          : setting.group || 'General';
      const key = includeTab ? `${setting.tab}:${setting.group}` : title;
      const group = grouped.get(key) ?? { key, title, settings: [] };
      group.settings.push(setting);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  });

  async function load() {
    loading = true;
    loadError = '';
    try {
      const result = await ompConfigApi.list();
      settings = result.settings;
      configPath = result.configPath;
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Gagal memuat konfigurasi OMP.';
    } finally {
      loading = false;
    }
  }

  async function saveSetting(id: string, value: unknown) {
    const updated = await ompConfigApi.update(id, value);
    settings = settings.map((setting) => setting.id === id ? updated : setting);
    notice = `Konfigurasi ${id} berhasil disimpan.`;
    noticeError = false;
  }

  async function resetSetting(id: string) {
    const updated = await ompConfigApi.reset(id);
    settings = settings.map((setting) => setting.id === id ? updated : setting);
    notice = `Konfigurasi ${id} dikembalikan ke nilai default/lapisan berikutnya.`;
    noticeError = false;
  }

  onMount(() => { void load(); });
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
  <div class="shrink-0 space-y-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-raised text-fg-subtle">
            <SlidersHorizontal size={16} />
          </div>
          <div>
            <h2 class="text-lg font-semibold tracking-tight text-fg">OMP Configuration</h2>
            <p class="text-xs text-fg-subtle">Konfigurasi dari registry resmi Oh My Pi.</p>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-faint">
          <span class="inline-flex items-center gap-1"><Settings2 size={12} /> {settings.length} pengaturan terdaftar</span>
          {#if configPath}
            <span aria-hidden="true">·</span>
            <span>Config directory:</span>
            <code class="break-all">{configPath}</code>
          {/if}
        </div>
      </div>
      <Button variant="secondary" size="sm" disabled={loading} onclick={load}>
        <RefreshCw size={13} class={loading ? 'animate-spin' : ''} />
        Refresh
      </Button>
    </div>

    <div class="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/30">
      <Search size={14} class="shrink-0 text-fg-faint" />
      <input bind:value={search} aria-label="Cari konfigurasi OMP" placeholder="Cari nama, ID, atau deskripsi konfigurasi…" class="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-faint" />
      {#if search}
        <button type="button" class="text-[11px] text-fg-faint hover:text-fg" onclick={() => (search = '')}>Clear</button>
      {/if}
    </div>

    <nav class="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Kategori konfigurasi">
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          aria-pressed={activeTab === tab.id}
          class={[
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors',
            activeTab === tab.id ? 'bg-surface-active font-medium text-fg' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg',
          ]}
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}
          <span class={['rounded px-1 text-[10px] tabular-nums', activeTab === tab.id ? 'bg-canvas text-fg' : 'bg-surface-raised text-fg-faint']}>{tabCounts[tab.id] ?? 0}</span>
        </button>
      {/each}
    </nav>

    <div class="flex items-start gap-2 rounded-md border border-line bg-surface-raised/60 px-3 py-2 text-xs leading-relaxed text-fg-subtle">
      <AlertCircle size={14} class="mt-0.5 shrink-0 text-fg-faint" />
      <p>Perubahan disimpan melalui mekanisme konfigurasi OMP ke file konfigurasi global. Pengaturan yang dikunci environment variable atau ditimpa konfigurasi proyek akan menampilkan sumbernya. Sesi yang sedang berjalan tidak otomatis berubah; konfigurasi diterapkan saat sesi baru dimulai.</p>
    </div>

    {#if notice}
      <div class={['flex items-center gap-2 rounded-md border px-3 py-2 text-xs', noticeError ? 'border-danger/30 bg-danger/5 text-danger' : 'border-success/20 bg-success/5 text-success']}>
        <Check size={13} />
        <span>{notice}</span>
        <button type="button" class="ml-auto text-current opacity-70 hover:opacity-100" onclick={() => (notice = '')} aria-label="Tutup notifikasi">×</button>
      </div>
    {/if}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto pr-0.5">
    {#if loading}
      <div class="space-y-2" aria-busy="true" aria-label="Memuat konfigurasi">
        {#each Array.from({ length: 6 }, (_, index) => index) as item (item)}
          <div class="h-24 animate-pulse rounded-lg border border-line bg-surface-raised/60"></div>
        {/each}
      </div>
    {:else if loadError}
      <div class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface-raised px-6 py-12 text-center">
        <AlertCircle size={22} class="text-danger" />
        <h3 class="mt-3 text-sm font-medium text-fg">Konfigurasi tidak dapat dimuat</h3>
        <p class="mt-1 max-w-lg text-xs text-fg-subtle">{loadError}</p>
        <Button class="mt-4" onclick={load}>Coba lagi</Button>
      </div>
    {:else if visibleSettings.length === 0}
      <div class="rounded-lg border border-line bg-surface-raised px-4 py-12 text-center">
        <p class="text-sm font-medium text-fg">Tidak ada konfigurasi yang cocok</p>
        <p class="mt-1 text-xs text-fg-subtle">Coba kata kunci lain atau pilih kategori berbeda.</p>
      </div>
    {:else}
      <div class="space-y-5 pb-4">
        {#each groups as group (group.key)}
          <section class="space-y-2">
            <div class="flex items-center justify-between gap-3 px-1">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{group.title}</h3>
              <span class="text-[10px] tabular-nums text-fg-faint">{group.settings.length}</span>
            </div>
            <div class="space-y-2">
              {#each group.settings as setting (setting.id)}
                <OmpSettingRow {setting} onSave={saveSetting} onReset={resetSetting} />
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </div>
</div>
