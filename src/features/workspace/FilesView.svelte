<script lang="ts">
  import { ConfirmDialog, ContextMenu, MenuItem, Skeleton } from '$lib/components/ui';
  import { Check, ChevronRight, FilePlus, FolderPlus, Info, RefreshCw, SquareTerminal } from '@lucide/svelte';
  import { workspaceApi } from '$lib/api';
  import type { WorkspaceItem } from '$lib/types';
  import { copyText, homePath, openInEditor, openPath, openProject, type FileActions, type RowInteractions } from './actions';
  import { browser } from './browser.svelte';
  import FileGrid from './FileGrid.svelte';
  import FileList from './FileList.svelte';
  import FilesSidebar from './FilesSidebar.svelte';
  import FilesToolbar from './FilesToolbar.svelte';
  import { isHidden } from '$lib/utils/workspace';
  import ItemMenuItems from './ItemMenuItems.svelte';
  import PathPicker from '$lib/components/workspace/PathPicker.svelte';
  import { prefs, type SortBy } from './preferences.svelte';
  import PropertiesDialog from './PropertiesDialog.svelte';

  let search = $state('');
  let deleteTarget = $state<WorkspaceItem | null>(null);
  let propertiesPath = $state<string | null>(null);
  let moveTarget = $state<WorkspaceItem | null>(null);
  let moveError = $state('');

  let renaming = $state<string | null>(null);
  let creating = $state<'file' | 'directory' | null>(null);
  let rowError = $state('');
  let attempt = $state(0);
  let draft = $state('');

  let sortSubmenuOpen = $state(false);
  let sortSubmenuSide = $state<'left' | 'right'>('right');
  let menu = $state<{ x: number; y: number; item?: WorkspaceItem; path?: string } | null>(null);

  const sortLabels: Record<SortBy, string> = { name: 'Name', size: 'Size', modified: 'Modified' };

  const visible = $derived.by(() => {
    const query = search.trim().toLowerCase();
    const sign = prefs.sortDir === 'asc' ? 1 : -1;
    const compare = (a: WorkspaceItem, b: WorkspaceItem) => {
      if (prefs.sortBy === 'size') return ((a.size ?? 0) - (b.size ?? 0)) * sign;
      if (prefs.sortBy === 'modified') return (new Date(a.modified ?? 0).getTime() - new Date(b.modified ?? 0).getTime()) * sign;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * sign;
    };
    return browser.items
      .filter((item) => (prefs.showHidden || !isHidden(item.name)) && item.name.toLowerCase().includes(query))
      .toSorted((a, b) => (a.type === b.type ? compare(a, b) : a.type === 'directory' ? -1 : 1));
  });

  const emptyText = $derived(search ? 'No matching files.' : 'This folder is empty.');

  function resetRow() {
    renaming = null;
    creating = null;
    rowError = '';
    draft = '';
  }

  function fail(message: string, name: string) {
    rowError = message;
    draft = name;
    attempt += 1;
  }

  function startCreate(type: 'file' | 'directory') {
    resetRow();
    creating = type;
  }

  const rows: RowInteractions = {
    get renaming() {
      return renaming;
    },
    get creating() {
      return creating;
    },
    get error() {
      return rowError;
    },
    get attempt() {
      return attempt;
    },
    get draft() {
      return draft;
    },
    async onrename(item, newName) {
      const { error } = await browser.rename(item, newName);
      if (error) fail(error, newName);
      else resetRow();
    },
    async oncreate(name) {
      const type = creating;
      if (!type) return;
      const { error } = await browser.create(name, type);
      if (error) fail(error, name);
      else {
        resetRow();
        if (type === 'file') openInEditor(browser.child(name), name);
      }
    },
    oncancel: resetRow,
    oncontext(event, item, path) {
      event.preventDefault();
      event.stopPropagation();
      sortSubmenuOpen = false;
      sortSubmenuSide = event.clientX > window.innerWidth - 360 ? 'left' : 'right';
      menu = { x: event.clientX, y: event.clientY, item, path };
    },
  };

  const actions: FileActions = {
    open: (item, path) => openPath(path, item.name, item.type),
    openInEditor: (item, path) => (item.type === 'directory' ? openProject(path, item.name) : openInEditor(path, item.name)),
    rename: (item) => {
      resetRow();
      renaming = item.name;
    },
    duplicate: (item) => void browser.duplicate(item),
    move: (item) => {
      moveError = '';
      moveTarget = item;
    },
    remove: (item) => (deleteTarget = item),
    properties: (_item, path) => (propertiesPath = path),
    download: (_item, path) => {
      const link = document.createElement('a');
      link.href = workspaceApi.downloadUrl(path);
      link.click();
    },
    newIn: async (_item, path, type) => {
      await browser.navigate(path);
      startCreate(type);
    },
    copyPath: (_item, path, relative) => void copyText(relative ? path : homePath(path)),
  };

  function onBackgroundContext(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('input, textarea')) return;
    event.preventDefault();
    sortSubmenuOpen = false;
    sortSubmenuSide = event.clientX > window.innerWidth - 360 ? 'left' : 'right';
    menu = { x: event.clientX, y: event.clientY };
  }

  async function confirmDelete() {
    const item = deleteTarget;
    deleteTarget = null;
    if (item) await browser.remove(item);
  }

  async function confirmMove(destination: string) {
    const item = moveTarget;
    if (!item) return;
    const dest = destination.replace(/^~\/?/, '').replace(/^\/+|\/+$/g, '') || '.';
    const { error } = await browser.move(item, dest);
    if (error) moveError = error;
    else moveTarget = null;
  }
</script>

<div class={[
  'grid h-full min-h-0 gap-4 lg:grid-rows-1',
  prefs.showSidebar ? 'grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[200px_1fr]' : 'grid-rows-1 lg:grid-cols-1',
]}>
  {#if prefs.showSidebar}
    <FilesSidebar onnew={startCreate} />
  {/if}
  <div class="flex min-h-0 min-w-0 flex-col gap-3">
    <FilesToolbar bind:search />
    {#if browser.error || prefs.error}
      <p class="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">{browser.error || prefs.error}</p>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="min-h-0 flex-1 overflow-y-auto" oncontextmenu={onBackgroundContext}>
      {#if browser.loading && browser.items.length === 0}
        <div class="space-y-1.5" aria-busy="true" aria-label="Loading files">
          {#each Array(8) as _, index (index)}<Skeleton class="h-9 rounded-md" />{/each}
        </div>
      {:else if prefs.view === 'list'}
        <FileList items={visible} basePath={browser.path} {actions} {rows} {emptyText} />
      {:else}
        <FileGrid items={visible} basePath={browser.path} {actions} {rows} {emptyText} />
      {/if}
    </div>
  </div>
</div>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} onclose={() => (menu = null)}>
    {#snippet children({ close })}
      {#if menu?.item && menu.path !== undefined}
        <ItemMenuItems item={menu.item} path={menu.path} {actions} {close} />
      {:else}
        {@const run = (fn: () => void) => () => {
          close();
          fn();
        }}
        <MenuItem onclick={run(() => startCreate('file'))}><FilePlus size={13} /> New file…</MenuItem>
        <MenuItem onclick={run(() => startCreate('directory'))}><FolderPlus size={13} /> New folder…</MenuItem>
        <div role="separator" class="my-1 h-px bg-line"></div>
        <MenuItem onclick={run(() => void browser.refresh())}><RefreshCw size={13} /> Refresh</MenuItem>
        <div role="separator" class="my-1 h-px bg-line"></div>
        <div role="presentation" class="relative" onpointerenter={(event) => { if (event.pointerType === 'mouse') sortSubmenuOpen = true; }} onpointerleave={(event) => { if (event.pointerType === 'mouse') sortSubmenuOpen = false; }}>
          <MenuItem class="justify-between" aria-haspopup="menu" aria-expanded={sortSubmenuOpen} onclick={() => (sortSubmenuOpen = true)}>
            <span>Sort by</span>
            <ChevronRight size={13} />
          </MenuItem>
          {#if sortSubmenuOpen}
            <div role="menu" class={['absolute top-0 z-[80] min-w-40 rounded-lg border border-line-strong bg-surface-raised p-1 shadow-pop', sortSubmenuSide === 'right' ? 'left-full ml-0.5' : 'right-full mr-0.5']}>
              {#each Object.entries(sortLabels) as [key, label] (key)}
                <MenuItem class="justify-between" onclick={run(() => prefs.setSort(key as SortBy))}>
                  <span>{label}</span>
                  {#if prefs.sortBy === key}<Check size={13} class="text-accent-hover" />{/if}
                </MenuItem>
              {/each}
              <div role="separator" class="my-1 h-px bg-line"></div>
              <MenuItem class="justify-between" onclick={run(() => prefs.setSort(prefs.sortBy, prefs.sortDir === 'asc' ? 'desc' : 'asc'))}>
                <span>{prefs.sortDir === 'asc' ? 'Ascending' : 'Descending'}</span>
              </MenuItem>
            </div>
          {/if}
        </div>
        <div role="separator" class="my-1 h-px bg-line"></div>
        <MenuItem class="justify-between" onclick={run(() => prefs.setView(prefs.view === 'list' ? 'grid' : 'list'))}>
          <span>View as {prefs.view === 'list' ? 'grid' : 'list'}</span>
        </MenuItem>
        <MenuItem class="justify-between" onclick={run(() => prefs.setShowHidden(!prefs.showHidden))}>
          <span>Show hidden files</span>
          {#if prefs.showHidden}<Check size={13} class="text-accent-hover" />{/if}
        </MenuItem>
        <div role="separator" class="my-1 h-px bg-line"></div>
        <MenuItem onclick={run(() => openProject(browser.path))}><SquareTerminal size={13} /> Open in Editor as project</MenuItem>
        <MenuItem onclick={run(() => (propertiesPath = browser.path))}><Info size={13} /> Properties</MenuItem>
      {/if}
    {/snippet}
  </ContextMenu>
{/if}

<ConfirmDialog
  open={deleteTarget !== null}
  title="Delete {deleteTarget?.type === 'directory' ? 'folder' : 'file'}?"
  description="“{deleteTarget?.name}” will be permanently deleted. This cannot be undone."
  confirmLabel="Delete"
  destructive
  onconfirm={confirmDelete}
  oncancel={() => (deleteTarget = null)}
/>

<PathPicker
  open={moveTarget !== null}
  mode="directory"
  title="Move “{moveTarget?.name ?? ''}” to…"
  initialPath={browser.path}
  confirmLabel="Move here"
  error={moveError}
  onselect={confirmMove}
  oncancel={() => (moveTarget = null)}
/>

<PropertiesDialog path={propertiesPath} onclose={() => (propertiesPath = null)} />
