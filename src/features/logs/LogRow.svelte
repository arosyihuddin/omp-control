<script lang="ts">
  import { Badge, CodeBlock } from '$lib/components/ui';
  import { LoaderCircle } from '@lucide/svelte';
  import type { BadgeTone } from '$lib/components/ui';
  import type { ToolCallLog } from '$lib/types';
  import { formatJson, formatTime } from '$lib/utils/format';

  interface Props {
    log: ToolCallLog;
    expanded: boolean;
    ontoggle: () => void;
  }

  let { log, expanded, ontoggle }: Props = $props();

  const tone = $derived<BadgeTone>(log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : log.status === 'running' || log.status === 'waiting_approval' ? 'warning' : 'neutral');
</script>

<div class="transition-colors hover:bg-surface-hover/60">
  <button
    type="button"
    class="grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left sm:grid-cols-[90px_1fr_80px_72px]"
    aria-expanded={expanded}
    onclick={ontoggle}
  >
    <span class="font-mono text-xs text-fg-faint">{formatTime(log.timestamp)}</span>
    <span class="min-w-0 truncate font-mono text-sm text-fg">{log.toolName}</span>
    <span class="hidden text-right font-mono text-xs text-fg-faint sm:block">{log.durationMs ?? '-'}ms</span>
    <span class="justify-self-end">
      <Badge {tone} class="gap-1.5 uppercase tracking-wide">
        {#if log.status === 'running'}<LoaderCircle size={12} class="animate-spin" aria-hidden="true" />{/if}
        {log.status === 'waiting_approval' ? 'waiting approval' : log.status}
      </Badge>
    </span>
  </button>

  {#if expanded}
    <div class="space-y-3 border-t border-line bg-canvas/40 px-4 py-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <div class="eyebrow mb-1">Request ID</div>
          <div class="break-all font-mono text-xs text-fg-muted">{log.requestId ?? '-'}</div>
        </div>
        {#if log.sessionId}
          <div>
            <div class="eyebrow mb-1">Session ID</div>
            <div class="break-all font-mono text-xs text-fg-muted">{log.sessionId}</div>
          </div>
        {/if}
      </div>
      <div>
        <div class="eyebrow mb-1">Arguments</div>
        <CodeBlock code={formatJson(log.arguments)} />
      </div>
      {#if log.result}
        <div>
          <div class="eyebrow mb-1">Result</div>
          <CodeBlock code={formatJson(log.result)} />
        </div>
      {/if}
      {#if log.error}
        <div>
          <div class="eyebrow mb-1 text-danger">Error</div>
          <CodeBlock code={log.error} tone="danger" class="max-h-48" />
        </div>
      {/if}
    </div>
  {/if}
</div>
