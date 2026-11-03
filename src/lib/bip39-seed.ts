/**
 * BIP-39: Mnemonic Code for Generating Deterministic Keys
 * Implements BIP-39 standard for generating 12/24-word seed phrases
 * Uses crypto-js for HTTP/HTTPS compatibility
 * Reference: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
 */

import CryptoJS from 'crypto-js';
import { BIP39_ENGLISH_WORDLIST } from './bip39-wordlist';

// ─── Configuration ───

const WORD_COUNT_12 = 12;
const WORD_COUNT_24 = 24;
const BITS_PER_WORD = 11;
const CHECKSUM_BITS_12 = 7;
const CHECKSUM_BITS_24 = 8;
const ENTROPY_BITS_12 = WORD_COUNT_12 * BITS_PER_WORD - CHECKSUM_BITS_12;
const ENTROPY_BITS_24 = WORD_COUNT_24 * BITS_PER_WORD - CHECKSUM_BITS_24;

// ─── Utilities ───

function bytesToBinary(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/// SHA-256 using crypto-js (works everywhere)
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const wordArray = CryptoJS.lib.WordArray.create(data);
  const hash = CryptoJS.SHA256(wordArray);
  const hex = hash.toString(CryptoJS.enc.Hex);
  return hexToBytes(hex);
}

// ─── Generate Mnemonic ───

/**
 * Generate BIP-39 mnemonic (24 words by default)
 * Uses cryptographically secure random entropy
 */
export async function generateMnemonic(wordCount: number = WORD_COUNT_24): Promise<string> {
  const entropyBits = wordCount === WORD_COUNT_12 ? ENTROPY_BITS_12 : ENTROPY_BITS_24;
  const checksumBits = wordCount === WORD_COUNT_12 ? CHECKSUM_BITS_12 : CHECKSUM_BITS_24;

  // Generate random entropy using crypto-js
  const entropyBytes = new Uint8Array(entropyBits / 8);
  const random = CryptoJS.lib.WordArray.random(entropyBytes.length);
  random.clamp(); // Ensure uniform distribution
  for (let i = 0; i < entropyBytes.length; i++) {
    entropyBytes[i] = random.words[Math.floor(i / 4)] >> ((3 - (i % 4)) * 8) & 0xff;
  }

  // Calculate checksum (first N bits of SHA-256)
  const checksumBytes = await sha256(entropyBytes);
  const checksumBinary = bytesToBinary(checksumBytes).substring(0, checksumBits);

  // Combine entropy + checksum
  const entropyBinary = bytesToBinary(entropyBytes);
  const combinedBinary = entropyBinary + checksumBinary;

  // Convert to words
  const words: string[] = [];
  for (let i = 0; i < combinedBinary.length; i += BITS_PER_WORD) {
    const chunk = combinedBinary.substring(i, i + BITS_PER_WORD);
    const index = parseInt(chunk, 2);
    words.push(BIP39_ENGLISH_WORDLIST[index]);
  }

  return words.join(' ');
}

// ─── Validate Mnemonic ───

/**
 * Validate BIP-39 mnemonic wordlist
 */
export function validateMnemonicWords(mnemonic: string): { valid: boolean; errors?: string[] } {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);

  if (words.length !== WORD_COUNT_12 && words.length !== WORD_COUNT_24) {
    return {
      valid: false,
      errors: [`Mnemonic must have 12 or 24 words, got ${words.length}`],
    };
  }

  const invalidWords: string[] = [];
  for (const word of words) {
    if (!BIP39_ENGLISH_WORDLIST.includes(word)) {
      invalidWords.push(word);
    }
  }

  if (invalidWords.length > 0) {
    return {
      valid: false,
      errors: [`Invalid words: ${invalidWords.join(', ')}`],
    };
  }

  return { valid: true };
}

/**
 * Validate BIP-39 mnemonic checksum
 */
export async function validateMnemonicChecksum(mnemonic: string): Promise<boolean> {
  const validation = validateMnemonicWords(mnemonic);
  if (!validation.valid) return false;

  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  const wordCount = words.length;
  const checksumBits = wordCount === WORD_COUNT_12 ? CHECKSUM_BITS_12 : CHECKSUM_BITS_24;
  const entropyBits = wordCount === WORD_COUNT_12 ? ENTROPY_BITS_12 : ENTROPY_BITS_24;

  // Convert words back to binary
  let binary = '';
  for (const word of words) {
    const index = BIP39_ENGLISH_WORDLIST.indexOf(word);
    binary += index.toString(2).padStart(BITS_PER_WORD, '0');
  }

  // Split into entropy and checksum
  const entropyBinary = binary.substring(0, entropyBits);
  const checksumBinary = binary.substring(entropyBits);

  // Convert entropy to bytes
  const entropyBytes = new Uint8Array(entropyBits / 8);
  for (let i = 0; i < entropyBytes.length; i++) {
    const byte = parseInt(entropyBinary.substring(i * 8, i * 8 + 8), 2);
    entropyBytes[i] = byte;
  }

  // Calculate and verify checksum
  const hash = await sha256(entropyBytes);
  const hashBinary = bytesToBinary(hash).substring(0, checksumBits);

  return hashBinary === checksumBinary;
}

// ─── Seed Generation ───

/**
 * Generate binary seed from mnemonic with optional passphrase
 * Uses PBKDF2 with HMAC-SHA512
 */
export async function mnemonicToSeed(
  mnemonic: string,
  passphrase: string = ''
): Promise<Uint8Array> {
  // Validate checksum first
  const isValid = await validateMnemonicChecksum(mnemonic);
  if (!isValid) {
    throw new Error('Invalid mnemonic checksum');
  }

  // Normalize to NFKD (canonical form)
  const normalizedMnemonic = mnemonic.normalize('NFKD');
  const normalizedPassphrase = `mnemonic${passphrase}`.normalize('NFKD');

  // Use crypto-js PBKDF2 with SHA-512
  const password = CryptoJS.enc.Utf8.parse(normalizedMnemonic);
  const salt = CryptoJS.enc.Utf8.parse(normalizedPassphrase);
  
  const seed = CryptoJS.PBKDF2(password, salt, {
    keySize: 512 / 32, // 64 bytes / 512 bits
    iterations: 2048,
    hasher: CryptoJS.algo.SHA512
  });

  // Convert WordArray to Uint8Array
  const hex = seed.toString(CryptoJS.enc.Hex);
  return hexToBytes(hex);
}

// ─── Types ───

export interface BIP39Wallet {
  mnemonic: string; // 24 words
  seed: Uint8Array; // 64 bytes
}

/**
 * Generate BIP-39 wallet (mnemonic + seed)
 */
export async function generateBIP39Wallet(
  wordCount: number = WORD_COUNT_24
): Promise<BIP39Wallet> {
  const mnemonic = await generateMnemonic(wordCount);
  const seed = await mnemonicToSeed(mnemonic);

  return { mnemonic, seed };
}

/**
 * Restore BIP-39 wallet from mnemonic
 */
export async function restoreBIP39Wallet(
  mnemonic: string,
  passphrase: string = ''
): Promise<BIP39Wallet> {
  const seed = await mnemonicToSeed(mnemonic, passphrase);

  return { mnemonic, seed };
}
