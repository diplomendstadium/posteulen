/** Online state and app updates (SPEC 15, 16.3). */
export const status = $state({ online: navigator.onLine, updateReady: false });

window.addEventListener('online', () => (status.online = true));
window.addEventListener('offline', () => (status.online = false));

const SW_URL = '/sw.js';

interface TrustedTypesLike {
  createPolicy(
    name: string,
    rules: { createScriptURL: (input: string) => string },
  ): { createScriptURL(input: string): unknown };
}

/**
 * Trusted Types (D-07) also guard service worker URLs. This policy allows exactly one URL.
 */
function serviceWorkerUrl(): string {
  const trustedTypes = (window as unknown as { trustedTypes?: TrustedTypesLike }).trustedTypes;
  if (!trustedTypes) return SW_URL;
  const policy = trustedTypes.createPolicy('posteulen-sw', {
    createScriptURL: (input) => {
      if (input !== SW_URL) throw new TypeError('unexpected service worker URL');
      return input;
    },
  });
  return policy.createScriptURL(SW_URL) as string;
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl(), { scope: '/' });
  const markWaiting = (): void => {
    if (registration.waiting && navigator.serviceWorker.controller) status.updateReady = true;
  };
  markWaiting();
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener('statechange', markWaiting);
  });
  // Reload only when a new version takes over, never on the very first installation
  // (that would wipe forms the user is filling in).
  const hadController = navigator.serviceWorker.controller !== null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update();
  });
}

export async function applyUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage({ type: 'skip-waiting' });
}
