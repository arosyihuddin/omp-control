<script lang="ts">
  import { CircleCheck, CircleX } from '@lucide/svelte';
  import { Button, CodeBlock, Modal } from '$lib/components/ui';
  import type { Approval, ApprovalDecision } from '$lib/types';

  interface Props {
    approval: Approval | null;
    busy?: boolean;
    onclose: () => void;
    ondecide: (id: string, decision: ApprovalDecision) => void;
  }

  let { approval, busy = false, onclose, ondecide }: Props = $props();
</script>

<Modal open={Boolean(approval)} title={approval ? 'Arguments · ' + approval.tool : 'Arguments'} width="max-w-3xl" {onclose}>
  {#if approval}
    <div class="p-4">
      <CodeBlock code={JSON.stringify(approval.args ?? {}, null, 2)} class="max-h-[min(55vh,520px)]" />
    </div>
  {/if}

  {#snippet footer()}
    {#if approval?.status === 'pending'}
      <Button variant="danger" disabled={busy} onclick={() => approval && ondecide(approval.id, 'deny')}><CircleX size={13} /> Deny</Button>
      <Button variant="primary" disabled={busy} onclick={() => approval && ondecide(approval.id, 'approve')}><CircleCheck size={13} /> Allow</Button>
    {/if}
  {/snippet}
</Modal>
