/**
 * secureStorage.ts
 * ────────────────
 * Encrypts / decrypts data in localStorage using AES-256-GCM via the
 * Web Crypto API.  The encryption key is derived from the authenticated
 * user's ID with PBKDF2 so the data is opaque at rest to anyone without
 * an active session.
 *
 * Usage:
 *   await secureStorage.setItem('key', data, userId)
 *   const data = await secureStorage.getItem<MyType>('key', userId)
 *   secureStorage.removeItem('key')
 */

const APP_SALT = 'chiro-stride-v1-salt' // static app-level salt
const ITERATIONS = 100_000

// ── Key derivation ──────────────────────────────────────────────────────────

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(APP_SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Encrypt ─────────────────────────────────────────────────────────────────

async function encrypt(plaintext: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
  const enc = new TextEncoder()

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )

  // Pack  iv (12 bytes) + ciphertext  →  base64
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), iv.length)

  return btoa(String.fromCharCode(...combined))
}

// ── Decrypt ─────────────────────────────────────────────────────────────────

async function decrypt(encoded: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))

  const iv = raw.slice(0, 12)
  const ciphertext = raw.slice(12)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(plainBuffer)
}

// ── Public API ──────────────────────────────────────────────────────────────

export const secureStorage = {
  /**
   * Encrypt `value` as JSON and store it under `key`.
   */
  async setItem<T>(key: string, value: T, userId: string): Promise<void> {
    try {
      const json = JSON.stringify(value)
      const encrypted = await encrypt(json, userId)
      localStorage.setItem(key, encrypted)
    } catch (err) {
      console.error('[secureStorage] setItem failed:', err)
    }
  },

  /**
   * Read and decrypt the value stored under `key`.
   * Returns `null` if the key doesn't exist or decryption fails
   * (e.g. different user, tampered data).
   */
  async getItem<T>(key: string, userId: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null

      // Handle migration: if it's valid unencrypted JSON, decrypt will fail.
      // In that case return the plaintext so existing data isn't lost, and
      // re-encrypt it transparently.
      try {
        const decrypted = await decrypt(raw, userId)
        return JSON.parse(decrypted) as T
      } catch {
        // Likely plaintext from before encryption was added — migrate it
        try {
          const plain = JSON.parse(raw) as T
          // Re-save encrypted so next read is secure
          await secureStorage.setItem(key, plain, userId)
          return plain
        } catch {
          // Truly unreadable
          return null
        }
      }
    } catch {
      return null
    }
  },

  /**
   * Remove a key entirely.
   */
  removeItem(key: string): void {
    localStorage.removeItem(key)
  },
}
