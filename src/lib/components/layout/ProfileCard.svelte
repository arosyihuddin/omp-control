<script lang="ts">
  import { ArrowLeftRight, Settings } from '@lucide/svelte';
  import { Avatar, Menu, MenuItem } from '$lib/components/ui';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import { profile } from '$lib/stores/profile.svelte';
  import { instanceRegistry } from '$lib/stores/instances.svelte';
  import ProfileModal from './ProfileModal.svelte';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();

  let settingsOpen = $state(false);
  let settingsSection = $state<'profile' | 'general' | 'editor' | 'instances'>('profile');

  const name = $derived(profile.data?.displayName ?? 'Profile');
  const instanceName = $derived(instanceRegistry.active?.name ?? 'No instance selected');
  const status = $derived(dashboard.connected ? 'Connected' : 'Disconnected');
</script>

<Menu align="left" placement="top" width="w-56">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      title={status}
      aria-label="Profile menu: {name}, {instanceName}, {status}"
      aria-expanded={open}
      class={[
        'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-surface-hover',
        open ? 'border-line-strong bg-surface-hover' : 'border-line',
        collapsed && 'md:justify-center md:border-transparent md:px-0',
      ]}
      onclick={toggle}
    >
      <span class="relative shrink-0">
        <Avatar {name} color={profile.data?.avatarColor} />
      </span>
      <span class={['min-w-0', collapsed && 'md:hidden']}>
        <span class="block truncate text-sm font-medium text-fg-muted">{name}</span>
        <span class="block truncate text-xs text-fg-faint">{instanceName} · {status}</span>
      </span>
    </button>
  {/snippet}
  {#snippet children({ close })}
    <MenuItem onclick={() => { close(); settingsSection = 'instances'; settingsOpen = true; }}><ArrowLeftRight size={13} /> Switch instance</MenuItem>
    <MenuItem onclick={() => { close(); settingsOpen = true; }}><Settings size={13} /> Settings</MenuItem>
  {/snippet}
</Menu>

<ProfileModal open={settingsOpen} initialSection={settingsSection} onclose={() => (settingsOpen = false)} />
