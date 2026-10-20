<script lang="ts">
  import ProfileCard from './ProfileCard.svelte';
  import NotificationCenter from './NotificationCenter.svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { router } from '$lib/stores/router.svelte';
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
    <NotificationCenter />
    <ProfileCard compact placement="bottom" />
  </div>
</header>
