/**
 * References Module
 *
 * Public API for manifest reference resolution.
 * Provides deterministic, reproducible cross-manifest reference resolution.
 *
 * Reference Formats:
 * - Internal: "#/path/to/value" - References within the same manifest
 * - External: "manifest://{type}/{id}@{version}#{path}" - References to other manifests
 *
 * CRITICAL GUARANTEES:
 * - Resolution is ALWAYS deterministic
 * - Same reference + same registry state = same result
 * - NO inference or guessing
 * - NO fuzzy matching
 * - NO default value injection
 * - External references MUST specify version (no "latest")
 *
 * @module references
 *
 * @example
 * // Internal reference resolution
 * import { createInternalResolver } from './references/index.js';
 *
 * const manifest = { organization: { name: "Acme Corp" } };
 * const resolver = createInternalResolver(manifest);
 * const result = await resolver.resolve("#/organization/name");
 * // result.value === "Acme Corp"
 *
 * @example
 * // External reference resolution
 * import { createExternalResolver } from './references/index.js';
 *
 * const resolver = createExternalResolver(myRegistry);
 * const result = await resolver.resolve("manifest://organization/org-001@1.0.0#/name");
 *
 * @example
 * // Reference validation
 * import { validateReference, isExternalReference } from './references/index.js';
 *
 * const validation = validateReference("manifest://org/id@1.0.0");
 * if (validation.valid) {
 *   console.log("Reference is valid");
 * }
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Primitive types
  ManifestReference,
  ManifestId,
  ContentHash,
  SemanticVersion,
  ManifestType,

  // Error types
  ResolutionErrorCode,
  ResolutionError,
  TraversalErrorCode,
  TraversalError,

  // Result types
  TraversalResult,
  ReferenceType,
  ReferenceValidationResult,
  ParsedExternalRef,

  // Manifest types
  ManifestMetadata,
  Manifest,
  ResolvedReference,

  // Interface types
  ReferenceResolution,
  ManifestRegistry,
} from './types/reference-types.js';

// =============================================================================
// Constant Exports
// =============================================================================

export {
  REFERENCE_PREFIXES,
  PATH_SEPARATORS,
  VALIDATION_PATTERNS,
  VALID_MANIFEST_TYPES,
} from './types/reference-types.js';

// =============================================================================
// Path Traversal Exports
// =============================================================================

export {
  // Path parsing
  parsePathSegments,
  isArrayIndex,
  parseArrayIndex,
  formatPath,

  // Path traversal
  traversePath,
  pathExists,
  getValueAtPath,
} from './core/path-traverser.js';

// =============================================================================
// Reference Validation Exports
// =============================================================================

export {
  // Type detection
  isInternalReference,
  isExternalReference,
  determineReferenceType,

  // Validation
  validateReference,

  // Parsing
  parseExternalReference,
  extractInternalPath,

  // Reference creation
  createInternalReference,
  createExternalReference,
} from './core/reference-validator.js';

// =============================================================================
// Reference Resolution Exports
// =============================================================================

export {
  // Resolver class
  ReferenceResolver,

  // Factory functions
  createInternalResolver,
  createExternalResolver,
  createResolver,

  // Standalone resolution functions
  resolveReference,
  resolveReferences,
  canResolve,
} from './core/reference-resolver.js';

export type { ReferenceResolverOptions } from './core/reference-resolver.js';
