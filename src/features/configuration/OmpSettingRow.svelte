<script lang="ts">
  import { AlertTriangle, LockKeyhole, RotateCcw, Save } from '@lucide/svelte';
  import type { OmpSetting } from '$lib/api';
  import Button from '$lib/components/ui/Button.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';

  interface Props {
    setting: OmpSetting;
    onSave: (id: string, value: unknown) => Promise<void>;
    onReset: (id: string) => Promise<void>;
  }

  let { setting, onSave, onReset }: Props = $props();
  let draft = $state('');
  let boolDraft = $state(false);
  let saving = $state(false);
  let error = $state('');

  function stringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2) ?? '';
  }

  $effect(() => {
    draft = setting.secret ? '' : stringify(setting.value);
    boolDraft = setting.value === true;
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
      saving = true;
      error = '';
      await onSave(setting.id, value);
      if (setting.secret) draft = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Gagal menyimpan konfigurasi.';
    } finally {
      saving = false;
    }
  }

  async function reset() {
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
</script>

<article class="rounded-lg border border-line bg-surface-raised px-3.5 py-3 transition-colors hover:border-line-strong sm:px-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="truncate text-sm font-medium text-fg">{setting.label}</h3>
        {#if setting.secret}
          <LockKeyhole size={13} class="shrink-0 text-fg-faint" />
        {/if}
        {#if setting.warning}
          <span title={setting.warning}><AlertTriangle size={14} class="shrink-0 text-warning" /></span>
        {/if}
      </div>
      <code class="mt-1 block break-all text-[11px] text-fg-faint">{setting.id}</code>
      {#if setting.description}
        <p class="mt-1.5 max-w-3xl text-xs leading-relaxed text-fg-subtle">{setting.description}</p>
      {/if}
      {#if setting.warning}
        <p class="mt-2 rounded-md bg-warning/10 px-2.5 py-2 text-xs leading-relaxed text-warning">{setting.warning}</p>
      {/if}
      {#if setting.provenance === 'env'}
        <p class="mt-2 text-xs text-warning">Nilai efektif dikendalikan environment variable{setting.envName ? ` (${setting.envName})` : ''}. Perubahan di sini tetap disimpan, tetapi tidak akan aktif sampai override tersebut dilepas.</p>
      {:else if setting.provenance === 'project' || setting.provenance === 'overlay' || setting.provenance === 'runtime'}
        <p class="mt-2 text-xs text-fg-faint">Nilai efektif berasal dari lapisan {setting.provenance}. Perubahan di sini menyimpan nilai global.</p>
      {/if}
    </div>

    <div class="flex min-w-0 shrink-0 flex-col gap-2 sm:w-[280px]">
      {#if setting.type === 'boolean'}
        <div class="flex min-h-8 items-center justify-between rounded-md border border-line bg-surface px-2.5">
          <span class="text-xs text-fg-subtle">{boolDraft ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={boolDraft} label={setting.label} onchange={(checked) => (boolDraft = checked)} />
        </div>
      {:else if useSelect}
        <select bind:value={draft} aria-label={setting.label} class="h-8 w-full rounded-md border border-line bg-surface px-2.5 text-xs text-fg outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30">
          {#each choices as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#if choices.find((option) => option.value === draft)?.description}
          <p class="text-[11px] leading-relaxed text-fg-faint">{choices.find((option) => option.value === draft)?.description}</p>
        {/if}
      {:else if setting.type === 'array' || setting.type === 'record'}
        <textarea bind:value={draft} aria-label={setting.label} rows="3" spellcheck="false" class="w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[11px] text-fg outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30" placeholder={setting.type === 'array' ? '[]' : '{}'}></textarea>
      {:else}
        <input
          bind:value={draft}
          aria-label={setting.label}
          type={setting.secret ? 'password' : setting.type === 'number' ? 'number' : 'text'}
          autocomplete={setting.secret ? 'new-password' : 'off'}
          placeholder={setting.secret ? (setting.hasValue ? 'Credential tersimpan · isi untuk mengganti' : 'Masukkan credential') : setting.type === 'number' ? 'Masukkan angka' : 'Belum diatur'}
          class="h-8 w-full rounded-md border border-line bg-surface px-2.5 text-xs text-fg outline-none placeholder:text-fg-faint focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
        />
      {/if}

      <div class="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" disabled={saving} onclick={reset}>
          <RotateCcw size={13} />
          Reset
        </Button>
        <Button size="sm" variant="primary" disabled={saving || (setting.secret && !draft)} onclick={save}>
          {#if saving}
            <span class="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent"></span>
          {:else}
            <Save size={13} />
          {/if}
          Simpan
        </Button>
      </div>
      {#if error}
        <p role="alert" class="text-xs leading-relaxed text-danger">{error}</p>
      {/if}
    </div>
  </div>
</article>
