/**
 * Reference Types Module
 *
 * Defines all type primitives for the reference resolution system.
 * This module contains NO logic, only type definitions.
 *
 * @module references/types
 */

// =============================================================================
// Primitive Types
// =============================================================================

/**
 * Raw reference string in one of the supported formats:
 * - Internal: "#/path/to/value"
 * - External: "manifest://{type}/{id}@{version}#{path}"
 */
export type ManifestReference = string;

/**
 * Manifest identifier - must be a valid, non-empty string
 */
export type ManifestId = string;

/**
 * Content-addressable hash for manifest versioning
 * Format: "sha256:{64-character-hex-string}"
 */
export type ContentHash = string;

/**
 * Semantic version string
 * Format: "MAJOR.MINOR.PATCH" (e.g., "1.0.0")
 */
export type SemanticVersion = string;

/**
 * Manifest type identifier
 */
export type ManifestType =
  | 'organization'
  | 'team'
  | 'role'
  | 'capability'
  | 'policy';

// =============================================================================
// Resolution Error Types
// =============================================================================

/**
 * Error codes for reference resolution failures.
 * Each code represents a specific failure mode with deterministic behavior.
 */
export type ResolutionErrorCode =
  | 'INVALID_REFERENCE_FORMAT'
  | 'PATH_NOT_FOUND'
  | 'PATH_TYPE_MISMATCH'
  | 'ARRAY_INDEX_OUT_OF_BOUNDS'
  | 'VERSION_REQUIRED'
  | 'EXTERNAL_MANIFEST_NOT_FOUND'
  | 'BROKEN_INTERNAL_REFERENCE'
  | 'INVALID_MANIFEST_ID'
  | 'INVALID_MANIFEST_TYPE';

/**
 * Immutable resolution error structure
 */
export interface ResolutionError {
  readonly code: ResolutionErrorCode;
  readonly reference: ManifestReference;
  readonly message: string;
}

// =============================================================================
// Traversal Types
// =============================================================================

/**
 * Error codes specific to path traversal operations
 */
export type TraversalErrorCode =
  | 'PATH_NOT_FOUND'
  | 'PATH_TYPE_MISMATCH'
  | 'ARRAY_INDEX_OUT_OF_BOUNDS';

/**
 * Error details for path traversal failures
 */
export interface TraversalError {
  readonly code: TraversalErrorCode;
  readonly path: string;
  readonly message: string;
}

/**
 * Result of a path traversal operation.
 * Contains either a found value or error details.
 */
export interface TraversalResult {
  readonly found: boolean;
  readonly value: unknown | null;
  readonly traversedPath: ReadonlyArray<string>;
  readonly error?: TraversalError;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Reference type classification
 */
export type ReferenceType = 'internal' | 'external' | 'unknown';

/**
 * Result of reference format validation.
 * Valid references have type !== 'unknown' and no errors.
 */
export interface ReferenceValidationResult {
  readonly valid: boolean;
  readonly type: ReferenceType;
  readonly errors: ReadonlyArray<string>;
}

/**
 * Parsed components of an external reference.
 * Format: manifest://{type}/{id}@{version}#{path}
 */
export interface ParsedExternalRef {
  readonly type: ManifestType;
  readonly manifestId: ManifestId;
  readonly version: string;
  readonly path: string;
}

// =============================================================================
// Resolution Types
// =============================================================================

/**
 * Manifest metadata required for resolution context
 */
export interface ManifestMetadata {
  readonly id: ManifestId;
  readonly version: string;
  readonly schemaVersion: string;
  readonly contentHash: ContentHash;
}

/**
 * Immutable manifest structure used as resolution context
 */
export interface Manifest {
  readonly $manifest: ManifestMetadata;
  readonly [key: string]: unknown;
}

/**
 * Result of a successful or failed reference resolution.
 * Always contains the original reference and resolution status.
 */
export interface ResolvedReference {
  readonly reference: ManifestReference;
  readonly resolved: boolean;
  readonly value: unknown | null;
  readonly manifest: Manifest | null;
  readonly error: ResolutionError | null;
}

/**
 * Interface for reference resolution operations
 */
export interface ReferenceResolution {
  /**
   * Resolves a reference to its target value.
   * Resolution is ALWAYS deterministic:
   * - Same reference + same registry state = same result
   * - No caching that could cause inconsistency
   * - No fallback to "similar" references
   *
   * @param ref - The manifest reference to resolve
   * @returns Promise resolving to the resolution result
   */
  resolve(ref: ManifestReference): Promise<ResolvedReference>;
}

/**
 * Registry interface for looking up manifests during resolution.
 * This is a dependency injection point for the resolver.
 */
export interface ManifestRegistry {
  /**
   * Retrieves a manifest by ID and version
   * @param id - Manifest identifier
   * @param version - Specific version (required, no "latest")
   * @returns The manifest or null if not found
   */
  getManifest(id: ManifestId, version: string): Promise<Manifest | null>;

  /**
   * Retrieves a manifest by content hash
   * @param hash - Content-addressable hash
   * @returns The manifest or null if not found
   */
  getByHash(hash: ContentHash): Promise<Manifest | null>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Reference format prefixes
 */
export const REFERENCE_PREFIXES = {
  INTERNAL: '#/',
  EXTERNAL: 'manifest://',
} as const;

/**
 * Path separator characters
 */
export const PATH_SEPARATORS = {
  PATH: '/',
  VERSION: '@',
  FRAGMENT: '#',
} as const;

/**
 * Validation patterns
 */
export const VALIDATION_PATTERNS = {
  /**
   * Content hash format: sha256:{64-hex-chars}
   */
  CONTENT_HASH: /^sha256:[a-f0-9]{64}$/,

  /**
   * Semantic version format: MAJOR.MINOR.PATCH
   */
  SEMANTIC_VERSION: /^\d+\.\d+\.\d+$/,

  /**
   * Valid manifest ID: alphanumeric with hyphens
   */
  MANIFEST_ID: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,

  /**
   * Array index in path: [0], [1], etc.
   */
  ARRAY_INDEX: /^\[(\d+)\]$/,

  /**
   * Numeric-only string for array index detection
   */
  NUMERIC: /^\d+$/,
} as const;

/**
 * Valid manifest types for external references
 */
export const VALID_MANIFEST_TYPES: ReadonlyArray<ManifestType> = [
  'organization',
  'team',
  'role',
  'capability',
  'policy',
] as const;
