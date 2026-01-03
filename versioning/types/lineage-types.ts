/**
 * Lineage Types - Chain verification and ancestry types
 *
 * This module defines types for managing and verifying the lineage chain
 * of organizational truth manifests, ensuring cryptographic integrity.
 */

import type { ContentHash } from './version-types';

/**
 * Represents the lineage chain of a manifest
 * Tracks ancestry from the genesis (root) manifest through all versions
 */
export interface LineageChain {
  /** Hash of the genesis (first) manifest in the chain */
  readonly root: ContentHash;

  /** Hash of the immediate parent manifest, null for genesis */
  readonly parent: ContentHash | null;

  /** Number of ancestors from the root (genesis = 0) */
  readonly depth: number;

  /** Branch identifier for forked manifests, null for main line */
  readonly branchId: string | null;
}

/**
 * Result of lineage chain verification
 */
export interface LineageVerificationResult {
  /** Whether the entire chain is valid */
  readonly valid: boolean;

  /** Total number of verified links in the chain */
  readonly chainLength: number;

  /** Array of detected breaks in the lineage */
  readonly breaks: ReadonlyArray<LineageBreak>;

  /** Verification timestamp */
  readonly verifiedAt: string;

  /** Root hash of the verified chain */
  readonly rootHash: ContentHash | null;
}

/**
 * Represents a break or inconsistency in the lineage chain
 */
export interface LineageBreak {
  /** Position in the chain where the break occurred (0-indexed) */
  readonly position: number;

  /** The hash that was expected based on parent reference */
  readonly expectedHash: ContentHash;

  /** The actual hash found at this position, if any */
  readonly actualHash?: ContentHash;

  /** Human-readable description of the break */
  readonly error: string;

  /** Type of break detected */
  readonly breakType: LineageBreakType;
}

/**
 * Types of lineage breaks that can occur
 */
export type LineageBreakType =
  | 'missing_parent'      // Parent hash references non-existent manifest
  | 'hash_mismatch'       // Computed hash doesn't match stored hash
  | 'chain_gap'           // Missing intermediate version
  | 'circular_reference'  // Chain contains a cycle
  | 'orphaned_branch'     // Branch point no longer exists
  | 'depth_mismatch'      // Depth doesn't match actual chain length
  | 'root_mismatch';      // Root hash inconsistency

/**
 * Information about a branch in the lineage
 */
export interface LineageBranch {
  /** Unique identifier for this branch */
  readonly branchId: string;

  /** Hash of the manifest where branching occurred */
  readonly branchPoint: ContentHash;

  /** Depth at which the branch was created */
  readonly branchDepth: number;

  /** Human-readable name for the branch */
  readonly branchName: string;

  /** Timestamp when the branch was created */
  readonly createdAt: string;
}

/**
 * Complete lineage tree including all branches
 */
export interface LineageTree {
  /** The root/genesis manifest hash */
  readonly root: ContentHash;

  /** Main lineage chain */
  readonly mainLine: ReadonlyArray<ContentHash>;

  /** All branches indexed by branch ID */
  readonly branches: Readonly<Record<string, LineageBranch>>;

  /** Total number of manifests across all branches */
  readonly totalManifests: number;

  /** Maximum depth across all branches */
  readonly maxDepth: number;
}

/**
 * Manifest reference within the lineage
 */
export interface LineageReference {
  /** Content hash of the referenced manifest */
  readonly hash: ContentHash;

  /** Depth in the chain */
  readonly depth: number;

  /** Branch ID if on a branch */
  readonly branchId: string | null;

  /** Whether this manifest has been verified */
  readonly verified: boolean;
}

/**
 * Options for lineage verification
 */
export interface LineageVerificationOptions {
  /** Whether to verify the entire chain or just the immediate parent */
  readonly fullChainVerification?: boolean;

  /** Maximum depth to verify (for performance) */
  readonly maxVerificationDepth?: number;

  /** Whether to check for circular references */
  readonly detectCircularReferences?: boolean;

  /** Whether to verify content hashes match */
  readonly verifyContentHashes?: boolean;
}

/**
 * Creates an empty lineage verification result for genesis manifests
 */
export function createGenesisLineageResult(rootHash: ContentHash): LineageVerificationResult {
  return Object.freeze({
    valid: true,
    chainLength: 1,
    breaks: Object.freeze([]),
    verifiedAt: new Date().toISOString(),
    rootHash
  });
}

/**
 * Creates a lineage break record
 */
export function createLineageBreak(
  position: number,
  expectedHash: ContentHash,
  error: string,
  breakType: LineageBreakType,
  actualHash?: ContentHash
): LineageBreak {
  const breakRecord: LineageBreak = {
    position,
    expectedHash,
    error,
    breakType
  };

  if (actualHash !== undefined) {
    return Object.freeze({ ...breakRecord, actualHash });
  }

  return Object.freeze(breakRecord);
}

/**
 * Creates an initial lineage chain for a genesis manifest
 */
export function createGenesisLineage(rootHash: ContentHash): LineageChain {
  return Object.freeze({
    root: rootHash,
    parent: null,
    depth: 0,
    branchId: null
  });
}

/**
 * Extends a lineage chain with a new manifest
 */
export function extendLineage(
  current: LineageChain,
  newHash: ContentHash,
  branchId?: string
): LineageChain {
  return Object.freeze({
    root: current.root,
    parent: newHash,
    depth: current.depth + 1,
    branchId: branchId ?? current.branchId
  });
}
