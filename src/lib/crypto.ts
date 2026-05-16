const ALGORITHM_NAME = "AES-GCM";
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

// --- UTILS ---
export function getMessageEncoding(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
export function getMessageDecoding(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

// SHA-256 Hash for Access Key ID
export async function hashString(str: string): Promise<string> {
  const data = getMessageEncoding(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert CryptoKey to exportable string
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(exported);
}
// Import CryptoKey from string
export async function importKey(keyStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(keyStr);
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: ALGORITHM_NAME },
    true,
    ["encrypt", "decrypt"]
  );
}

// --- MASTER KEY MANAGEMENT ---
const MASTER_KEY_STORAGE = 'therapie_safe_master_key';

export async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(MASTER_KEY_STORAGE);
  if (stored) {
    return importKey(stored);
  }
  const newKey = await crypto.subtle.generateKey(
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  const keyStr = await exportKey(newKey);
  localStorage.setItem(MASTER_KEY_STORAGE, keyStr);
  return newKey;
}

// --- GENERIC ENCRYPTION (ArrayBuffer <-> ArrayBuffer) ---
export async function encryptWithKey(key: CryptoKey, data: BufferSource): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv: iv as BufferSource },
    key,
    data
  );
  return { ciphertext, iv };
}

export async function decryptWithKey(key: CryptoKey, ciphertext: BufferSource, iv: Uint8Array): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: ALGORITHM_NAME, iv: iv as BufferSource },
    key,
    ciphertext
  );
}

// --- ACCESS KEY LOGIC (Password-based) ---
async function getKeyMaterial(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    getMessageEncoding(password) as any,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function deriveKeyFromPassword(passwordKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPayloadWithPassword(payloadString: string, password: string): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array, salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKeyFromPassword(keyMaterial, salt);
  
  const encodedPayload = getMessageEncoding(payloadString);
  const { ciphertext, iv } = await encryptWithKey(key, encodedPayload as any);
  return { ciphertext, iv, salt };
}

export async function decryptPayloadWithPassword(ciphertext: ArrayBuffer, password: string, iv: Uint8Array, salt: Uint8Array): Promise<string> {
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKeyFromPassword(keyMaterial, salt);
  
  const decryptedBuffer = await decryptWithKey(key, ciphertext, iv);
  return getMessageDecoding(decryptedBuffer);
}
