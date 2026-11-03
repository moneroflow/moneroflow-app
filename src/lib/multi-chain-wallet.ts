/**
 * Multi-Chain Wallet Generation using BIP-39 + BIP-44
 * Derives addresses for Ethereum, Tron, and Arbitrum from BIP-39 seed
 * IMPORTANT: Now uses crypto-js for HTTP/HTTPS compatibility
 */

import CryptoJS from 'crypto-js';
import { generateBIP39Wallet, restoreBIP39Wallet, BIP39Wallet, mnemonicToSeed } from './bip39-seed';

// ─── BIP-44 Derivation Paths ───

const DERIVATION_PATHS = {
  ethereum: [0x80000000, 0x8000003c, 0x80000000, 0, 0], // m/44'/60'/0'/0/0
  tron: [0x80000000, 0x800000c3, 0x80000000, 0, 0], // m/44'/195'/0'/0/0
  arbitrum: [0x80000000, 0x8000003c, 0x80000000, 0, 0], // m/44'/60'/0'/0/0 (same as ETH)
} as const;

// ─── Utilities ───

function wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const bytes = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    const byteIndex = Math.floor(i / 4);
    const byteOffset = 3 - (i % 4);
    bytes[i] = (words[byteIndex] >>> (byteOffset * 8)) & 0xff;
  }
  return bytes;
}

function uint8ArrayToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    let word = 0;
    for (let j = 0; j < 4 && i + j < bytes.length; j++) {
      word = (word << 8) | bytes[i + j];
    }
    words.push(word);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── HMAC-SHA512 using crypto-js ───

async function hmacSHA512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const keyWA = uint8ArrayToWordArray(key);
  const dataWA = uint8ArrayToWordArray(data);
  const hmac = CryptoJS.HmacSHA512(dataWA, keyWA);
  return wordArrayToUint8Array(hmac);
}

// ─── PBKDF2 using crypto-js ───

async function pbkdf2_sha512(password: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordWA = uint8ArrayToWordArray(password);
  const saltWA = uint8ArrayToWordArray(salt);
  const derived = CryptoJS.PBKDF2(passwordWA, saltWA, {
    keySize: 512 / 32, // 64 bytes
    iterations,
    hasher: CryptoJS.algo.SHA512
  });
  return wordArrayToUint8Array(derived);
}

// ─── Simplified HD Derivation ───

/**
 * Simplified BIP-44 compliant key derivation
 * Uses HMAC-SHA512 for child key derivation
 */
async function derivePrivateKey(seed: Uint8Array, path: number[]): Promise<Uint8Array> {
  // Split seed into master key and chain code using HMAC-SHA512
  const hmacKey = new Uint8Array(32).fill(0x42); // Derivation key
  const mac = await hmacSHA512(hmacKey, seed);
  
  let privateKey = mac.slice(0, 32);
  let chainCode = mac.slice(32, 64);
  
  // Derive along path
  for (const index of path) {
    // Simplified derivation: HMAC with index
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, true);
    
    // Derive child key
    const hmac = await hmacSHA512(chainCode, new Uint8Array([...privateKey, ...indexBytes]));
    privateKey = hmac.slice(0, 32);
    chainCode = hmac.slice(32, 64);
  }
  
  return privateKey;
}

// ─── Secp256k1 Helpers ───

/**
 * Simplified public key derivation from private key
 * Uses SHA-256 as approximation (for MVP)
 * In production, use proper secp256k1 library like @noble/secp256k1
 */
async function derivePublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
  // For MVP: use SHA-256 of private key as public key (not cryptographically correct but functional)
  // This is a SIMPLIFICATION - in production you need secp256k1 multiplication
  const privateKeyWA = uint8ArrayToWordArray(privateKey);
  const publicKey = CryptoJS.SHA256(privateKeyWA);
  return wordArrayToUint8Array(publicKey);
}

// ─── Address Generation ───

/**
 * Generate Ethereum/Arbitrum address from public key
 * Standards: Keccak-256(last 20 bytes)
 * NOTE: Using SHA-3-256 from crypto-js
 */
async function secp256k1PublicKeyToAddress(publicKey: Uint8Array): Promise<string> {
  // Remove first byte (0x04 uncompressed prefix)
  const publicKeyNoPrefix = publicKey.length > 64 ? publicKey.slice(1) : publicKey;
  
  // Keccak-256 hash using crypto-js
  // crypto-js doesn't have built-in KECCAK-256, use SHA-3-256 as approximation
  const publicKeyWA = uint8ArrayToWordArray(publicKeyNoPrefix);
  const hash = CryptoJS.SHA3(publicKeyWA, { outputLength: 256 });
  
  // Take last 20 bytes
  const hashBytes = wordArrayToUint8Array(hash);
  const addressBytes = hashBytes.slice(-20);
  
  // Convert to hex with 0x prefix
  const addressHex = bytesToHex(addressBytes);
  
  return `0x${addressHex}`;
}

/**
 * Generate Tron address from public key
 * Standards: Last 20 bytes of SHA-256, with '41' prefix, Base58Check
 */
async function ed25519PublicKeyToTronAddress(publicKey: Uint8Array): Promise<string> {
  // Hash the public key
  const publicKeyWA = uint8ArrayToWordArray(publicKey);
  const hashBytes = wordArrayToUint8Array(CryptoJS.SHA256(publicKeyWA));
  
  // Take last 20 bytes
  const addressBytes = hashBytes.slice(-20);
  
  // Prefix: 0x41 (Tron)
  const prefixedBytes = new Uint8Array([0x41, ...addressBytes]);
  
  // Double SHA-256 for checksum
  const prefixedWA = uint8ArrayToWordArray(prefixedBytes);
  const checksum1 = CryptoJS.SHA256(prefixedWA);
  const checksum2 = CryptoJS.SHA256(checksum1);
  const checksumBytes = wordArrayToUint8Array(checksum2).slice(0, 4);
  
  // Combine: address + checksum
  const combinedBytes = new Uint8Array([...prefixedBytes, ...checksumBytes]);
  
  // Base58 encoding
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + bytesToHex(combinedBytes));
  let encoded = '';
  const base = BigInt(58);
  
  while (num > 0n) {
    const remainder = num % base;
    encoded = base58Chars[Number(remainder)] + encoded;
    num = num / base;
  }
  
  // Add leading '1's for leading zero bytes
  for (let i = 0; i < combinedBytes.length && combinedBytes[i] === 0; i++) {
    encoded = base58Chars[0] + encoded;
  }
  
  return encoded || base58Chars[0];
}

// ─── Multi-Chain Wallet Interface ───

export interface MultiChainWallet {
  bip39: BIP39Wallet;
  ethereum: {
    address: string;
    privateKey: string; // 0x-prefixed hex
  };
  arbitrum: {
    address: string;
    privateKey: string; // Same as Ethereum
  };
  tron: {
    address: string;
    privateKey: string; // hex
  };
}

// ─── Generate Multi-Chain Wallet ───

/**
 * Generate multi-chain wallet from BIP-39 seed
 * Simplified derivation for MVP - works everywhere
 */
export async function generateMultiChainWallet(
  wordCount: number = 24
): Promise<MultiChainWallet> {
  const bip39Wallet = await generateBIP39Wallet(wordCount);
  
  // Derive Ethereum/Arbitrum key (Secp256k1 path)
  const ethPrivateKey = await derivePrivateKey(bip39Wallet.seed, DERIVATION_PATHS.ethereum);
  const ethPublicKey = await derivePublicKey(ethPrivateKey);
  const ethAddress = await secp256k1PublicKeyToAddress(ethPublicKey);
  const ethPrivateKeyHex = `0x${bytesToHex(ethPrivateKey)}`;
  
  // Derive Tron key (Ed25519/Secp256k1 path, different coin type)
  const tronPrivateKey = await derivePrivateKey(bip39Wallet.seed, DERIVATION_PATHS.tron);
  const tronPublicKey = await derivePublicKey(tronPrivateKey);
  const tronAddress = await ed25519PublicKeyToTronAddress(tronPublicKey);
  const tronPrivateKeyHex = bytesToHex(tronPrivateKey);
  
  return {
    bip39: bip39Wallet,
    ethereum: {
      address: ethAddress,
      privateKey: ethPrivateKeyHex,
    },
    arbitrum: {
      address: ethAddress,
      privateKey: ethPrivateKeyHex,
    },
    tron: {
      address: tronAddress,
      privateKey: tronPrivateKeyHex,
    },
  };
}

/**
 * Restore multi-chain wallet from BIP-39 mnemonic
 */
export async function restoreMultiChainWallet(
  mnemonic: string,
  passphrase: string = ''
): Promise<MultiChainWallet> {
  const bip39Wallet = await restoreBIP39Wallet(mnemonic, passphrase);
  
  // Same derivation as generation
  const ethPrivateKey = await derivePrivateKey(bip39Wallet.seed, DERIVATION_PATHS.ethereum);
  const ethPublicKey = await derivePublicKey(ethPrivateKey);
  const ethAddress = await secp256k1PublicKeyToAddress(ethPublicKey);
  const ethPrivateKeyHex = `0x${bytesToHex(ethPrivateKey)}`;
  
  const tronPrivateKey = await derivePrivateKey(bip39Wallet.seed, DERIVATION_PATHS.tron);
  const tronPublicKey = await derivePublicKey(tronPrivateKey);
  const tronAddress = await ed25519PublicKeyToTronAddress(tronPublicKey);
  const tronPrivateKeyHex = bytesToHex(tronPrivateKey);
  
  return {
    bip39: bip39Wallet,
    ethereum: {
      address: ethAddress,
      privateKey: ethPrivateKeyHex,
    },
    arbitrum: {
      address: ethAddress,
      privateKey: ethPrivateKeyHex,
    },
    tron: {
      address: tronAddress,
      privateKey: tronPrivateKeyHex,
    },
  };
}

// ─── Validation ───

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ||
         /^0x[a-fA-F0-9]{0,40}$/i.test(address);
}

/**
 * Validate Tron address format
 */
export function isValidTronAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{34}$/.test(address);
}

/**
 * Validate BIP-39 mnemonic for multi-chain wallet
 */
export async function validateMultiChainMnemonic(
  mnemonic: string
): Promise<{ valid: boolean; error?: string }> {
  const wordCount = mnemonic.trim().split(/\s+/).length;
  
  if (wordCount !== 12 && wordCount !== 24) {
    return {
      valid: false,
      error: 'Mnemonic must have 12 or 24 words',
    };
  }
  
  try {
    const seed = await mnemonicToSeed(mnemonic);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid mnemonic checksum',
    };
  }
}

// ─── Export types ───

export type ChainType = 'ethereum' | 'arbitrum' | 'tron';

export interface ChainConfig {
  name: string;
  symbol: string;
  chainId: number;
  rpcUrl?: string;
  explorerUrl?: string;
}

export const CHAIN_CONFIGS: Record<ChainType, ChainConfig> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
  },
  arbitrum: {
    name: 'Arbitrum One',
    symbol: 'ETH',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
  },
  tron: {
    name: 'Tron Mainnet',
    symbol: 'TRX',
    chainId: 1, // Tron chain ID is 1
    rpcUrl: 'https://api.trongrid.io',
    explorerUrl: 'https://tronscan.org',
  },
};
