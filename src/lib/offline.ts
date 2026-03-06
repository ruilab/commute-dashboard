/**
 * Offline support utilities.
 *
 * - Service worker registration
 * - IndexedDB queue for offline check-ins
 * - Background sync registration
 * - Push notification subscription management
 */

const DB_NAME = "commute-offline";
const DB_VERSION = 1;
const PENDING_STORE = "pending-events";
const CACHE_STORE = "cached-data";

// ─── Service Worker ────────────────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch {
    return null;
  }
}

// ─── IndexedDB ─────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue a check-in event for later sync.
 */
export async function queueOfflineEvent(event: {
  type: "start_session" | "add_event" | "add_tag";
  payload: Record<string, unknown>;
  timestamp: string;
}): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).add(event);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Request background sync
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-checkins");
    }
  } catch {
    // IndexedDB not available; event will be lost
  }
}

/**
 * Get count of pending offline events.
 */
export async function getPendingEventCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, "readonly");
    const store = tx.objectStore(PENDING_STORE);
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Cache data for offline viewing.
 */
export async function cacheData(
  key: string,
  data: unknown
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put({ key, data, cachedAt: Date.now() });
  } catch {
    // Ignore
  }
}

/**
 * Get cached data.
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, "readonly");
    const store = tx.objectStore(CACHE_STORE);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// ─── Push Notifications ────────────────────────────────────────────────────

/**
 * Subscribe to push notifications.
 */
export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check current push permission state.
 */
export function getPushPermissionState(): "granted" | "denied" | "prompt" | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as "granted" | "denied" | "prompt";
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

// ─── Online/Offline Detection ──────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(
  callback: (online: boolean) => void
): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
