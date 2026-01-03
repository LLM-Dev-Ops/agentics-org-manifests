/**
 * Reference Resolver Module
 *
 * Provides the core resolution logic for manifest references.
 * All resolution is DETERMINISTIC and REPRODUCIBLE.
 *
 * Reference Format: "manifest://{type}/{id}@{version}#{path}"
 * Components:
 * - type:    Manifest type (organization, team, role, etc.)
 * - id:      Unique manifest identifier
 * - version: Semantic version or content hash (REQUIRED for determinism)
 * - path:    JSONPath to specific field (optional)
 *
 * CRITICAL REQUIREMENTS:
 * - NO inference or guessing
 * - NO fuzzy matching
 * - NO default value injection
 * - Resolution must be deterministic and reproducible
 * - External references MUST specify version (no "latest" for determinism)
 *
 * @module references/core/reference-resolver
 */

import type {
  ManifestReference,
  ManifestRegistry,
  Manifest,
  ResolvedReference,
  ResolutionError,
  ResolutionErrorCode,
  ReferenceResolution,
} from '../types/reference-types.js';
import { REFERENCE_PREFIXES } from '../types/reference-types.js';
import {
  validateReference,
  isInternalReference,
  isExternalReference,
  parseExternalReference,
  extractInternalPath,
} from './reference-validator.js';
import { traversePath } from './path-traverser.js';

// =============================================================================
// Error Creation Helpers
// =============================================================================

/**
 * Creates an immutable resolution error.
 */
function createResolutionError(
  code: ResolutionErrorCode,
  reference: ManifestReference,
  message: string
): ResolutionError {
  return Object.freeze({
    code,
    reference,
    message,
  });
}

/**
 * Creates a failed resolution result.
 */
function createFailedResolution(
  reference: ManifestReference,
  error: ResolutionError
): ResolvedReference {
  return Object.freeze({
    reference,
    resolved: false,
    value: null,
    manifest: null,
    error,
  });
}

/**
 * Creates a successful resolution result.
 */
function createSuccessResolution(
  reference: ManifestReference,
  value: unknown,
  manifest: Manifest
): ResolvedReference {
  return Object.freeze({
    reference,
    resolved: true,
    value: deepFreeze(value),
    manifest,
    error: null,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Deep freezes a value to ensure immutability.
 * This is critical for maintaining the determinism guarantee.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value) as T;
  }

  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value) as T;
}

// =============================================================================
// Internal Reference Resolution
// =============================================================================

/**
 * Resolves an internal reference within a manifest.
 *
 * Internal references start with "#/" and point to paths within the same manifest.
 *
 * @param ref - The internal reference to resolve
 * @param context - The manifest containing the reference
 * @returns Promise resolving to the resolution result
 */
async function resolveInternalReference(
  ref: ManifestReference,
  context: Manifest
): Promise<ResolvedReference> {
  // Extract path from reference
  const path = extractInternalPath(ref);

  if (path === null) {
    return createFailedResolution(
      ref,
      createResolutionError(
        'INVALID_REFERENCE_FORMAT',
        ref,
        `Internal reference must start with '${REFERENCE_PREFIXES.INTERNAL}'`
      )
    );
  }

  // Traverse path within manifest content
  const traversalResult = traversePath(context, path);

  if (!traversalResult.found) {
    const errorCode: ResolutionErrorCode =
      traversalResult.error?.code === 'PATH_TYPE_MISMATCH'
        ? 'PATH_TYPE_MISMATCH'
        : traversalResult.error?.code === 'ARRAY_INDEX_OUT_OF_BOUNDS'
          ? 'ARRAY_INDEX_OUT_OF_BOUNDS'
          : 'BROKEN_INTERNAL_REFERENCE';

    return createFailedResolution(
      ref,
      createResolutionError(
        errorCode,
        ref,
        traversalResult.error?.message ?? `Path not found: ${path}`
      )
    );
  }

  return createSuccessResolution(ref, traversalResult.value, context);
}

// =============================================================================
// External Reference Resolution
// =============================================================================

/**
 * Resolves an external reference to another manifest.
 *
 * External references have the format: manifest://{type}/{id}@{version}#{path}
 *
 * CRITICAL: Version is REQUIRED. "latest" is NOT allowed for determinism.
 *
 * @param ref - The external reference to resolve
 * @param registry - The manifest registry for lookups
 * @returns Promise resolving to the resolution result
 */
async function resolveExternalReference(
  ref: ManifestReference,
  registry: ManifestRegistry
): Promise<ResolvedReference> {
  // Parse the reference
  const parsed = parseExternalReference(ref);

  if (parsed === null) {
    return createFailedResolution(
      ref,
      createResolutionError(
        'INVALID_REFERENCE_FORMAT',
        ref,
        'Failed to parse external reference. Format: manifest://{type}/{id}@{version}#{path}'
      )
    );
  }

  // Version is required - this should already be validated by parseExternalReference
  // but we double-check for safety
  if (parsed.version === '' || parsed.version === 'latest') {
    return createFailedResolution(
      ref,
      createResolutionError(
        'VERSION_REQUIRED',
        ref,
        'External references must specify explicit version for determinism. "latest" is NOT allowed.'
      )
    );
  }

  // Load the referenced manifest from registry
  const manifest = await registry.getManifest(parsed.manifestId, parsed.version);

  if (manifest === null) {
    return createFailedResolution(
      ref,
      createResolutionError(
        'EXTERNAL_MANIFEST_NOT_FOUND',
        ref,
        `Manifest not found: ${parsed.manifestId}@${parsed.version}`
      )
    );
  }

  // If no path specified, return the entire manifest
  if (parsed.path === '' || parsed.path === '/') {
    return createSuccessResolution(ref, manifest, manifest);
  }

  // Traverse path within the loaded manifest
  const traversalResult = traversePath(manifest, parsed.path);

  if (!traversalResult.found) {
    const errorCode: ResolutionErrorCode =
      traversalResult.error?.code === 'PATH_TYPE_MISMATCH'
        ? 'PATH_TYPE_MISMATCH'
        : traversalResult.error?.code === 'ARRAY_INDEX_OUT_OF_BOUNDS'
          ? 'ARRAY_INDEX_OUT_OF_BOUNDS'
          : 'PATH_NOT_FOUND';

    return createFailedResolution(
      ref,
      createResolutionError(
        errorCode,
        ref,
        traversalResult.error?.message ?? `Path not found in manifest: ${parsed.path}`
      )
    );
  }

  return createSuccessResolution(ref, traversalResult.value, manifest);
}

// =============================================================================
// Reference Resolver Class
// =============================================================================

/**
 * Options for creating a ReferenceResolver
 */
export interface ReferenceResolverOptions {
  /**
   * The manifest registry for looking up external references.
   * Required for external reference resolution.
   */
  readonly registry?: ManifestRegistry;

  /**
   * The context manifest for internal reference resolution.
   * Required for internal reference resolution.
   */
  readonly context?: Manifest;
}

/**
 * ReferenceResolver implements the ReferenceResolution interface.
 *
 * This class provides deterministic, reproducible reference resolution.
 *
 * GUARANTEES:
 * - Same reference + same registry state = same result
 * - No caching that could cause inconsistency
 * - No fallback to "similar" references
 * - No inference or guessing
 *
 * @example
 * // For internal references
 * const resolver = new ReferenceResolver({ context: myManifest });
 * const result = await resolver.resolve("#/organization/name");
 *
 * @example
 * // For external references
 * const resolver = new ReferenceResolver({ registry: myRegistry });
 * const result = await resolver.resolve("manifest://organization/org-001@1.0.0#/name");
 *
 * @example
 * // For both internal and external
 * const resolver = new ReferenceResolver({ context: myManifest, registry: myRegistry });
 */
export class ReferenceResolver implements ReferenceResolution {
  private readonly registry: ManifestRegistry | undefined;
  private readonly context: Manifest | undefined;

  constructor(options: ReferenceResolverOptions = {}) {
    this.registry = options.registry;
    this.context = options.context;
  }

  /**
   * Resolves a manifest reference to its target value.
   *
   * Resolution is ALWAYS deterministic:
   * - Same reference + same registry state = same result
   * - No caching that could cause inconsistency
   * - No fallback to "similar" references
   *
   * @param ref - The manifest reference to resolve
   * @returns Promise resolving to the resolution result
   */
  async resolve(ref: ManifestReference): Promise<ResolvedReference> {
    // Step 1: Validate reference format
    const validation = validateReference(ref);

    if (!validation.valid) {
      return createFailedResolution(
        ref,
        createResolutionError(
          'INVALID_REFERENCE_FORMAT',
          ref,
          validation.errors.join('; ')
        )
      );
    }

    // Step 2: Route to appropriate resolver based on type
    if (isInternalReference(ref)) {
      return this.resolveInternal(ref);
    }

    if (isExternalReference(ref)) {
      return this.resolveExternal(ref);
    }

    // Should not reach here if validation passed, but handle gracefully
    return createFailedResolution(
      ref,
      createResolutionError(
        'INVALID_REFERENCE_FORMAT',
        ref,
        'Unknown reference type'
      )
    );
  }

  /**
   * Resolves an internal reference.
   * Requires context manifest to be set.
   */
  private async resolveInternal(ref: ManifestReference): Promise<ResolvedReference> {
    if (this.context === undefined) {
      return createFailedResolution(
        ref,
        createResolutionError(
          'BROKEN_INTERNAL_REFERENCE',
          ref,
          'Cannot resolve internal reference without a context manifest'
        )
      );
    }

    return resolveInternalReference(ref, this.context);
  }

  /**
   * Resolves an external reference.
   * Requires registry to be set.
   */
  private async resolveExternal(ref: ManifestReference): Promise<ResolvedReference> {
    if (this.registry === undefined) {
      return createFailedResolution(
        ref,
        createResolutionError(
          'EXTERNAL_MANIFEST_NOT_FOUND',
          ref,
          'Cannot resolve external reference without a manifest registry'
        )
      );
    }

    return resolveExternalReference(ref, this.registry);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ReferenceResolver for internal reference resolution only.
 *
 * @param context - The manifest to resolve internal references within
 * @returns A configured ReferenceResolver
 */
export function createInternalResolver(context: Manifest): ReferenceResolver {
  return new ReferenceResolver({ context });
}

/**
 * Creates a ReferenceResolver for external reference resolution only.
 *
 * @param registry - The manifest registry for lookups
 * @returns A configured ReferenceResolver
 */
export function createExternalResolver(registry: ManifestRegistry): ReferenceResolver {
  return new ReferenceResolver({ registry });
}

/**
 * Creates a ReferenceResolver for both internal and external references.
 *
 * @param context - The manifest for internal reference resolution
 * @param registry - The manifest registry for external lookups
 * @returns A configured ReferenceResolver
 */
export function createResolver(
  context: Manifest,
  registry: ManifestRegistry
): ReferenceResolver {
  return new ReferenceResolver({ context, registry });
}

// =============================================================================
// Standalone Resolution Functions
// =============================================================================

/**
 * Resolves a reference without creating a resolver instance.
 * Convenience function for one-off resolutions.
 *
 * @param ref - The reference to resolve
 * @param options - Resolution options (context and/or registry)
 * @returns Promise resolving to the resolution result
 */
export async function resolveReference(
  ref: ManifestReference,
  options: ReferenceResolverOptions
): Promise<ResolvedReference> {
  const resolver = new ReferenceResolver(options);
  return resolver.resolve(ref);
}

/**
 * Resolves multiple references in parallel.
 * All resolutions are independent and deterministic.
 *
 * @param refs - Array of references to resolve
 * @param options - Resolution options (context and/or registry)
 * @returns Promise resolving to array of resolution results
 */
export async function resolveReferences(
  refs: ReadonlyArray<ManifestReference>,
  options: ReferenceResolverOptions
): Promise<ReadonlyArray<ResolvedReference>> {
  const resolver = new ReferenceResolver(options);
  const results = await Promise.all(refs.map((ref) => resolver.resolve(ref)));
  return Object.freeze(results);
}

/**
 * Checks if a reference can be resolved successfully.
 * Does not return the resolved value, only success/failure.
 *
 * @param ref - The reference to check
 * @param options - Resolution options
 * @returns Promise resolving to true if resolution succeeds
 */
export async function canResolve(
  ref: ManifestReference,
  options: ReferenceResolverOptions
): Promise<boolean> {
  const result = await resolveReference(ref, options);
  return result.resolved;
}
