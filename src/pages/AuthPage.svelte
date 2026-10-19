<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onAuthenticated: () => void | Promise<void>;
  }

  let { onAuthenticated }: Props = $props();
  let mode = $state<'loading' | 'setup' | 'login' | 'error'>('loading');
  let username = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  let busy = $state(false);
  let usernameInput: HTMLInputElement | undefined = $state();
  let error = $state('');

  onMount(() => {
    void fetch('/control/v1/auth/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('Tidak dapat memeriksa status autentikasi server.');
        return response.json();
      })
      .then((status: { configured: boolean; authenticated: boolean }) => {
        if (status.authenticated) void onAuthenticated();
        else mode = status.configured ? 'login' : 'setup';
      })
      .catch((reason) => {
        error = reason instanceof Error ? reason.message : 'Server autentikasi tidak tersedia.';
        mode = 'error';
      });
  });

  $effect(() => {
    if (mode === 'login' || mode === 'setup') usernameInput?.focus();
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || (mode !== 'login' && mode !== 'setup')) return;
    error = '';
    if (mode === 'setup' && password !== confirmPassword) {
      error = 'Konfirmasi password tidak cocok.';
      return;
    }
    busy = true;
    try {
      const response = await fetch('/control/v1/auth/' + mode, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? 'Autentikasi gagal.');
      await onAuthenticated();
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'Terjadi kesalahan saat autentikasi.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="min-h-screen bg-canvas p-3 text-fg sm:p-5 lg:p-8">
  <main class="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-2">
    <section class="auth-brand relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface-raised p-10 lg:flex xl:p-14">
      <div class="relative z-10 flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-sm font-semibold">O</div>
        <span class="text-sm font-semibold tracking-tight">OMP Control</span>
      </div>

      <div class="relative z-10 my-12 max-w-lg">
        <p class="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-fg-subtle">One workspace. Full control.</p>
        <h2 class="max-w-md text-4xl font-semibold leading-[1.12] tracking-[-0.045em] xl:text-[3.25rem]">Your tools,<br />connected.</h2>
        <p class="mt-5 max-w-sm text-sm leading-6 text-fg-subtle">Satu tempat untuk mengelola instance, menjalankan tools, dan memantau aktivitas workspace Anda.</p>

        <div class="auth-graphic mt-12 max-w-sm" aria-hidden="true">
          <div class="flex items-center gap-3">
            <div class="auth-node flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted">
              <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/></svg>
            </div>
            <div class="h-px w-8 bg-line-strong"></div>
            <div class="auth-node flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted">
              <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10"/></svg>
            </div>
            <div class="h-px w-8 bg-line-strong"></div>
            <div class="auth-node flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/5 text-accent">
              <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>
            </div>
          </div>
          <div class="ml-5 mt-3 h-7 w-px bg-line"></div>
          <div class="ml-5 flex items-center gap-2 text-xs text-fg-subtle">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            Instances · Tools · Activity
          </div>
        </div>
      </div>

      <p class="relative z-10 text-xs text-fg-faint">Private workspace</p>
    </section>

    <section class="flex min-w-0 items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
      <div class="w-full max-w-[360px]">
        <div class="mb-8 lg:hidden">
          <div class="mb-6 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-raised text-sm font-semibold shadow-card">O</div>
          <p class="text-sm font-semibold">OMP Control</p>
        </div>

        <div class="mb-8">
          <h1 class="text-2xl font-semibold tracking-tight">{mode === 'setup' ? 'Buat akun administrator' : 'Selamat datang kembali'}</h1>
          <p class="mt-2 text-sm leading-6 text-fg-subtle">
            {mode === 'setup' ? 'Buat akun untuk mulai mengamankan workspace Anda.' : 'Masuk menggunakan akun administrator Anda.'}
          </p>
        </div>

        {#if mode === 'loading'}
          <div class="rounded-xl border border-line bg-surface-raised p-5 text-center text-sm text-fg-subtle">Memeriksa konfigurasi autentikasi…</div>
        {:else if mode === 'error'}
          <div class="rounded-xl border border-line bg-surface-raised p-5">
            <p class="text-sm text-danger" role="alert">{error}</p>
            <button class="mt-4 w-full rounded-lg border border-line px-4 py-2.5 text-sm transition hover:bg-surface-hover" onclick={() => location.reload()}>Coba lagi</button>
          </div>
        {:else}
          <form onsubmit={submit} class="space-y-5">
            <div>
              <label class="mb-2 block text-sm font-medium" for="auth-username">Username</label>
              <input id="auth-username" bind:this={usernameInput} bind:value={username} required minlength="3" maxlength="64" autocomplete="username" autocapitalize="none" spellcheck="false" class="auth-input w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder="Masukkan username" />
            </div>

            <div>
              <label class="mb-2 block text-sm font-medium" for="auth-password">Password</label>
              <div class="auth-input flex items-center rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
                <input id="auth-password" bind:value={password} required minlength={mode === 'setup' ? 12 : undefined} maxlength="1024" type={showPassword ? 'text' : 'password'} autocomplete={mode === 'setup' ? 'new-password' : 'current-password'} class="min-w-0 flex-1 rounded-none bg-transparent px-3.5 py-3 text-sm outline-none focus-visible:ring-0" placeholder={mode === 'setup' ? 'Minimal 12 karakter' : 'Masukkan password'} />
                <button type="button" class="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle outline-none transition hover:bg-surface-hover hover:text-fg focus-visible:ring-0" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={showPassword} onclick={() => showPassword = !showPassword}>
                  {#if showPassword}
                    <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a11.8 11.8 0 0 1-3.1 4.2"/><path d="M6.2 6.2A12.5 12.5 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10.4 10.4 0 0 0 3.1-.5"/></svg>
                  {:else}
                    <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                  {/if}
                </button>
              </div>
            </div>

            {#if mode === 'setup'}
              <div>
                <label class="mb-2 block text-sm font-medium" for="auth-confirm-password">Konfirmasi password</label>
                <div class="auth-input flex items-center rounded-lg border border-line bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
                  <input id="auth-confirm-password" bind:value={confirmPassword} required minlength="12" maxlength="1024" type={showConfirmPassword ? 'text' : 'password'} autocomplete="new-password" class="min-w-0 flex-1 rounded-none bg-transparent px-3.5 py-3 text-sm outline-none focus-visible:ring-0" placeholder="Ulangi password" />
                  <button type="button" class="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle outline-none transition hover:bg-surface-hover hover:text-fg focus-visible:ring-0" aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'} aria-pressed={showConfirmPassword} onclick={() => showConfirmPassword = !showConfirmPassword}>
                    {#if showConfirmPassword}
                      <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a11.8 11.8 0 0 1-3.1 4.2"/><path d="M6.2 6.2A12.5 12.5 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10.4 10.4 0 0 0 3.1-.5"/></svg>
                    {:else}
                      <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                    {/if}
                  </button>
                </div>
                <p class="mt-2 text-xs text-fg-subtle">Password minimal 12 karakter. Akun pertama hanya dapat dibuat sekali.</p>
              </div>
            {/if}

            {#if error}
              <p class="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>
            {/if}

            <button type="submit" disabled={busy} class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-55">
              {busy ? 'Memproses…' : mode === 'setup' ? 'Buat akun administrator' : 'Masuk'}
              {#if !busy}<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12M10 4l6 6-6 6"/></svg>{/if}
            </button>
          </form>
        {/if}
        <p class="mt-8 border-t border-line pt-5 text-center text-xs text-fg-faint">Secure administrator access</p>
      </div>
    </section>
  </main>
</div>
