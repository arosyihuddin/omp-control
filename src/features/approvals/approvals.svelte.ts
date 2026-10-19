import { approvalsApi, errorMessage } from '$lib/api';
import { onServerEvents } from '$lib/api/events';
import type { Approval, ApprovalDecision } from '$lib/types';

class ApprovalsStore {
  items = $state<Approval[]>([]);
  loading = $state(true);
  error = $state('');
  actingId = $state('');
  clearing = $state(false);

  pending = $derived(this.items.filter((approval) => approval.status === 'pending'));
  history = $derived(this.items.filter((approval) => approval.status !== 'pending'));

  async load() {
    try {
      this.items = await approvalsApi.list();
      this.error = '';
    } catch (error) {
      this.error = errorMessage(error, 'Unable to load approvals');
    } finally {
      this.loading = false;
    }
  }

  async decide(id: string, decision: ApprovalDecision) {
    this.actingId = id;
    this.error = '';
    try {
      const result = await approvalsApi.decide(id, decision) as { approval?: Approval };
      if (result.approval) this.upsert(result.approval);
    } catch (error) {
      this.error = errorMessage(error, 'Unable to update approval');
    } finally {
      this.actingId = '';
    }
  }

  private upsert(approval: Approval) {
    const index = this.items.findIndex((item) => item.id === approval.id);
    if (index === -1) this.items = [approval, ...this.items];
    else this.items = this.items.map((item) => item.id === approval.id ? approval : item);
    this.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private handleEvent(type: string, event: MessageEvent) {
    if (type === 'approval.cleared') {
      this.items = this.items.filter((approval) => approval.status === 'pending');
      return;
    }
    try {
      const approval = JSON.parse(event.data) as Approval;
      if (approval?.id) this.upsert(approval);
    } catch {
      void this.load();
    }
  }

  /** Returns true when the history was cleared. */
  async clearHistory(): Promise<boolean> {
    if (!this.history.length || this.clearing) return false;
    this.clearing = true;
    this.error = '';
    try {
      await approvalsApi.clear();
      this.items = this.items.filter((approval) => approval.status === 'pending');
      return true;
    } catch (error) {
      this.error = errorMessage(error, 'Unable to clear approval history');
      return false;
    } finally {
      this.clearing = false;
    }
  }

  /** Apply realtime approval events directly to avoid redundant list requests. */
  watch() {
    return onServerEvents(['approval.created', 'approval.updated', 'approval.cleared'], (event) => this.handleEvent(event.type, event));
  }
}

export const approvals = new ApprovalsStore();
