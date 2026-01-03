/**
 * Version Types - Core version primitives for organizational truth manifests
 *
 * This module defines the foundational types for content-addressable versioning,
 * ensuring all version identifiers are deterministic and verifiable.
 */

/**
 * Content hash using SHA-256 algorithm
 * Format: "sha256:{64-character-hex-encoded-hash}"
 */
export type ContentHash = `sha256:${string}`;

/**
 * Version identifier combining short hash and sequence number
 * Format: "v{8-char-short-hash}_{sequence-number}"
 * Example: "v1a2b3c4d_001"
 */
export type VersionId = `v${string}_${string}`;

/**
 * Semantic version following semver specification
 * Format: "{major}.{minor}.{patch}"
 */
export type SemanticVersion = `${number}.${number}.${number}`;

/**
 * Versioned manifest with complete lineage information
 * All properties are readonly to enforce immutability
 */
export interface VersionedManifest {
  /** Unique version identifier */
  readonly versionId: VersionId;

  /** SHA-256 hash of the canonical content */
  readonly contentHash: ContentHash;

  /** Hash of the parent manifest, null for genesis */
  readonly parentHash: ContentHash | null;

  /** Complete chain of ancestor hashes from root to parent */
  readonly lineageChain: ReadonlyArray<ContentHash>;

  /** ISO 8601 timestamp of version creation */
  readonly creationTimestamp: string;

  /** Frozen canonical representation of the manifest content */
  readonly canonicalContent: Readonly<object>;
}

/**
 * Result of content hash computation
 */
export interface ContentHashResult {
  /** The computed content hash */
  readonly hash: ContentHash;

  /** The canonicalized content that was hashed */
  readonly canonicalizedContent: string;

  /** Size of the canonicalized content in bytes */
  readonly contentSize: number;
}

/**
 * Version creation options
 */
export interface VersionCreateOptions {
  /** Parent version hash for establishing lineage */
  readonly parentHash?: ContentHash;

  /** Existing lineage chain to extend */
  readonly lineageChain?: ReadonlyArray<ContentHash>;

  /** Optional semantic version override */
  readonly semanticVersion?: SemanticVersion;

  /** Custom timestamp (defaults to current time) */
  readonly timestamp?: string;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  /** Whether the versions are identical by content hash */
  readonly identical: boolean;

  /** Whether version A is an ancestor of version B */
  readonly isAncestor: boolean;

  /** Whether version A is a descendant of version B */
  readonly isDescendant: boolean;

  /** Common ancestor hash, if any */
  readonly commonAncestor: ContentHash | null;

  /** Divergence point in the lineage chain */
  readonly divergenceDepth: number | null;
}

/**
 * Validates that a string is a valid ContentHash format
 */
export function isValidContentHash(value: string): value is ContentHash {
  const pattern = /^sha256:[a-f0-9]{64}$/;
  return pattern.test(value);
}

/**
 * Validates that a string is a valid VersionId format
 */
export function isValidVersionId(value: string): value is VersionId {
  const pattern = /^v[a-f0-9]{8}_\d{3,}$/;
  return pattern.test(value);
}

/**
 * Validates that a string is a valid SemanticVersion format
 */
export function isValidSemanticVersion(value: string): value is SemanticVersion {
  const pattern = /^\d+\.\d+\.\d+$/;
  return pattern.test(value);
}

/**
 * Extracts the short hash from a ContentHash
 */
export function extractShortHash(hash: ContentHash): string {
  return hash.slice(7, 15); // Skip "sha256:" prefix, take 8 chars
}

/**
 * Generates a VersionId from a ContentHash and sequence number
 */
export function generateVersionId(hash: ContentHash, sequence: number): VersionId {
  const shortHash = extractShortHash(hash);
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `v${shortHash}_${paddedSequence}` as VersionId;
}
