<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { Search, FilePlus2, FolderOpen, Save, Files, Maximize2, RefreshCw, File, Keyboard, ArrowLeft, Terminal as TerminalIcon } from '@lucide/svelte';
  import { Modal, Input, Skeleton } from '$lib/components/ui';
  import { workspaceApi } from '$lib/api';
  import { joinPath } from './file-utils';

  interface Props {
    open: boolean;
    root?: string;
    onclose: () => void;
    onaction: (action: string) => void;
    onselectfile: (path: string) => void;
  }
  let { open, root = '.', onclose, onaction, onselectfile }: Props = $props();
  let query = $state('');
  let view = $state<'commands' | 'shortcuts'>('commands');
  let files = $state<{ path: string; name: string }[]>([]);
  let loadingFiles = $state(false);
  let hasIndexed = $state(false);
  let loadError = $state('');
  let selectedIndex = $state(0);
  let resultsContainer = $state<HTMLDivElement>();
  let shortcutsContainer = $state<HTMLDivElement>();
  let selectedShortcutIndex = $state(0);
  let requestId = 0;

  // Horizontal motion only: unlike Svelte's fly transition, this does not animate opacity.
  function slideX(node: Element, options: { x?: number; duration?: number }) {
    const distance = options.x ?? 28;
    return {
      duration: options.duration ?? 220,
      easing: cubicOut,
      css: (t: number) => `transform: translate3d(${(1 - t) * distance}px, 0, 0); will-change: transform;`,
    };
  }

  const commands = [
    { id: 'open-file', label: 'Open File…', detail: 'Browse workspace files', icon: FilePlus2, keywords: 'file browse open' },
    { id: 'open-folder', label: 'Open Folder…', detail: 'Choose a workspace folder', icon: FolderOpen, keywords: 'folder directory workspace' },
    { id: 'save', label: 'Save', detail: 'Save the current file', icon: Save, keywords: 'write editor' },
    { id: 'save-all', label: 'Save All', detail: 'Save all open files', icon: Save, keywords: 'write all' },
    { id: 'toggle-explorer', label: 'Toggle Explorer', detail: 'Show or hide the file tree', icon: Files, keywords: 'sidebar tree' },
    { id: 'refresh', label: 'Refresh Explorer', detail: 'Reload workspace files', icon: RefreshCw, keywords: 'reload update' },
    { id: 'fullscreen', label: 'Toggle Fullscreen', detail: 'Expand or restore the editor', icon: Maximize2, keywords: 'full screen expand' },
    { id: 'toggle-terminal', label: 'Toggle Terminal', detail: 'Show or hide the integrated terminal', icon: TerminalIcon, keywords: 'console shell panel' },
    { id: 'new-terminal', label: 'New Terminal', detail: 'Create an integrated terminal session', icon: TerminalIcon, keywords: 'console shell create' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', detail: 'Browse and search editor shortcuts', icon: Keyboard, keywords: 'keys hotkeys keyboard shortcut' },
  ];

  const shortcuts = [["General","Show Command Center","Ctrl+Shift+P","Search commands and tools"],["General","Quick Open / Search Files","Ctrl+P","Find and open a file"],["General","Open Settings","Ctrl+,","Open application settings"],["General","Keyboard Shortcuts","Ctrl+K Ctrl+S","Open the keyboard shortcuts reference"],["General","Toggle Integrated Terminal","Ctrl+Backtick","Show or hide the terminal panel"],["General","Create New Terminal","Ctrl+Shift+Backtick","Create a new terminal session"],["General","Toggle Full Screen","F11","Toggle application fullscreen"],["General","Close Current Tab","Ctrl+W","Close the active editor tab"],["General","Close All Editors","Ctrl+K W","Close all open editor tabs"],["General","Save","Ctrl+S","Save the active file"],["General","Save All","Ctrl+K S","Save all open files"],["General","Open File","Ctrl+O","Open a file"],["General","Open Folder / Project","Ctrl+K Ctrl+O","Open a project folder"],["Editor","Undo","Ctrl+Z","Undo the last edit"],["Editor","Redo","Ctrl+Y","Redo the last undone edit"],["Editor","Cut Line","Ctrl+X","Cut current line if no selection"],["Editor","Copy Line","Ctrl+C","Copy current line if no selection"],["Editor","Move Line Up","Alt+Up","Move current line up"],["Editor","Move Line Down","Alt+Down","Move current line down"],["Editor","Copy Line Up","Shift+Alt+Up","Duplicate line above"],["Editor","Copy Line Down","Shift+Alt+Down","Duplicate line below"],["Editor","Delete Line","Ctrl+Shift+K","Delete current line"],["Editor","Insert Line Below","Ctrl+Enter","Insert a line below"],["Editor","Insert Line Above","Ctrl+Shift+Enter","Insert a line above"],["Editor","Select All","Ctrl+A","Select all editor content"],["Editor","Toggle Line Comment","Ctrl+/","Comment or uncomment selected lines"],["Editor","Toggle Block Comment","Shift+Alt+A","Toggle a block comment"],["Editor","Indent Line","Ctrl+]","Indent selected lines"],["Editor","Outdent Line","Ctrl+[","Outdent selected lines"],["Editor","Format Document","Shift+Alt+F","Format document when supported"],["Editor","Go to Line","Ctrl+G","Jump to a line number"],["Editor","Go to Definition","F12","Go to symbol definition when supported"],["Editor","Peek Definition","Alt+F12","Preview symbol definition when supported"],["Editor","Rename Symbol","F2","Rename symbol when supported"],["Editor","Trigger Suggestion","Ctrl+Space","Show code completion when supported"],["Editor","Add Cursor Above","Ctrl+Alt+Up","Add cursor to line above"],["Editor","Add Cursor Below","Ctrl+Alt+Down","Add cursor to line below"],["Editor","Find","Ctrl+F","Find text in current file"],["Editor","Replace","Ctrl+H","Find and replace text"],["Editor","Select All Occurrences","Ctrl+Shift+L","Select all occurrences"],["Editor","Add Next Occurrence","Ctrl+D","Select next matching occurrence"],["Navigation","Switch Editor Tab","Ctrl+Tab","Switch to next recently used editor"],["Navigation","Switch to Previous Tab","Ctrl+Shift+Tab","Switch to previous editor"],["Navigation","Go Back","Alt+Left","Navigate to previous location"],["Navigation","Go Forward","Alt+Right","Navigate to next location"],["Navigation","Go to Symbol","Ctrl+Shift+O","Navigate to a symbol in current file"],["Navigation","Go to References","Shift+F12","Find references when supported"],["Navigation","Toggle Explorer","Ctrl+B","Toggle the sidebar / explorer"],["Navigation","Focus Explorer","Ctrl+Shift+E","Focus file explorer"],["Navigation","Search Workspace","Ctrl+Shift+F","Search across workspace files"],["Navigation","Source Control","Ctrl+Shift+G","Open source control when available"],["Navigation","Extensions","Ctrl+Shift+X","Open extensions when available"],["Terminal","Focus Terminal","Ctrl+Backtick","Focus integrated terminal"],["Terminal","Create Terminal","Ctrl+Shift+Backtick","Create a new integrated terminal"],["Terminal","Split Terminal","Ctrl+Shift+5","Split terminal when supported"],["Terminal","Clear Terminal","Ctrl+K","Clear output when terminal is focused"],["Window","Reload Window","Ctrl+R","Reload application window"],["Window","Zoom In","Ctrl++","Increase UI zoom when supported"],["Window","Zoom Out","Ctrl+-","Decrease UI zoom when supported"],["Window","Reset Zoom","Ctrl+Numpad0","Reset UI zoom when supported"]] as const;
  const filteredShortcuts = $derived(shortcuts.filter((item) => item.join(' ').toLowerCase().includes(query.trim().toLowerCase())));

  const filteredCommands = $derived(commands.filter((item) =>
    (item.label + ' ' + item.detail + ' ' + item.keywords).toLowerCase().includes(query.trim().toLowerCase())
  ));
  const filteredFiles = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return files.filter((file) => (file.name + ' ' + file.path).toLowerCase().includes(needle)).slice(0, 100);
  });
  const results = $derived([
    ...filteredFiles.map((file) => ({ kind: 'file' as const, id: file.path, label: file.name, detail: file.path, icon: File })),
    ...filteredCommands.map((item) => ({ kind: 'command' as const, id: item.id, label: item.label, detail: item.detail, icon: item.icon })),
  ]);

  async function indexFiles() {
    const id = ++requestId;
    loadingFiles = true;
    loadError = '';
    const found: { path: string; name: string }[] = [];
    const queue = [root || '.'];
    const visited = new Set<string>();
    try {
      while (queue.length && found.length < 5000 && visited.size < 1500) {
        const dir = queue.shift()!;
        if (visited.has(dir)) continue;
        visited.add(dir);
        try {
          const data = await workspaceApi.list(dir);
          for (const item of data.items ?? []) {
            if (item.name.startsWith('.') || item.ignored) continue;
            const path = joinPath(data.path, item.name);
            if (item.type === 'directory') queue.push(path);
            else found.push({ path, name: item.name });
            if (found.length >= 5000) break;
          }
        } catch {
          // Skip unreadable folders and continue indexing the rest.
        }
      }
      if (id === requestId) files = found;
    } catch {
      if (id === requestId) loadError = 'Unable to search workspace files.';
    } finally {
      if (id === requestId) {
        loadingFiles = false;
        hasIndexed = true;
      }
    }
  }

  function chooseResult(index: number) {
    const item = results[index];
    if (!item) return;
    query = '';
    if (item.kind === 'file') onselectfile(item.id);
    else if (item.id === 'shortcuts') { view = 'shortcuts'; query = ''; selectedIndex = 0; }
    else onaction(item.id);
  }

  function keydown(event: KeyboardEvent) {
    if (view === 'shortcuts') {
      if (event.key === 'ArrowDown' && filteredShortcuts.length) {
        event.preventDefault();
        selectedShortcutIndex = Math.min(selectedShortcutIndex + 1, filteredShortcuts.length - 1);
      } else if (event.key === 'ArrowUp' && filteredShortcuts.length) {
        event.preventDefault();
        selectedShortcutIndex = Math.max(selectedShortcutIndex - 1, 0);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        view = 'commands';
        query = '';
        selectedIndex = 0;
      }
      return;
    }
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === 'Enter' && results.length) {
      event.preventDefault();
      chooseResult(selectedIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }

  $effect(() => {
    if (open) {
      query = '';
      view = 'commands';
      selectedIndex = 0;
    } else {
      requestId++;
    }
  });
  $effect(() => {
    if (open && query.trim() && !hasIndexed && !loadingFiles) void indexFiles();
  });
  $effect(() => { query; selectedIndex = 0; selectedShortcutIndex = 0; });
  $effect(() => {
    const index = selectedIndex;
    if (!open || view !== 'commands') return;
    const selected = resultsContainer?.querySelector<HTMLElement>(`[data-result-index="${index}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  });
  $effect(() => {
    const index = selectedShortcutIndex;
    if (!open || view !== 'shortcuts') return;
    const selected = shortcutsContainer?.querySelector<HTMLElement>(`[data-shortcut-index="${index}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  });
</script>

<Modal {open} title="Command Center" width="max-w-xl" height="h-[min(70vh,560px)]" onclose={onclose} autofocus>
  <div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <div class="relative min-h-0 flex-1 overflow-hidden">
      {#if view === 'shortcuts'}
        <div in:slideX={{ x: 36, duration: 220 }} out:slideX={{ x: 36, duration: 180 }} class="absolute inset-0 flex min-h-0 flex-col gap-2 bg-surface-raised">
          <div class="flex shrink-0 items-center gap-2">
            <button type="button" aria-label="Back to commands" onclick={() => { view = 'commands'; query = ''; }} class="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-fg-subtle transition hover:bg-surface-hover hover:text-fg"><ArrowLeft size={15} /></button>
            <div class="min-w-0 flex-1"><p class="text-sm font-medium text-fg">Keyboard Shortcuts</p><p class="text-xs text-fg-subtle">Search common VS Code shortcuts</p></div>
            <span class="rounded border border-line px-1.5 py-1 text-[10px] text-fg-faint">{filteredShortcuts.length} shortcuts</span>
          </div>
          <div class="relative shrink-0"><Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" /><Input bind:value={query} placeholder="Search shortcut, command, or key…" onkeydown={keydown} class="pl-9" autofocus /></div>
          <div bind:this={shortcutsContainer} class="min-h-0 flex-1 overflow-y-auto py-1">
            {#if filteredShortcuts.length}
              {#each filteredShortcuts as item, index (item[1])}
                <div data-shortcut-index={index} aria-current={selectedShortcutIndex === index ? 'true' : undefined} class={['command-result flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors', selectedShortcutIndex === index ? 'is-selected' : '']}><div class="min-w-0 flex-1"><p class="text-sm text-fg">{item[1]}</p><p class="truncate text-xs text-fg-subtle">{item[3]}</p><p class="mt-0.5 text-[10px] uppercase tracking-wide text-fg-faint">{item[0]}</p></div><kbd class="shrink-0 rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-fg-muted">{item[2]}</kbd></div>
              {/each}
            {:else}<div class="px-3 py-8 text-center text-sm text-fg-subtle">No matching shortcuts</div>{/if}
          </div>
        </div>
      {:else}
        <div in:slideX={{ x: -36, duration: 220 }} out:slideX={{ x: -36, duration: 220 }} class="absolute inset-0 flex min-h-0 flex-col gap-2 bg-surface-raised">
          <div class="relative shrink-0"><Search size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" /><Input bind:value={query} placeholder="Search files by name or run a command…" onkeydown={keydown} class="pl-9" autofocus /></div>
          <div bind:this={resultsContainer} class="min-h-0 flex-1 overflow-y-auto py-1">
            {#if results.length}
              {#each results as item, index (item.kind + ':' + item.id)}
                {@const Icon = item.icon}
                <button type="button" data-result-index={index} onclick={() => chooseResult(index)} class={['command-result flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent', selectedIndex === index ? 'is-selected' : '']}>
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-fg-subtle"><Icon size={16} /></span>
                  <span class="min-w-0 flex-1"><span class="block truncate text-sm text-fg">{item.label}</span><span class="block truncate text-xs text-fg-subtle">{item.detail}</span></span>
                  {#if selectedIndex === index}<span class="text-[10px] text-fg-faint">↵</span>{/if}
                </button>
              {/each}
            {:else if loadingFiles && query.trim()}
              <div class="space-y-3 px-3 py-6" aria-label="Searching workspace" aria-busy="true"><div class="flex items-center gap-3"><Skeleton class="size-8 shrink-0" /><div class="flex-1 space-y-2"><Skeleton class="h-3 w-2/3" /><Skeleton class="h-2.5 w-1/3" /></div></div><div class="flex items-center gap-3"><Skeleton class="size-8 shrink-0" /><div class="flex-1 space-y-2"><Skeleton class="h-3 w-1/2" /><Skeleton class="h-2.5 w-1/4" /></div></div><div class="flex items-center gap-3"><Skeleton class="size-8 shrink-0" /><div class="flex-1 space-y-2"><Skeleton class="h-3 w-3/4" /><Skeleton class="h-2.5 w-2/5" /></div></div></div>
            {:else if query.trim()}
              <div class="px-3 py-8 text-center text-sm text-fg-subtle">No matching files or commands</div>
            {:else}
              <div class="px-3 py-4 text-xs text-fg-subtle">Type to search files across the workspace or find a command.</div>
              {#each filteredCommands as item (item.id)}
                {@const Icon = item.icon}
                <button type="button" onclick={() => { if (item.id === 'shortcuts') { view = 'shortcuts'; query = ''; } else onaction(item.id); }} class="command-result flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-fg-subtle"><Icon size={16} /></span>
                  <span class="min-w-0 flex-1"><span class="block text-sm text-fg">{item.label}</span><span class="block truncate text-xs text-fg-subtle">{item.detail}</span></span>
                </button>
              {/each}
            {/if}
            {#if loadError}<p class="px-3 py-2 text-xs text-danger">{loadError}</p>{/if}
          </div>
        </div>
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-3 border-t border-line pt-3 text-[11px] text-fg-faint"><span>↑↓ Navigate</span><span>↵ Open / Run</span><span>Esc {view === 'shortcuts' ? 'Back' : 'Close'}</span>{#if loadingFiles}<span class="ml-auto">Indexing files…</span>{/if}</div>
  </div>
</Modal>

<style>
  .command-result:hover,
  .command-result.is-selected {
    background-color: color-mix(in srgb, rgb(var(--c-surface-hover)) 94%, white);
  }
</style>
