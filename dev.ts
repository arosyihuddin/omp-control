import { patchSveltekit, startDevServer } from '@eslym/sveltekit-adapter-bun/dev';

await patchSveltekit();
await startDevServer({ host: '0.0.0.0', port: 5173 });
