import { instancesApi, type Instance } from "$lib/api/instances";
import { setStoredActiveInstance } from "$lib/api/runtime-url";

class InstanceRegistry {
  items = $state<Instance[]>([]);
  loading = $state(false);
  activeId = $state<string | null>(null);
  error = $state("");

  get active(): Instance | undefined {
    return this.items.find((item) => item.id === this.activeId);
  }

  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.items = (await instancesApi.list()).instances;
      const saved = this.activeId ?? this.readStoredId();
      const next = saved && this.items.some((item) => item.id === saved)
        ? saved
        : this.items[0]?.id ?? null;
      this.setActive(next);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load instances";
    } finally {
      this.loading = false;
    }
  }

  setActive(id: string | null) {
    const next = id && this.items.some((item) => item.id === id) ? id : null;
    const changed = next !== this.activeId;
    this.activeId = next;
    setStoredActiveInstance(this.activeId);
    if (changed && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("omp-control:instance-change", { detail: { id: this.activeId } }));
  }

  private readStoredId(): string | null {
    try { return localStorage.getItem("omp-control-active-instance"); } catch { return null; }
  }
}

export const instanceRegistry = new InstanceRegistry();
