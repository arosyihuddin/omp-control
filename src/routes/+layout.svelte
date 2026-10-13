<script lang="ts">
  import type { Snippet } from 'svelte';
  import '@fontsource-variable/inter';
  import '../lib/styles/app.css';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
