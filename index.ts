/**
 * agentics-org-manifests
 *
 * Single source of organizational truth for the Agentics platform.
 * Provides immutable, versioned, validated organizational manifests.
 *
 * This module owns ONLY organizational data definition and validation.
 * It does NOT own simulation, execution, orchestration, or deployment logic.
 *
 * @packageDocumentation
 */

// Export validation module (primary API)
export {
  validateManifest,
  quickValidate,
  validateManifests,
  detectManifestType,
  createValidationError,
  createSuccessResult,
  mergeValidationResults,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type StrictnessLevel,
  ValidationErrorCodes,
  ValidationWarningCodes,
} from './validation/index';

// Export versioning module
export {
  computeContentHash,
  canonicalizeContent,
  sortKeysRecursively,
  verifyContentHash,
  verifyLineageChain,
  extractLineage,
  createChildLineage,
  deepFreeze,
  enforceImmutability,
  detectMutableFields,
  createImmutableManifest,
  type ContentHash,
  type VersionId,
  type SemanticVersion,
  type VersionedManifest,
  type LineageChain,
  type LineageVerificationResult,
  type LineageBreak,
} from './versioning/index';

// Export registry module
export {
  createManifestIndex,
  createVersionCatalog,
  createQueryEngine,
  createRegistry,
  createQueryBuilder,
  type ManifestIndex,
  type ManifestReference,
  type VersionCatalog,
  type VersionInfo,
  type ManifestRegistry,
  type QueryParams,
  type QueryResult,
  type Manifest,
  type ManifestId,
} from './registry/index';

// Export references module
export {
  traversePath,
  parsePathSegments,
  isArrayIndex,
  parseArrayIndex,
  validateReference,
  isInternalReference,
  isExternalReference,
  parseExternalReference,
  createInternalReference,
  createExternalReference,
  type ResolvedReference,
  type TraversalResult,
  type TraversalError,
  type ReferenceValidationResult,
  type ParsedExternalRef,
  type ResolutionError,
  type ResolutionErrorCode,
} from './references/index';

// Export schema paths for consumers
export const SCHEMA_PATHS = {
  v1: {
    organization: './schemas/v1/organization.schema.json',
    team: './schemas/v1/team.schema.json',
    role: './schemas/v1/role.schema.json',
    capability: './schemas/v1/capability.schema.json',
    policy: './schemas/v1/policy.schema.json',
    meta: './schemas/v1/_meta.schema.json',
  },
  common: {
    primitives: './schemas/common/primitives.schema.json',
    identifiers: './schemas/common/identifiers.schema.json',
    timestamps: './schemas/common/timestamps.schema.json',
  },
  evolution: {
    compatibilityMatrix: './schemas/evolution/compatibility-matrix.json',
  },
} as const;

// Export manifest types
export const MANIFEST_TYPES = [
  'organization',
  'team',
  'role',
  'capability',
  'policy',
] as const;

export type ManifestType = (typeof MANIFEST_TYPES)[number];

// Export version constants
export const CURRENT_SCHEMA_VERSION = '1.0.0' as const;
export const MINIMUM_SUPPORTED_VERSION = '1.0.0' as const;

/**
 * Repository metadata
 */
export const REPOSITORY_INFO = {
  name: 'agentics-org-manifests',
  description: 'Immutable organizational truth manifests for Agentics platform',
  version: '1.0.0',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  owner: 'Agentics Platform Team',
} as const;
