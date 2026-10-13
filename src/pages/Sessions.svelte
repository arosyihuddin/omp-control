<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ArrowUp, Bot, Code2, Folder, FolderOpen, MessageSquare, Plus, Search, Square, Terminal, Trash2, X } from '@lucide/svelte';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import { errorMessage, sessionsApi, sessionsModelsApi, type OmpModelOption } from '$lib/api';
  import OptionDropdown from '$lib/components/ui/OptionDropdown.svelte';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import PathPicker from '$lib/components/workspace/PathPicker.svelte';
  import { readString, writeString, storageKeys } from '$lib/utils/storage';

  let selectedId = $state<string | null>(null);
  let search = $state('');
  let cwd = $state('');
  let pickerOpen = $state(false);
  let selectedModel = $state('');
  let modelOptions = $state<OmpModelOption[]>([]);
  let defaultModel = $state<string | null>(null);
  let modelsLoading = $state(false);
  let modelsError = $state('');
  const sessionModelChoices = $derived([
    { value: '', label: `OMP default · ${defaultModel ?? 'automatic'}` },
    ...modelOptions.map((model) => ({ value: model.id, label: `${model.name} · ${model.provider}` })),
  ]);
  let prompt = $state('');
  let newTaskMode = $state(false);
  let creating = $state(false);
  let sending = $state(false);
  let formError = $state('');
  let chatEnd = $state<HTMLDivElement>();
  let shouldAutoScroll = $state(true);
  let lastScrolledSessionId: string | null = null;
  let toolExpanded = $state<Record<string, boolean>>({});
  const projectSessions = $derived.by(() => {
    if (!cwd) return [];
    const root = cwd.replace(/^\.\/?|\/+$/g, '');
    return dashboard.sessions.filter((session) => {
      const sessionPath = (session.cwd ?? '').replace(/\\/g, '/').replace(/\/+$/g, '');
      if (!root) return /^\/home\/[^/]+$/.test(sessionPath);
      return sessionPath.endsWith('/' + root) || sessionPath === root;
    });
  });
  const activeSession = $derived(projectSessions.find((s) => s.sessionId === selectedId) ?? null);
  const active = $derived(activeSession?.status === 'running' || activeSession?.status === 'starting');
  const visibleSessions = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return [...projectSessions]
      .filter((s) => !q || (s.sessionId + ' ' + (s.task ?? '') + ' ' + (s.cwd ?? '')).toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  });

  async function scrollBottom(force = false) {
    await tick();
    if (force || shouldAutoScroll) chatEnd?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }

  function handleChatScroll(event: Event) {
    const element = event.currentTarget as HTMLElement;
    shouldAutoScroll = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  async function loadModels(path: string) {
    if (!path) {
      modelOptions = [];
      defaultModel = null;
      return;
    }
    modelsLoading = true;
    modelsError = '';
    try {
      const result = await sessionsModelsApi.list(path);
      modelOptions = result.models;
      defaultModel = result.defaultModel;
      if (selectedModel && !modelOptions.some((model) => model.id === selectedModel)) selectedModel = '';
    } catch (error) {
      modelsError = errorMessage(error, 'Unable to load available models');
      modelOptions = [];
    } finally {
      modelsLoading = false;
    }
  }

  async function createSession(event?: SubmitEvent) {
    event?.preventDefault();
    if (creating || !prompt.trim() || !cwd.trim()) return;
    creating = true;
    formError = '';
    try {
      const session = await sessionsApi.create({ task: prompt.trim(), cwd: cwd.trim(), ...(selectedModel ? { model: selectedModel } : {}) });
      dashboard.sessions = [session, ...dashboard.sessions.filter((s) => s.sessionId !== session.sessionId)];
      selectedId = session.sessionId;
      newTaskMode = false;
      prompt = '';
      await scrollBottom(true);
    } catch (error) {
      formError = errorMessage(error, 'Unable to create session');
    } finally {
      creating = false;
    }
  }

  function openDirectoryPicker() { pickerOpen = true; }
  async function chooseDirectory(path: string) {
    cwd = path;
    writeString(storageKeys.sessionsLastRoot, path);
    if (selectedId && !dashboard.sessions.some((session) => session.sessionId === selectedId && (path === '.' ? /^\/home\/[^/]+$/.test(session.cwd ?? '') : (session.cwd ?? '').replace(/\\/g, '/').endsWith('/' + path)))) selectedId = null;
    pickerOpen = false;
    formError = '';
    await loadModels(path);
  }

  async function sendPrompt(event?: SubmitEvent) {
    event?.preventDefault();
    const message = prompt.trim();
    if (!activeSession || !message || sending || active) return;
    sending = true;
    formError = '';
    try {
      await sessionsApi.resume(activeSession.sessionId, message);
      prompt = '';
      await scrollBottom(true);
    } catch (error) {
      formError = errorMessage(error, 'Unable to send message');
    } finally {
      sending = false;
    }
  }

  async function interruptSession() {
    if (!activeSession || !active) return;
    try {
      await sessionsApi.act(activeSession.sessionId, 'interrupt');
    } catch (error) {
      formError = errorMessage(error, 'Unable to stop session');
    }
  }

  async function disposeSession(sessionId: string, task: string) {
    if (!confirm(`Delete session "${task || 'Untitled session'}" and its saved history?`)) return;
    try {
      await sessionsApi.act(sessionId, 'dispose');
      dashboard.sessions = dashboard.sessions.filter((session) => session.sessionId !== sessionId);
      if (selectedId === sessionId) {
        selectedId = null;
        newTaskMode = false;
      }
    } catch (error) {
      formError = errorMessage(error, 'Unable to dispose session');
    }
  }

  onMount(() => {
    cwd = readString(storageKeys.sessionsLastRoot) ?? '';
    if (cwd) void loadModels(cwd);
    void dashboard.refresh();
  });
  $effect(() => {
    const sessionId = activeSession?.sessionId ?? null;
    if (sessionId !== lastScrolledSessionId) {
      lastScrolledSessionId = sessionId;
      shouldAutoScroll = true;
    }
    const messageContent = (activeSession?.messages ?? []).map((message) => `${message.id}:${message.content ?? ''}:${message.arguments ?? ''}:${message.result ?? ''}:${message.status ?? ''}`).join('\\n');
    void messageContent;
    if (shouldAutoScroll) void scrollBottom();
  });
</script>

{#snippet composer()}
      <div class="w-full">
          {#if formError}<p class="mx-auto mb-2 mx-auto mb-2 w-full max-w-2xl text-left text-xs text-danger" role="alert">{formError}</p>{/if}
          <form onsubmit={(event) => { event.preventDefault(); if (activeSession) void sendPrompt(); else void createSession(); }} class="relative mx-auto w-full max-w-2xl rounded-2xl border border-line bg-surface-raised shadow-card focus-within:border-accent/50">
            <textarea bind:value={prompt} rows="1" placeholder={active ? "OMP is working…" : "Message OMP…"} disabled={sending || creating} oninput={(event) => { const el = event.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 192) + "px"; }} class="max-h-48 min-h-0 w-full appearance-none resize-none overflow-y-auto rounded-none border-0 bg-transparent px-4 py-2 text-base leading-5 text-fg outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-fg-faint disabled:opacity-60"></textarea>
            {#if !activeSession}
              <div class="flex flex-wrap items-center gap-2 border-t border-line/70 px-3 py-2">
                <span class="shrink-0 text-[11px] text-fg-faint">Model</span>
                <OptionDropdown options={sessionModelChoices} value={selectedModel} label="Session model" width="w-full" class="min-w-0 max-w-full flex-1" disabled={!cwd || modelsLoading || creating} onchange={(value) => (selectedModel = value)} />
                {#if modelsLoading}<span class="text-[10px] text-fg-faint">Loading models…</span>{/if}
                {#if modelsError}<span class="basis-full text-[10px] text-danger">{modelsError}</span>{/if}
              </div>
            {/if}
            <div class="flex items-center justify-between gap-3 px-3 pb-2"><div class="flex min-w-0 items-center gap-2">{#if !activeSession}<button type="button" onclick={openDirectoryPicker} class="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-fg-muted hover:bg-surface-hover" title="Choose project directory" aria-label="Choose project directory"><Plus size={17} /></button>{#if cwd}<button type="button" onclick={openDirectoryPicker} class="flex min-w-0 max-w-64 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-fg-muted hover:bg-surface-hover"><Folder size={12} /><span class="truncate">{cwd}</span><X size={11} /></button>{:else}<span class="text-[10px] text-fg-faint">Choose a project with +</span>{/if}{:else}<span class="truncate text-[10px] text-fg-faint">{activeSession.cwd}</span>{/if}</div>{#if active}<button type="button" onclick={interruptSession} class="inline-flex size-8 items-center justify-center rounded-full bg-accent text-white hover:opacity-90" aria-label="Stop" title="Stop"><Square size={14} /></button>{:else}<button type="submit" disabled={!prompt.trim() || sending || creating || (!activeSession && !cwd)} class="inline-flex size-8 items-center justify-center rounded-full bg-accent text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message" title="Send message"><ArrowUp size={16} /></button>{/if}</div>
          </form>
        </div>
{/snippet}


<div class="flex h-full min-h-0 overflow-hidden rounded-xl border border-line bg-surface">
  <aside class={["flex w-60 shrink-0 flex-col border-r border-line bg-surface-secondary/40 sm:w-72", cwd ? "" : "hidden"]}>
    <div class="flex items-center justify-between gap-2 border-b border-line p-3">
      <div class="flex min-w-0 items-center gap-2"><MessageSquare size={16} class="text-fg-muted" /><span class="truncate text-sm font-semibold">OMP Chat</span></div>
      <button type="button" onclick={() => { selectedId = null; newTaskMode = true; prompt = ''; formError = ''; }} aria-label="New agent task" title="New agent task" class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-fg-muted hover:bg-surface-hover"><Plus size={16} /></button>
    </div>
    <div class="border-b border-line p-3">
      <button type="button" onclick={openDirectoryPicker} class="flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-left hover:bg-surface-hover" title="Choose project folder">
        <FolderOpen size={15} class="shrink-0 text-fg-muted" />
        <span class="min-w-0 flex-1 truncate text-xs">{cwd || 'Choose project folder'}</span>
        <span class="shrink-0 text-[10px] text-fg-faint">Change</span>
      </button>
    </div>
    <div class="p-2">
      <div class="relative"><Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" /><input bind:value={search} placeholder="Search sessions" aria-label="Search sessions" class="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-xs text-fg outline-none placeholder:text-fg-faint focus:border-accent/60" /></div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <div class="mb-2 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">Recent sessions</div>
      {#if visibleSessions.length}
        <div class="space-y-1">
          {#each visibleSessions as session (session.sessionId)}
            <div class="group relative">
              <button type="button" onclick={() => { selectedId = session.sessionId; newTaskMode = false; formError = ''; }} class={["min-w-0 w-full rounded-lg border py-2 pl-2.5 pr-10 text-left transition-colors", selectedId === session.sessionId ? "border-accent/30 bg-accent/10" : "border-transparent hover:bg-surface-hover"]}>
                <div class="mb-1 flex items-center gap-2"><span class={["size-1.5 shrink-0 rounded-full", session.status === "running" || session.status === "starting" ? "bg-emerald-400" : session.status === "failed" ? "bg-danger" : "bg-fg-faint"]}></span><span class="min-w-0 flex-1 truncate text-xs font-medium text-fg">{session.task || "Untitled session"}</span></div>
                <div class="flex items-center justify-between gap-2 pl-3.5"><span class="truncate text-[10px] text-fg-faint">{session.cwd ?? ""}</span><span class="shrink-0 text-[10px] text-fg-faint">{session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : ""}</span></div>
              </button>
              <button type="button" onclick={() => disposeSession(session.sessionId, session.task ?? '')} class="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100" title="Delete session and history" aria-label={`Delete session ${session.task || session.sessionId}`}><Trash2 size={13} /></button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="px-2 py-8 text-center text-xs text-fg-faint">{!cwd ? "Choose a project folder to view its sessions" : search ? "No matching sessions" : "No sessions in this project yet"}</div>
      {/if}
    </div>
    <div class="border-t border-line p-3 text-[10px] text-fg-faint"><div class="flex items-center gap-2"><span class={["size-1.5 rounded-full", dashboard.connected ? "bg-emerald-400" : "bg-fg-faint"]}></span>{dashboard.connected ? "Runtime connected" : "Runtime disconnected"}</div></div>
  </aside>

  <main class="flex min-w-0 flex-1 flex-col">
    {#if activeSession}
      <header class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
        <div class="min-w-0"><div class="truncate text-sm font-semibold text-fg">{activeSession.task || "OMP session"}</div><div class="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-fg-faint"><span class="inline-flex items-center gap-1"><Terminal size={11} />{activeSession.cwd}</span>{#if activeSession.model}<span>·</span><span>{activeSession.model}</span>{/if}</div></div>
        <div class="flex shrink-0 items-center gap-2"><span class={["rounded-full border px-2 py-1 text-[10px] font-medium", active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : activeSession.status === "failed" ? "border-danger/25 bg-danger/5 text-danger" : "border-line text-fg-muted"]}>{activeSession.status}</span><button type="button" onclick={() => { selectedId = null; newTaskMode = false; formError = ''; }} class="inline-flex size-8 items-center justify-center rounded-md border border-line text-fg-muted hover:bg-surface-hover" title="Back to project overview" aria-label="Back to project overview"><X size={13} /></button></div>
      </header>
      <section onscroll={handleChatScroll} class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto grid w-full max-w-4xl grid-cols-12 gap-y-5 px-4 py-6 sm:px-8">
          {#each activeSession.messages ?? [] as message (message.id)}
            {#if message.role === "user"}
              <div class="col-span-12 flex justify-end"><div class="max-w-[88%] rounded-2xl rounded-br-md bg-accent/10 px-4 py-3 text-sm leading-6 text-fg"><MarkdownContent content={message.content} /></div></div>
            {:else if message.role === "assistant"}
              <div class="col-span-12 min-w-0"><div class="min-w-0 pt-1">{#if message.content}<MarkdownContent content={message.content} class="text-sm leading-6 text-fg" />{:else if active}<div class="flex items-center gap-2 py-1 text-xs text-fg-faint"><span class="size-1.5 animate-pulse rounded-full bg-accent"></span>Thinking…</div>{/if}</div></div>
            {:else}
              <div class="col-span-12 w-full min-w-0 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
                <button type="button" onclick={() => { toolExpanded[message.id] = !(toolExpanded[message.id] ?? (message.status === "running")); }} aria-expanded={toolExpanded[message.id] ?? (message.status === "running")} class="flex w-full cursor-pointer items-center gap-2 border-b border-line px-3 py-2 text-left text-[11px] font-medium text-fg-muted"><Code2 size={13} />{message.toolName ?? "Tool activity"}{#if message.status === "running"}<span class="ml-auto text-accent">Running</span>{:else if message.isError || message.status === "failed"}<span class="ml-auto text-danger">Failed</span>{:else if message.status === "completed"}<span class="ml-auto text-emerald-500">Completed</span>{/if}<span class="ml-2 text-fg-faint">{(toolExpanded[message.id] ?? (message.status === "running")) ? "⌃" : "⌄"}</span></button>
                {#if toolExpanded[message.id] ?? (message.status === "running")}
                  {#if message.arguments}<div class="border-b border-line/70"><div class="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Arguments</div><pre class="max-h-48 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-fg-muted">{message.arguments}</pre></div>{/if}
                  {#if message.result}<pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs leading-5 text-fg-muted">{message.result}</pre>{/if}
                {/if}
              </div>
            {/if}
          {/each}
          {#if active && !(activeSession.messages ?? []).some((m) => m.role === "assistant" && !m.content)}
            <div class="col-span-12 -mb-5 flex items-center gap-2 text-xs text-fg-faint"><span class="size-1.5 animate-pulse rounded-full bg-accent"></span>Agent is working…</div>
          {/if}
          {#if activeSession.error}<div class="col-span-12 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">{activeSession.error}</div>{/if}
          <div class="col-span-12" bind:this={chatEnd}></div>
        </div>
      </section>

    {:else if !cwd}
      <div class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <div class="w-full max-w-xl p-8 text-center sm:p-10">
          <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-accent"><FolderOpen size={25} /></div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-fg-faint">OMP · Agent Workspace</p>
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-fg">Open a project to get started</h2>
          <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-fg-muted">Pilih folder proyek sebagai konteks kerja agent. Dari sini kamu bisa melihat sesi sebelumnya, memantau aktivitas, dan memulai tugas baru.</p>
          <button type="button" onclick={openDirectoryPicker} class="mx-auto mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:opacity-90"><FolderOpen size={16} /> Pilih folder proyek</button>
        </div>
      </div>
    {:else if newTaskMode}
      <header class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
        <div class="min-w-0"><div class="text-sm font-semibold text-fg">New agent task</div><div class="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-fg-faint"><Folder size={12} />{cwd}</div></div>
        <button type="button" onclick={() => { newTaskMode = false; formError = ''; }} class="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-hover">Back to project</button>
      </header>
      <section class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-8">
        <div class="w-full max-w-2xl">
          <div class="mb-5"><div class="mb-2 flex size-10 items-center justify-center rounded-xl border border-line bg-surface-secondary text-accent"><Bot size={20} /></div><h2 class="text-xl font-semibold text-fg">What should the agent work on?</h2><p class="mt-1 text-sm text-fg-muted">Describe the task. OMP will use this project folder as its working directory.</p></div>
          {@render composer()}
        </div>
      </section>
    {:else}
      <header class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
        <div class="min-w-0"><div class="text-sm font-semibold text-fg">Agent Workspace</div><div class="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-fg-faint"><FolderOpen size={12} />{cwd}</div></div>
        <button type="button" onclick={() => { newTaskMode = true; prompt = ''; formError = ''; }} class="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:opacity-90"><Plus size={14} /> New agent task</button>
      </header>
      <section class="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div class="mx-auto w-full max-w-5xl">
          <div class="mb-7"><p class="text-xs font-medium uppercase tracking-wider text-fg-faint">Project overview</p><h2 class="mt-2 break-words text-2xl font-semibold tracking-tight text-fg">{cwd.split('/').filter(Boolean).at(-1) || cwd}</h2><p class="mt-1 break-all text-xs text-fg-muted">{cwd}</p></div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="rounded-xl border border-line bg-surface-raised p-4 shadow-card"><div class="text-xs text-fg-subtle">Total tasks</div><div class="mt-2 text-2xl font-semibold tabular-nums text-fg">{projectSessions.length}</div></div>
            <div class="rounded-xl border border-line bg-surface-raised p-4 shadow-card"><div class="text-xs text-fg-subtle">Running</div><div class="mt-2 text-2xl font-semibold tabular-nums text-fg">{projectSessions.filter((s) => s.status === 'running' || s.status === 'starting').length}</div></div>
            <div class="rounded-xl border border-line bg-surface-raised p-4 shadow-card"><div class="text-xs text-fg-subtle">Needs attention</div><div class="mt-2 text-2xl font-semibold tabular-nums text-fg">{projectSessions.filter((s) => s.status === 'failed' || s.status === 'interrupted').length}</div></div>
          </div>
          <div class="mt-8 flex items-center justify-between gap-3"><h3 class="text-sm font-semibold text-fg">Recent agent activity</h3><span class="text-[11px] text-fg-faint">{visibleSessions.length} tasks</span></div>
          {#if visibleSessions.length}
            <div class="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-raised shadow-card">
              {#each visibleSessions.slice(0, 8) as session (session.sessionId)}
                <button type="button" onclick={() => { selectedId = session.sessionId; newTaskMode = false; formError = ''; }} class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover">
                  <span class={["size-2 shrink-0 rounded-full", session.status === 'running' || session.status === 'starting' ? 'bg-emerald-400' : session.status === 'failed' ? 'bg-danger' : 'bg-fg-faint']}></span>
                  <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-fg">{session.task || 'Untitled task'}</span><span class="mt-1 block truncate text-[11px] text-fg-faint">{session.cwd}</span></span>
                  <span class="shrink-0 rounded-full border border-line px-2 py-1 text-[10px] text-fg-muted">{session.status}</span>
                  <span class="hidden shrink-0 text-[10px] text-fg-faint sm:block">{session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : ''}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="mt-3 rounded-xl border border-dashed border-line px-5 py-10 text-center"><div class="mx-auto flex size-10 items-center justify-center rounded-xl border border-line bg-surface-secondary text-fg-muted"><Bot size={19} /></div><p class="mt-3 text-sm font-medium text-fg">No agent tasks yet</p><p class="mt-1 text-xs text-fg-muted">Create your first task to start working in this project.</p><button type="button" onclick={() => { newTaskMode = true; prompt = ''; formError = ''; }} class="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-hover"><Plus size={14} /> Create first task</button></div>
          {/if}
        </div>
      </section>
    {/if}
    {#if activeSession}
      <div class="px-3 pb-3 pt-3 sm:px-6 sm:pb-5">{@render composer()}</div>
    {/if}
  </main>
</div>
<PathPicker open={pickerOpen} mode="directory" initialPath={cwd || '.'} confirmLabel="Use this folder" onselect={chooseDirectory} oncancel={() => (pickerOpen = false)} />
