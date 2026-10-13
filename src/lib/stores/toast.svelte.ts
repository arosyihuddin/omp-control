type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

class ToastStore {
  items = $state<ToastItem[]>([]);
  private nextId = 1;

  show(tone: ToastTone, title: string, message?: string) {
    const id = this.nextId++;
    this.items = [...this.items, { id, tone, title, message }].slice(-5);
    window.setTimeout(() => this.dismiss(id), 4500);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string) { this.show('error', title, message); }
  info(title: string, message?: string) { this.show('info', title, message); }

  dismiss(id: number) {
    this.items = this.items.filter((item) => item.id !== id);
  }
}

export const toast = new ToastStore();
