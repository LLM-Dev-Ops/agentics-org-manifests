/**
 * Query Types - Interface types for registry queries
 *
 * This module defines the query interface types for the manifest registry.
 * All queries are read-only and produce deterministic results.
 *
 * @module registry/types/query-types
 */

import type {
  ManifestType,
  ManifestId,
  ContentHash,
  ISODateTime,
  VersionRange,
  SemanticVersion,
  Manifest,
  ManifestReference,
  VersionInfo,
  VersionList,
  LineageChain,
  LineageVerification,
  RegistryError,
  Paginated,
} from './registry-types.js';

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Query parameters for manifest searches
 * All parameters are optional and can be combined
 */
export interface QueryParams {
  /** Filter by manifest type */
  readonly type?: ManifestType;

  /** Filter by version range (semver expression) */
  readonly version?: VersionRange;

  /** Filter manifests created after this date */
  readonly createdAfter?: ISODateTime;

  /** Filter manifests created before this date */
  readonly createdBefore?: ISODateTime;

  /** Maximum number of results to return (default: 100, max: 1000) */
  readonly limit?: number;

  /** Number of results to skip for pagination (default: 0) */
  readonly offset?: number;

  /** Field to sort results by */
  readonly orderBy?: QueryOrderField;

  /** Sort direction */
  readonly orderDirection?: 'asc' | 'desc';

  /** Filter by schema version */
  readonly schemaVersion?: SemanticVersion;

  /** Include deprecated manifests (default: false) */
  readonly includeDeprecated?: boolean;

  /** Filter by manifest IDs (exact match) */
  readonly ids?: ReadonlyArray<ManifestId>;

  /** Filter by content hashes */
  readonly hashes?: ReadonlyArray<ContentHash>;
}

/**
 * Fields that can be used for sorting query results
 */
export type QueryOrderField =
  | 'createdAt'
  | 'version'
  | 'id'
  | 'type'
  | 'schemaVersion';

// ============================================================================
// Query Results
// ============================================================================

/**
 * Query result containing matched manifests
 * Results are deterministic: same query params produce same result order
 */
export interface QueryResult {
  readonly manifests: ReadonlyArray<Manifest>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
  readonly query: QueryParams;
  readonly executedAt: ISODateTime;
  readonly executionTimeMs: number;
}

/**
 * Lightweight query result returning only references
 * Useful for large result sets where full manifests aren't needed
 */
export interface QueryReferencesResult {
  readonly references: ReadonlyArray<ManifestReference>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
  readonly query: QueryParams;
  readonly executedAt: ISODateTime;
  readonly executionTimeMs: number;
}

// ============================================================================
// Lookup Options
// ============================================================================

/**
 * Options for manifest retrieval operations
 */
export interface GetOptions {
  /** Specific version to retrieve ("latest" for most recent) */
  readonly version?: SemanticVersion | 'latest';

  /** Include full lineage chain in result */
  readonly includeLineage?: boolean;

  /** Include extended metadata */
  readonly includeMetadata?: boolean;

  /** Verify lineage integrity before returning */
  readonly verifyLineage?: boolean;
}

/**
 * Options for version listing
 */
export interface ListVersionsOptions {
  /** Include deprecated versions (default: true) */
  readonly includeDeprecated?: boolean;

  /** Maximum number of versions to return */
  readonly limit?: number;

  /** Sort order for versions */
  readonly order?: 'asc' | 'desc';
}

// ============================================================================
// Registry Interface
// ============================================================================

/**
 * Manifest Registry Interface
 *
 * Provides read-only access to the manifest registry.
 * All operations are deterministic and idempotent.
 *
 * IMPORTANT: This interface is READ-ONLY.
 * NO write operations are exposed to external systems.
 */
export interface ManifestRegistry {
  // =========================================================================
  // Lookup Operations (Read-Only)
  // =========================================================================

  /**
   * Retrieve a manifest by its unique identifier
   * @param id - Manifest identifier
   * @param options - Retrieval options
   * @returns The manifest if found, null otherwise
   */
  getById(id: ManifestId, options?: GetOptions): Promise<Manifest | null>;

  /**
   * Retrieve a manifest by its content hash
   * @param hash - Content-addressable hash
   * @returns The manifest if found, null otherwise
   */
  getByHash(hash: ContentHash): Promise<Manifest | null>;

  /**
   * Retrieve the latest version of a manifest
   * @param id - Manifest identifier
   * @returns The latest version if manifest exists, null otherwise
   */
  getLatestVersion(id: ManifestId): Promise<Manifest | null>;

  /**
   * Check if a manifest exists in the registry
   * @param id - Manifest identifier
   * @returns True if manifest exists
   */
  exists(id: ManifestId): Promise<boolean>;

  /**
   * Check if a specific hash exists in the registry
   * @param hash - Content hash to check
   * @returns True if hash exists
   */
  hashExists(hash: ContentHash): Promise<boolean>;

  // =========================================================================
  // Query Operations (Read-Only)
  // =========================================================================

  /**
   * Query manifests with filters
   * Results are deterministic: same params produce same result order
   *
   * @param params - Query parameters
   * @returns Paginated query results
   */
  query(params: QueryParams): Promise<QueryResult>;

  /**
   * Query manifest references (lightweight)
   * Returns only reference metadata without full content
   *
   * @param params - Query parameters
   * @returns Paginated reference results
   */
  queryReferences(params: QueryParams): Promise<QueryReferencesResult>;

  /**
   * List all versions of a manifest
   * @param id - Manifest identifier
   * @param options - Listing options
   * @returns Version list or null if manifest not found
   */
  listVersions(
    id: ManifestId,
    options?: ListVersionsOptions
  ): Promise<VersionList | null>;

  /**
   * Get a specific version of a manifest
   * @param id - Manifest identifier
   * @param version - Semantic version string
   * @returns The manifest version if found, null otherwise
   */
  getVersion(
    id: ManifestId,
    version: SemanticVersion
  ): Promise<Manifest | null>;

  // =========================================================================
  // Lineage Operations (Read-Only)
  // =========================================================================

  /**
   * Get the lineage chain for a manifest
   * @param hash - Content hash of the manifest
   * @returns Lineage chain or null if hash not found
   */
  getLineage(hash: ContentHash): Promise<LineageChain | null>;

  /**
   * Verify the integrity of a manifest's lineage chain
   * @param hash - Content hash of the manifest
   * @returns Verification result
   */
  verifyLineage(hash: ContentHash): Promise<LineageVerification>;

  /**
   * Get all ancestors of a manifest in the lineage chain
   * @param hash - Content hash of the manifest
   * @returns Array of ancestor manifests (oldest first)
   */
  getAncestors(hash: ContentHash): Promise<ReadonlyArray<Manifest>>;

  // =========================================================================
  // Aggregate Operations (Read-Only)
  // =========================================================================

  /**
   * Count manifests matching query parameters
   * @param params - Query parameters (limit/offset ignored)
   * @returns Total count of matching manifests
   */
  count(params?: Omit<QueryParams, 'limit' | 'offset'>): Promise<number>;

  /**
   * List all manifest types with counts
   * @returns Map of manifest types to counts
   */
  countByType(): Promise<ReadonlyMap<ManifestType, number>>;

  /**
   * List all unique manifest IDs
   * @param type - Optional filter by manifest type
   * @returns Array of manifest IDs
   */
  listIds(type?: ManifestType): Promise<ReadonlyArray<ManifestId>>;
}

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * Fluent query builder interface for constructing queries
 */
export interface QueryBuilder {
  /** Filter by manifest type */
  ofType(type: ManifestType): QueryBuilder;

  /** Filter by version range */
  withVersion(range: VersionRange): QueryBuilder;

  /** Filter by creation date range */
  createdBetween(after: ISODateTime, before: ISODateTime): QueryBuilder;

  /** Filter by creation date (after) */
  createdAfter(date: ISODateTime): QueryBuilder;

  /** Filter by creation date (before) */
  createdBefore(date: ISODateTime): QueryBuilder;

  /** Set pagination limit */
  limit(count: number): QueryBuilder;

  /** Set pagination offset */
  offset(count: number): QueryBuilder;

  /** Set sort order */
  orderBy(field: QueryOrderField, direction?: 'asc' | 'desc'): QueryBuilder;

  /** Filter by schema version */
  withSchemaVersion(version: SemanticVersion): QueryBuilder;

  /** Include deprecated manifests */
  includeDeprecated(): QueryBuilder;

  /** Filter by specific IDs */
  withIds(ids: ReadonlyArray<ManifestId>): QueryBuilder;

  /** Build the query parameters */
  build(): QueryParams;
}

// ============================================================================
// Query Validation Types
// ============================================================================

/**
 * Query validation result
 */
export interface QueryValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<QueryValidationError>;
  readonly warnings: ReadonlyArray<QueryValidationWarning>;
  readonly normalizedParams: QueryParams | undefined;
}

/**
 * Query validation error
 */
export interface QueryValidationError {
  readonly field: keyof QueryParams;
  readonly code: string;
  readonly message: string;
}

/**
 * Query validation warning
 */
export interface QueryValidationWarning {
  readonly field: keyof QueryParams;
  readonly code: string;
  readonly message: string;
  readonly suggestion?: string;
}

/**
 * Validate query parameters
 */
export function validateQueryParams(params: QueryParams): QueryValidation {
  const errors: QueryValidationError[] = [];
  const warnings: QueryValidationWarning[] = [];

  // Validate limit
  if (params.limit !== undefined) {
    if (params.limit < 1) {
      errors.push({
        field: 'limit',
        code: 'INVALID_LIMIT',
        message: 'Limit must be at least 1',
      });
    } else if (params.limit > 1000) {
      warnings.push({
        field: 'limit',
        code: 'LIMIT_TOO_HIGH',
        message: 'Limit exceeds maximum of 1000, will be capped',
        suggestion: 'Use pagination for large result sets',
      });
    }
  }

  // Validate offset
  if (params.offset !== undefined && params.offset < 0) {
    errors.push({
      field: 'offset',
      code: 'INVALID_OFFSET',
      message: 'Offset cannot be negative',
    });
  }

  // Validate date range
  if (params.createdAfter && params.createdBefore) {
    const after = new Date(params.createdAfter);
    const before = new Date(params.createdBefore);
    if (after >= before) {
      errors.push({
        field: 'createdAfter',
        code: 'INVALID_DATE_RANGE',
        message: 'createdAfter must be before createdBefore',
      });
    }
  }

  // Validate type
  if (
    params.type &&
    !['organization', 'team', 'role', 'capability', 'policy'].includes(
      params.type
    )
  ) {
    errors.push({
      field: 'type',
      code: 'INVALID_TYPE',
      message: `Invalid manifest type: ${params.type}`,
    });
  }

  // Normalize parameters
  const normalizedParams: QueryParams = {
    ...params,
    limit: Math.min(params.limit ?? 100, 1000),
    offset: Math.max(params.offset ?? 0, 0),
    orderBy: params.orderBy ?? 'createdAt',
    orderDirection: params.orderDirection ?? 'desc',
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedParams: errors.length === 0 ? normalizedParams : undefined,
  };
}

// ============================================================================
// Query Factory
// ============================================================================

/**
 * Create a new query builder instance
 */
export function createQueryBuilder(): QueryBuilder {
  let params: QueryParams = {};

  const builder: QueryBuilder = {
    ofType(type: ManifestType): QueryBuilder {
      params = { ...params, type };
      return builder;
    },

    withVersion(range: VersionRange): QueryBuilder {
      params = { ...params, version: range };
      return builder;
    },

    createdBetween(after: ISODateTime, before: ISODateTime): QueryBuilder {
      params = { ...params, createdAfter: after, createdBefore: before };
      return builder;
    },

    createdAfter(date: ISODateTime): QueryBuilder {
      params = { ...params, createdAfter: date };
      return builder;
    },

    createdBefore(date: ISODateTime): QueryBuilder {
      params = { ...params, createdBefore: date };
      return builder;
    },

    limit(count: number): QueryBuilder {
      params = { ...params, limit: count };
      return builder;
    },

    offset(count: number): QueryBuilder {
      params = { ...params, offset: count };
      return builder;
    },

    orderBy(field: QueryOrderField, direction: 'asc' | 'desc' = 'desc'): QueryBuilder {
      params = { ...params, orderBy: field, orderDirection: direction };
      return builder;
    },

    withSchemaVersion(version: SemanticVersion): QueryBuilder {
      params = { ...params, schemaVersion: version };
      return builder;
    },

    includeDeprecated(): QueryBuilder {
      params = { ...params, includeDeprecated: true };
      return builder;
    },

    withIds(ids: ReadonlyArray<ManifestId>): QueryBuilder {
      params = { ...params, ids };
      return builder;
    },

    build(): QueryParams {
      return { ...params };
    },
  };

  return builder;
}
