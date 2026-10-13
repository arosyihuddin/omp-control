import type { Handle } from '@sveltejs/kit';
import { handleControlRequest } from '../server/index';

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (pathname === '/healthz' || pathname === '/control/v1' || pathname.startsWith('/control/v1/')) {
    return handleControlRequest(event.request, event.platform);
  }
  return resolve(event);
};
