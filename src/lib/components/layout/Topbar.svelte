<script lang="ts">
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { Moon, RefreshCw, Sun } from '@lucide/svelte';
  import ProfileCard from './ProfileCard.svelte';
  import { dashboard } from '$lib/stores/dashboard.svelte';
  import { router } from '$lib/stores/router.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import { Skeleton } from '$lib/components/ui';
</script>

<header class="flex h-12 shrink-0 items-center justify-between gap-3 bg-canvas px-3 sm:px-4">
  <div class="flex min-w-0 items-center gap-2">
    <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1.5 text-md">
      {#if router.inWorkspace}
        <span class="text-fg-subtle">Workspace</span>
        <ChevronRight size={14} class="shrink-0 text-fg-faint" />
      {/if}
      <h1 class="truncate font-medium text-fg">{router.title}</h1>
    </nav>
  </div>
  <div class="flex shrink-0 items-center gap-2">
    <IconButton label="Refresh" disabled={dashboard.loading} onclick={() => dashboard.refresh()}>
      {#if dashboard.loading}<Skeleton class="size-4" />{:else}<RefreshCw size={15} strokeWidth={1.8} />{/if}
    </IconButton>
    <IconButton label={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onclick={(event) => theme.toggle(event.currentTarget)}>
      {#if theme.current === 'dark'}<Sun size={16} strokeWidth={1.8} />{:else}<Moon size={16} strokeWidth={1.8} />{/if}
    </IconButton>
    <ProfileCard compact placement="bottom" />
  </div>
</header>
