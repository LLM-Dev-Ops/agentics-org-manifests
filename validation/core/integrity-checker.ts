/**
 * Integrity Checker
 *
 * Pure functions for validating referential integrity in manifests.
 * Detects broken references, circular references, and dangling references.
 *
 * All functions are:
 * - Pure (no side effects)
 * - Deterministic (same input = same output)
 * - Stateless
 */

import {
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationOptions,
  type ManifestReference,
  type ReferenceResolutionResult,
  ValidationErrorCodes,
  createValidationError,
  createSuccessResult,
  createFailureResult,
} from '../types/validation-result.js';

/**
 * Internal reference prefix per SPARC_PSEUDOCODE
 */
const INTERNAL_REF_PREFIX = '#/';

/**
 * External reference prefix per SPARC_PSEUDOCODE
 */
const EXTERNAL_REF_PREFIX = 'manifest://';

/**
 * Reference patterns from SPARC_REFINEMENT
 */
const REFERENCE_PATTERNS = {
  INTERNAL: /^#\/.+$/,
  EXTERNAL: /^manifest:\/\/[a-zA-Z0-9_-]+@[a-zA-Z0-9._-]+(\/.+)?$/,
  EXTERNAL_NO_VERSION: /^manifest:\/\/[a-zA-Z0-9_-]+(\/.+)?$/,
} as const;

/**
 * Determine reference type from reference string
 */
function determineReferenceType(reference: string): 'internal' | 'external' | 'unknown' {
  if (reference.startsWith(INTERNAL_REF_PREFIX)) {
    return 'internal';
  }
  if (reference.startsWith(EXTERNAL_REF_PREFIX)) {
    return 'external';
  }
  return 'unknown';
}

/**
 * Parse internal reference path
 * Format: #/path/to/value
 */
function parseInternalReference(reference: string): string[] {
  if (!reference.startsWith(INTERNAL_REF_PREFIX)) {
    return [];
  }

  const pathWithoutPrefix = reference.slice(2); // Remove "#/"
  return pathWithoutPrefix.split('/').filter(segment => segment.length > 0);
}

/**
 * Parse external reference
 * Format: manifest://manifest_id@version/path/to/value
 */
interface ParsedExternalReference {
  manifestId: string;
  version: string | null;
  path: string;
}

function parseExternalReference(reference: string): ParsedExternalReference | null {
  if (!reference.startsWith(EXTERNAL_REF_PREFIX)) {
    return null;
  }

  const pathWithoutPrefix = reference.slice(11); // Remove "manifest://"
  const firstSlashIndex = pathWithoutPrefix.indexOf('/');

  let manifestPart: string;
  let valuePath: string;

  if (firstSlashIndex === -1) {
    manifestPart = pathWithoutPrefix;
    valuePath = '';
  } else {
    manifestPart = pathWithoutPrefix.slice(0, firstSlashIndex);
    valuePath = pathWithoutPrefix.slice(firstSlashIndex + 1);
  }

  // Parse version from manifest identifier
  const versionIndex = manifestPart.indexOf('@');

  let manifestId: string;
  let version: string | null;

  if (versionIndex === -1) {
    manifestId = manifestPart;
    version = null;
  } else {
    manifestId = manifestPart.slice(0, versionIndex);
    version = manifestPart.slice(versionIndex + 1);
  }

  return {
    manifestId,
    version,
    path: valuePath,
  };
}

/**
 * Traverse a path in an object
 */
function traversePath(
  obj: unknown,
  pathSegments: readonly string[]
): { found: boolean; value: unknown; error?: string } {
  let current: unknown = obj;

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i]!;
    const currentPath = pathSegments.slice(0, i + 1).join('/');

    if (current === null || current === undefined) {
      return {
        found: false,
        value: undefined,
        error: `Path segment '${segment}' not found: parent is ${current === null ? 'null' : 'undefined'}`,
      };
    }

    // Handle array index notation
    const arrayIndexMatch = segment.match(/^(\d+)$/);

    if (arrayIndexMatch) {
      const index = parseInt(arrayIndexMatch[1]!, 10);

      if (!Array.isArray(current)) {
        return {
          found: false,
          value: undefined,
          error: `Expected array at '${currentPath}' but found ${typeof current}`,
        };
      }

      if (index >= current.length) {
        return {
          found: false,
          value: undefined,
          error: `Array index ${index} out of bounds (length: ${current.length})`,
        };
      }

      current = current[index];
    } else {
      // Object property access
      if (typeof current !== 'object') {
        return {
          found: false,
          value: undefined,
          error: `Expected object at '${currentPath}' but found ${typeof current}`,
        };
      }

      const currentObj = current as Record<string, unknown>;

      if (!(segment in currentObj)) {
        return {
          found: false,
          value: undefined,
          error: `Property '${segment}' not found at '${currentPath}'`,
        };
      }

      current = currentObj[segment];
    }
  }

  return { found: true, value: current };
}

/**
 * Extract all references from a manifest
 */
export function extractReferences(
  data: unknown,
  basePath: string = '$'
): ManifestReference[] {
  const references: ManifestReference[] = [];

  function recurse(current: unknown, path: string): void {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof current === 'string') {
      // Check for reference patterns
      const refType = determineReferenceType(current);
      if (refType !== 'unknown') {
        const parsed = refType === 'external' ? parseExternalReference(current) : null;
        const ref: ManifestReference = {
          sourcePath: path,
          target: current,
          type: refType,
        };
        if (parsed?.version !== undefined && parsed.version !== null) {
          (ref as { version: string }).version = parsed.version;
        }
        references.push(ref);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        recurse(item, `${path}[${index}]`);
      });
      return;
    }

    if (typeof current === 'object') {
      const obj = current as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        recurse(value, `${path}.${key}`);
      }
    }
  }

  recurse(data, basePath);
  return references;
}

/**
 * Validate internal reference
 */
function validateInternalReference(
  reference: ManifestReference,
  manifest: unknown
): ReferenceResolutionResult {
  const pathSegments = parseInternalReference(reference.target);

  if (pathSegments.length === 0) {
    return {
      reference,
      resolved: false,
      error: 'Invalid internal reference format',
    };
  }

  const result = traversePath(manifest, pathSegments);

  if (!result.found) {
    return {
      reference,
      resolved: false,
      error: result.error ?? 'Path not found',
    };
  }

  return {
    reference,
    resolved: true,
  };
}

/**
 * Validate external reference format
 * Note: Actual resolution requires loading external manifests
 */
function validateExternalReferenceFormat(
  reference: ManifestReference
): ReferenceResolutionResult {
  const parsed = parseExternalReference(reference.target);

  if (parsed === null) {
    return {
      reference,
      resolved: false,
      error: 'Invalid external reference format',
    };
  }

  // Version is REQUIRED for external references per SPARC_PSEUDOCODE
  if (parsed.version === null) {
    return {
      reference,
      resolved: false,
      error: 'External references must specify version for determinism. Use format: manifest://id@version/path',
    };
  }

  // Validate manifest ID format
  if (!/^[a-zA-Z0-9_-]+$/.test(parsed.manifestId)) {
    return {
      reference,
      resolved: false,
      error: `Invalid manifest ID format: ${parsed.manifestId}`,
    };
  }

  // Format is valid (actual resolution would require loading the manifest)
  return {
    reference,
    resolved: true,
  };
}

/**
 * Detect circular references within a manifest
 */
export function detectCircularReferences(
  data: unknown,
  maxDepth: number = 100
): { hasCircular: boolean; paths: string[] } {
  const visited = new WeakSet<object>();
  const circularPaths: string[] = [];

  function detect(current: unknown, path: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    if (current === null || current === undefined || typeof current !== 'object') {
      return;
    }

    const obj = current as object;

    if (visited.has(obj)) {
      circularPaths.push(path);
      return;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        detect(item, `${path}[${index}]`, depth + 1);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        detect(value, `${path}.${key}`, depth + 1);
      }
    }

    // Note: We don't delete from visited because we're checking for structural
    // circular references, not just repeated visits in different branches
  }

  detect(data, '$', 0);

  return {
    hasCircular: circularPaths.length > 0,
    paths: circularPaths,
  };
}

/**
 * Validate referential integrity of a manifest
 *
 * Checks:
 * 1. Internal references (#/path/to/value) resolve within the manifest
 * 2. External references (manifest://id@version/path) have valid format
 * 3. No circular references in the data structure
 * 4. No dangling references
 *
 * @param manifest - The manifest to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateReferentialIntegrity(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';
  const maxDepth = options.maxDepth ?? 100;

  // Check for structural circular references
  const circularCheck = detectCircularReferences(manifest, maxDepth);
  if (circularCheck.hasCircular) {
    for (const path of circularCheck.paths) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.CIRCULAR_REFERENCE,
          path,
          'Circular reference detected in manifest structure'
        )
      );
    }
  }

  // Extract and validate all references
  const references = extractReferences(manifest);

  for (const reference of references) {
    if (reference.type === 'internal') {
      const result = validateInternalReference(reference, manifest);
      if (!result.resolved) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.BROKEN_INTERNAL_REFERENCE,
            reference.sourcePath,
            `Internal reference points to non-existent path: ${result.error}`
          )
        );
      }
    } else if (reference.type === 'external') {
      const result = validateExternalReferenceFormat(reference);
      if (!result.resolved) {
        if (result.error?.includes('must specify version')) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.VERSION_REQUIRED,
              reference.sourcePath,
              result.error
            )
          );
        } else {
          errors.push(
            createValidationError(
              ValidationErrorCodes.INVALID_EXTERNAL_REFERENCE,
              reference.sourcePath,
              `Invalid external reference: ${result.error}`
            )
          );
        }
      }
    }
  }

  const schemaVersion = (manifest as Record<string, unknown>)?.['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze([
      'circular_reference_detection',
      'internal_reference_resolution',
      'external_reference_format_validation',
    ]),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate a single reference
 *
 * @param reference - The reference string to validate
 * @param manifest - The manifest containing the reference
 * @returns Resolution result
 */
export function validateReference(
  reference: string,
  manifest: unknown
): ReferenceResolutionResult {
  const refType = determineReferenceType(reference);

  const manifestRef: ManifestReference = {
    sourcePath: '$',
    target: reference,
    type: refType === 'unknown' ? 'internal' : refType,
  };

  if (refType === 'internal') {
    return validateInternalReference(manifestRef, manifest);
  }

  if (refType === 'external') {
    return validateExternalReferenceFormat(manifestRef);
  }

  return {
    reference: manifestRef,
    resolved: false,
    error: `Unknown reference format: ${reference}`,
  };
}

/**
 * Resolve internal reference and return the value
 *
 * @param reference - The internal reference string (e.g., "#/path/to/value")
 * @param manifest - The manifest to resolve against
 * @returns The resolved value or null if not found
 */
export function resolveInternalReference(
  reference: string,
  manifest: unknown
): { value: unknown; found: boolean; error?: string } {
  if (!reference.startsWith(INTERNAL_REF_PREFIX)) {
    return {
      value: undefined,
      found: false,
      error: 'Reference must start with #/',
    };
  }

  const pathSegments = parseInternalReference(reference);
  return traversePath(manifest, pathSegments);
}

/**
 * Check if a value is a reference string
 */
export function isReference(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return determineReferenceType(value) !== 'unknown';
}

/**
 * Check if a value is an internal reference
 */
export function isInternalReference(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.startsWith(INTERNAL_REF_PREFIX);
}

/**
 * Check if a value is an external reference
 */
export function isExternalReference(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.startsWith(EXTERNAL_REF_PREFIX);
}
