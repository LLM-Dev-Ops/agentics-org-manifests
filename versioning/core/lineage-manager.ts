/**
 * Lineage Manager - Chain verification and ancestry management
 *
 * This module provides functionality for managing and verifying the lineage chain
 * of organizational truth manifests, ensuring cryptographic integrity across versions.
 */

import { computeContentHash, verifyContentHash } from './content-hasher';
import type { ContentHash } from '../types/version-types';
import type {
  LineageChain,
  LineageVerificationResult,
  LineageBreak,
  LineageBreakType,
  LineageVerificationOptions,
  LineageBranch,
  LineageTree,
  LineageReference
} from '../types/lineage-types';
import { createLineageBreak, createGenesisLineageResult } from '../types/lineage-types';

/**
 * Represents an immutable manifest for lineage verification
 */
export interface ImmutableManifest {
  readonly $manifest: {
    readonly contentHash?: ContentHash;
    readonly lineage?: {
      readonly root: ContentHash;
      readonly parent: ContentHash | null;
      readonly depth: number;
      readonly branchId?: string | null;
    };
  };
  readonly [key: string]: unknown;
}

/**
 * Manifest store for resolving hashes to manifest content
 */
export interface ManifestStore {
  /**
   * Retrieves a manifest by its content hash
   */
  getManifest(hash: ContentHash): Promise<ImmutableManifest | null>;

  /**
   * Checks if a manifest exists in the store
   */
  hasManifest(hash: ContentHash): Promise<boolean>;
}

/**
 * Verifies the lineage chain of a manifest
 *
 * @param manifest - The manifest to verify
 * @param store - Optional manifest store for full chain verification
 * @param options - Verification options
 * @returns Verification result with any detected breaks
 */
export async function verifyLineageChain(
  manifest: ImmutableManifest,
  store?: ManifestStore,
  options: LineageVerificationOptions = {}
): Promise<LineageVerificationResult> {
  const {
    fullChainVerification = false,
    maxVerificationDepth = 100,
    detectCircularReferences = true,
    verifyContentHashes = true
  } = options;

  const breaks: LineageBreak[] = [];
  const lineage = extractLineage(manifest);

  // Genesis manifest - no parent to verify
  if (lineage.parent === null && lineage.depth === 0) {
    const rootHash = manifest.$manifest.contentHash;
    if (!rootHash) {
      return createInvalidResult(breaks, 0, null);
    }
    return createGenesisLineageResult(rootHash);
  }

  // Verify current manifest's content hash
  if (verifyContentHashes && manifest.$manifest.contentHash) {
    const isValidHash = verifyContentHash(manifest, manifest.$manifest.contentHash);
    if (!isValidHash) {
      breaks.push(createLineageBreak(
        lineage.depth,
        manifest.$manifest.contentHash,
        'Content hash does not match computed hash',
        'hash_mismatch',
        computeContentHash(manifest)
      ));
    }
  }

  // Verify depth matches parent relationship
  if (lineage.depth > 0 && lineage.parent === null) {
    breaks.push(createLineageBreak(
      lineage.depth,
      lineage.root,
      `Depth ${lineage.depth} but parent is null`,
      'depth_mismatch'
    ));
  }

  // Full chain verification if store is provided
  if (fullChainVerification && store && lineage.parent) {
    const seenHashes = new Set<ContentHash>();
    let currentHash: ContentHash | null = lineage.parent;
    let currentDepth = lineage.depth - 1;
    let chainLength = 1;

    while (currentHash && currentDepth >= 0 && chainLength <= maxVerificationDepth) {
      // Check for circular references
      if (detectCircularReferences && seenHashes.has(currentHash)) {
        breaks.push(createLineageBreak(
          currentDepth,
          currentHash,
          'Circular reference detected in lineage chain',
          'circular_reference'
        ));
        break;
      }
      seenHashes.add(currentHash);

      // Fetch and verify parent manifest
      const parentManifest = await store.getManifest(currentHash);

      if (!parentManifest) {
        breaks.push(createLineageBreak(
          currentDepth,
          currentHash,
          'Parent manifest not found in store',
          'missing_parent'
        ));
        break;
      }

      // Verify parent's content hash
      if (verifyContentHashes && parentManifest.$manifest.contentHash) {
        const isValidParentHash = verifyContentHash(
          parentManifest,
          parentManifest.$manifest.contentHash
        );
        if (!isValidParentHash) {
          breaks.push(createLineageBreak(
            currentDepth,
            parentManifest.$manifest.contentHash,
            'Parent content hash mismatch',
            'hash_mismatch',
            computeContentHash(parentManifest)
          ));
        }
      }

      // Move to grandparent
      const parentLineage = extractLineage(parentManifest);
      currentHash = parentLineage.parent;
      currentDepth--;
      chainLength++;

      // Verify root consistency
      if (parentLineage.root !== lineage.root) {
        breaks.push(createLineageBreak(
          currentDepth,
          lineage.root,
          'Root hash mismatch in lineage chain',
          'root_mismatch',
          parentLineage.root
        ));
      }
    }

    // Verify we reached root
    if (currentDepth > 0 && breaks.length === 0) {
      breaks.push(createLineageBreak(
        currentDepth,
        lineage.root,
        `Chain incomplete: expected depth 0, reached ${currentDepth}`,
        'chain_gap'
      ));
    }

    return createVerificationResult(breaks, chainLength, lineage.root);
  }

  // Basic verification without full chain traversal
  return createVerificationResult(breaks, 1, lineage.root);
}

/**
 * Extracts lineage information from a manifest
 *
 * @param manifestData - The manifest object
 * @returns The extracted lineage chain
 */
export function extractLineage(manifestData: object): LineageChain {
  const manifest = manifestData as Partial<ImmutableManifest>;

  if (!manifest.$manifest?.lineage) {
    // No lineage info - treat as potential genesis
    const contentHash = manifest.$manifest?.contentHash;
    return Object.freeze({
      root: contentHash ?? computeContentHash(manifestData),
      parent: null,
      depth: 0,
      branchId: null
    });
  }

  const lineage = manifest.$manifest.lineage;

  return Object.freeze({
    root: lineage.root,
    parent: lineage.parent,
    depth: lineage.depth,
    branchId: lineage.branchId ?? null
  });
}

/**
 * Creates a new lineage chain for a child manifest
 *
 * @param parentManifest - The parent manifest
 * @param branchId - Optional branch identifier for forked manifests
 * @returns New lineage chain for the child
 */
export function createChildLineage(
  parentManifest: ImmutableManifest,
  branchId?: string
): LineageChain {
  const parentLineage = extractLineage(parentManifest);
  const parentHash = parentManifest.$manifest.contentHash ?? computeContentHash(parentManifest);

  return Object.freeze({
    root: parentLineage.root,
    parent: parentHash,
    depth: parentLineage.depth + 1,
    branchId: branchId ?? parentLineage.branchId
  });
}

/**
 * Builds a complete lineage tree from a manifest store
 *
 * @param rootHash - The genesis manifest hash
 * @param store - Manifest store for resolution
 * @returns Complete lineage tree
 */
export async function buildLineageTree(
  rootHash: ContentHash,
  store: ManifestStore
): Promise<LineageTree> {
  const rootManifest = await store.getManifest(rootHash);

  if (!rootManifest) {
    return Object.freeze({
      root: rootHash,
      mainLine: Object.freeze([rootHash]),
      branches: Object.freeze({}),
      totalManifests: 0,
      maxDepth: 0
    });
  }

  // In a full implementation, this would traverse the entire tree
  // For now, return a basic structure
  return Object.freeze({
    root: rootHash,
    mainLine: Object.freeze([rootHash]),
    branches: Object.freeze({}),
    totalManifests: 1,
    maxDepth: 0
  });
}

/**
 * Finds the common ancestor of two manifests
 *
 * @param manifestA - First manifest
 * @param manifestB - Second manifest
 * @param store - Manifest store for chain traversal
 * @returns The common ancestor hash, or null if none found
 */
export async function findCommonAncestor(
  manifestA: ImmutableManifest,
  manifestB: ImmutableManifest,
  store: ManifestStore
): Promise<ContentHash | null> {
  const lineageA = extractLineage(manifestA);
  const lineageB = extractLineage(manifestB);

  // Different roots means no common ancestor
  if (lineageA.root !== lineageB.root) {
    return null;
  }

  // Same manifest
  const hashA = manifestA.$manifest.contentHash ?? computeContentHash(manifestA);
  const hashB = manifestB.$manifest.contentHash ?? computeContentHash(manifestB);

  if (hashA === hashB) {
    return hashA;
  }

  // Collect ancestors of A
  const ancestorsA = new Set<ContentHash>([hashA]);
  let currentA: ContentHash | null = lineageA.parent;

  while (currentA) {
    ancestorsA.add(currentA);
    const manifest = await store.getManifest(currentA);
    if (!manifest) break;
    const lineage = extractLineage(manifest);
    currentA = lineage.parent;
  }

  // Find first B ancestor that's in A's ancestor set
  let currentB: ContentHash | null = hashB;

  while (currentB) {
    if (ancestorsA.has(currentB)) {
      return currentB;
    }
    const manifest = await store.getManifest(currentB);
    if (!manifest) break;
    const lineage = extractLineage(manifest);
    currentB = lineage.parent;
  }

  // Root is always common ancestor if same root
  return lineageA.root;
}

/**
 * Creates a lineage reference from a manifest
 */
export function createLineageReference(manifest: ImmutableManifest): LineageReference {
  const lineage = extractLineage(manifest);
  const hash = manifest.$manifest.contentHash ?? computeContentHash(manifest);

  return Object.freeze({
    hash,
    depth: lineage.depth,
    branchId: lineage.branchId,
    verified: false
  });
}

// Helper functions

function createVerificationResult(
  breaks: LineageBreak[],
  chainLength: number,
  rootHash: ContentHash | null
): LineageVerificationResult {
  return Object.freeze({
    valid: breaks.length === 0,
    chainLength,
    breaks: Object.freeze(breaks),
    verifiedAt: new Date().toISOString(),
    rootHash
  });
}

function createInvalidResult(
  breaks: LineageBreak[],
  chainLength: number,
  rootHash: ContentHash | null
): LineageVerificationResult {
  return Object.freeze({
    valid: false,
    chainLength,
    breaks: Object.freeze(breaks),
    verifiedAt: new Date().toISOString(),
    rootHash
  });
}
