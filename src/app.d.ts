import type { AdapterPlatform } from '@eslym/sveltekit-adapter-bun';

declare global {
  namespace App {
    interface Platform extends AdapterPlatform {}
  }
}

export {};
