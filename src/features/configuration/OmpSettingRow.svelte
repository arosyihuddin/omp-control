<script lang="ts">
  import { AlertTriangle, LockKeyhole, RotateCcw } from '@lucide/svelte';
  import type { OmpSetting } from '$lib/api';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import OptionDropdown from '$lib/components/ui/OptionDropdown.svelte';

  interface Props {
    setting: OmpSetting;
    onSave: (id: string, value: unknown) => Promise<void>;
    onReset: (id: string) => Promise<void>;
  }

  let { setting, onSave, onReset }: Props = $props();
  let draft = $state('');
  let boolDraft = $state(false);
  let saving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSavedValue = '';
  let error = $state('');
  let editorOpen = $state(false);
  let structuredRows = $state<{ key: string; value: string; valueType: 'string' | 'number' | 'boolean' | 'json' }[]>([]);
  let structuredError = $state('');

  function stringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2) ?? '';
  }

  $effect(() => {
    draft = setting.secret ? '' : stringify(setting.value);
    boolDraft = setting.value === true;
    lastSavedValue = JSON.stringify(setting.value) ?? '';
    error = '';
  });

  const choices = $derived(
    setting.options?.length
      ? setting.options
      : (setting.enumValues ?? []).map((value) => ({ value, label: value, description: undefined as string | undefined })),
  );
  const useSelect = $derived((setting.type === 'enum' || choices.length > 0) && choices.length > 0);

  async function save() {
    let value: unknown;
    try {
      if (setting.secret) {
        if (!draft) return;
        value = draft;
      } else if (setting.type === 'boolean') {
        value = boolDraft;
      } else if (setting.type === 'number') {
        if (!draft.trim() || !Number.isFinite(Number(draft))) throw new Error('Masukkan angka yang valid.');
        value = Number(draft);
      } else if (setting.type === 'array' || setting.type === 'record') {
        value = JSON.parse(draft);
      } else {
        value = draft;
      }
      const serialized = JSON.stringify(value);
      if (serialized === lastSavedValue && !setting.secret) return;
      saving = true;
      error = '';
      await onSave(setting.id, value);
      lastSavedValue = serialized;
      if (setting.secret) draft = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Gagal menyimpan konfigurasi.';
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void save(); }, 650);
  }

  function saveNow(value: string | boolean) {
    if (saveTimer) clearTimeout(saveTimer);
    if (typeof value === 'boolean') boolDraft = value;
    else draft = value;
    void save();
  }

  async function reset() {
    if (saveTimer) clearTimeout(saveTimer);
    saving = true;
    error = '';
    try {
      await onReset(setting.id);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Gagal mereset konfigurasi.';
    } finally {
      saving = false;
    }
  }
  function openStructuredEditor() {
    structuredError = '';
    try {
      const value = JSON.parse(draft || (setting.type === 'array' ? '[]' : '{}')) as unknown;
      if (setting.type === 'array' && Array.isArray(value)) {
        structuredRows = value.map((item) => ({ key: '', value: typeof item === 'string' ? item : String(item), valueType: item === null || typeof item === 'object' ? 'json' : typeof item as 'string' | 'number' | 'boolean' }));
      } else if (setting.type === 'record' && value && typeof value === 'object' && !Array.isArray(value)) {
        structuredRows = Object.entries(value).map(([key, item]) => ({ key, value: typeof item === 'string' ? item : String(item), valueType: item === null || typeof item === 'object' ? 'json' : typeof item as 'string' | 'number' | 'boolean' }));
      } else {
        throw new Error(setting.type === 'array' ? 'Nilai harus berupa list/array.' : 'Nilai harus berupa object.');
      }
    } catch (cause) {
      structuredError = cause instanceof Error ? cause.message : 'Format data tidak valid.';
      structuredRows = [];
    }
    editorOpen = true;
  }

  function scheduleStructuredSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const parseRow = (row: typeof structuredRows[number]): unknown => {
          if (row.valueType === 'string') return row.value;
          if (row.valueType === 'number') { const number = Number(row.value); if (!row.value.trim() || !Number.isFinite(number)) throw new Error('Masukkan angka yang valid.'); return number; }
          if (row.valueType === 'boolean') { if (row.value !== 'true' && row.value !== 'false') throw new Error('Pilih true atau false.'); return row.value === 'true'; }
          return JSON.parse(row.value);
        };
        const result = setting.type === 'array'
          ? structuredRows.map(parseRow)
          : Object.fromEntries(structuredRows.map((row) => [row.key.trim(), parseRow(row)]));
        if (setting.type === 'record' && structuredRows.some((row) => !row.key.trim())) throw new Error('Nama key tidak boleh kosong.');
        if (setting.type === 'record' && new Set(structuredRows.map((row) => row.key.trim())).size !== structuredRows.length) throw new Error('Nama key tidak boleh duplikat.');
        draft = JSON.stringify(result, null, 2);
        structuredError = '';
        void save();
      } catch (cause) {
        structuredError = cause instanceof Error ? cause.message : 'Periksa format nilai. String harus menggunakan tanda kutip JSON.';
      }
    }, 650);
  }

  function addStructuredRow() {
    structuredRows = [...structuredRows, { key: '', value: '', valueType: 'string' }];
    scheduleStructuredSave();
  }

  function removeStructuredRow(index: number) {
    structuredRows = structuredRows.filter((_, rowIndex) => rowIndex !== index);
    scheduleStructuredSave();
  }
</script>

<article class="group rounded-xl border border-line bg-surface-raised px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-surface-hover sm:px-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="truncate text-sm font-medium tracking-[-0.01em] text-fg">{setting.label}</h3>
        {#if setting.secret}
          <LockKeyhole size={13} class="shrink-0 text-fg-faint" />
        {/if}
        {#if setting.warning}
          <span title={setting.warning}><AlertTriangle size={14} class="shrink-0 text-warning" /></span>
        {/if}
      </div>
    </div>

    <div class="flex min-w-0 shrink-0 flex-col gap-2 sm:w-[280px]">
      {#if setting.type === 'boolean'}
        <div class="flex min-h-8 items-center justify-between rounded-md px-1.5">
          <span class="text-xs text-fg-subtle">{boolDraft ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={boolDraft} label={setting.label} onchange={(checked) => saveNow(checked)} />
        </div>
      {:else if useSelect}
        <OptionDropdown options={choices} value={draft} label={setting.label} width="w-full" class="w-full" disabled={saving} onchange={(value) => saveNow(value)} />
        {#if choices.find((option) => option.value === draft)?.description}
          <p class="text-[11px] leading-relaxed text-fg-faint">{choices.find((option) => option.value === draft)?.description}</p>
        {/if}
      {:else if setting.type === 'array' || setting.type === 'record'}
        <button type="button" onclick={openStructuredEditor} class="flex min-h-10 w-full items-center justify-between rounded-md border border-line/80 bg-surface px-3 text-left text-xs text-fg-subtle transition-colors hover:border-line-strong hover:bg-surface-raised hover:text-fg">
          <span>{setting.type === 'array' ? 'Edit list items' : 'Edit fields'}</span>
          <span class="text-[11px] text-fg-faint">Open editor ↗</span>
        </button>
      {:else}
        <Input
          bind:value={draft}
          oninput={scheduleSave}
          aria-label={setting.label}
          type={setting.secret ? 'password' : setting.type === 'number' ? 'number' : 'text'}
          autocomplete={setting.secret ? 'new-password' : 'off'}
          placeholder={setting.secret ? (setting.hasValue ? 'Credential tersimpan · isi untuk mengganti' : 'Masukkan credential') : setting.type === 'number' ? 'Masukkan angka' : 'Belum diatur'}
          class="text-xs"
        />
      {/if}

      <div class="flex items-center justify-between gap-2 px-1.5">
        <span class="text-[11px] text-fg-faint">{#if saving}Menyimpan…{:else}Auto-save aktif{/if}</span>
        <Button size="sm" variant="ghost" disabled={saving} onclick={reset}>
          <RotateCcw size={13} />
          Reset
        </Button>
      </div>
      {#if error}
        <p role="alert" class="px-1.5 text-xs leading-relaxed text-danger">{error}</p>
      {/if}
    </div>
  </div>
</article>
<Modal
  open={editorOpen}
  title={setting.type === 'array' ? 'Edit list items' : 'Edit configuration fields'}
  description={setting.label}
  width="max-w-2xl"
  height="h-[min(75vh,680px)]"
  onclose={() => (editorOpen = false)}
>
  <div class="space-y-3 p-4 sm:p-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-fg-subtle">Atur nilai lewat form. Perubahan valid akan tersimpan otomatis.</p>
      <span class="shrink-0 rounded-md border border-line bg-surface-raised px-2 py-1 text-[10px] text-fg-faint">{structuredRows.length} {setting.type === 'array' ? 'items' : 'fields'}</span>
    </div>
    {#if structuredRows.length === 0}
      <div class="rounded-lg border border-dashed border-line px-4 py-8 text-center text-xs text-fg-subtle">Belum ada item. Tambahkan item untuk mulai mengisi.</div>
    {/if}
    {#each structuredRows as row, index (index)}
      <div class="grid grid-cols-1 items-end gap-2 rounded-lg border border-line bg-surface-raised p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
        {#if setting.type === 'record'}
          <label class="block min-w-0"><span class="mb-1 block text-[11px] text-fg-subtle">Field name</span><input bind:value={row.key} oninput={scheduleStructuredSave} placeholder="Nama field" class="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-xs text-fg outline-none focus:border-accent/60" /></label>
        {/if}
        <div class="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
          <label class="block min-w-0"><span class="mb-1 block text-[11px] text-fg-subtle">Tipe</span><OptionDropdown options={[{ value: 'string', label: 'Teks' }, { value: 'number', label: 'Angka' }, { value: 'boolean', label: 'Boolean' }, { value: 'json', label: 'JSON' }]} value={row.valueType} label="Tipe data" width="w-full" class="w-full" onchange={(value) => { row.valueType = value as typeof row.valueType; if (row.valueType === 'boolean' && row.value !== 'true' && row.value !== 'false') row.value = 'false'; scheduleStructuredSave(); }} /></label>
          {#if row.valueType === 'boolean'}
            <label class="block min-w-0"><span class="mb-1 block text-[11px] text-fg-subtle">Nilai</span><OptionDropdown options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]} value={row.value} label="Nilai boolean" width="w-full" class="w-full" onchange={(value) => { row.value = value; scheduleStructuredSave(); }} /></label>
          {:else}
            <label class="block min-w-0"><span class="mb-1 block text-[11px] text-fg-subtle">Nilai</span><Input bind:value={row.value} oninput={scheduleStructuredSave} type={row.valueType === 'number' ? 'number' : 'text'} placeholder={row.valueType === 'string' ? 'Masukkan teks' : row.valueType === 'number' ? '0' : '{ } atau [ ]'} class="text-xs" /></label>
          {/if}
        </div>
        <button type="button" class="rounded-md p-2 text-fg-faint transition-colors hover:bg-danger/10 hover:text-danger" aria-label="Hapus item" onclick={() => removeStructuredRow(index)}><span class="text-sm">×</span></button>
      </div>
    {/each}
    {#if structuredError}<p role="alert" class="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">{structuredError}</p>{/if}
    <button type="button" onclick={addStructuredRow} class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-xs font-medium text-fg-subtle transition-colors hover:border-line-strong hover:bg-surface-raised hover:text-fg"><span class="text-base">+</span> Tambah {setting.type === 'array' ? 'item' : 'field'}</button>
  </div>
  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <span class="text-[11px] text-fg-faint">{#if saving}Menyimpan…{:else}Auto-save aktif{/if}</span>
      <Button size="sm" variant="secondary" onclick={() => (editorOpen = false)}>Selesai</Button>
    </div>
  {/snippet}
</Modal>
