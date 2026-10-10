<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowRight, Check, CircleAlert, Plus, Server, Settings2, ShieldCheck } from '@lucide/svelte';
  import ProfileModal from './ProfileModal.svelte';
  import { instanceRegistry } from '$lib/stores/instances.svelte';
  import type { Instance } from '$lib/api/instances';

  interface Props { onenter: () => void; }
  let { onenter }: Props = $props();
  let settingsOpen = $state(false);
  let refreshing = $state(false);
  let error = $state('');

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
</script>

<div class="relative flex h-full min-h-screen flex-col overflow-y-auto bg-[#0b0b0b] text-[#f5f5f1]">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(225,220,201,0.10),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0.08),#0b0b0b_72%)]"></div>
  <header class="relative flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"><Server size={18}/></div>
      <span class="text-sm font-semibold tracking-[0.18em]">OMP CONTROL</span>
    </div>
    <span class="hidden items-center gap-1.5 text-xs text-white/50 sm:flex"><ShieldCheck size={14}/> Your servers, your control</span>
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
        <button type="button" class="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#e1dcc9] px-5 text-sm font-semibold text-[#17130e] transition hover:bg-white" onclick={() => (settingsOpen = true)}><Plus size={16}/> Add your first instance</button>
      </div>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each instanceRegistry.items as instance (instance.id)}
          <button type="button" class="group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#e1dcc9]/50 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-[#e1dcc9]" onclick={() => select(instance)}>
            <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#412d15] via-[#e1dcc9]/80 to-transparent opacity-60 transition group-hover:opacity-100"></div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]"><Server size={21} class="text-[#e1dcc9]"/></div>
              {#if instanceRegistry.activeId === instance.id}<span class="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300"><Check size={12}/> Active</span>{/if}
            </div>
            <h2 class="mt-5 truncate text-lg font-semibold">{instance.name}</h2>
            <p class="mt-1 truncate text-xs text-white/40">{instance.baseUrl}</p>
            <div class="mt-auto flex items-center justify-between pt-5">
              <span class="flex items-center gap-1.5 text-xs capitalize text-white/55"><span class={['h-1.5 w-1.5 rounded-full', instance.status === 'online' ? 'bg-emerald-400' : instance.status === 'offline' ? 'bg-red-400' : 'bg-white/30']}></span>{instance.status}</span>
              <span class="flex items-center gap-1 text-xs font-medium text-[#e1dcc9] opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100">Open <ArrowRight size={14}/></span>
            </div>
          </button>
        {/each}
        <button type="button" class="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-transparent p-5 text-center transition hover:border-white/30 hover:bg-white/[0.035]" onclick={() => (settingsOpen = true)}>
          <span class="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><Plus size={22}/></span>
          <span class="mt-4 text-sm font-semibold">Add another server</span>
          <span class="mt-1 text-xs text-white/40">Connect an OMP-MCP instance</span>
        </button>
      </div>
    {/if}

    <div class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/35">
      <span>Instance selection · OMP Control Plane</span>
      <button type="button" class="inline-flex items-center gap-1.5 transition hover:text-white/70" onclick={() => (settingsOpen = true)}><Settings2 size={13}/> Manage instances</button>
    </div>
  </main>
</div>

<ProfileModal open={settingsOpen} initialSection="instances" onclose={() => (settingsOpen = false)} />
