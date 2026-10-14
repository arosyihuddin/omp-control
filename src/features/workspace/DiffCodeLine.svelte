<script lang="ts">
  import { EditorState } from '@codemirror/state';
  import { syntaxTree } from '@codemirror/language';
  import { javascript } from '@codemirror/lang-javascript';
  import { json } from '@codemirror/lang-json';
  import { html } from '@codemirror/lang-html';
  import { css } from '@codemirror/lang-css';
  import { python } from '@codemirror/lang-python';
  import { markdown } from '@codemirror/lang-markdown';
  import { yaml } from '@codemirror/lang-yaml';
  import { xml } from '@codemirror/lang-xml';
  import { classHighlighter, highlightTree } from '@lezer/highlight';

  let { content, filename }: { content: string; filename: string } = $props();

  function languageForFile(name: string) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return javascript();
    if (['ts', 'tsx', 'mts', 'cts'].includes(ext)) return javascript({ typescript: true, jsx: ext.endsWith('x') });
    if (['json', 'jsonc'].includes(ext)) return json();
    if (['html', 'svelte', 'vue'].includes(ext)) return html();
    if (['css', 'scss', 'less'].includes(ext)) return css();
    if (['py', 'pyi'].includes(ext)) return python();
    if (['md', 'mdx'].includes(ext)) return markdown();
    if (['yaml', 'yml'].includes(ext)) return yaml();
    if (['xml', 'svg'].includes(ext)) return xml();
    return null;
  }

  const segments = $derived.by(() => {
    const language = languageForFile(filename);
    if (!language || !content) return [{ text: content || ' ', className: '' }];
    const state = EditorState.create({ doc: content, extensions: [language] });
    const output: { from: number; to: number; className: string }[] = [];
    highlightTree(syntaxTree(state), classHighlighter, (from, to, className) => output.push({ from, to, className }));
    const result: { text: string; className: string }[] = [];
    let cursor = 0;
    for (const segment of output) {
      if (segment.from > cursor) result.push({ text: content.slice(cursor, segment.from), className: '' });
      result.push({ text: content.slice(segment.from, segment.to), className: segment.className });
      cursor = segment.to;
    }
    if (cursor < content.length) result.push({ text: content.slice(cursor), className: '' });
    return result.length ? result : [{ text: content || ' ', className: '' }];
  });
</script>

<pre class="min-w-0 whitespace-pre px-2"><code>{#each segments as segment, index (`${index}:${segment.text}:${segment.className}`)}<span class={segment.className}>{segment.text}</span>{/each}</code></pre>

<style>
  :global(.tok-keyword), :global(.tok-controlKeyword), :global(.tok-modifier) { color: #c678dd; }
  :global(.tok-string), :global(.tok-string2), :global(.tok-regexp) { color: #98c379; }
  :global(.tok-number), :global(.tok-bool), :global(.tok-null) { color: #d19a66; }
  :global(.tok-comment) { color: var(--c-fg-subtle); font-style: italic; }
  :global(.tok-variableName), :global(.tok-propertyName) { color: #e06c75; }
  :global(.tok-definition), :global(.tok-typeName), :global(.tok-className), :global(.tok-namespace) { color: #e5c07b; }
  :global(.tok-function), :global(.tok-operator), :global(.tok-punctuation), :global(.tok-separator) { color: var(--c-fg); }
  :global(.tok-tagName), :global(.tok-heading) { color: #e06c75; }
  :global(.tok-attributeName) { color: #d19a66; }
  :global(.tok-attributeValue) { color: #98c379; }
  :global(.tok-meta), :global(.tok-annotation) { color: #56b6c2; }
</style>
