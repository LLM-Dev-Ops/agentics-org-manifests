/**
 * Query Engine - Read-only query interface for the manifest registry
 *
 * This module provides the primary query interface for accessing manifests.
 * All operations are READ-ONLY and produce deterministic results.
 *
 * IMPORTANT: This interface exposes NO write operations.
 * All mutations happen through the import pipeline, not through queries.
 *
 * @module registry/core/query-engine
 */

import type {
  ManifestId,
  ManifestType,
  ContentHash,
  SemanticVersion,
  ISODateTime,
  Manifest,
  ManifestReference,
  VersionList,
  LineageChain,
  LineageVerification,
  LineageError,
} from '../types/registry-types.js';
import type {
  QueryParams,
  QueryResult,
  QueryReferencesResult,
  GetOptions,
  ListVersionsOptions,
  ManifestRegistry,
} from '../types/query-types.js';
import { validateQueryParams } from '../types/query-types.js';
import type { ManifestIndex } from './manifest-index.js';
import type { VersionCatalog } from './version-catalog.js';
import type { StorageAdapter } from '../storage/storage-adapter.js';
import { getManifestPath } from '../storage/storage-adapter.js';

// ============================================================================
// Query Engine Implementation
// ============================================================================

/**
 * Create a query engine instance
 *
 * The query engine provides the implementation of the ManifestRegistry interface.
 * All operations are read-only and produce deterministic results.
 *
 * @param index - Manifest index for lookups
 * @param versionCatalog - Version catalog for version operations
 * @param storage - Storage adapter for reading manifests
 * @returns ManifestRegistry implementation
 */
export function createQueryEngine(
  index: ManifestIndex,
  versionCatalog: VersionCatalog,
  storage: StorageAdapter
): ManifestRegistry {
  /**
   * Read a manifest from storage by its reference
   */
  async function readManifest(ref: ManifestReference, version?: SemanticVersion): Promise<Manifest | null> {
    const manifestPath = getManifestPath(ref.type, ref.id, version);
    return storage.readManifest(manifestPath);
  }

  /**
   * Build lineage chain from manifest
   */
  function buildLineageChain(manifest: Manifest): LineageChain {
    const lineage = manifest.lineage || [];
    const depth = lineage.length;
    const firstHash = lineage[0];
    const lastHash = lineage[lineage.length - 1];
    const root: ContentHash = depth > 0 && firstHash !== undefined ? firstHash : manifest.hash;
    const parent: ContentHash | null = depth > 0 && lastHash !== undefined ? lastHash : null;

    return {
      root,
      parent,
      current: manifest.hash,
      depth,
      branchId: null,
      chain: [...lineage, manifest.hash],
    };
  }

  /**
   * Apply query filters to manifest references
   */
  function applyFilters(
    refs: ReadonlyArray<ManifestReference>,
    params: QueryParams
  ): ManifestReference[] {
    let result = [...refs];

    // Filter by type
    if (params.type) {
      result = result.filter((ref) => ref.type === params.type);
    }

    // Filter by version range
    if (params.version) {
      result = result.filter((ref) =>
        ref.versions.some((v: SemanticVersion) => versionCatalog.satisfiesRange(v, params.version!))
      );
    }

    // Filter by creation date
    if (params.createdAfter) {
      const afterDate = new Date(params.createdAfter);
      result = result.filter((ref) => new Date(ref.createdAt) >= afterDate);
    }

    if (params.createdBefore) {
      const beforeDate = new Date(params.createdBefore);
      result = result.filter((ref) => new Date(ref.createdAt) < beforeDate);
    }

    // Filter by schema version
    if (params.schemaVersion) {
      result = result.filter((ref) => ref.schemaVersion === params.schemaVersion);
    }

    // Filter by specific IDs
    if (params.ids && params.ids.length > 0) {
      const idSet = new Set(params.ids);
      result = result.filter((ref) => idSet.has(ref.id));
    }

    // Filter by hashes
    if (params.hashes && params.hashes.length > 0) {
      const hashSet = new Set(params.hashes);
      result = result.filter((ref) => hashSet.has(ref.latestHash));
    }

    return result;
  }

  /**
   * Sort manifest references by specified field
   */
  function sortRefs(
    refs: ManifestReference[],
    orderBy: string = 'createdAt',
    direction: 'asc' | 'desc' = 'desc'
  ): ManifestReference[] {
    const sorted = [...refs];

    sorted.sort((a, b) => {
      let cmp = 0;

      switch (orderBy) {
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'version':
          cmp = versionCatalog.compareVersions(
            a.versions[a.versions.length - 1] || '0.0.0',
            b.versions[b.versions.length - 1] || '0.0.0'
          );
          break;
        case 'id':
          cmp = a.id.localeCompare(b.id);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'schemaVersion':
          cmp = versionCatalog.compareVersions(a.schemaVersion, b.schemaVersion);
          break;
        default:
          cmp = a.createdAt.localeCompare(b.createdAt);
      }

      return direction === 'desc' ? -cmp : cmp;
    });

    return sorted;
  }

  /**
   * Apply pagination to results
   */
  function paginate<T>(
    items: ReadonlyArray<T>,
    limit: number,
    offset: number
  ): { items: T[]; hasMore: boolean } {
    const start = offset;
    const end = offset + limit;
    const paginatedItems = items.slice(start, end);
    const hasMore = end < items.length;

    return { items: paginatedItems as T[], hasMore };
  }

  const registry: ManifestRegistry = {
    // =========================================================================
    // Lookup Operations
    // =========================================================================

    async getById(id: ManifestId, options?: GetOptions): Promise<Manifest | null> {
      const ref = index.getById(id);
      if (!ref) {
        return null;
      }

      const version = options?.version === 'latest' ? undefined : options?.version;
      const manifest = await readManifest(ref, version);

      if (!manifest) {
        return null;
      }

      // Verify lineage if requested
      if (options?.verifyLineage) {
        const verification = await registry.verifyLineage(manifest.hash);
        if (!verification.valid) {
          // Return null if lineage is invalid? Or include verification result?
          // For now, we still return the manifest but could add a flag
        }
      }

      return manifest;
    },

    async getByHash(hash: ContentHash): Promise<Manifest | null> {
      const ref = index.getByHash(hash);
      if (!ref) {
        return null;
      }

      return readManifest(ref);
    },

    async getLatestVersion(id: ManifestId): Promise<Manifest | null> {
      return registry.getById(id, { version: 'latest' });
    },

    async exists(id: ManifestId): Promise<boolean> {
      return index.has(id);
    },

    async hashExists(hash: ContentHash): Promise<boolean> {
      return index.hasHash(hash);
    },

    // =========================================================================
    // Query Operations
    // =========================================================================

    async query(params: QueryParams): Promise<QueryResult> {
      const startTime = Date.now();

      // Validate and normalize parameters
      const validation = validateQueryParams(params);
      const normalizedParams = validation.normalizedParams || {
        ...params,
        limit: Math.min(params.limit ?? 100, 1000),
        offset: Math.max(params.offset ?? 0, 0),
        orderBy: params.orderBy ?? 'createdAt',
        orderDirection: params.orderDirection ?? 'desc',
      };

      // Get all references
      const allRefs = index.list();

      // Apply filters
      const filteredRefs = applyFilters(allRefs, normalizedParams);

      // Sort results
      const sortedRefs = sortRefs(
        filteredRefs,
        normalizedParams.orderBy,
        normalizedParams.orderDirection
      );

      // Apply pagination
      const { items: paginatedRefs, hasMore } = paginate(
        sortedRefs,
        normalizedParams.limit!,
        normalizedParams.offset!
      );

      // Load full manifests
      const manifests: Manifest[] = [];
      for (const ref of paginatedRefs) {
        const manifest = await readManifest(ref);
        if (manifest) {
          manifests.push(manifest);
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        manifests,
        total: filteredRefs.length,
        limit: normalizedParams.limit!,
        offset: normalizedParams.offset!,
        hasMore,
        query: normalizedParams,
        executedAt: new Date().toISOString(),
        executionTimeMs: executionTime,
      };
    },

    async queryReferences(params: QueryParams): Promise<QueryReferencesResult> {
      const startTime = Date.now();

      // Validate and normalize parameters
      const validation = validateQueryParams(params);
      const normalizedParams = validation.normalizedParams || {
        ...params,
        limit: Math.min(params.limit ?? 100, 1000),
        offset: Math.max(params.offset ?? 0, 0),
        orderBy: params.orderBy ?? 'createdAt',
        orderDirection: params.orderDirection ?? 'desc',
      };

      // Get all references
      const allRefs = index.list();

      // Apply filters
      const filteredRefs = applyFilters(allRefs, normalizedParams);

      // Sort results
      const sortedRefs = sortRefs(
        filteredRefs,
        normalizedParams.orderBy,
        normalizedParams.orderDirection
      );

      // Apply pagination
      const { items: paginatedRefs, hasMore } = paginate(
        sortedRefs,
        normalizedParams.limit!,
        normalizedParams.offset!
      );

      const executionTime = Date.now() - startTime;

      return {
        references: paginatedRefs,
        total: filteredRefs.length,
        limit: normalizedParams.limit!,
        offset: normalizedParams.offset!,
        hasMore,
        query: normalizedParams,
        executedAt: new Date().toISOString(),
        executionTimeMs: executionTime,
      };
    },

    async listVersions(
      id: ManifestId,
      options?: ListVersionsOptions
    ): Promise<VersionList | null> {
      const versionList = versionCatalog.getVersionList(id);
      if (!versionList) {
        return null;
      }

      let versions = [...versionList.versions];

      // Filter deprecated if requested
      if (options?.includeDeprecated === false) {
        versions = versions.filter((v) => !v.deprecated);
      }

      // Apply limit
      if (options?.limit && versions.length > options.limit) {
        versions = versions.slice(0, options.limit);
      }

      // Apply sort order
      if (options?.order === 'asc') {
        versions.reverse();
      }

      return {
        ...versionList,
        versions,
        totalCount: versions.length,
      };
    },

    async getVersion(
      id: ManifestId,
      version: SemanticVersion
    ): Promise<Manifest | null> {
      const ref = index.getById(id);
      if (!ref) {
        return null;
      }

      // Check if version exists
      if (!ref.versions.includes(version)) {
        return null;
      }

      return readManifest(ref, version);
    },

    // =========================================================================
    // Lineage Operations
    // =========================================================================

    async getLineage(hash: ContentHash): Promise<LineageChain | null> {
      const ref = index.getByHash(hash);
      if (!ref) {
        return null;
      }

      const manifest = await readManifest(ref);
      if (!manifest) {
        return null;
      }

      return buildLineageChain(manifest);
    },

    async verifyLineage(hash: ContentHash): Promise<LineageVerification> {
      const now = new Date().toISOString();
      const errors: LineageError[] = [];

      const ref = index.getByHash(hash);
      if (!ref) {
        return {
          valid: false,
          manifestId: '' as ManifestId,
          hash,
          chainLength: 0,
          errors: [{
            code: 'HASH_NOT_FOUND',
            message: `Hash ${hash} not found in registry`,
            position: 0,
            expectedHash: hash,
            actualHash: undefined,
          }],
          verifiedAt: now,
        };
      }

      const manifest = await readManifest(ref);
      if (!manifest) {
        return {
          valid: false,
          manifestId: ref.id,
          hash,
          chainLength: 0,
          errors: [{
            code: 'MANIFEST_NOT_FOUND',
            message: `Manifest ${ref.id} could not be read`,
            position: 0,
            expectedHash: hash,
            actualHash: undefined,
          }],
          verifiedAt: now,
        };
      }

      const lineage = manifest.lineage || [];

      // Verify each hash in the lineage exists
      for (let i = 0; i < lineage.length; i++) {
        const ancestorHash = lineage[i];
        if (ancestorHash === undefined) {
          continue;
        }
        const ancestorExists = index.hasHash(ancestorHash);

        if (!ancestorExists) {
          errors.push({
            code: 'MISSING_ANCESTOR',
            message: `Ancestor hash at position ${i} not found`,
            position: i,
            expectedHash: ancestorHash,
            actualHash: undefined,
          });
        }
      }

      // Verify the current hash matches
      if (manifest.hash !== hash) {
        errors.push({
          code: 'HASH_MISMATCH',
          message: 'Manifest hash does not match requested hash',
          position: lineage.length,
          expectedHash: hash,
          actualHash: manifest.hash as ContentHash,
        });
      }

      return {
        valid: errors.length === 0,
        manifestId: ref.id,
        hash,
        chainLength: lineage.length + 1,
        errors,
        verifiedAt: now,
      };
    },

    async getAncestors(hash: ContentHash): Promise<ReadonlyArray<Manifest>> {
      const lineage = await registry.getLineage(hash);
      if (!lineage) {
        return [];
      }

      const ancestors: Manifest[] = [];

      // Load all ancestors (excluding current)
      for (const ancestorHash of lineage.chain.slice(0, -1)) {
        const ancestorRef = index.getByHash(ancestorHash);
        if (ancestorRef) {
          const ancestor = await readManifest(ancestorRef);
          if (ancestor) {
            ancestors.push(ancestor);
          }
        }
      }

      return ancestors;
    },

    // =========================================================================
    // Aggregate Operations
    // =========================================================================

    async count(params?: Omit<QueryParams, 'limit' | 'offset'>): Promise<number> {
      if (!params) {
        return index.count();
      }

      const allRefs = index.list();
      const filteredRefs = applyFilters(allRefs, params);
      return filteredRefs.length;
    },

    async countByType(): Promise<ReadonlyMap<ManifestType, number>> {
      const counts = new Map<ManifestType, number>();
      const types: ManifestType[] = ['organization', 'team', 'role', 'capability', 'policy'];

      for (const type of types) {
        counts.set(type, index.count(type));
      }

      return counts;
    },

    async listIds(type?: ManifestType): Promise<ReadonlyArray<ManifestId>> {
      if (type) {
        return index.getIdsByType(type);
      }
      return index.getIds();
    },
  };

  return registry;
}

// ============================================================================
// Query Engine Factory
// ============================================================================

/**
 * Configuration for creating a query engine
 */
export interface QueryEngineConfig {
  /** Manifest index */
  readonly index: ManifestIndex;
  /** Version catalog */
  readonly versionCatalog: VersionCatalog;
  /** Storage adapter */
  readonly storage: StorageAdapter;
}

/**
 * Create a query engine from configuration
 */
export function createQueryEngineFromConfig(
  config: QueryEngineConfig
): ManifestRegistry {
  return createQueryEngine(config.index, config.versionCatalog, config.storage);
}

// ============================================================================
// Query Utilities
// ============================================================================

/**
 * Create a query for all manifests of a specific type
 */
export function queryByType(type: ManifestType): QueryParams {
  return { type };
}

/**
 * Create a query for manifests created in a date range
 */
export function queryByDateRange(
  after: ISODateTime,
  before: ISODateTime
): QueryParams {
  return { createdAfter: after, createdBefore: before };
}

/**
 * Create a query for specific manifest IDs
 */
export function queryByIds(ids: ManifestId[]): QueryParams {
  return { ids };
}

/**
 * Create a paginated query
 */
export function paginatedQuery(
  limit: number,
  offset: number,
  params?: QueryParams
): QueryParams {
  return { ...params, limit, offset };
}
