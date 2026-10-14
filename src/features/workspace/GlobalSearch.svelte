<script lang="ts">
  import { Search, File, LoaderCircle } from '@lucide/svelte';
  import { Modal, Input } from '$lib/components/ui';
  import { workspaceApi } from '$lib/api';
  import { joinPath } from '$lib/utils/workspace';

  interface Props {
    open: boolean;
    root: string;
    onclose: () => void;
    onselect: (path: string) => void;
  }
  let { open, root, onclose, onselect }: Props = $props();
  let query = $state('');
  let files = $state<{ path: string; name: string }[]>([]);
  let results = $state<{ path: string; line: number; text: string }[]>([]);
  let loadingIndex = $state(false);
  let searching = $state(false);
  let error = $state('');
  let requestId = 0;

  async function indexWorkspace() {
    loadingIndex = true;
    error = '';
    const found: { path: string; name: string }[] = [];
    const queue = [root];
    const visited = new Set<string>();
    try {
      while (queue.length && found.length < 2500 && visited.size < 800) {
        const dir = queue.shift()!;
        if (visited.has(dir)) continue;
        visited.add(dir);
        const data = await workspaceApi.list(dir);
        for (const item of data.items ?? []) {
          if (item.name.startsWith('.') || item.ignored) continue;
          const path = joinPath(data.path, item.name);
          if (item.type === 'directory') queue.push(path);
          else found.push({ path, name: item.name });
          if (found.length >= 2500) break;
        }
      }
      files = found;
    } catch {
      error = 'Tidak bisa membaca daftar file workspace.';
    } finally {
      loadingIndex = false;
    }
  }

  async function searchContent(value: string) {
    const id = ++requestId;
    const needle = value.trim().toLowerCase();
    results = [];
    if (needle.length < 2 || !files.length) return;
    searching = true;
    const matches: { path: string; line: number; text: string }[] = [];
    try {
      for (let start = 0; start < files.length && matches.length < 100; start += 12) {
        if (id !== requestId) return;
        const batch = files.slice(start, start + 12);
        const contents = await Promise.all(batch.map(async (file) => {
          try {
            const content = await workspaceApi.readFile(file.path);
            if (content.includes('\u0000') || content.length > 1024 * 1024) return { file, content: '' };
            return { file, content };
          } catch {
            return { file, content: '' };
          }
        }));
        for (const { file, content } of contents) {
          if (!content) continue;
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              matches.push({ path: file.path, line: i + 1, text: makeExcerpt(lines[i], needle) });
              if (matches.length >= 100) break;
            }
          }
          if (matches.length >= 100) break;
        }
        results = [...matches];
      }
    } finally {
      if (id === requestId) searching = false;
    }
  }

  $effect(() => {
    if (!open) {
      requestId++;
      return;
    }
    query = '';
    results = [];
    if (!files.length && !loadingIndex) void indexWorkspace();
  });
  $effect(() => {
    const value = query;
    if (!open || value.trim().length < 2) {
      requestId++;
      results = [];
      searching = false;
      return;
    }
    const handle = setTimeout(() => void searchContent(value), 250);
    return () => clearTimeout(handle);
  });

  function highlightedParts(text: string, value: string) {
    const needle = value.trim();
    if (!needle) return [{ text, match: false }];
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text
      .split(new RegExp(`(${escaped})`, 'ig'))
      .filter(Boolean)
      .map((part) => ({ text: part, match: part.toLowerCase() === needle.toLowerCase() }));
  }

  function makeExcerpt(line: string, needle: string) {
    const value = line.trim();
    if (value.length <= 240) return value;
    const index = value.toLowerCase().indexOf(needle);
    const start = Math.max(0, index - 100);
    const end = Math.min(value.length, start + 240);
    return `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`;
  }

  function openResult(path: string) {
    onselect(path);
    onclose();
  }
</script>

<Modal {open} title="Search" width="max-w-3xl" height="h-[min(78vh,680px)]" onclose={onclose} autofocus>
  <div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <div class="relative shrink-0">
      <Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
      <Input bind:value={query} placeholder="Search across files…" class="pl-9" autofocus />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if loadingIndex}
        <p class="px-3 py-6 text-center text-sm text-fg-subtle">Indexing workspace files…</p>
      {:else if error}
        <p class="px-3 py-6 text-center text-sm text-danger">{error}</p>
      {:else if query.trim().length < 2}
        <p class="px-3 py-6 text-center text-sm text-fg-subtle">Ketik minimal 2 karakter untuk mencari isi file.</p>
      {:else if !results.length && searching}
        <p class="px-3 py-6 text-center text-sm text-fg-subtle"><LoaderCircle size={15} class="mr-2 inline animate-spin" />Searching workspace…</p>
      {:else if !results.length}
        <p class="px-3 py-6 text-center text-sm text-fg-subtle">Tidak ada hasil yang cocok.</p>
      {:else}
        {#each results as result, i (result.path + ':' + result.line + ':' + i)}
          <button type="button" class="mb-1 flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-hover" onclick={() => openResult(result.path)}>
            <File size={15} class="mt-0.5 shrink-0 text-fg-subtle" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-fg">{result.path}<span class="ml-2 text-fg-faint">:{result.line}</span></span>
              <span class="mt-1 block break-all font-mono text-xs text-fg-muted">{#each highlightedParts(result.text, query) as part, partIndex (partIndex)}{#if part.match}<span class="rounded-sm bg-warning/25 font-semibold text-fg ring-1 ring-warning/40">{part.text}</span>{:else}{part.text}{/if}{/each}</span>
            </span>
          </button>
        {/each}
        {#if searching}<p class="px-3 py-2 text-xs text-fg-faint">Masih mencari…</p>{/if}
      {/if}
    </div>
    <p class="shrink-0 border-t border-line pt-3 text-[11px] text-fg-faint">Hasil dibatasi 100 baris. File tersembunyi dan file yang diabaikan tidak dicari.</p>
  </div>
</Modal>
