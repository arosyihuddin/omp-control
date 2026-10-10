<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, ArrowRight, Check, CircleAlert, EllipsisVertical, LogOut, Pencil, Plus, Server, Settings2, Trash2 } from '@lucide/svelte';
  import { Avatar, Modal } from '$lib/components/ui';
  import { profile } from '$lib/stores/profile.svelte';
  import ProfileModal from './ProfileModal.svelte';
  import { instanceRegistry } from '$lib/stores/instances.svelte';
  import { instancesApi } from '$lib/api/instances';
  import type { Instance } from '$lib/api/instances';

  interface Props { onenter: () => void; onback?: () => void; }
  let { onenter, onback }: Props = $props();
  let settingsOpen = $state(false);
  let accountOpen = $state(false);
  let openMenuId = $state<string | null>(null);
  let editing = $state<Instance | null>(null);
  let editName = $state('');
  let editUrl = $state('');
  let editCredential = $state('');
  let saving = $state(false);
  let actionError = $state('');
  let refreshing = $state(false);
  let error = $state('');
  let creating = $state(false);
  let createName = $state('');
  let createUrl = $state('http://127.0.0.1:48766');
  let createCredential = $state('');
  let createSaving = $state(false);
  let createError = $state('');

  onMount(async () => {
    refreshing = true;
    await instanceRegistry.load();
    error = instanceRegistry.error;
    refreshing = false;
  });

  function select(instance: Instance) {
    instanceRegistry.setActive(instance.id);
    onenter();
  }

  function openEdit(instance: Instance) {
    openMenuId = null;
    editing = instance;
    editName = instance.name;
    editUrl = instance.baseUrl;
    editCredential = '';
    actionError = '';
  }

  async function saveEdit(event: SubmitEvent) {
    event.preventDefault();
    if (!editing || saving || !editName.trim() || !editUrl.trim()) return;
    saving = true;
    actionError = '';
    try {
      await instancesApi.update(editing.id, { name: editName.trim(), baseUrl: editUrl.trim(), ...(editCredential.trim() ? { credential: editCredential.trim() } : {}) });
      editing = null;
      await instanceRegistry.load();
    } catch (e) {
      actionError = e instanceof Error ? e.message : 'Unable to update instance';
    } finally {
      saving = false;
    }
  }

  async function removeInstance(instance: Instance) {
    openMenuId = null;
    if (!window.confirm('Remove "' + instance.name + '" from this control plane? The remote server will not be changed.')) return;
    try {
      await instancesApi.remove(instance.id);
      await instanceRegistry.load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to remove instance';
    }
  }

  function openCreate() {
    openMenuId = null;
    createName = '';
    createUrl = 'http://127.0.0.1:48766';
    createCredential = '';
    createError = '';
    creating = true;
  }

  async function saveCreate(event: SubmitEvent) {
    event.preventDefault();
    if (createSaving || !createName.trim() || !createUrl.trim()) return;
    const hadActiveInstance = Boolean(instanceRegistry.activeId);
    createSaving = true;
    createError = '';
    try {
      await instancesApi.create({ name: createName.trim(), baseUrl: createUrl.trim(), ...(createCredential.trim() ? { credential: createCredential.trim() } : {}) });
      creating = false;
      await instanceRegistry.load();
      if (!hadActiveInstance && instanceRegistry.active) onenter();
    } catch (e) {
      createError = e instanceof Error ? e.message : 'Unable to register instance';
    } finally {
      createSaving = false;
    }
  }
</script>

<div class="relative flex h-full min-h-screen flex-col overflow-y-auto bg-[#0b0b0b] text-[#f5f5f1]">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(225,220,201,0.10),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0.08),#0b0b0b_72%)]"></div>
  <header class="relative flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
    <div class="flex items-center gap-3">
      {#if instanceRegistry.active && onback}
        <button type="button" class="mr-1 flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white" aria-label="Back" title="Back" onclick={onback}>
          <ArrowLeft size={18} />
        </button>
      {/if}
      <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"><Server size={18}/></div>
      <span class="text-sm font-semibold tracking-[0.18em]">OMP CONTROL</span>
    </div>
    <div class="relative">
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/[0.08]" aria-label="Account" title="Account" aria-expanded={accountOpen} onclick={() => (accountOpen = !accountOpen)}>
        <Avatar name={profile.data?.displayName ?? 'Profile'} color={profile.data?.avatarColor} />
      </button>
      {#if accountOpen}
        <div class="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-white/10 bg-[#171717] p-1.5 shadow-xl">
          <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white" onclick={() => { accountOpen = false; settingsOpen = true; }}>
            <Settings2 size={15}/> Settings
          </button>
          <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-400/10" onclick={() => { accountOpen = false; window.dispatchEvent(new CustomEvent('omp-control:logout')); }}>
            <LogOut size={15}/> Log out
          </button>
        </div>
      {/if}
    </div>
  </header>

  <main class="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-12 pt-8 sm:px-10 lg:px-16">
    <div class="mb-9 max-w-2xl">
      <p class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#e1dcc9]/70">Choose your workspace</p>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-5xl">Which server are we using?</h1>
      <p class="mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">Pilih instance OMP-MCP untuk membuka workspace. Hubungkan server terlebih dahulu jika ini pertama kalinya.</p>
    </div>

    {#if error}
      <div role="alert" class="mb-5 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"><CircleAlert size={16}/>{error}<button class="ml-auto underline" onclick={async () => { await instanceRegistry.load(); error = instanceRegistry.error; }}>Coba lagi</button></div>
    {/if}

    {#if refreshing || instanceRegistry.loading}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each [1,2,3] as item (item)}<div class="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"></div>{/each}</div>
    {:else if instanceRegistry.items.length === 0}
      <div class="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center">
        <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"><Server size={28} class="text-[#e1dcc9]"/></div>
        <h2 class="text-xl font-semibold">No servers yet</h2>
        <p class="mt-2 max-w-md text-sm leading-6 text-white/50">Tambahkan instance OMP-MCP untuk mulai. Setelah terhubung, server akan muncul di sini seperti pilihan profil.</p>
        <button type="button" class="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#e1dcc9] px-5 text-sm font-semibold text-[#17130e] transition hover:bg-white" onclick={openCreate}><Plus size={16}/> Add your first instance</button>
      </div>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each instanceRegistry.items as instance (instance.id)}
          <div class="group relative flex min-h-44 flex-col overflow-visible rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#e1dcc9]/50 hover:bg-white/[0.07]">
            <button type="button" aria-label={'Open ' + instance.name} class="absolute inset-0 z-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#e1dcc9]" onclick={() => select(instance)}></button>
            <div class="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#412d15] via-[#e1dcc9]/80 to-transparent opacity-60 transition group-hover:opacity-100"></div>
            <div class="relative z-10 flex items-start justify-between gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]"><Server size={21} class="text-[#e1dcc9]"/></div>
              <div class="flex items-center gap-2">
                {#if instanceRegistry.activeId === instance.id}<span class="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300"><Check size={12}/> Active</span>{/if}
                <div class="relative">
                  <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition hover:bg-white/[0.08] hover:text-white" aria-label={'Actions for ' + instance.name} title="Instance actions" aria-expanded={openMenuId === instance.id} onclick={(event) => { event.stopPropagation(); openMenuId = openMenuId === instance.id ? null : instance.id; }}><EllipsisVertical size={17}/></button>
                  {#if openMenuId === instance.id}
                    <div class="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-white/10 bg-[#171717] p-1.5 shadow-xl">
                      <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white" onclick={(event) => { event.stopPropagation(); openEdit(instance); }}><Pencil size={15}/> Edit instance</button>
                      <button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-400/10" onclick={(event) => { event.stopPropagation(); void removeInstance(instance); }}><Trash2 size={15}/> Remove instance</button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <div class="pointer-events-none relative z-10 mt-5 min-w-0">
              <h2 class="truncate text-lg font-semibold">{instance.name}</h2>
              <p class="mt-1 truncate text-xs text-white/40">{instance.baseUrl}</p>
            </div>
            <div class="pointer-events-none relative z-10 mt-auto flex items-center justify-between pt-5">
              <span class="flex items-center gap-1.5 text-xs capitalize text-white/55"><span class={['h-1.5 w-1.5 rounded-full', instance.status === 'online' ? 'bg-emerald-400' : instance.status === 'offline' ? 'bg-red-400' : 'bg-white/30']}></span>{instance.status}</span>
              <span class="flex items-center gap-1 text-xs font-medium text-[#e1dcc9] opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100">Open <ArrowRight size={14}/></span>
            </div>
          </div>
        {/each}
        <button type="button" class="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-transparent p-5 text-center transition hover:border-white/30 hover:bg-white/[0.035]" onclick={openCreate}>
          <span class="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><Plus size={22}/></span>
          <span class="mt-4 text-sm font-semibold">Add another server</span>
          <span class="mt-1 text-xs text-white/40">Connect an OMP-MCP instance</span>
        </button>
      </div>
    {/if}

    <div class="mt-10 border-t border-white/10 pt-5 text-xs text-white/35">
      <span>Instance selection · OMP Control Plane</span>
    </div>
  </main>
</div>

<ProfileModal open={settingsOpen} initialSection="instances" onclose={() => (settingsOpen = false)} />

<Modal open={Boolean(editing)} title="Edit OMP-MCP instance" description="Update this server connection" width="max-w-lg" onclose={() => { if (!saving) editing = null; }}>
  <form id="picker-instance-edit" class="space-y-4 px-4 py-4" onsubmit={saveEdit}>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Display name</span><input required maxlength="80" bind:value={editName} class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70"/></label>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Base URL</span><input required type="url" bind:value={editUrl} class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70"/><span class="block text-xs text-white/40">Use HTTPS except for localhost development instances.</span></label>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Bearer token <span class="text-white/40">(optional)</span></span><input type="password" autocomplete="new-password" bind:value={editCredential} placeholder="Leave blank to keep current token" class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70"/></label>
    {#if actionError}<div role="alert" class="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"><CircleAlert size={16}/>{actionError}</div>{/if}
  </form>
  {#snippet footer()}
    <button type="button" class="h-9 rounded-lg px-3 text-sm text-white/70 hover:bg-white/[0.08] disabled:opacity-50" onclick={() => { if (!saving) editing = null; }} disabled={saving}>Cancel</button>
    <button type="submit" form="picker-instance-edit" disabled={saving || !editName.trim() || !editUrl.trim()} class="inline-flex h-9 items-center gap-2 rounded-lg bg-[#e1dcc9] px-3 text-sm font-medium text-[#17130e] disabled:opacity-50">{#if saving}<span class="animate-spin">◌</span>{:else}<Check size={15}/>{/if} Save changes</button>
  {/snippet}
</Modal>

<Modal open={creating} title="Add OMP-MCP instance" description="Register a server in this control plane" width="max-w-lg" onclose={() => { if (!createSaving) creating = false; }} autofocus>
  <form id="picker-instance-create" class="space-y-4 px-4 py-4" onsubmit={saveCreate}>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Display name</span><input required maxlength="80" bind:value={createName} class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70" placeholder="My OMP-MCP server"/></label>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Base URL</span><input required type="url" bind:value={createUrl} class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70"/><span class="block text-xs text-white/40">Use HTTPS except for localhost development instances.</span></label>
    <label class="block space-y-1.5 text-sm"><span class="text-white/65">Bearer token <span class="text-white/40">(optional)</span></span><input type="password" autocomplete="new-password" bind:value={createCredential} placeholder="Enter token if required" class="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-[#e1dcc9]/70"/></label>
    {#if createError}<div role="alert" class="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"><CircleAlert size={16}/>{createError}</div>{/if}
  </form>
  {#snippet footer()}
    <button type="button" class="h-9 rounded-lg px-3 text-sm text-white/70 hover:bg-white/[0.08] disabled:opacity-50" onclick={() => { if (!createSaving) creating = false; }} disabled={createSaving}>Cancel</button>
    <button type="submit" form="picker-instance-create" disabled={createSaving || !createName.trim() || !createUrl.trim()} class="inline-flex h-9 items-center gap-2 rounded-lg bg-[#e1dcc9] px-3 text-sm font-medium text-[#17130e] disabled:opacity-50">{#if createSaving}<span class="animate-spin">◌</span>{:else}<Plus size={15}/>{/if} Add server</button>
  {/snippet}
</Modal>
