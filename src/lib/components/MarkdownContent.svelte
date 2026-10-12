<script lang="ts">
  import { onMount } from 'svelte';

  let { content, class: className = '' }: { content: string; class?: string } = $props();
  let ready = $state(false);
  let rendered = $state('');

  let parseMarkdown: ((value: string) => string) | null = null;

  onMount(async () => {
    const [{ marked }, { default: DOMPurify }] = await Promise.all([
      import('marked'),
      import('dompurify')
    ]);
    parseMarkdown = (value: string) => {
      const html = marked.parse(value, { async: false, breaks: true, gfm: true });
      return DOMPurify.sanitize(html);
    };
    ready = true;
  });

  $effect(() => {
    const value = content;
    if (ready && parseMarkdown) rendered = parseMarkdown(value);
    else rendered = '';
  });
</script>

<div class={`markdown break-words ${className}`}>
  {#if ready}
    {@html rendered}
  {:else}
    <span class="whitespace-pre-wrap">{content}</span>
  {/if}
</div>

<style>
  .markdown :global(p) { margin: 0.45rem 0; }
  .markdown :global(p:first-child) { margin-top: 0; }
  .markdown :global(p:last-child) { margin-bottom: 0; }
  .markdown :global(h1), .markdown :global(h2), .markdown :global(h3), .markdown :global(h4) {
    margin: 1rem 0 0.45rem;
    font-weight: 650;
    line-height: 1.35;
  }
  .markdown :global(h1) { font-size: 1.35rem; }
  .markdown :global(h2) { font-size: 1.2rem; }
  .markdown :global(h3) { font-size: 1.05rem; }
  .markdown :global(ul), .markdown :global(ol) { margin: 0.5rem 0; padding-left: 1.5rem; }
  .markdown :global(ul) { list-style: disc; }
  .markdown :global(ol) { list-style: decimal; }
  .markdown :global(li) { margin: 0.2rem 0; padding-left: 0.15rem; }
  .markdown :global(blockquote) {
    margin: 0.65rem 0;
    border-left: 3px solid var(--color-line, currentColor);
    padding-left: 0.8rem;
    color: var(--color-fg-muted, inherit);
  }
  .markdown :global(pre) {
    max-width: 100%;
    overflow-x: auto;
    margin: 0.65rem 0;
    border: 1px solid var(--color-line, #8884);
    border-radius: 0.6rem;
    padding: 0.75rem;
    background: var(--color-surface-raised, #8881);
    font-size: 0.82rem;
    line-height: 1.55;
  }
  .markdown :global(code) {
    border-radius: 0.25rem;
    background: var(--color-surface-secondary, #8882);
    padding: 0.1rem 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em;
  }
  .markdown :global(pre code) { padding: 0; background: transparent; font-size: inherit; }
  .markdown :global(a) { color: var(--color-accent, #60a5fa); text-decoration: underline; text-underline-offset: 2px; }
  .markdown :global(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 0.65rem 0; }
  .markdown :global(th), .markdown :global(td) { border: 1px solid var(--color-line, #8884); padding: 0.4rem 0.6rem; text-align: left; }
  .markdown :global(th) { font-weight: 650; background: var(--color-surface-secondary, #8882); }
  .markdown :global(hr) { margin: 0.9rem 0; border: 0; border-top: 1px solid var(--color-line, #8884); }
  .markdown :global(img) { max-width: 100%; border-radius: 0.5rem; }
</style>
