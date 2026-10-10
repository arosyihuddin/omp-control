<script lang="ts">
  import { ArrowLeftRight, LogOut, Settings } from '@lucide/svelte';
  import { Avatar, Menu, MenuItem } from '$lib/components/ui';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import { profile } from '$lib/stores/profile.svelte';
  import { instanceRegistry } from '$lib/stores/instances.svelte';
  import ProfileModal from './ProfileModal.svelte';

  interface Props {
    collapsed?: boolean;
    placement?: 'top' | 'bottom';
    compact?: boolean;
  }

  let { collapsed = false, placement = 'top', compact = false }: Props = $props();

  let settingsOpen = $state(false);
  let settingsSection = $state<'profile' | 'general' | 'editor' | 'instances'>('profile');

  const name = $derived(profile.data?.displayName ?? 'Profile');
  const instanceName = $derived(instanceRegistry.active?.name ?? 'No instance selected');
  const status = $derived(dashboard.connected ? 'Connected' : 'Disconnected');
</script>

<Menu align="right" {placement} width="w-56">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      title={status}
      aria-label="Profile menu: {name}, {instanceName}, {status}"
      aria-expanded={open}
      class={[
        'flex items-center gap-2.5 rounded-md text-left transition-colors hover:bg-surface-hover hover:text-fg',
        compact ? 'h-8 w-8 justify-center p-0' : 'w-full px-2.5 py-2',
        !compact && open && 'bg-surface-hover',
        collapsed && 'md:justify-center md:px-0',
      ]}
      onclick={toggle}
    >
      <span class="relative shrink-0">
        <Avatar {name} color={profile.data?.avatarColor} />
      </span>
      {#if !compact}
        <span class={['min-w-0', collapsed && 'md:hidden']}>
          <span class="block truncate text-sm font-medium text-fg-muted">{name}</span>
          <span class="block truncate text-xs text-fg-faint">{instanceName} · {status}</span>
        </span>
      {/if}
    </button>
  {/snippet}
  {#snippet children({ close })}
    <div class="mb-1 border-b border-line px-3 pb-3 pt-2" role="presentation">
      <div class="flex min-w-0 items-center gap-2.5">
        <Avatar {name} color={profile.data?.avatarColor} />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-fg">{name}</div>
          <div class="truncate text-xs text-fg-subtle">{profile.data?.role ?? 'User'}</div>
        </div>
      </div>
      <div class="mt-3 rounded-md bg-surface px-2.5 py-2">
        <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-faint">Active instance</div>
        <div class="truncate text-xs font-medium text-fg" title={instanceRegistry.active?.name ?? 'No instance selected'}>{instanceName}</div>
        <div class="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
          <span class={['size-1.5 rounded-full', dashboard.connected ? 'bg-success' : 'bg-fg-faint']}></span>
          {status}
          {#if instanceRegistry.active?.baseUrl}<span class="truncate text-fg-faint">· {instanceRegistry.active.baseUrl}</span>{/if}
        </div>
      </div>
    </div>
    <MenuItem onclick={() => { close(); window.dispatchEvent(new CustomEvent('omp-control:show-instance-picker')); }}><ArrowLeftRight size={13} /> Switch instance</MenuItem>
    <MenuItem onclick={() => { close(); settingsOpen = true; }}><Settings size={13} /> Settings</MenuItem>
    <MenuItem onclick={() => { close(); window.dispatchEvent(new CustomEvent('omp-control:logout')); }}><LogOut size={13} /> Logout</MenuItem>
  {/snippet}
</Menu>

<ProfileModal open={settingsOpen} initialSection={settingsSection} onclose={() => (settingsOpen = false)} />
