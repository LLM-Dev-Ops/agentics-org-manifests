/**
 * Versioning Module - Public API for organizational truth manifest versioning
 *
 * This module provides content-addressable versioning capabilities for
 * organizational truth manifests, ensuring cryptographic integrity and
 * immutable lineage tracking.
 *
 * @module versioning
 */

// Type exports
export type {
  ContentHash,
  VersionId,
  SemanticVersion,
  VersionedManifest,
  ContentHashResult,
  VersionCreateOptions,
  VersionComparison
} from './types/version-types';

export {
  isValidContentHash,
  isValidVersionId,
  isValidSemanticVersion,
  extractShortHash,
  generateVersionId
} from './types/version-types';

export type {
  LineageChain,
  LineageVerificationResult,
  LineageBreak,
  LineageBreakType,
  LineageBranch,
  LineageTree,
  LineageReference,
  LineageVerificationOptions
} from './types/lineage-types';

export {
  createGenesisLineageResult,
  createLineageBreak,
  createGenesisLineage,
  extendLineage
} from './types/lineage-types';

// Core functionality exports
export {
  computeContentHash,
  computeContentHashWithMetadata,
  canonicalizeContent,
  sortKeysRecursively,
  verifyContentHash,
  computeFieldHash,
  combineHashes,
  extractRawHash,
  computeStreamingHash
} from './core/content-hasher';

export type {
  ImmutableManifest as LineageImmutableManifest,
  ManifestStore
} from './core/lineage-manager';

export {
  verifyLineageChain,
  extractLineage,
  createChildLineage,
  buildLineageTree,
  findCommonAncestor,
  createLineageReference
} from './core/lineage-manager';

export type {
  ImmutabilityVerification,
  ImmutableManifest
} from './core/immutability-guard';

export {
  deepFreeze,
  enforceImmutability,
  detectMutableFields,
  checkDeepFrozen,
  createImmutableManifest,
  validateManifestIntegrity,
  modifyManifest
} from './core/immutability-guard';

// Convenience re-exports for common patterns
import { computeContentHash, verifyContentHash } from './core/content-hasher';
import { deepFreeze, createImmutableManifest, enforceImmutability } from './core/immutability-guard';
import { verifyLineageChain, extractLineage, createChildLineage } from './core/lineage-manager';
import type { ContentHash, VersionedManifest, VersionCreateOptions } from './types/version-types';
import { generateVersionId } from './types/version-types';
import type { LineageChain } from './types/lineage-types';
import type { ImmutableManifest } from './core/immutability-guard';

/**
 * Creates a complete versioned manifest from content
 *
 * @param content - The manifest content to version
 * @param options - Version creation options
 * @returns Complete versioned manifest with lineage
 */
export function createVersionedManifest(
  content: object,
  options: VersionCreateOptions = {}
): VersionedManifest {
  const { parentHash, lineageChain = [], timestamp } = options;

  // Compute content hash
  const contentHash = computeContentHash(content);

  // Generate version ID
  const sequence = lineageChain.length + 1;
  const versionId = generateVersionId(contentHash, sequence);

  // Build lineage chain
  const newLineageChain: ContentHash[] = [...lineageChain];
  if (parentHash) {
    newLineageChain.push(parentHash);
  }

  // Create versioned manifest
  const versionedManifest: VersionedManifest = {
    versionId,
    contentHash,
    parentHash: parentHash ?? null,
    lineageChain: Object.freeze(newLineageChain),
    creationTimestamp: timestamp ?? new Date().toISOString(),
    canonicalContent: deepFreeze(content)
  };

  return deepFreeze(versionedManifest) as VersionedManifest;
}

/**
 * Creates a new version from an existing manifest
 *
 * @param parentManifest - The parent manifest to derive from
 * @param newContent - The updated content
 * @returns New versioned manifest with proper lineage
 */
export function deriveVersion(
  parentManifest: VersionedManifest,
  newContent: object
): VersionedManifest {
  const newLineageChain = [...parentManifest.lineageChain, parentManifest.contentHash];

  return createVersionedManifest(newContent, {
    parentHash: parentManifest.contentHash,
    lineageChain: newLineageChain
  });
}

/**
 * Verifies a complete version including content hash and lineage
 *
 * @param manifest - The versioned manifest to verify
 * @returns True if the manifest is valid
 */
export function verifyVersion(manifest: VersionedManifest): boolean {
  // Verify content hash
  const isContentValid = verifyContentHash(
    manifest.canonicalContent as object,
    manifest.contentHash
  );

  if (!isContentValid) {
    return false;
  }

  // Verify version ID format
  const expectedVersionId = generateVersionId(
    manifest.contentHash,
    manifest.lineageChain.length + 1
  );

  if (manifest.versionId !== expectedVersionId) {
    return false;
  }

  // Verify lineage chain consistency
  if (manifest.parentHash !== null) {
    const lastInChain = manifest.lineageChain[manifest.lineageChain.length - 1];
    if (lastInChain !== manifest.parentHash) {
      return false;
    }
  } else if (manifest.lineageChain.length > 0) {
    return false;
  }

  return true;
}

/**
 * Compares two versions and returns their relationship
 *
 * @param versionA - First version
 * @param versionB - Second version
 * @returns Comparison result describing the relationship
 */
export function compareVersions(
  versionA: VersionedManifest,
  versionB: VersionedManifest
): {
  identical: boolean;
  isAncestor: boolean;
  isDescendant: boolean;
  commonAncestor: ContentHash | null;
} {
  const identical = versionA.contentHash === versionB.contentHash;

  if (identical) {
    return {
      identical: true,
      isAncestor: false,
      isDescendant: false,
      commonAncestor: versionA.contentHash
    };
  }

  // Check if A is ancestor of B
  const isAncestor = versionB.lineageChain.includes(versionA.contentHash);

  // Check if A is descendant of B
  const isDescendant = versionA.lineageChain.includes(versionB.contentHash);

  // Find common ancestor
  let commonAncestor: ContentHash | null = null;

  const ancestorsA = new Set([versionA.contentHash, ...versionA.lineageChain]);

  for (let i = versionB.lineageChain.length - 1; i >= 0; i--) {
    const hash = versionB.lineageChain[i];
    if (hash !== undefined && ancestorsA.has(hash)) {
      commonAncestor = hash;
      break;
    }
  }

  if (!commonAncestor && ancestorsA.has(versionB.contentHash)) {
    commonAncestor = versionB.contentHash;
  }

  return {
    identical,
    isAncestor,
    isDescendant,
    commonAncestor
  };
}

/**
 * Module version information
 */
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
} as const;
