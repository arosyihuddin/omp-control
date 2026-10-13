<script lang="ts">
  import { Button, Modal } from '$lib/components/ui';
  import { workspaceApi } from '$lib/api';
  import { openInEditor } from './actions';
  import { editorOpenPrompt } from './editor-prompt.svelte';
  import { preview } from './preview.svelte';

  const mediaUrl = $derived(preview.path ? workspaceApi.previewUrl(preview.path) : '');
  const mediaKind = $derived(preview.kind);
</script>

<Modal
  open={preview.open}
  title={preview.name}
  description="File preview"
  width="max-w-5xl"
  height="h-[min(82vh,760px)]"
  onclose={() => preview.hide()}
>
  {#if mediaKind === 'image'}
    <div class="flex h-full min-h-[45vh] items-center justify-center bg-black/30 p-4">
      <img src={mediaUrl} alt={preview.name} class="max-h-full max-w-full object-contain" />
    </div>
  {:else if mediaKind === 'pdf'}
    <iframe title={preview.name} src={mediaUrl} class="h-full min-h-[65vh] w-full border-0 bg-surface"></iframe>
  {:else if mediaKind === 'video'}
    <div class="flex h-full min-h-[45vh] items-center justify-center bg-black p-3">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video src={mediaUrl} controls playsinline class="max-h-full max-w-full"></video>
    </div>
  {:else if mediaKind === 'audio'}
    <div class="flex min-h-[45vh] flex-col items-center justify-center gap-5 p-6">
      <div class="text-sm text-fg-muted">{preview.name}</div>
      <audio src={mediaUrl} controls class="w-full max-w-xl"></audio>
    </div>
  {/if}
</Modal>

<Modal
  open={editorOpenPrompt.current !== null}
  title="Open this file in Editor?"
  description={editorOpenPrompt.current?.name ?? ''}
  width="max-w-md"
  onclose={() => (editorOpenPrompt.current = null)}
>
  <p class="px-4 py-4 text-sm text-fg-muted">
    This file type does not have a built-in preview. Do you want to open it in the text editor anyway?
  </p>
  {#snippet footer()}
    <Button size="sm" onclick={() => (editorOpenPrompt.current = null)}>Cancel</Button>
    <Button
      size="sm"
      variant="primary"
      onclick={() => {
        const target = editorOpenPrompt.current;
        editorOpenPrompt.current = null;
        if (target) openInEditor(target.path, target.name);
      }}
    >Open in Editor</Button>
  {/snippet}
</Modal>
