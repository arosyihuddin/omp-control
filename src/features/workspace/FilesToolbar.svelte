<script lang="ts">
  import { ArrowLeft, ArrowRight, Check, Home, LayoutGrid, List, MoreVertical, PanelLeft, type LucideIcon } from '@lucide/svelte';
  import { IconButton, Menu, MenuItem, SearchInput, SegmentedControl } from '$lib/components/ui';
  import { browser } from './browser.svelte';
  import { prefs, type FileView } from './preferences.svelte';

  interface Props {
    search?: string;
  }

  let { search = $bindable('') }: Props = $props();

  const viewOptions: { value: FileView; icon: LucideIcon; iconClass: string; ariaLabel: string }[] = [
    { value: 'list', icon: List, iconClass: 'text-accent-hover', ariaLabel: 'List view' },
    { value: 'grid', icon: LayoutGrid, iconClass: 'text-accent-hover', ariaLabel: 'Grid view' },
  ];

  const absolute = $derived(browser.path.startsWith('/'));
  const segments = $derived(browser.path === '.' || browser.path === '/' ? [] : browser.path.split('/').filter(Boolean));
</script>

<div class="flex flex-wrap items-center gap-2">
  <div class="flex min-w-0 flex-1 items-center gap-1">
    <IconButton label="Back" disabled={!browser.back.length} onclick={() => browser.goBack()}><ArrowLeft size={14} /></IconButton>
    <IconButton label="Forward" disabled={!browser.forward.length} onclick={() => browser.goForward()}><ArrowRight size={14} /></IconButton>
    <nav
      aria-label="Current folder"
      class="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-md border border-line bg-surface px-1 font-mono text-sm text-fg-muted"
    >
      <button type="button" class="flex h-6 shrink-0 items-center gap-1 rounded px-1.5 leading-none hover:bg-surface-hover hover:text-fg" onclick={() => browser.navigate(absolute ? '/' : '.')}>
        <Home size={12} class="block shrink-0" />
        <span class="relative top-px inline-flex items-center leading-none">{absolute ? '/' : '/home'}</span>
      </button>
      {#each segments as segment, index (index)}
        <span class="text-fg-faint">/</span>
        <button
          type="button"
          class="flex h-6 shrink-0 items-center rounded px-1.5 leading-none hover:bg-surface-hover hover:text-fg"
          onclick={() => browser.navigate(absolute ? '/' + segments.slice(0, index + 1).join('/') : segments.slice(0, index + 1).join('/'))}
        >
          {segment}
        </button>
      {/each}
    </nav>
  </div>

  <div class="flex items-center gap-2">
    <SearchInput class="w-full sm:w-56" bind:value={search} placeholder="Search in folder" label="Search files" />
    <SegmentedControl label="File view" options={viewOptions} value={prefs.view} onchange={(view) => prefs.setView(view)} />
    <Menu width="w-52">
      {#snippet trigger({ toggle, open })}
        <IconButton label="View options" active={open} aria-expanded={open} onclick={toggle}><MoreVertical size={14} /></IconButton>
      {/snippet}
      {#snippet children({ close })}
        <MenuItem
          class="justify-between"
          onclick={() => {
            prefs.setShowHidden(!prefs.showHidden);
            close();
          }}
        >
          <span>Show hidden files</span>
          {#if prefs.showHidden}<Check size={13} class="text-accent-hover" />{/if}
        </MenuItem>
        <div role="separator" class="my-1 h-px bg-line"></div>
        <MenuItem
          onclick={() => {
            prefs.setShowSidebar(!prefs.showSidebar);
            close();
          }}
        >
          <PanelLeft size={13} />
          {prefs.showSidebar ? 'Hide sidebar' : 'Show sidebar'}
        </MenuItem>
      {/snippet}
    </Menu>
  </div>
</div>
