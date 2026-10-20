<script lang="ts">
  import { ChevronDown, Folder, PanelLeft } from '@lucide/svelte';
  import { mainNav, routes, workspaceNav } from '$lib/routes';
  import { approvals } from '$features/approvals/approvals.svelte';
  import { router } from '$lib/stores/router.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import SidebarItem from './SidebarItem.svelte';
  import Logo from './Logo.svelte';

  let workspaceOpen = $state(false);
  const collapsed = $derived(ui.sidebarCollapsed);

  // Keep the Workspace section expanded when the current route is one of its submenus,
  // including after a full page refresh restores the route from the URL.
  $effect(() => {
    if (router.inWorkspace) workspaceOpen = true;
  });

  function onWorkspaceClick() {
    if (collapsed && window.matchMedia('(min-width: 768px)').matches) router.navigate('workspace-files');
    else workspaceOpen = !workspaceOpen;
  }
</script>

{#if ui.mobileNavOpen}
  <button
    type="button"
    class="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] md:hidden"
    aria-label="Close navigation"
    onclick={() => (ui.mobileNavOpen = false)}
  ></button>
{/if}

<aside
  class={[
    'fixed inset-y-0 left-0 z-40 flex w-[min(84vw,256px)] shrink-0 flex-col bg-canvas transition-transform duration-200 ease-out md:relative md:z-auto md:translate-x-0 md:transition-[width]',
    ui.mobileNavOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
    collapsed ? 'md:w-14' : 'md:w-56',
  ]}
>
  <div class="flex h-12 shrink-0 items-center justify-between px-3">
    {#if collapsed}
      <div class="mx-auto hidden h-7 w-7 items-center justify-center overflow-hidden md:flex" aria-hidden="true">
        <Logo size={28} />
      </div>
    {/if}
    <div class={['flex min-w-0 items-center gap-2.5', collapsed && 'md:hidden']}>
      <Logo size={24} full />
    </div>
  </div>

  <nav class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pt-2" aria-label="Main">
    {#each mainNav as id (id)}
      {@const route = routes[id]}
      <SidebarItem
        href={route.path}
        icon={route.icon}
        label={route.title}
        active={router.current === id}
        {collapsed}
        badge={id === 'approvals' ? approvals.pending.length : 0}
        onclick={(event) => router.link(event, id)}
      />
    {/each}

    <div class="pt-1">
      <button
        type="button"
        class={[
          'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-base transition-colors',
          collapsed && 'md:justify-center md:px-0',
          router.inWorkspace && (collapsed || !workspaceOpen) ? 'bg-surface-active text-fg' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg',
        ]}
        onclick={onWorkspaceClick}
        aria-expanded={workspaceOpen}
        title={collapsed ? 'Workspace' : undefined}
      >
        <Folder size={16} strokeWidth={1.8} class="shrink-0" />
        <span class={['truncate', collapsed && 'md:hidden']}>Workspace</span>
        <ChevronDown size={13} strokeWidth={1.8} class={['ml-auto transition-transform', !workspaceOpen && '-rotate-90', collapsed && 'md:hidden']} />
      </button>
      {#if workspaceOpen}
        <div class={['ml-[17px] mt-0.5 space-y-0.5 border-l border-line pl-2', collapsed && 'md:hidden']}>
          {#each workspaceNav as id (id)}
            {@const route = routes[id]}
            <SidebarItem
              nested
              href={route.path}
              icon={route.icon}
              label={route.title}
              active={router.current === id}
              onclick={(event) => router.link(event, id)}
            />
          {/each}
        </div>
      {/if}
    </div>
  </nav>

  <div class="shrink-0 border-t border-line p-2">
    <button type="button" class="flex h-9 w-full items-center justify-center gap-2 rounded-md text-fg-faint transition-colors hover:bg-surface hover:text-fg" onclick={() => ui.toggleSidebar()} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      <PanelLeft size={16} strokeWidth={1.8} />
      {#if !collapsed}<span class="text-xs font-medium">Collapse sidebar</span>{/if}
    </button>
  </div>
</aside>
