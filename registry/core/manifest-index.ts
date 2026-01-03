/**
 * Manifest Index - Primary index for manifest lookup and management
 *
 * This module provides the primary index for accessing manifests in the registry.
 * The index is loaded from storage and provides efficient lookup operations.
 *
 * All operations are READ-ONLY. The index is immutable once loaded.
 *
 * @module registry/core/manifest-index
 */

import type {
  ManifestId,
  ManifestType,
  ContentHash,
  ManifestReference,
  SemanticVersion,
  ISODateTime,
} from '../types/registry-types.js';
import type { StorageAdapter, ManifestIndex as StorageIndex } from '../storage/storage-adapter.js';

// ============================================================================
// Manifest Index Interface
// ============================================================================

/**
 * Primary manifest index interface
 *
 * Provides efficient lookup operations for manifests.
 * All operations are O(1) or O(log n) complexity.
 *
 * The index is IMMUTABLE - once created, it cannot be modified.
 */
export interface ManifestIndex {
  /** Read-only map of all manifests by ID */
  readonly manifests: ReadonlyMap<ManifestId, ManifestReference>;

  /** Index version */
  readonly version: string;

  /** Last update timestamp */
  readonly lastUpdated: ISODateTime;

  /**
   * Get a manifest reference by ID
   * @param id - Manifest identifier
   * @returns ManifestReference if found, null otherwise
   */
  getById(id: ManifestId): ManifestReference | null;

  /**
   * Get a manifest reference by content hash
   * @param hash - Content hash
   * @returns ManifestReference if found, null otherwise
   */
  getByHash(hash: ContentHash): ManifestReference | null;

  /**
   * Check if a manifest exists in the index
   * @param id - Manifest identifier
   * @returns True if manifest exists
   */
  has(id: ManifestId): boolean;

  /**
   * Check if a hash exists in the index
   * @param hash - Content hash
   * @returns True if hash exists
   */
  hasHash(hash: ContentHash): boolean;

  /**
   * List all manifest references
   * @returns Array of all manifest references (sorted by ID)
   */
  list(): ReadonlyArray<ManifestReference>;

  /**
   * List manifests by type
   * @param type - Manifest type
   * @returns Array of manifest references of the specified type
   */
  listByType(type: ManifestType): ReadonlyArray<ManifestReference>;

  /**
   * Get all manifest IDs
   * @returns Array of all manifest IDs
   */
  getIds(): ReadonlyArray<ManifestId>;

  /**
   * Get all manifest IDs of a specific type
   * @param type - Manifest type
   * @returns Array of manifest IDs
   */
  getIdsByType(type: ManifestType): ReadonlyArray<ManifestId>;

  /**
   * Get count of manifests
   * @param type - Optional type filter
   * @returns Count of manifests
   */
  count(type?: ManifestType): number;

  /**
   * Search manifests by criteria
   * @param criteria - Search criteria
   * @returns Matching manifest references
   */
  search(criteria: IndexSearchCriteria): ReadonlyArray<ManifestReference>;
}

/**
 * Index search criteria
 */
export interface IndexSearchCriteria {
  /** Filter by type */
  readonly type?: ManifestType;

  /** Filter by ID prefix */
  readonly idPrefix?: string;

  /** Filter by schema version */
  readonly schemaVersion?: SemanticVersion;

  /** Filter by creation date (after) */
  readonly createdAfter?: ISODateTime;

  /** Filter by creation date (before) */
  readonly createdBefore?: ISODateTime;

  /** Maximum results */
  readonly limit?: number;
}

// ============================================================================
// Manifest Index Implementation
// ============================================================================

/**
 * Create a manifest index from storage
 *
 * @param storageIndex - Raw index from storage
 * @returns Immutable manifest index
 */
export function createManifestIndex(storageIndex: StorageIndex): ManifestIndex {
  // Create internal indexes for efficient lookups
  const byId = new Map<ManifestId, ManifestReference>(storageIndex.manifests);
  const byHash = new Map<ContentHash, ManifestReference>();
  const byType = new Map<ManifestType, ManifestReference[]>();

  // Build secondary indexes
  for (const [, ref] of byId) {
    // Hash index - map latest hash to reference
    byHash.set(ref.latestHash, ref);

    // Also index all version hashes (if we had full version history)
    // For now, only latest hash is indexed

    // Type index
    const typeRefs = byType.get(ref.type) || [];
    typeRefs.push(ref);
    byType.set(ref.type, typeRefs);
  }

  // Sort type indexes by ID for deterministic ordering
  for (const [type, refs] of byType) {
    refs.sort((a, b) => a.id.localeCompare(b.id));
    byType.set(type, refs);
  }

  // Create sorted list for deterministic iteration
  const sortedList: ManifestReference[] = Array.from(byId.values()).sort(
    (a, b) => a.id.localeCompare(b.id)
  );

  const sortedIds: ManifestId[] = sortedList.map((ref) => ref.id);

  const index: ManifestIndex = {
    manifests: byId,
    version: storageIndex.version,
    lastUpdated: storageIndex.lastUpdated,

    getById(id: ManifestId): ManifestReference | null {
      return byId.get(id) ?? null;
    },

    getByHash(hash: ContentHash): ManifestReference | null {
      return byHash.get(hash) ?? null;
    },

    has(id: ManifestId): boolean {
      return byId.has(id);
    },

    hasHash(hash: ContentHash): boolean {
      return byHash.has(hash);
    },

    list(): ReadonlyArray<ManifestReference> {
      return sortedList;
    },

    listByType(type: ManifestType): ReadonlyArray<ManifestReference> {
      return byType.get(type) ?? [];
    },

    getIds(): ReadonlyArray<ManifestId> {
      return sortedIds;
    },

    getIdsByType(type: ManifestType): ReadonlyArray<ManifestId> {
      const refs = byType.get(type) ?? [];
      return refs.map((ref) => ref.id);
    },

    count(type?: ManifestType): number {
      if (type) {
        return byType.get(type)?.length ?? 0;
      }
      return byId.size;
    },

    search(criteria: IndexSearchCriteria): ReadonlyArray<ManifestReference> {
      let results: ManifestReference[] = criteria.type
        ? [...(byType.get(criteria.type) ?? [])]
        : [...sortedList];

      // Filter by ID prefix
      if (criteria.idPrefix) {
        const prefix = criteria.idPrefix.toLowerCase();
        results = results.filter((ref) =>
          ref.id.toLowerCase().startsWith(prefix)
        );
      }

      // Filter by schema version
      if (criteria.schemaVersion) {
        results = results.filter(
          (ref) => ref.schemaVersion === criteria.schemaVersion
        );
      }

      // Filter by creation date
      if (criteria.createdAfter) {
        const afterDate = new Date(criteria.createdAfter);
        results = results.filter(
          (ref) => new Date(ref.createdAt) >= afterDate
        );
      }

      if (criteria.createdBefore) {
        const beforeDate = new Date(criteria.createdBefore);
        results = results.filter(
          (ref) => new Date(ref.createdAt) < beforeDate
        );
      }

      // Apply limit
      if (criteria.limit && results.length > criteria.limit) {
        results = results.slice(0, criteria.limit);
      }

      return results;
    },
  };

  return index;
}

// ============================================================================
// Index Factory
// ============================================================================

/**
 * Load manifest index from storage adapter
 *
 * @param storage - Storage adapter to read from
 * @returns Promise resolving to manifest index
 */
export async function loadManifestIndex(
  storage: StorageAdapter
): Promise<ManifestIndex> {
  const storageIndex = await storage.readIndex();
  return createManifestIndex(storageIndex);
}

/**
 * Create an empty manifest index
 * Useful for testing or when no manifests exist
 */
export function createEmptyIndex(): ManifestIndex {
  return createManifestIndex({
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    manifests: new Map(),
    hashIndex: new Map(),
    typeIndex: new Map(),
  });
}

// ============================================================================
// Index Statistics
// ============================================================================

/**
 * Index statistics
 */
export interface IndexStats {
  readonly totalManifests: number;
  readonly byType: ReadonlyMap<ManifestType, number>;
  readonly oldestManifest: ISODateTime | null;
  readonly newestManifest: ISODateTime | null;
  readonly uniqueSchemaVersions: ReadonlyArray<SemanticVersion>;
}

/**
 * Calculate statistics for an index
 */
export function calculateIndexStats(index: ManifestIndex): IndexStats {
  const manifests = index.list();

  const byType = new Map<ManifestType, number>();
  const schemaVersions = new Set<SemanticVersion>();
  let oldest: ISODateTime | null = null;
  let newest: ISODateTime | null = null;

  for (const ref of manifests) {
    // Count by type
    byType.set(ref.type, (byType.get(ref.type) ?? 0) + 1);

    // Collect schema versions
    schemaVersions.add(ref.schemaVersion);

    // Track date range
    if (!oldest || ref.createdAt < oldest) {
      oldest = ref.createdAt;
    }
    if (!newest || ref.createdAt > newest) {
      newest = ref.createdAt;
    }
  }

  return {
    totalManifests: manifests.length,
    byType,
    oldestManifest: oldest,
    newestManifest: newest,
    uniqueSchemaVersions: Array.from(schemaVersions).sort(),
  };
}

// ============================================================================
// Manifest Reference Builder
// ============================================================================

/**
 * Builder for creating ManifestReference objects
 * Used primarily for testing and manifest import
 */
export interface ManifestReferenceBuilder {
  id(id: ManifestId): ManifestReferenceBuilder;
  type(type: ManifestType): ManifestReferenceBuilder;
  path(path: string): ManifestReferenceBuilder;
  versions(versions: SemanticVersion[]): ManifestReferenceBuilder;
  schemaVersion(version: SemanticVersion): ManifestReferenceBuilder;
  latestHash(hash: ContentHash): ManifestReferenceBuilder;
  createdAt(date: ISODateTime): ManifestReferenceBuilder;
  updatedAt(date: ISODateTime): ManifestReferenceBuilder;
  build(): ManifestReference;
}

/**
 * Create a manifest reference builder
 */
export function createManifestReferenceBuilder(): ManifestReferenceBuilder {
  let ref: Partial<ManifestReference> = {};

  const builder: ManifestReferenceBuilder = {
    id(id: ManifestId) {
      ref = { ...ref, id };
      return builder;
    },
    type(type: ManifestType) {
      ref = { ...ref, type };
      return builder;
    },
    path(path: string) {
      ref = { ...ref, path };
      return builder;
    },
    versions(versions: SemanticVersion[]) {
      ref = { ...ref, versions };
      return builder;
    },
    schemaVersion(version: SemanticVersion) {
      ref = { ...ref, schemaVersion: version };
      return builder;
    },
    latestHash(hash: ContentHash) {
      ref = { ...ref, latestHash: hash };
      return builder;
    },
    createdAt(date: ISODateTime) {
      ref = { ...ref, createdAt: date };
      return builder;
    },
    updatedAt(date: ISODateTime) {
      ref = { ...ref, updatedAt: date };
      return builder;
    },
    build(): ManifestReference {
      if (!ref.id || !ref.type || !ref.path || !ref.latestHash) {
        throw new Error(
          'ManifestReference requires id, type, path, and latestHash'
        );
      }

      const now = new Date().toISOString();

      return {
        id: ref.id,
        type: ref.type,
        path: ref.path,
        versions: ref.versions ?? ['1.0.0'],
        schemaVersion: ref.schemaVersion ?? '1.0.0',
        latestHash: ref.latestHash,
        createdAt: ref.createdAt ?? now,
        updatedAt: ref.updatedAt ?? now,
      };
    },
  };

  return builder;
}
