<script lang="ts">
  import { Check, Code2, Keyboard, LockKeyhole, Moon, Network, Settings2, Sun, UserRound } from '@lucide/svelte';
  import { Avatar, Button, Input, Modal } from '$lib/components/ui';
  import { profile } from '$lib/stores/profile.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import InstancesManager from './InstancesManager.svelte';

  interface Props { open: boolean; onclose: () => void; initialSection?: 'profile' | 'general' | 'editor' | 'instances'; }
  let { open, onclose, initialSection = 'profile' }: Props = $props();
  type Section = 'profile' | 'general' | 'editor' | 'instances';
  let section = $state<Section>('profile');
  const colors = [
    { key: 'accent', swatch: 'bg-accent', label: 'Indigo' },
    { key: 'info', swatch: 'bg-info', label: 'Blue' },
    { key: 'success', swatch: 'bg-success', label: 'Green' },
    { key: 'warning', swatch: 'bg-warning', label: 'Amber' },
    { key: 'danger', swatch: 'bg-danger', label: 'Red' },
  ];
  let displayName = $state('');
  let role = $state('');
  let avatarColor = $state('accent');
  let error = $state('');
  let saving = $state(false);
  $effect(() => {
    if (!open) return;
    section = initialSection;
    displayName = profile.data?.displayName ?? '';
    role = profile.data?.role ?? '';
    avatarColor = profile.data?.avatarColor ?? 'accent';
    error = '';
  });
  async function submit() {
    if (!displayName.trim() || saving) return;
    saving = true;
    const message = await profile.save({ displayName: displayName.trim(), role: role.trim(), avatarColor });
    saving = false;
    if (message) error = message;
    else onclose();
  }
  const sections = [
    { id: 'profile' as const, label: 'Profile', icon: UserRound },
    { id: 'general' as const, label: 'Umum', icon: Settings2 },
    { id: 'editor' as const, label: 'Editor', icon: Code2 },
    { id: 'instances' as const, label: 'Instances', icon: Network },
  ];
  const shortcuts = [
    { action: 'Save file', keys: ['Ctrl / ⌘', 'S'] },
    { action: 'Save all files', keys: ['Ctrl / ⌘', 'Shift', 'S'] },
    { action: 'Close active tab', keys: ['Ctrl / ⌘', 'W'] },
    { action: 'Next / previous tab', keys: ['Ctrl / ⌘', 'Tab / Shift+Tab'] },
    { action: 'Search files / commands', keys: ['Ctrl / ⌘', 'P'] },
    { action: 'Rename selected item', keys: ['F2'] },
    { action: 'Delete selected item', keys: ['Delete'] },
    { action: 'Close dialog / picker', keys: ['Esc'] },
  ];
</script>

<Modal {open} title="Settings" width="max-w-3xl" height="h-[min(70vh,600px)]" {onclose}>
  <div class="flex h-full min-h-0 flex-col sm:flex-row">
    <aside class="w-full shrink-0 border-b border-line sm:w-44 sm:border-b-0 sm:border-r">
      <nav class="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:p-2.5" aria-label="Settings sections">
        {#each sections as item (item.id)}
          <button type="button" class={['flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors sm:flex-none', section === item.id ? 'bg-surface-active text-fg font-medium' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg']} aria-current={section === item.id ? 'page' : undefined} onclick={() => (section = item.id)}>
            <item.icon size={15} class="shrink-0" />{item.label}
          </button>
        {/each}
      </nav>
    </aside>

    <section class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      {#if section === 'profile'}
        <div class="mb-5"><h4 class="text-sm font-semibold">Profile</h4><p class="mt-1 text-xs text-fg-subtle">Update your account details.</p></div>
        <div class="mb-5 flex items-center gap-3">
          <Avatar name={displayName} color={avatarColor} size="lg" />
          <div><p class="mb-2 text-xs text-fg-subtle">Avatar color</p><div class="flex gap-2" role="radiogroup" aria-label="Avatar color">
            {#each colors as color (color.key)}
              <button type="button" role="radio" aria-checked={avatarColor === color.key} aria-label={color.label} class={['h-5 w-5 rounded-full transition-shadow', color.swatch, avatarColor === color.key ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface-raised' : 'hover:ring-2 hover:ring-line-strong']} onclick={() => (avatarColor = color.key)}></button>
            {/each}
          </div></div>
        </div>
        <div class="mb-4 space-y-1.5"><label class="block text-xs text-fg-subtle" for="profile-name">Display name</label><Input id="profile-name" bind:value={displayName} maxlength={48} onkeydown={(event) => event.key === 'Enter' && submit()} /></div>
        <div class="mb-5 space-y-1.5"><label class="block text-xs text-fg-subtle" for="profile-role">Role</label><Input id="profile-role" bind:value={role} maxlength={48} placeholder="Administrator" onkeydown={(event) => event.key === 'Enter' && submit()} /></div>
        <div class="border-t border-line pt-4">
          <div class="flex items-center gap-3"><LockKeyhole size={17} class="text-fg-subtle"/><div class="min-w-0 flex-1"><p class="text-sm font-medium">Password</p><p class="mt-0.5 text-xs text-fg-subtle">Password management will be available when sign-in is enabled.</p></div><span class="shrink-0 rounded border border-line px-2 py-1 text-[11px] text-fg-faint">Coming later</span></div>
        </div>
        {#if error}<p class="mt-3 text-xs text-danger" role="alert">{error}</p>{/if}
        <div class="mt-5 flex justify-end"><Button size="sm" variant="primary" disabled={!displayName.trim() || saving} onclick={submit}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      {:else if section === 'general'}
        <div class="mb-5"><h4 class="text-sm font-semibold">Umum</h4><p class="mt-1 text-xs text-fg-subtle">Pengaturan umum aplikasi.</p></div>
        <div class="border-t border-line pt-4">
          <div class="flex items-center gap-3">
            <Sun size={17} class="shrink-0 text-fg-subtle"/>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">Tema aplikasi</p>
              <p class="mt-0.5 text-xs text-fg-subtle">Pilih tampilan terang atau gelap untuk OMP Control.</p>
            </div>
            <div class="flex shrink-0 gap-1 rounded-lg border border-line p-1">
              <button type="button" aria-pressed={theme.current === 'light'} class={['inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors', theme.current === 'light' ? 'bg-surface-hover text-fg font-medium' : 'text-fg-subtle hover:text-fg']} onclick={(event) => theme.set('light', event.currentTarget)}><Sun size={13}/> Light {#if theme.current === 'light'}<Check size={12}/>{/if}</button>
              <button type="button" aria-pressed={theme.current === 'dark'} class={['inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors', theme.current === 'dark' ? 'bg-surface-hover text-fg font-medium' : 'text-fg-subtle hover:text-fg']} onclick={(event) => theme.set('dark', event.currentTarget)}><Moon size={13}/> Dark {#if theme.current === 'dark'}<Check size={12}/>{/if}</button>
            </div>
          </div>
        </div>
      {:else if section === 'editor'}
        <div class="mb-5"><h4 class="text-sm font-semibold">Editor</h4><p class="mt-1 text-xs text-fg-subtle">Pintasan keyboard editor.</p></div>
        <div>
          <div class="mb-2 flex items-center gap-2"><Keyboard size={15} class="text-fg-subtle"/><h5 class="text-xs font-medium">Keyboard shortcuts</h5></div>
          <div class="divide-y divide-line border-y border-line">
            {#each shortcuts as shortcut (shortcut.action)}
              <div class="flex items-center justify-between gap-3 py-2.5"><span class="text-sm text-fg-subtle">{shortcut.action}</span><span class="flex flex-wrap justify-end gap-1">{#each shortcut.keys as key, i (`${shortcut.action}-${key}-${i}`)}<kbd class="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{key}</kbd>{/each}</span></div>
            {/each}
          </div>
          <p class="mt-2 text-xs text-fg-faint">Some shortcuts work only when the editor or a file item has focus.</p>
        </div>
      {:else}
        <InstancesManager onenter={onclose} />
      {/if}
    </section>
  </div>
</Modal>
