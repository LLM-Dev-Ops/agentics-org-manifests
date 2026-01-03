/**
 * Registry Types - Core type definitions for the manifest registry
 *
 * This module defines the fundamental types used throughout the registry system.
 * All types are designed to be immutable and support read-only operations.
 *
 * @module registry/types/registry-types
 */

// ============================================================================
// Primitive Types
// ============================================================================

/**
 * Manifest type enumeration - defines all supported manifest categories
 */
export type ManifestType =
  | 'organization'
  | 'team'
  | 'role'
  | 'capability'
  | 'policy';

/**
 * Unique identifier for a manifest
 * Format: lowercase alphanumeric with hyphens, e.g., "org-001", "team-alpha"
 */
export type ManifestId = string;

/**
 * Content-addressable hash for manifest versioning
 * Format: "sha256:{64-character-hex-string}"
 */
export type ContentHash = `sha256:${string}`;

/**
 * ISO 8601 formatted date-time string
 * Example: "2026-01-02T12:00:00.000Z"
 */
export type ISODateTime = string;

/**
 * Semantic version range expression
 * Supports: exact ("1.0.0"), range (">=1.0.0 <2.0.0"), latest ("latest")
 */
export type VersionRange = string;

/**
 * Semantic version string
 * Format: MAJOR.MINOR.PATCH (e.g., "1.0.0", "2.1.3")
 */
export type SemanticVersion = string;

// ============================================================================
// Manifest Core Types
// ============================================================================

/**
 * Manifest metadata block - present in all manifests
 * Contains versioning, hashing, and lineage information
 */
export interface ManifestMetadata {
  readonly version: SemanticVersion;
  readonly contentHash: ContentHash;
  readonly createdAt: ISODateTime;
  readonly schemaVersion: SemanticVersion;
  readonly lineage: ReadonlyArray<ContentHash>;
}

/**
 * Core manifest structure - immutable organizational truth
 *
 * All manifests follow this structure with type-specific content
 */
export interface Manifest {
  readonly id: ManifestId;
  readonly type: ManifestType;
  readonly version: SemanticVersion;
  readonly schemaVersion: SemanticVersion;
  readonly content: Readonly<Record<string, unknown>>;
  readonly hash: ContentHash;
  readonly lineage: ReadonlyArray<ContentHash>;
  readonly createdAt: ISODateTime;
  readonly $manifest: ManifestMetadata;
}

/**
 * Lightweight manifest reference for indexing
 * Contains essential lookup information without full content
 */
export interface ManifestReference {
  readonly id: ManifestId;
  readonly type: ManifestType;
  readonly path: string;
  readonly versions: ReadonlyArray<SemanticVersion>;
  readonly schemaVersion: SemanticVersion;
  readonly latestHash: ContentHash;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

// ============================================================================
// Lineage Types
// ============================================================================

/**
 * Lineage chain structure for version tracking
 * Provides cryptographic proof of version history
 */
export interface LineageChain {
  readonly root: ContentHash;
  readonly parent: ContentHash | null;
  readonly current: ContentHash;
  readonly depth: number;
  readonly branchId: string | null;
  readonly chain: ReadonlyArray<ContentHash>;
}

/**
 * Result of lineage verification
 */
export interface LineageVerification {
  readonly valid: boolean;
  readonly manifestId: ManifestId;
  readonly hash: ContentHash;
  readonly chainLength: number;
  readonly errors: ReadonlyArray<LineageError>;
  readonly verifiedAt: ISODateTime;
}

/**
 * Lineage verification error details
 */
export interface LineageError {
  readonly code: string;
  readonly message: string;
  readonly position: number;
  readonly expectedHash: ContentHash | undefined;
  readonly actualHash: ContentHash | undefined;
}

// ============================================================================
// Version Types
// ============================================================================

/**
 * Detailed version information
 */
export interface VersionInfo {
  readonly versionId: SemanticVersion;
  readonly contentHash: ContentHash;
  readonly createdAt: ISODateTime;
  readonly schemaVersion: SemanticVersion;
  readonly parentHash: ContentHash | null;
  readonly deprecated: boolean;
  readonly deprecatedAt?: ISODateTime;
  readonly deprecationReason?: string;
}

/**
 * List of versions for a manifest
 */
export interface VersionList {
  readonly manifestId: ManifestId;
  readonly versions: ReadonlyArray<VersionInfo>;
  readonly latestVersion: SemanticVersion;
  readonly totalCount: number;
}

// ============================================================================
// Registry State Types
// ============================================================================

/**
 * Registry statistics for monitoring
 */
export interface RegistryStats {
  readonly totalManifests: number;
  readonly manifestsByType: Readonly<Record<ManifestType, number>>;
  readonly totalVersions: number;
  readonly lastUpdated: ISODateTime;
  readonly storageSize: number;
}

/**
 * Registry health check result
 */
export interface RegistryHealth {
  readonly healthy: boolean;
  readonly checks: ReadonlyArray<HealthCheck>;
  readonly checkedAt: ISODateTime;
}

/**
 * Individual health check result
 */
export interface HealthCheck {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warn';
  readonly message?: string;
  readonly duration: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Registry operation error
 */
export interface RegistryError {
  readonly code: RegistryErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: ISODateTime;
}

/**
 * Standard registry error codes
 */
export type RegistryErrorCode =
  | 'MANIFEST_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'HASH_NOT_FOUND'
  | 'INVALID_QUERY'
  | 'STORAGE_ERROR'
  | 'LINEAGE_INVALID'
  | 'SCHEMA_MISMATCH'
  | 'INTERNAL_ERROR';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid ManifestType
 */
export function isManifestType(value: string): value is ManifestType {
  return ['organization', 'team', 'role', 'capability', 'policy'].includes(value);
}

/**
 * Type guard to check if a string is a valid ContentHash
 */
export function isContentHash(value: string): value is ContentHash {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

/**
 * Type guard to check if a string is a valid SemanticVersion
 */
export function isSemanticVersion(value: string): value is SemanticVersion {
  return /^\d+\.\d+\.\d+$/.test(value);
}

/**
 * Type guard to check if a string is a valid ISODateTime
 */
export function isISODateTime(value: string): value is ISODateTime {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that may fail
 */
export type Result<T, E = RegistryError> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

/**
 * Create a success result
 */
export function success<T>(value: T): Result<T> {
  return { success: true, value };
}

/**
 * Create a failure result
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Paginated result wrapper
 */
export interface Paginated<T> {
  readonly items: ReadonlyArray<T>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}
