/**
 * Content Hasher - SHA-256 content-addressable hashing
 *
 * This module provides deterministic content hashing for organizational truth manifests.
 * All hashing is performed on canonicalized (normalized) content to ensure
 * the same logical content always produces the same hash.
 */

import { createHash } from 'crypto';
import type { ContentHash, ContentHashResult } from '../types/version-types';

/**
 * Fields that are excluded from content hashing as they are computed values
 */
const EXCLUDED_HASH_FIELDS = [
  'contentHash',
  '$contentHash',
  '_contentHash',
  'computed_hash'
] as const;

/**
 * Computes a deterministic SHA-256 content hash for the given object
 *
 * @param content - The object to hash
 * @returns The content hash in "sha256:{hex}" format
 */
export function computeContentHash(content: object): ContentHash {
  const canonicalized = canonicalizeContent(content);
  const jsonString = JSON.stringify(canonicalized);

  const hash = createHash('sha256')
    .update(jsonString, 'utf8')
    .digest('hex');

  return `sha256:${hash}` as ContentHash;
}

/**
 * Computes a content hash with additional metadata
 *
 * @param content - The object to hash
 * @returns Full hash result including canonicalized content and size
 */
export function computeContentHashWithMetadata(content: object): ContentHashResult {
  const canonicalized = canonicalizeContent(content);
  const jsonString = JSON.stringify(canonicalized);

  const hash = createHash('sha256')
    .update(jsonString, 'utf8')
    .digest('hex');

  return Object.freeze({
    hash: `sha256:${hash}` as ContentHash,
    canonicalizedContent: jsonString,
    contentSize: Buffer.byteLength(jsonString, 'utf8')
  });
}

/**
 * Canonicalizes content for deterministic hashing
 *
 * Canonicalization rules:
 * 1. Sort all object keys alphabetically (recursively)
 * 2. Remove excluded hash fields
 * 3. Normalize undefined to null
 * 4. Preserve array order (arrays are not sorted)
 *
 * @param content - The object to canonicalize
 * @returns A new object with canonical structure
 */
export function canonicalizeContent(content: object): object {
  const excluded = new Set<string>(EXCLUDED_HASH_FIELDS);
  return sortKeysRecursively(content, excluded) as object;
}

/**
 * Recursively sorts object keys alphabetically
 * Handles nested objects and arrays appropriately
 *
 * @param obj - The value to process
 * @param excludeKeys - Set of keys to exclude from the result
 * @returns The processed value with sorted keys
 */
export function sortKeysRecursively(
  obj: unknown,
  excludeKeys: Set<string> = new Set()
): unknown {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return null;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays - preserve order but process elements
  if (Array.isArray(obj)) {
    return Object.freeze(obj.map(item => sortKeysRecursively(item, excludeKeys)));
  }

  // Handle Date objects - convert to ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle regular objects - sort keys and process values
  const sortedKeys = Object.keys(obj as Record<string, unknown>)
    .filter(key => !excludeKeys.has(key))
    .sort();

  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const value = (obj as Record<string, unknown>)[key];
    result[key] = sortKeysRecursively(value, excludeKeys);
  }

  return Object.freeze(result);
}

/**
 * Verifies that a content hash matches the given content
 *
 * @param content - The content to verify
 * @param expectedHash - The expected content hash
 * @returns True if the hash matches
 */
export function verifyContentHash(content: object, expectedHash: ContentHash): boolean {
  const computedHash = computeContentHash(content);
  return computedHash === expectedHash;
}

/**
 * Computes a hash for a specific field within the content
 * Useful for tracking changes to specific sections
 *
 * @param content - The full content object
 * @param fieldPath - Dot-separated path to the field (e.g., "beliefs.core")
 * @returns The field hash or null if field doesn't exist
 */
export function computeFieldHash(content: object, fieldPath: string): ContentHash | null {
  const pathParts = fieldPath.split('.');
  let current: unknown = content;

  for (const part of pathParts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) {
    return null;
  }

  if (typeof current !== 'object') {
    // For primitive values, wrap in object for consistent hashing
    return computeContentHash({ value: current });
  }

  return computeContentHash(current as object);
}

/**
 * Creates a composite hash from multiple content hashes
 * Useful for summarizing changes across multiple manifests
 *
 * @param hashes - Array of content hashes to combine
 * @returns A single content hash representing all inputs
 */
export function combineHashes(hashes: ReadonlyArray<ContentHash>): ContentHash {
  if (hashes.length === 0) {
    // Empty input produces a deterministic "null" hash
    return computeContentHash({ hashes: [] });
  }

  // Sort hashes for deterministic ordering
  const sortedHashes = [...hashes].sort();

  return computeContentHash({ hashes: sortedHashes });
}

/**
 * Extracts the raw hex hash from a ContentHash
 *
 * @param hash - The content hash
 * @returns The 64-character hex string without prefix
 */
export function extractRawHash(hash: ContentHash): string {
  return hash.slice(7); // Remove "sha256:" prefix
}

/**
 * Computes a streaming hash for large content
 * Processes content in chunks to manage memory usage
 *
 * @param contentChunks - Iterator of content strings
 * @returns The final content hash
 */
export function computeStreamingHash(contentChunks: Iterable<string>): ContentHash {
  const hashInstance = createHash('sha256');

  for (const chunk of contentChunks) {
    hashInstance.update(chunk, 'utf8');
  }

  const hash = hashInstance.digest('hex');
  return `sha256:${hash}` as ContentHash;
}
