/**
 * MoneroFlow native bridge.
 *
 * This is the Capacitor "plumbing" layer — the analog of the platform-channel
 * native shell we reverse-engineered from Cake Wallet (MainActivity's
 * MethodChannel$Result helpers). Every capability here auto-detects the runtime:
 * on a native device it routes to a Capacitor plugin; in a plain web browser it
 * falls back to the Web API so the exact same React code runs in both places.
 *
 * Design note (from REVERSE-ENGINEERING.md): Cake keeps its UI logic in the
 * cross-platform layer (Flutter) and only touches native code for device
 * capabilities (QR/camera, biometric, share, url-launch). We mirror that: all UI
 * stays in React; this module is the only place that talks to the native shell.
 *
 * The whole module is async and never throws synchronously — callers can safely
 * `await` any method on any host.
 */

// Lazy imports so the module is tree-importable without Capacitor at runtime.
let _isNative: boolean | null = null;

/** True when running inside a Capacitor native shell (not a plain browser). */
export function isNative(): boolean {
  if (_isNative !== null) return _isNative;
  const w = window as unknown as Record<string, unknown>;
  _isNative = typeof w.Capacitor !== 'undefined' && !!w.Capacitor?.isNativePlatform?.();
  return _isNative;
}

async function importPlugin<T>(loader: () => Promise<{ default: T }>): Promise<T | null> {
  if (!isNative()) return null;
  try {
    const mod = await loader();
    return mod.default ?? null;
  } catch (err) {
    console.warn('[native] plugin unavailable:', err);
    return null;
  }
}

export interface NativeSharePayload {
  title?: string;
  text?: string;
  url?: string;
  files?: string[];
}

export interface NativeNetworkStatus {
  connected: boolean;
  connectionType: string;
}

/**
 * Native bridge. All methods are safe to call from any runtime and never throw
 * synchronously; web fallbacks keep the browser build fully functional.
 */
export const native = {
  /**
   * Biometric unlock (fingerprint / Face ID). Mirrors Cake's app-lock.
   * @param reason Shown to the user on the OS prompt.
   * @returns true when authenticated (or biometrics unavailable on web).
   */
  async biometricUnlock(reason = 'Unlock MoneroFlow'): Promise<boolean> {
    const mod = await importPlugin<typeof import('@capgo/capacitor-native-biometric')>(
      () => import('@capgo/capacitor-native-biometric'),
    );
    if (!mod) return true; // web: no lock
    try {
      const res = await mod.NativeBiometric.isAvailable();
      if (!res.isAvailable) return true; // device has no biometrics configured
      // verifyIdentity resolves on success and throws on rejection/cancel.
      await mod.NativeBiometric.verifyIdentity({
        reason,
        title: 'MoneroFlow',
        subtitle: 'Authenticate to continue',
        description: 'Use your biometrics to unlock MoneroFlow',
        maxAttempts: 3,
        useFallback: true,
      });
      return true;
    } catch (err) {
      console.warn('[native] biometric verify failed:', err);
      return false;
    }
  },

  /** Native share sheet. Falls back to Web Share API, then clipboard. */
  async share(payload: NativeSharePayload): Promise<boolean> {
    // Web Share API first (works on mobile browsers + some PWA contexts).
    const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> };
    if (!isNative() && typeof nav.share === 'function') {
      try {
        await nav.share({ title: payload.title, text: payload.text, url: payload.url });
        return true;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return false; // user cancelled
      }
    }
    const mod = await importPlugin<typeof import('@capacitor/share')>(
      () => import('@capacitor/share'),
    );
    if (mod) {
      try {
        const { Share } = mod;
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          files: payload.files ?? [],
        });
        return true;
      } catch (err) {
        console.warn('[native] share failed:', err);
        return false;
      }
    }
    return false;
  },

  /** Open an external URL/URI (payment handler, explorer). */
  async openExternal(url: string): Promise<boolean> {
    const mod = await importPlugin<typeof import('@capacitor/browser')>(
      () => import('@capacitor/browser'),
    );
    if (mod) {
      try {
        const { Browser } = mod;
        await Browser.open({ url });
        return true;
      } catch (err) {
        console.warn('[native] browser open failed:', err);
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  },

  /**
   * Pick an image / run the camera for QR scanning.
   * Returns a data URL or path readable by an <img>/QR decoder.
   */
  async pickImage(forCamera = false): Promise<string | null> {
    const mod = await importPlugin<typeof import('@capacitor/camera')>(
      () => import('@capacitor/camera'),
    );
    if (mod) {
      try {
        const { Camera, CameraResultType, CameraSource } = mod;
        const image = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: forCamera ? CameraSource.Camera : CameraSource.Photos,
        });
        return image?.dataUrl ?? null;
      } catch (err) {
        console.warn('[native] camera failed:', err);
        return null;
      }
    }
    // Web fallback: hidden file input for photos.
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => {
        input.remove();
        // The onchange covers the selected-pick path; nothing more to do here.
      }, 30000);
    });
  },

  /** Fire-and-forget toast. Web falls back to console + optional DOM. */
  async toast(message: string): Promise<void> {
    const mod = await importPlugin<typeof import('@capacitor/toast')>(
      () => import('@capacitor/toast'),
    );
    if (mod) {
      try {
        const { Toast } = mod;
        await Toast.show({ text: message });
        return;
      } catch (err) {
        console.warn('[native] toast failed:', err);
      }
    }
    // Web: surface via sonner if present, else console.
    try {
      const { toast: sonnerToast } = await import('sonner');
      sonnerToast(message);
    } catch {
      console.info('[toast]', message);
    }
  },

  /** Live network status. */
  async getNetworkStatus(): Promise<NativeNetworkStatus> {
    const mod = await importPlugin<typeof import('@capacitor/network')>(
      () => import('@capacitor/network'),
    );
    if (mod) {
      try {
        const { Network } = mod;
        const status = await Network.getStatus();
        return {
          connected: status.connected,
          connectionType: status.connectionType,
        };
      } catch (err) {
        console.warn('[native] network failed:', err);
      }
    }
    return { connected: navigator.onLine, connectionType: navigator.onLine ? 'wifi' : 'none' };
  },

  /** Persistent secure key-value storage (native) with localStorage fallback. */
  async getItem(key: string): Promise<string | null> {
    // Currently backed by localStorage in both runtimes. Swap in a secure
    // keystore-backed plugin (e.g. capacitor-secure-storage) for a hardened build.
    try {
      return window.localStorage.getItem(`mf:${key}`);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(`mf:${key}`, value);
    } catch (err) {
      console.warn('[native] setItem failed:', err);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(`mf:${key}`);
    } catch (err) {
      console.warn('[native] removeItem failed:', err);
    }
  },
};

export default native;
