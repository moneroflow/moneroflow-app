// Encrypted IndexedDB storage using Web Crypto API (AES-GCM)

const DB_NAME = 'moneroflow_privacy';
const STORE_NAME = 'encrypted_data';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey('raw', rawKey.buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: string, passphrase: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const plaintext = enc.encode(data);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext.buffer as ArrayBuffer);
  // Format: [salt(16) | iv(12) | ciphertext]
  const result = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  return result.buffer;
}

export async function decryptData(buffer: ArrayBuffer, passphrase: string): Promise<string> {
  const data = new Uint8Array(buffer);
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ciphertext.buffer as ArrayBuffer);
  return new TextDecoder().decode(decrypted);
}

export async function saveEncrypted(key: string, data: string, passphrase: string): Promise<void> {
  const db = await openDB();
  const encrypted = await encryptData(data, passphrase);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(encrypted, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEncrypted(key: string, passphrase: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = async () => {
      if (!req.result) return resolve(null);
      try {
        const decrypted = await decryptData(req.result, passphrase);
        resolve(decrypted);
      } catch {
        reject(new Error('Decryption failed — wrong passphrase?'));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearEncryptedStore(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function exportEncryptedBackup(data: string, passphrase: string): Promise<Blob> {
  return encryptData(data, passphrase).then(buf => new Blob([buf], { type: 'application/octet-stream' }));
}

export async function importEncryptedBackup(file: File, passphrase: string): Promise<string> {
  const buf = await file.arrayBuffer();
  return decryptData(buf, passphrase);
}
