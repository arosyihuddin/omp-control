<script lang="ts">
  import { Code2, FilePlus2, FolderOpen, ChevronRight, RefreshCw, Save, X, Circle, File, PanelLeft, Check, AlertCircle, Home, Maximize2, Minimize2, Search, Command, FolderX, Terminal as TerminalIcon, Plus } from '@lucide/svelte';
  import { Button, IconButton, Modal, EmptyState } from '$lib/components/ui';
  import { basename, displayPath, joinPath, isHidden } from './file-utils';
  import EditorTreeItem from './EditorTreeItem.svelte';
  import PathPicker from './PathPicker.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import { editor } from './editor.svelte';
  import { onMount } from 'svelte';
  import { TerminalController, TerminalSessions, TerminalViewport } from '$features/terminal';

  let pickerOpen = $state(false);
  let commandOpen = $state(false);
  let pickerMode = $state<'file' | 'directory'>('file');
  let closeTarget = $state<string | null>(null);
  let closeProjectOpen = $state(false);
  let showTree = $state(true);
  let fullscreen = $state(false);
  let sidebarWidth = $state(224);
  let resizingSidebar = $state(false);
  let resizeStartX = 0;
  let resizeStartWidth = 224;
  let showHidden = $state(true);
  let filter = $state('');
  let terminalOpen = $state(false);
  let terminalHeight = $state(320);
  let resizingTerminal = $state(false);
  let terminalResizeStartY = 0;
  let terminalResizeStartHeight = 320;
  const terminalController = new TerminalController({ scope: 'project', getWorkspaceRoot: () => editor.root });
  let terminalViewport = $state<ReturnType<typeof TerminalViewport>>();
  let terminalInitPromise: Promise<void> | undefined;

  async function showTerminal(createNew = false) {
    terminalOpen = true;
    if (terminalInitPromise) await terminalInitPromise;
    if (createNew || terminalController.terminals.length === 0) {
      if (!terminalController.creating) await terminalController.create();
    }
    requestAnimationFrame(() => terminalViewport?.focus());
  }

  async function closeTerminal(id: string) {
    await terminalController.close(id);
    if (terminalController.terminals.length === 0) terminalOpen = false;
  }

  const visibleItems = $derived(editor.items
    .filter((item) => (showHidden || !isHidden(item.name)) && item.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .toSorted((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
  const activeLineCount = $derived((editor.activeTab?.content ?? '').split('\n').length);

  onMount(() => {
    try {
      fullscreen = localStorage.getItem('omp-editor-fullscreen') === 'true';
    } catch {
      fullscreen = false;
    }
  });
  onMount(() => {
    terminalController.attach({ write: (data) => terminalViewport?.write(data), reset: () => terminalViewport?.reset(), focus: () => terminalViewport?.focus(), refit: () => terminalViewport?.refit() });
    terminalInitPromise = terminalController.init();
    void terminalInitPromise;
    return () => terminalController.dispose();
  });

  $effect(() => {
    void terminalController.setWorkspaceRoot(editor.root);
  });

  onMount(() => {
    // Restore the project and its open tabs after a page refresh.
    if (!editor.root && editor.tabs.length === 0) void editor.restoreLastSession();
  });

  onMount(() => {
    // Capture Escape before the embedded CodeMirror editor can consume it.
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (commandOpen) {
        event.preventDefault();
        event.stopPropagation();
        commandOpen = false;
      } else if (pickerOpen) {
        event.preventDefault();
        event.stopPropagation();
        pickerOpen = false;
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  });
  function startSidebarResize(event: PointerEvent) {
    if (!showTree || event.button !== 0) return;
    event.preventDefault();
    resizingSidebar = true;
    resizeStartX = event.clientX;
    resizeStartWidth = sidebarWidth;
    window.addEventListener('pointermove', resizeSidebar);
    window.addEventListener('pointerup', stopSidebarResize, { once: true });
  }

  function resizeSidebar(event: PointerEvent) {
    if (!resizingSidebar) return;
    sidebarWidth = Math.min(520, Math.max(160, resizeStartWidth + event.clientX - resizeStartX));
  }

  function stopSidebarResize() {
    resizingSidebar = false;
    window.removeEventListener('pointermove', resizeSidebar);
  }

  function startTerminalResize(event: PointerEvent) {
    if (!terminalOpen || event.button !== 0) return;
    event.preventDefault();
    resizingTerminal = true;
    terminalResizeStartY = event.clientY;
    terminalResizeStartHeight = terminalHeight;
    window.addEventListener('pointermove', resizeTerminal);
    window.addEventListener('pointerup', stopTerminalResize, { once: true });
  }

  function resizeTerminal(event: PointerEvent) {
    if (!resizingTerminal) return;
    terminalHeight = Math.min(Math.floor(window.innerHeight * 0.75), Math.max(176, terminalResizeStartHeight + terminalResizeStartY - event.clientY));
    requestAnimationFrame(() => terminalViewport?.refit());
  }

  function stopTerminalResize() {
    resizingTerminal = false;
    window.removeEventListener('pointermove', resizeTerminal);
    requestAnimationFrame(() => terminalViewport?.refit());
  }

  function toggleFullscreen() {
    fullscreen = !fullscreen;
    try {
      localStorage.setItem('omp-editor-fullscreen', String(fullscreen));
    } catch {
      // Keep fullscreen usable when localStorage is unavailable.
    }
  }

  function openPicker(mode: 'file' | 'directory') {
    pickerMode = mode;
    pickerOpen = true;
  }

  async function pickPath(path: string) {
    pickerOpen = false;
    if (pickerMode === 'directory') await editor.openFolder(path, path === '.' ? 'Home' : basename(path));
    else await editor.openFile(path);
  }

  function requestCloseProject() {
    if (editor.dirty) {
      closeProjectOpen = true;
      return;
    }
    editor.closeProject();
    filter = '';
    showTree = true;
  }

  async function confirmCloseProject(choice: 'save' | 'discard' | 'cancel') {
    closeProjectOpen = false;
    if (choice === 'cancel') return;
    if (choice === 'save') {
      await editor.saveAll();
      if (editor.dirty) return;
    }
    editor.closeProject();
    filter = '';
    showTree = true;
  }

  function closeRequest(path: string) {
    const tab = editor.tabs.find((item) => item.path === path);
    if (tab && tab.content !== tab.saved) {
      closeTarget = path;
      return;
    }
    editor.closeTab(path);
  }

  async function confirmClose(discard: boolean) {
    const path = closeTarget;
    closeTarget = null;
    if (!path) return;
    if (!discard) await editor.save(path);
    const tab = editor.tabs.find((item) => item.path === path);
    if (!tab || tab.content === tab.saved || discard) editor.closeTab(path);
  }


  function keydown(event: KeyboardEvent) {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.code === 'Backquote' && !event.shiftKey) {
      event.preventDefault();
      if (terminalOpen) terminalOpen = false;
      else void showTerminal();
    } else if (mod && event.shiftKey && event.code === 'Backquote') {
      event.preventDefault();
      void showTerminal(true);
    } else if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (event.shiftKey) void editor.saveAll();
      else void editor.save();
    } else if (mod && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (editor.activePath) closeRequest(editor.activePath);
    } else if (mod && event.key === 'Tab' && editor.tabs.length > 1) {
      event.preventDefault();
      const index = editor.tabs.findIndex((tab) => tab.path === editor.activePath);
      const step = event.shiftKey ? -1 : 1;
      editor.activePath = editor.tabs[(index + step + editor.tabs.length) % editor.tabs.length].path;
    } else if (event.key === 'Escape' && commandOpen) {
      commandOpen = false;
    } else if (mod && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      commandOpen = true;
    } else if (event.key === 'Escape' && pickerOpen) {
      pickerOpen = false;
    }
   }
</script>

<svelte:window onkeydown={keydown} />

<div class={["flex h-full min-h-0 flex-col overflow-hidden bg-surface-raised", fullscreen ? "fixed inset-0 z-50 rounded-none" : "rounded-lg border border-line shadow-card"]}>
  <div class="relative flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-2.5">
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <div class="flex size-7 shrink-0 items-center justify-center rounded text-accent"><Code2 size={16} /></div>
      <span class="shrink-0 text-sm font-medium text-fg">Editor</span>
      <span class="text-fg-faint">/</span>
      <span class="truncate text-xs text-fg-subtle" title={editor.root ? displayPath(editor.root) : 'Open a folder or file to get started'}>{editor.root ? displayPath(editor.root) : 'No folder opened'}</span>
    </div>
    <button type="button" aria-label="Search files" title="Search files" onclick={() => (commandOpen = true)} class="absolute left-1/2 top-1/2 hidden h-7 w-[min(34%,360px)] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-xs text-fg-subtle transition-colors hover:border-fg-faint hover:bg-surface-hover sm:flex">
      <Search size={14} class="shrink-0 text-fg-faint" />
      <span class="flex-1 truncate">Search files…</span>
      <span class="flex items-center gap-0.5 text-[10px] text-fg-faint"><Command size={10} /> P</span>
    </button>
    <div class="flex shrink-0 items-center gap-0.5">
      {#if editor.root}
        <IconButton label="Open file" size="sm" onclick={() => openPicker('file')}><FilePlus2 size={15} /></IconButton>
        <IconButton label="Close project" size="sm" onclick={requestCloseProject}><FolderX size={15} /></IconButton>
        <IconButton label="Refresh project files" size="sm" disabled={editor.treeLoading} onclick={() => void editor.loadDir(editor.dir)}><RefreshCw size={14} /></IconButton>
      {:else}
        <Button size="sm" variant="secondary" onclick={() => openPicker('directory')}><FolderOpen size={14} /> Open Project</Button>
      {/if}
      <IconButton label={editor.saving ? 'Saving…' : 'Save'} size="sm" disabled={!editor.activeDirty || editor.saving} onclick={() => void editor.save()}><Save size={15} /></IconButton>
      <div class="mx-1 h-5 w-px bg-line"></div>
      <IconButton label={terminalOpen ? 'Hide terminal' : 'Show terminal'} size="sm" onclick={() => { if (terminalOpen) terminalOpen = false; else void showTerminal(); }}><TerminalIcon size={15} /></IconButton>
      <IconButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} size="sm" onclick={toggleFullscreen}>{#if fullscreen}<Minimize2 size={15} />{:else}<Maximize2 size={15} />{/if}</IconButton>
    </div>

  </div>
  <div class={["flex min-h-0 flex-1", resizingSidebar ? "select-none cursor-col-resize" : ""]}>
    {#if editor.root && showTree}
      <aside class="flex shrink-0 flex-col border-r border-line bg-surface text-sm" style={"width: " + sidebarWidth + "px; min-width: 160px; max-width: min(520px, 70vw)"}>
        <div class="flex h-10 items-center justify-between border-b border-line px-3">
          <span class="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-fg-muted" title={editor.projectLabel}>{editor.root ? editor.projectLabel : 'Explorer'}</span>
          <div class="flex items-center gap-0.5">
            <IconButton label="Collapse explorer" size="sm" onclick={() => (showTree = false)}><PanelLeft size={14} /></IconButton>
          </div>
        </div>
        {#if editor.root}
          <div class="border-b border-line px-2 py-2">
            <input bind:value={filter} aria-label="Filter files" placeholder="Filter files…" class="h-8 w-full rounded-md border border-line bg-surface-raised px-2 text-sm text-fg placeholder:text-fg-faint outline-none focus:border-accent" />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            {#if editor.treeLoading}
              <p class="px-2 py-3 text-xs text-fg-faint">Loading files…</p>
            {:else if visibleItems.length === 0}
              <p class="px-2 py-3 text-xs text-fg-faint">{filter ? 'No matching files' : 'This folder is empty'}</p>
            {:else}
              {#each visibleItems as item (item.name)}
                <EditorTreeItem
                  {item}
                  path={joinPath(editor.dir, item.name)}
                  depth={0}
                  activePath={editor.activePath}
                  onOpen={(path, permanent) => void editor.openFile(path, undefined, !permanent)}
                />
              {/each}
            {/if}
          </div>
        {:else}
          <div class="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
            <FolderOpen size={25} class="text-fg-faint" />
            <p class="text-xs text-fg-subtle">No folder opened</p>
            <Button size="sm" variant="secondary" onclick={() => openPicker('directory')}>Open Folder</Button>
          </div>
        {/if}
      </aside>
      <div role="separator" aria-orientation="vertical" aria-label="Resize explorer sidebar" title="Drag to resize sidebar (double-click to reset)" class="group relative z-10 -ml-px w-1 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-accent/50 active:bg-accent/70" onpointerdown={startSidebarResize} ondblclick={() => (sidebarWidth = 224)}><span class="absolute inset-y-0 -left-1 -right-1"></span></div>
    {:else if editor.root}
      <div class="flex items-start border-r border-line p-1.5">
        <IconButton label="Show explorer" size="sm" onclick={() => (showTree = true)}><PanelLeft size={15} /></IconButton>
      </div>
    {/if}

    <section class="relative flex min-w-0 flex-1 flex-col">
      <section class={['absolute inset-x-0 bottom-0 z-20 flex-col overflow-hidden border-t border-line bg-surface shadow-card', terminalOpen ? 'flex' : 'hidden']} style={terminalOpen ? `height: ${terminalHeight}px` : undefined}>
        <div role="separator" aria-orientation="horizontal" aria-label="Resize terminal panel" title="Drag to resize terminal" class="group relative z-10 h-1 shrink-0 cursor-row-resize touch-none bg-transparent hover:bg-accent/40 active:bg-accent/60" onpointerdown={startTerminalResize}><span class="absolute inset-x-0 -top-1 -bottom-1"></span></div>
        <header class="flex h-9 shrink-0 items-center justify-between border-b border-line px-2.5"><div class="flex items-center gap-2 text-xs font-medium text-fg-muted"><TerminalIcon size={14} /> Terminal <span class="text-fg-faint">({terminalController.terminals.length})</span></div><div class="flex items-center gap-1"><IconButton label="New terminal" size="sm" disabled={terminalController.creating} onclick={() => void terminalController.create()}><Plus size={14} /></IconButton><IconButton label="Hide terminal" size="sm" onclick={() => (terminalOpen = false)}><X size={14} /></IconButton></div></header>
        <div class="flex min-h-0 flex-1"><div class="relative min-w-0 flex-1"><TerminalViewport bind:this={terminalViewport} ondata={terminalController.sendInput} onresize={terminalController.sendResize} />{#if !terminalController.active && !terminalController.loading}<div class="absolute inset-0 flex items-center justify-center bg-surface text-sm text-fg-subtle">No active terminal</div>{/if}{#if terminalController.error}<button type="button" class="absolute inset-x-3 bottom-3 rounded-md border border-line bg-surface-raised px-3 py-2 text-left text-xs text-danger shadow-card" onclick={() => (terminalController.error = '')}>{terminalController.error}</button>{/if}</div><TerminalSessions terminals={terminalController.terminals} activeId={terminalController.activeId} loading={terminalController.loading} onopen={(id) => terminalController.open(id)} onclose={(id) => void closeTerminal(id)} /></div>
      </section>
      {#if editor.tabs.length > 0}
        <div class="flex h-10 min-w-0 items-stretch overflow-x-auto border-b border-line bg-surface">
          {#each editor.tabs as tab (tab.path)}
            <div class={['group flex min-w-0 max-w-52 shrink-0 items-center border-r border-line', editor.activePath === tab.path ? 'border-b-2 border-b-accent bg-surface-raised' : 'border-b-2 border-b-transparent']}>
              <button class={['flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-sm', editor.activePath === tab.path ? 'text-fg' : 'text-fg-muted hover:text-fg']} title={tab.preview ? tab.path + ' — Preview (will be replaced when opening another file)' : tab.path} onclick={() => (editor.activePath = tab.path)} ondblclick={() => editor.makePermanent(tab.path)}>
                <File size={14} class="shrink-0 text-fg-subtle" />
                <span class="truncate" class:italic={tab.preview}>{tab.name}</span>
                {#if tab.content !== tab.saved}
                  <Circle size={7} fill="currentColor" class="shrink-0 text-accent" />
                {/if}
              </button>
              <button class="mr-1 flex size-6 shrink-0 items-center justify-center rounded text-fg-faint opacity-0 hover:bg-surface-hover hover:text-fg group-hover:opacity-100 focus:opacity-100" aria-label={'Close ' + tab.name} title="Close tab" onclick={() => closeRequest(tab.path)}><X size={13} /></button>
            </div>
          {/each}
          <div class="flex flex-1 items-center justify-end gap-1 px-2">
            <IconButton label="Close saved tabs" size="sm" onclick={() => editor.closeSaved()}><Check size={14} /></IconButton>
          </div>
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          {#if editor.error}
            <div class="flex items-center gap-2 border-b border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert"><AlertCircle size={15} />{editor.error}</div>
          {/if}
          {#if editor.loading}
            <div class="p-4 text-sm text-fg-subtle">Opening file…</div>
          {:else if editor.activeTab}
            <div class="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2 text-xs text-fg-faint">
              <Home size={13} class="shrink-0" />
              {#each editor.activeTab.path.split('/').filter(Boolean) as crumb, index (index)}
                <ChevronRight size={12} class="shrink-0" />
                <span class={index === editor.activeTab.path.split('/').filter(Boolean).length - 1 ? 'truncate text-fg-muted' : 'shrink-0'}>{crumb}</span>
              {/each}
            </div>
            <div class="flex min-h-0 flex-1 overflow-hidden bg-surface-raised">
              {#key editor.activeTab.path}
                <CodeEditor content={editor.activeTab.content} filename={editor.activeTab.name} onChange={(value) => editor.editActive(value)} />
              {/key}
            </div>
          {/if}
          <footer class="flex h-8 items-center justify-between gap-3 border-t border-line bg-surface px-3 text-xs text-fg-faint">
            <span class="truncate">{editor.activeTab ? displayPath(editor.activeTab.path) : 'No file selected'}</span>
            <span class="shrink-0">{editor.activeDirty ? 'Unsaved changes' : 'UTF-8'} · {activeLineCount} lines</span>
          </footer>
        </div>
      {:else}
        <div class="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState icon={Code2} title={editor.root ? 'No files open' : 'No project open'} description={editor.root ? 'Choose a file from the project explorer to start editing.' : 'Open a project folder to show its files and start editing.'}>
            <div class="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onclick={() => openPicker('directory')}><FolderOpen size={15} /> Open Project</Button>
              {#if editor.root}
                <Button variant="secondary" onclick={() => openPicker('file')}><FilePlus2 size={15} /> Open File</Button>
              {/if}
            </div>
          </EmptyState>
        </div>
      {/if}

    </section>
  </div>
</div>

<CommandPalette open={commandOpen} root={editor.root || '.'} onclose={() => (commandOpen = false)} onselectfile={(path) => { commandOpen = false; void editor.openFile(path); }} onaction={(action) => { commandOpen = false; if (action === 'open-file') openPicker('file'); else if (action === 'open-folder') openPicker('directory'); else if (action === 'save') void editor.save(); else if (action === 'save-all') void editor.saveAll(); else if (action === 'toggle-explorer') showTree = !showTree; else if (action === 'fullscreen') toggleFullscreen(); else if (action === 'refresh') void editor.loadDir(editor.dir); else if (action === 'toggle-terminal') { if (terminalOpen) terminalOpen = false; else void showTerminal(); } else if (action === 'new-terminal') { void showTerminal(true); } }} />
<PathPicker open={pickerOpen} mode={pickerMode} initialPath={editor.root || '.'} onselect={pickPath} oncancel={() => (pickerOpen = false)} />

<Modal open={closeProjectOpen} title="Close project?" width="max-w-md" onclose={() => (closeProjectOpen = false)}>
  <p class="px-4 py-4 text-sm text-fg-muted">This project has unsaved changes. Save them before closing the project?</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => void confirmCloseProject('cancel')}>Cancel</Button>
    <Button variant="secondary" onclick={() => void confirmCloseProject('discard')}>Don't Save</Button>
    <Button variant="primary" onclick={() => void confirmCloseProject('save')}>Save & Close</Button>
  {/snippet}
</Modal>

<Modal open={closeTarget !== null} title="Unsaved changes" width="max-w-md" onclose={() => (closeTarget = null)}>
  <p class="px-4 py-4 text-sm text-fg-muted">Save changes to {editor.tabs.find((tab) => tab.path === closeTarget)?.name ?? 'this file'} before closing?</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (closeTarget = null)}>Cancel</Button>
    <Button variant="secondary" onclick={() => void confirmClose(true)}>Don't Save</Button>
    <Button variant="primary" onclick={() => void confirmClose(false)}>Save</Button>
  {/snippet}
</Modal>
