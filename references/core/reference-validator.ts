/**
 * Reference Validator Module
 *
 * Provides validation functions for manifest references.
 * All functions are pure and deterministic.
 *
 * Reference Formats:
 * - Internal: "#/path/to/value"
 * - External: "manifest://{type}/{id}@{version}#{path}"
 *
 * @module references/core/reference-validator
 */

import type {
  ManifestReference,
  ManifestType,
  ReferenceType,
  ReferenceValidationResult,
  ParsedExternalRef,
} from '../types/reference-types.js';
import {
  REFERENCE_PREFIXES,
  PATH_SEPARATORS,
  VALIDATION_PATTERNS,
  VALID_MANIFEST_TYPES,
} from '../types/reference-types.js';

// =============================================================================
// Reference Type Detection
// =============================================================================

/**
 * Checks if a reference is an internal reference.
 * Internal references start with "#/" and point to paths within the same manifest.
 *
 * @param ref - The reference string to check
 * @returns true if the reference is internal
 *
 * @example
 * isInternalReference("#/organization/name") // true
 * isInternalReference("manifest://org/id@1.0.0") // false
 */
export function isInternalReference(ref: ManifestReference): boolean {
  return ref.startsWith(REFERENCE_PREFIXES.INTERNAL);
}

/**
 * Checks if a reference is an external reference.
 * External references start with "manifest://" and point to other manifests.
 *
 * @param ref - The reference string to check
 * @returns true if the reference is external
 *
 * @example
 * isExternalReference("manifest://org/id@1.0.0") // true
 * isExternalReference("#/path/to/value") // false
 */
export function isExternalReference(ref: ManifestReference): boolean {
  return ref.startsWith(REFERENCE_PREFIXES.EXTERNAL);
}

/**
 * Determines the type of a reference.
 *
 * @param ref - The reference string to classify
 * @returns The reference type: 'internal', 'external', or 'unknown'
 */
export function determineReferenceType(ref: ManifestReference): ReferenceType {
  if (isInternalReference(ref)) {
    return 'internal';
  }
  if (isExternalReference(ref)) {
    return 'external';
  }
  return 'unknown';
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates an internal reference format.
 *
 * Internal references must:
 * - Start with "#/"
 * - Have a valid path (can be empty for root)
 * - Not contain invalid characters
 *
 * @param ref - The reference to validate
 * @returns Array of validation error messages (empty if valid)
 */
function validateInternalReference(ref: ManifestReference): ReadonlyArray<string> {
  const errors: string[] = [];

  if (!ref.startsWith(REFERENCE_PREFIXES.INTERNAL)) {
    errors.push(`Internal reference must start with '${REFERENCE_PREFIXES.INTERNAL}'`);
    return errors;
  }

  // Extract path portion
  const path = ref.slice(REFERENCE_PREFIXES.INTERNAL.length);

  // Path can be empty (references root)
  if (path === '') {
    return errors;
  }

  // Check for double slashes (invalid path)
  if (path.includes('//')) {
    errors.push('Path contains invalid double slashes');
  }

  // Check for trailing slash (not allowed except for root)
  if (path.endsWith('/') && path !== '/') {
    errors.push('Path cannot end with a trailing slash');
  }

  return errors;
}

/**
 * Validates a manifest type string.
 *
 * @param type - The type string to validate
 * @returns true if the type is valid
 */
function isValidManifestType(type: string): type is ManifestType {
  return (VALID_MANIFEST_TYPES as ReadonlyArray<string>).includes(type);
}

/**
 * Validates a manifest ID format.
 *
 * @param id - The manifest ID to validate
 * @returns true if the ID is valid
 */
function isValidManifestId(id: string): boolean {
  if (id.length < 2) {
    return false;
  }
  return VALIDATION_PATTERNS.MANIFEST_ID.test(id);
}

/**
 * Validates a version string.
 * Accepts semantic versions or content hashes.
 *
 * @param version - The version string to validate
 * @returns true if the version is valid
 */
function isValidVersion(version: string): boolean {
  // Semantic version
  if (VALIDATION_PATTERNS.SEMANTIC_VERSION.test(version)) {
    return true;
  }

  // Content hash
  if (VALIDATION_PATTERNS.CONTENT_HASH.test(version)) {
    return true;
  }

  // Version IDs (e.g., "v1a2b3c4_0001")
  if (/^v[a-f0-9]{8}_\d{4}$/.test(version)) {
    return true;
  }

  return false;
}

/**
 * Parses an external reference into its component parts.
 *
 * Format: manifest://{type}/{id}@{version}#{path}
 *
 * @param ref - The external reference to parse
 * @returns Parsed reference components or null if invalid
 *
 * @example
 * parseExternalReference("manifest://organization/org-001@1.0.0#/teams/0")
 * // Returns: { type: "organization", manifestId: "org-001", version: "1.0.0", path: "/teams/0" }
 */
export function parseExternalReference(ref: ManifestReference): ParsedExternalRef | null {
  if (!isExternalReference(ref)) {
    return null;
  }

  // Remove prefix
  const withoutPrefix = ref.slice(REFERENCE_PREFIXES.EXTERNAL.length);

  // Split by fragment separator for path
  const fragmentIndex = withoutPrefix.indexOf(PATH_SEPARATORS.FRAGMENT);
  let manifestPart: string;
  let path: string;

  if (fragmentIndex === -1) {
    manifestPart = withoutPrefix;
    path = '';
  } else {
    manifestPart = withoutPrefix.slice(0, fragmentIndex);
    path = withoutPrefix.slice(fragmentIndex + 1);
  }

  // Parse manifest part: {type}/{id}@{version}
  const firstSlash = manifestPart.indexOf(PATH_SEPARATORS.PATH);
  if (firstSlash === -1) {
    return null; // Missing type/id separator
  }

  const type = manifestPart.slice(0, firstSlash);
  const idAndVersion = manifestPart.slice(firstSlash + 1);

  // Split id and version
  const versionIndex = idAndVersion.indexOf(PATH_SEPARATORS.VERSION);
  if (versionIndex === -1) {
    return null; // Missing version - REQUIRED for determinism
  }

  const manifestId = idAndVersion.slice(0, versionIndex);
  const version = idAndVersion.slice(versionIndex + 1);

  // Validate type
  if (!isValidManifestType(type)) {
    return null;
  }

  // Validate manifest ID
  if (!isValidManifestId(manifestId)) {
    return null;
  }

  // Validate version
  if (version === '' || version === 'latest') {
    return null; // Version required, "latest" not allowed for determinism
  }

  return Object.freeze({
    type: type as ManifestType,
    manifestId,
    version,
    path,
  });
}

/**
 * Validates an external reference format.
 *
 * External references must:
 * - Start with "manifest://"
 * - Have a valid manifest type
 * - Have a valid manifest ID
 * - Have a version specified (NO "latest" allowed for determinism)
 * - Have a valid path (if specified)
 *
 * @param ref - The reference to validate
 * @returns Array of validation error messages (empty if valid)
 */
function validateExternalReference(ref: ManifestReference): ReadonlyArray<string> {
  const errors: string[] = [];

  if (!ref.startsWith(REFERENCE_PREFIXES.EXTERNAL)) {
    errors.push(`External reference must start with '${REFERENCE_PREFIXES.EXTERNAL}'`);
    return errors;
  }

  // Remove prefix
  const withoutPrefix = ref.slice(REFERENCE_PREFIXES.EXTERNAL.length);

  // Split by fragment separator
  const fragmentIndex = withoutPrefix.indexOf(PATH_SEPARATORS.FRAGMENT);
  const manifestPart = fragmentIndex === -1
    ? withoutPrefix
    : withoutPrefix.slice(0, fragmentIndex);
  const pathPart = fragmentIndex === -1
    ? ''
    : withoutPrefix.slice(fragmentIndex + 1);

  // Parse manifest part: {type}/{id}@{version}
  const firstSlash = manifestPart.indexOf(PATH_SEPARATORS.PATH);
  if (firstSlash === -1) {
    errors.push('External reference must have format: manifest://{type}/{id}@{version}');
    return errors;
  }

  const type = manifestPart.slice(0, firstSlash);
  const idAndVersion = manifestPart.slice(firstSlash + 1);

  // Validate type
  if (!isValidManifestType(type)) {
    errors.push(`Invalid manifest type '${type}'. Valid types: ${VALID_MANIFEST_TYPES.join(', ')}`);
  }

  // Split id and version
  const versionIndex = idAndVersion.indexOf(PATH_SEPARATORS.VERSION);
  if (versionIndex === -1) {
    errors.push('External reference must specify version for determinism. Use format: manifest://{type}/{id}@{version}');
    return errors;
  }

  const manifestId = idAndVersion.slice(0, versionIndex);
  const version = idAndVersion.slice(versionIndex + 1);

  // Validate manifest ID
  if (manifestId === '') {
    errors.push('Manifest ID cannot be empty');
  } else if (!isValidManifestId(manifestId)) {
    errors.push(`Invalid manifest ID format '${manifestId}'. Must be lowercase alphanumeric with hyphens`);
  }

  // Validate version - CRITICAL: No "latest" allowed
  if (version === '') {
    errors.push('Version cannot be empty');
  } else if (version === 'latest') {
    errors.push('Version "latest" is NOT allowed for external references. Explicit version required for determinism');
  } else if (!isValidVersion(version)) {
    errors.push(`Invalid version format '${version}'. Must be semantic version (x.y.z) or content hash (sha256:...)`);
  }

  // Validate path if present
  if (pathPart !== '') {
    if (pathPart.includes('//')) {
      errors.push('Path contains invalid double slashes');
    }
  }

  return errors;
}

/**
 * Validates a manifest reference format.
 *
 * This is the main validation entry point. It:
 * 1. Determines the reference type
 * 2. Applies type-specific validation rules
 * 3. Returns a comprehensive validation result
 *
 * CRITICAL: This function is deterministic and pure.
 * Same input always produces same output.
 *
 * @param ref - The reference string to validate
 * @returns Validation result with type and any errors
 *
 * @example
 * validateReference("#/organization/name")
 * // Returns: { valid: true, type: "internal", errors: [] }
 *
 * @example
 * validateReference("manifest://organization/org-001@latest")
 * // Returns: { valid: false, type: "external", errors: ["Version 'latest' is NOT allowed..."] }
 */
export function validateReference(ref: ManifestReference): ReferenceValidationResult {
  // Check for null/undefined/empty
  if (ref === null || ref === undefined || ref === '') {
    return Object.freeze({
      valid: false,
      type: 'unknown',
      errors: ['Reference cannot be empty'],
    });
  }

  // Determine type
  const type = determineReferenceType(ref);

  // Validate based on type
  let errors: ReadonlyArray<string>;

  switch (type) {
    case 'internal':
      errors = validateInternalReference(ref);
      break;
    case 'external':
      errors = validateExternalReference(ref);
      break;
    case 'unknown':
    default:
      errors = [
        `Reference must start with '${REFERENCE_PREFIXES.INTERNAL}' for internal or '${REFERENCE_PREFIXES.EXTERNAL}' for external references`,
      ];
      break;
  }

  return Object.freeze({
    valid: errors.length === 0,
    type,
    errors,
  });
}

/**
 * Extracts the path portion from an internal reference.
 *
 * @param ref - The internal reference
 * @returns The path portion (without #/ prefix) or null if invalid
 */
export function extractInternalPath(ref: ManifestReference): string | null {
  if (!isInternalReference(ref)) {
    return null;
  }
  return ref.slice(REFERENCE_PREFIXES.INTERNAL.length);
}

/**
 * Creates a valid internal reference from a path.
 *
 * @param path - The path to reference
 * @returns A valid internal reference string
 */
export function createInternalReference(path: string): ManifestReference {
  // Normalize path (remove leading slash if present)
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${REFERENCE_PREFIXES.INTERNAL}${normalizedPath}`;
}

/**
 * Creates a valid external reference from components.
 *
 * @param type - Manifest type
 * @param id - Manifest ID
 * @param version - Version string (required)
 * @param path - Optional path within the manifest
 * @returns A valid external reference string or null if invalid components
 */
export function createExternalReference(
  type: ManifestType,
  id: string,
  version: string,
  path?: string
): ManifestReference | null {
  // Validate components
  if (!isValidManifestType(type)) {
    return null;
  }
  if (!isValidManifestId(id)) {
    return null;
  }
  if (version === '' || version === 'latest') {
    return null; // Version required and cannot be "latest"
  }

  let ref = `${REFERENCE_PREFIXES.EXTERNAL}${type}/${id}${PATH_SEPARATORS.VERSION}${version}`;

  if (path !== undefined && path !== '') {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    ref += `${PATH_SEPARATORS.FRAGMENT}${normalizedPath}`;
  }

  return ref;
}
