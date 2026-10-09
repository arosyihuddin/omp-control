import { readString, storageKeys, writeString } from '$lib/utils/storage';

export type Theme = 'dark' | 'light';

class ThemeStore {
  current = $state<Theme>('dark');

  init() {
    this.apply(readString(storageKeys.theme) === 'light' ? 'light' : 'dark');
  }

  set(next: Theme, origin?: HTMLElement) {
    if (next === this.current) return;

    const root = document.documentElement;
    const rect = origin?.getBoundingClientRect();
    if (rect) {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty('--theme-ripple-x', `${x}px`);
      root.style.setProperty('--theme-ripple-y', `${y}px`);
      root.style.setProperty('--theme-ripple-radius', `${radius}px`);
    }

    const update = () => {
      this.apply(next);
      writeString(storageKeys.theme, next);
    };

    // Circular reveal originates from the theme button, with a safe fallback
    // for browsers that do not support the View Transitions API.
    if (rect && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        document.startViewTransition(update);
        return;
      } catch {
        // Fall through to an immediate theme change if the transition cannot start.
      }
    }
    update();
  }

  toggle(origin?: HTMLElement) {
    this.set(this.current === 'dark' ? 'light' : 'dark', origin);
  }

  private apply(theme: Theme) {
    this.current = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }
}

export const theme = new ThemeStore();
