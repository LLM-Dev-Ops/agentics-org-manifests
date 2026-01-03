/**
 * Immutability Guard - Mutation detection and enforcement
 *
 * This module provides functionality to enforce immutability on organizational
 * truth manifests and detect fields that may contain mutable data.
 */

import type { ContentHash } from '../types/version-types';
import { computeContentHash, verifyContentHash } from './content-hasher';

/**
 * Fields that are inherently mutable and should be flagged
 */
const MUTABLE_FIELD_PATTERNS = [
  'updated_at',
  'updatedAt',
  'last_modified',
  'lastModified',
  'modified_at',
  'modifiedAt',
  'accessed_at',
  'accessedAt',
  'last_accessed',
  'lastAccessed',
  'revision_count',
  'revisionCount',
  'edit_count',
  'editCount',
  'view_count',
  'viewCount',
  'access_count',
  'accessCount'
] as const;

/**
 * Result of immutability verification
 */
export interface ImmutabilityVerification {
  /** Whether the manifest is properly immutable */
  readonly isImmutable: boolean;

  /** Whether the manifest object is frozen */
  readonly isFrozen: boolean;

  /** Whether all nested objects are frozen */
  readonly isDeepFrozen: boolean;

  /** Fields that contain potentially mutable data */
  readonly mutableFields: ReadonlyArray<string>;

  /** Whether the content hash matches (if present) */
  readonly hashValid: boolean;

  /** Verification timestamp */
  readonly verifiedAt: string;

  /** Warnings about potential mutability issues */
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Immutable manifest interface for type safety
 */
export interface ImmutableManifest {
  readonly $manifest: {
    readonly contentHash?: ContentHash;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

/**
 * Deep freezes an object and all nested objects
 * Returns a new frozen object, does not mutate the input
 *
 * @param obj - The object to freeze
 * @returns A deeply frozen copy of the object
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const frozenArray = obj.map(item => deepFreeze(item));
    return Object.freeze(frozenArray) as unknown as Readonly<T>;
  }

  // Handle Date objects - create new frozen Date
  if (obj instanceof Date) {
    return Object.freeze(new Date(obj.getTime())) as unknown as Readonly<T>;
  }

  // Handle regular objects
  const frozenObj: Record<string, unknown> = {};

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    frozenObj[key] = deepFreeze(value);
  }

  return Object.freeze(frozenObj) as unknown as Readonly<T>;
}

/**
 * Enforces immutability on a manifest and returns verification result
 *
 * @param manifest - The manifest to verify
 * @returns Verification result with detailed status
 */
export function enforceImmutability(manifest: ImmutableManifest): ImmutabilityVerification {
  const warnings: string[] = [];

  // Check if object is frozen
  const isFrozen = Object.isFrozen(manifest);
  if (!isFrozen) {
    warnings.push('Manifest object is not frozen');
  }

  // Check deep freeze status
  const isDeepFrozen = checkDeepFrozen(manifest);
  if (!isDeepFrozen) {
    warnings.push('Manifest contains unfrozen nested objects');
  }

  // Detect mutable fields
  const mutableFields = detectMutableFields(manifest);
  if (mutableFields.length > 0) {
    warnings.push(`Found ${mutableFields.length} potentially mutable field(s)`);
  }

  // Verify content hash if present
  let hashValid = true;
  if (manifest.$manifest?.contentHash) {
    hashValid = verifyContentHash(manifest, manifest.$manifest.contentHash);
    if (!hashValid) {
      warnings.push('Content hash does not match computed hash');
    }
  } else {
    warnings.push('No content hash present for verification');
  }

  const isImmutable = isFrozen && isDeepFrozen && mutableFields.length === 0 && hashValid;

  return Object.freeze({
    isImmutable,
    isFrozen,
    isDeepFrozen,
    mutableFields: Object.freeze(mutableFields),
    hashValid,
    verifiedAt: new Date().toISOString(),
    warnings: Object.freeze(warnings)
  });
}

/**
 * Detects fields that may contain mutable data
 *
 * @param content - The object to analyze
 * @returns Array of field paths that may be mutable
 */
export function detectMutableFields(content: object): string[] {
  const mutableFields: string[] = [];
  const mutablePatterns = new Set(MUTABLE_FIELD_PATTERNS);

  function traverse(obj: unknown, path: string): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
      return;
    }

    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${key}` : key;

      // Check if key matches mutable patterns
      const lowerKey = key.toLowerCase();
      for (const pattern of mutablePatterns) {
        if (lowerKey === pattern.toLowerCase()) {
          mutableFields.push(fullPath);
          break;
        }
      }

      // Check for timestamp-like field names
      if (
        lowerKey.endsWith('_at') ||
        lowerKey.endsWith('at') && lowerKey.length > 2 ||
        lowerKey.endsWith('_date') ||
        lowerKey.endsWith('date') && lowerKey.length > 4 ||
        lowerKey.endsWith('_time') ||
        lowerKey.endsWith('time') && lowerKey.length > 4 ||
        lowerKey.endsWith('_count') ||
        lowerKey.endsWith('count') && lowerKey.length > 5
      ) {
        if (!mutableFields.includes(fullPath)) {
          // Only add if it's likely a mutable timestamp/counter
          const value = (obj as Record<string, unknown>)[key];
          if (typeof value === 'string' || typeof value === 'number') {
            // Additional heuristics
            if (
              lowerKey.includes('update') ||
              lowerKey.includes('modified') ||
              lowerKey.includes('access') ||
              lowerKey.includes('revision') ||
              lowerKey.includes('edit') ||
              lowerKey.includes('view')
            ) {
              mutableFields.push(fullPath);
            }
          }
        }
      }

      // Recursively traverse nested objects
      traverse((obj as Record<string, unknown>)[key], fullPath);
    }
  }

  traverse(content, '');

  return Object.freeze(mutableFields) as string[];
}

/**
 * Checks if an object is deeply frozen
 *
 * @param obj - The object to check
 * @returns True if the object and all nested objects are frozen
 */
export function checkDeepFrozen(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return true;
  }

  if (typeof obj !== 'object') {
    return true;
  }

  if (!Object.isFrozen(obj)) {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.every(item => checkDeepFrozen(item));
  }

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (!checkDeepFrozen((obj as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Creates an immutable manifest from content
 *
 * @param content - The manifest content
 * @returns Deeply frozen manifest with computed content hash
 */
export function createImmutableManifest(content: object): ImmutableManifest {
  // First canonicalize and compute hash
  const contentHash = computeContentHash(content);

  // Extract or create $manifest section
  const existingManifest = (content as Partial<ImmutableManifest>).$manifest ?? {};

  // Build the complete manifest
  const manifest: Record<string, unknown> = { ...content };
  manifest.$manifest = {
    ...existingManifest,
    contentHash
  };

  // Deep freeze and return
  return deepFreeze(manifest) as ImmutableManifest;
}

/**
 * Validates that a manifest hasn't been tampered with
 *
 * @param manifest - The manifest to validate
 * @returns True if the manifest is valid and untampered
 */
export function validateManifestIntegrity(manifest: ImmutableManifest): boolean {
  const verification = enforceImmutability(manifest);
  return verification.hashValid && verification.mutableFields.length === 0;
}

/**
 * Creates a modified version of a manifest (returns new immutable copy)
 *
 * @param manifest - The original manifest
 * @param modifications - Function to apply modifications
 * @returns New immutable manifest with modifications applied
 */
export function modifyManifest<T extends ImmutableManifest>(
  manifest: T,
  modifications: (draft: Record<string, unknown>) => void
): ImmutableManifest {
  // Create a mutable copy
  const draft = JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;

  // Apply modifications
  modifications(draft);

  // Return new immutable version
  return createImmutableManifest(draft);
}
