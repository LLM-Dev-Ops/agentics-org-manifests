/**
 * Registry Module - Public API for the Manifest Registry
 *
 * This module provides the public interface for accessing the manifest registry.
 * All operations are READ-ONLY. The registry serves as the indexed access layer
 * for organizational truth manifests.
 *
 * @module registry
 *
 * @example
 * ```typescript
 * import { createRegistry, createQueryBuilder } from './registry';
 *
 * // Create registry instance
 * const registry = await createRegistry('/path/to/repo');
 *
 * // Query manifests
 * const query = createQueryBuilder()
 *   .ofType('organization')
 *   .limit(10)
 *   .build();
 *
 * const result = await registry.query(query);
 * console.log(`Found ${result.total} organizations`);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

// Core registry types
export type {
  ManifestType,
  ManifestId,
  ContentHash,
  ISODateTime,
  VersionRange,
  SemanticVersion,
  ManifestMetadata,
  Manifest,
  ManifestReference,
  LineageChain,
  LineageVerification,
  LineageError,
  VersionInfo,
  VersionList,
  RegistryStats,
  RegistryHealth,
  HealthCheck,
  RegistryError,
  RegistryErrorCode,
  Result,
  Paginated,
} from './types/registry-types.js';

// Type guards and utilities
export {
  isManifestType,
  isContentHash,
  isSemanticVersion,
  isISODateTime,
  success,
  failure,
} from './types/registry-types.js';

// Query types
export type {
  QueryParams,
  QueryOrderField,
  QueryResult,
  QueryReferencesResult,
  GetOptions,
  ListVersionsOptions,
  ManifestRegistry,
  QueryBuilder,
  QueryValidation,
  QueryValidationError,
  QueryValidationWarning,
} from './types/query-types.js';

// Query utilities
export {
  validateQueryParams,
  createQueryBuilder,
} from './types/query-types.js';

// ============================================================================
// Core Module Exports
// ============================================================================

// Manifest index
export type {
  ManifestIndex,
  IndexSearchCriteria,
  IndexStats,
  ManifestReferenceBuilder,
} from './core/manifest-index.js';

export {
  createManifestIndex,
  loadManifestIndex,
  createEmptyIndex,
  calculateIndexStats,
  createManifestReferenceBuilder,
} from './core/manifest-index.js';

// Version catalog
export type {
  VersionCatalog,
  ParsedVersion,
} from './core/version-catalog.js';

export {
  createVersionCatalog,
  parseSemanticVersion,
  compareSemanticVersions,
  versionSatisfiesRange,
  bumpVersion,
  isValidSemanticVersion,
  sortVersionsDescending,
  sortVersionsAscending,
  findBestVersion,
} from './core/version-catalog.js';

// Query engine
export type {
  QueryEngineConfig,
} from './core/query-engine.js';

export {
  createQueryEngine,
  createQueryEngineFromConfig,
  queryByType,
  queryByDateRange,
  queryByIds,
  paginatedQuery,
} from './core/query-engine.js';

// ============================================================================
// Storage Exports
// ============================================================================

export type {
  StorageConfig,
  StorageAdapter,
  ManifestIndex as StorageManifestIndex,
  FileStats,
  StorageUsage,
  StorageErrorCode,
} from './storage/storage-adapter.js';

export {
  DEFAULT_STORAGE_CONFIG,
  StorageError,
  createStorageAdapter,
  getManifestPath,
  parseManifestPath,
  createDefaultStorageAdapter,
} from './storage/storage-adapter.js';

// ============================================================================
// Factory Functions
// ============================================================================

import { createDefaultStorageAdapter } from './storage/storage-adapter.js';
import { loadManifestIndex } from './core/manifest-index.js';
import { createVersionCatalog } from './core/version-catalog.js';
import { createQueryEngine } from './core/query-engine.js';
import type { ManifestRegistry } from './types/query-types.js';
import type { ManifestIndex } from './core/manifest-index.js';
import type { VersionCatalog } from './core/version-catalog.js';
import type { StorageAdapter } from './storage/storage-adapter.js';

/**
 * Registry instance containing all components
 */
export interface Registry {
  /** Storage adapter for file access */
  readonly storage: StorageAdapter;
  /** Manifest index for lookups */
  readonly index: ManifestIndex;
  /** Version catalog for version management */
  readonly versions: VersionCatalog;
  /** Query interface (ManifestRegistry implementation) */
  readonly query: ManifestRegistry;
}

/**
 * Registry configuration options
 */
export interface RegistryOptions {
  /** Base path to the repository root */
  readonly repositoryRoot?: string;
  /** Custom storage adapter (overrides repositoryRoot) */
  readonly storage?: StorageAdapter;
}

/**
 * Create a complete registry instance
 *
 * This is the main entry point for creating a registry.
 * It initializes all components and returns a complete registry object.
 *
 * @param options - Registry configuration options
 * @returns Promise resolving to Registry instance
 *
 * @example
 * ```typescript
 * // Create registry with default paths
 * const registry = await createRegistry();
 *
 * // Create registry with custom repository root
 * const registry = await createRegistry({
 *   repositoryRoot: '/path/to/agentics-org-manifests'
 * });
 *
 * // Use the registry
 * const manifest = await registry.query.getById('org-001');
 * const versions = await registry.versions.listVersions('org-001');
 * ```
 */
export async function createRegistry(options: RegistryOptions = {}): Promise<Registry> {
  // Create or use provided storage adapter
  const storage = options.storage ?? createDefaultStorageAdapter(
    options.repositoryRoot ?? process.cwd()
  );

  // Load the manifest index
  const index = await loadManifestIndex(storage);

  // Create version catalog
  const versions = createVersionCatalog(index, storage);

  // Create query engine
  const query = createQueryEngine(index, versions, storage);

  return {
    storage,
    index,
    versions,
    query,
  };
}

/**
 * Create a registry with synchronous initialization
 *
 * Use this when you need to create a registry synchronously,
 * typically for testing or when the index is pre-loaded.
 *
 * @param storage - Storage adapter
 * @param index - Pre-loaded manifest index
 * @returns Registry instance
 */
export function createRegistrySync(
  storage: StorageAdapter,
  index: ManifestIndex
): Registry {
  const versions = createVersionCatalog(index, storage);
  const query = createQueryEngine(index, versions, storage);

  return {
    storage,
    index,
    versions,
    query,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

import type { Manifest } from './types/registry-types.js';
import type { QueryParams, QueryResult } from './types/query-types.js';

/**
 * Quick lookup of a manifest by ID
 *
 * Creates a temporary registry and retrieves the manifest.
 * For multiple lookups, create a registry instance instead.
 *
 * @param id - Manifest identifier
 * @param options - Registry options
 * @returns Promise resolving to Manifest or null
 */
export async function getManifest(
  id: string,
  options: RegistryOptions = {}
): Promise<Manifest | null> {
  const registry = await createRegistry(options);
  return registry.query.getById(id);
}

/**
 * Quick query of manifests
 *
 * Creates a temporary registry and executes the query.
 * For multiple queries, create a registry instance instead.
 *
 * @param params - Query parameters
 * @param options - Registry options
 * @returns Promise resolving to QueryResult
 */
export async function queryManifests(
  params: QueryParams,
  options: RegistryOptions = {}
): Promise<QueryResult> {
  const registry = await createRegistry(options);
  return registry.query.query(params);
}

/**
 * Check if a manifest exists
 *
 * @param id - Manifest identifier
 * @param options - Registry options
 * @returns Promise resolving to boolean
 */
export async function manifestExists(
  id: string,
  options: RegistryOptions = {}
): Promise<boolean> {
  const registry = await createRegistry(options);
  return registry.query.exists(id);
}

// ============================================================================
// Module Information
// ============================================================================

/**
 * Registry module version
 */
export const REGISTRY_VERSION = '1.0.0';

/**
 * Registry module metadata
 */
export const REGISTRY_INFO = {
  name: 'agentics-org-manifests/registry',
  version: REGISTRY_VERSION,
  description: 'Read-only manifest registry for organizational truth',
  author: 'Agentics',
  license: 'MIT',
} as const;
