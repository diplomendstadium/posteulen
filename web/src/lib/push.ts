/** Web Push setup and verification in the browser (SPEC 11.4). */
import { SECURITY } from '@posteulen/shared/constants.ts';
import { api } from './api.ts';

export type PushState = 'confirmed' | 'testing' | 'unconfirmed' | 'none' | 'unavailable' | 'denied';

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function pushSupported(): boolean {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return false;
  // iOS: only as installed home-screen app (SPEC 11.4 step 1).
  if (isIos() && !window.matchMedia('(display-mode: standalone)').matches) return false;
  return true;
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function serverStatus(): Promise<{ state: PushState; needsVerification?: boolean }> {
  return api<{ state: PushState; needsVerification?: boolean }>('GET', '/api/push/status');
}

/** Subscribes (any refusal means "not available") and runs the end-to-end test. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unavailable';
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await api<{ publicKey: string }>('GET', '/api/push/key');
  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  } catch {
    return 'unavailable';
  }
  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  await api('PUT', '/api/push/subscription', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
  return waitForConfirmation();
}

export async function sendTest(): Promise<PushState> {
  await api('POST', '/api/push/test', {});
  return waitForConfirmation();
}

/** Waits up to 60 s for the service worker's confirmation (SPEC 11.4 step 3). */
export async function waitForConfirmation(): Promise<PushState> {
  const deadline = Date.now() + SECURITY.PUSH_VERIFY_SECONDS * 1000;
  while (Date.now() < deadline) {
    const { state } = await serverStatus();
    if (state === 'confirmed') return 'confirmed';
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return 'unconfirmed';
}
