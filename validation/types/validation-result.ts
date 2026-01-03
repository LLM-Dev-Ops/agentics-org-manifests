/**
 * Validation Result Type Definitions
 *
 * This module defines the core types for validation results following
 * SPARC Architecture principles: pure, deterministic, immutable.
 *
 * All types are readonly to enforce immutability.
 */

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Strictness levels for validation
 * - STRICT: All fields required, no unknown fields, exact type matching
 * - STANDARD: Required fields enforced, optional fields validated if present
 * - PERMISSIVE: Required fields only, warnings for unknown fields
 */
export type StrictnessLevel = 'STRICT' | 'STANDARD' | 'PERMISSIVE';

/**
 * Validation error representing a critical issue that invalidates the manifest
 */
export interface ValidationError {
  /** Error code for programmatic handling (e.g., "SCHEMA_001") */
  readonly code: string;
  /** JSONPath to the error location (e.g., "$.organization.name") */
  readonly path: string;
  /** Human-readable error description */
  readonly message: string;
  /** Severity is always "error" for ValidationError */
  readonly severity: 'error';
  /** Optional additional context about the error */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Validation warning representing a non-critical issue
 */
export interface ValidationWarning {
  /** Warning code for programmatic handling */
  readonly code: string;
  /** JSONPath to the warning location */
  readonly path: string;
  /** Human-readable warning description */
  readonly message: string;
  /** Severity is always "warning" for ValidationWarning */
  readonly severity: 'warning';
  /** Optional additional context about the warning */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Metadata about the validation operation
 */
export interface ValidationMetadata {
  /** Schema version used for validation */
  readonly schemaVersion: string;
  /** ISO 8601 timestamp of when validation was performed */
  readonly validatedAt: string;
  /** List of checks that were performed */
  readonly checksPerformed: ReadonlyArray<string>;
  /** Strictness level used for validation */
  readonly strictnessLevel: StrictnessLevel;
  /** Duration of validation in milliseconds */
  readonly durationMs?: number;
}

/**
 * Complete validation result containing validity status, errors, warnings, and metadata
 */
export interface ValidationResult {
  /** Whether the manifest is valid (no errors) */
  readonly valid: boolean;
  /** Array of validation errors (empty if valid) */
  readonly errors: ReadonlyArray<ValidationError>;
  /** Array of validation warnings */
  readonly warnings: ReadonlyArray<ValidationWarning>;
  /** Metadata about the validation operation */
  readonly metadata: ValidationMetadata;
}

/**
 * Validation function signature - pure function type
 * @template T - The manifest type being validated
 */
export type ValidationFunction<T> = (manifest: T) => ValidationResult;

/**
 * Async validation function signature - for operations requiring I/O
 * @template T - The manifest type being validated
 */
export type AsyncValidationFunction<T> = (manifest: T) => Promise<ValidationResult>;

/**
 * Validation options to configure validation behavior
 */
export interface ValidationOptions {
  /** Strictness level for validation (defaults to STRICT) */
  readonly strictnessLevel?: StrictnessLevel;
  /** Schema version to validate against (defaults to manifest's declared version) */
  readonly schemaVersion?: string;
  /** Whether to include reference validation (defaults to true) */
  readonly validateReferences?: boolean;
  /** Whether to check for forbidden patterns (defaults to true) */
  readonly checkForbiddenPatterns?: boolean;
  /** Maximum depth for nested validation (defaults to 100) */
  readonly maxDepth?: number;
}

/**
 * Reference type for cross-manifest references
 */
export type ReferenceType = 'internal' | 'external';

/**
 * Reference information extracted from a manifest
 */
export interface ManifestReference {
  /** Source path where the reference is defined */
  readonly sourcePath: string;
  /** Target path or manifest ID being referenced */
  readonly target: string;
  /** Type of reference (internal or external) */
  readonly type: ReferenceType;
  /** Version constraint for external references (if specified) */
  readonly version?: string;
}

/**
 * Result of reference resolution
 */
export interface ReferenceResolutionResult {
  /** The original reference */
  readonly reference: ManifestReference;
  /** Whether the reference was successfully resolved */
  readonly resolved: boolean;
  /** Error message if resolution failed */
  readonly error?: string;
}

/**
 * Error codes as constants for type safety
 */
export const ValidationErrorCodes = {
  // Schema validation errors
  SCHEMA_NOT_FOUND: 'SCHEMA_001',
  SCHEMA_VIOLATION: 'SCHEMA_002',
  INVALID_SCHEMA_VERSION: 'SCHEMA_003',

  // Required field errors
  REQUIRED_FIELD_MISSING: 'REQUIRED_001',
  REQUIRED_SECTION_INCOMPLETE: 'REQUIRED_002',

  // Reference errors
  BROKEN_INTERNAL_REFERENCE: 'REF_001',
  INVALID_EXTERNAL_REFERENCE: 'REF_002',
  CIRCULAR_REFERENCE: 'REF_003',
  DANGLING_REFERENCE: 'REF_004',
  VERSION_REQUIRED: 'REF_005',

  // Pattern errors
  FORBIDDEN_PATTERN_DETECTED: 'PATTERN_001',
  PLACEHOLDER_DETECTED: 'PATTERN_002',

  // Immutability errors
  IMMUTABILITY_VIOLATION: 'IMMUTABLE_001',
  MUTABLE_FIELD_DETECTED: 'IMMUTABLE_002',

  // Type errors
  TYPE_MISMATCH: 'TYPE_001',
  ENUM_INVALID: 'TYPE_002',
  FORMAT_INVALID: 'TYPE_003',

  // Structural errors
  UNKNOWN_FIELD: 'STRUCT_001',
  MAX_DEPTH_EXCEEDED: 'STRUCT_002',
  ARRAY_INDEX_OUT_OF_BOUNDS: 'STRUCT_003',
  PATH_NOT_FOUND: 'STRUCT_004',
  PATH_TYPE_MISMATCH: 'STRUCT_005',
} as const;

/**
 * Warning codes as constants
 */
export const ValidationWarningCodes = {
  DEPRECATED_FIELD: 'WARN_001',
  FUTURE_SCHEMA_FIELD: 'WARN_002',
  UNKNOWN_FIELD_PERMISSIVE: 'WARN_003',
  OPTIONAL_FIELD_EMPTY: 'WARN_004',
} as const;

/**
 * Helper function to create a validation error
 */
export function createValidationError(
  code: string,
  path: string,
  message: string,
  context?: Record<string, unknown>
): ValidationError {
  return Object.freeze({
    code,
    path,
    message,
    severity: 'error' as const,
    ...(context && { context: Object.freeze(context) }),
  });
}

/**
 * Helper function to create a validation warning
 */
export function createValidationWarning(
  code: string,
  path: string,
  message: string,
  context?: Record<string, unknown>
): ValidationWarning {
  return Object.freeze({
    code,
    path,
    message,
    severity: 'warning' as const,
    ...(context && { context: Object.freeze(context) }),
  });
}

/**
 * Helper function to create a successful validation result
 */
export function createSuccessResult(
  metadata: ValidationMetadata,
  warnings: ReadonlyArray<ValidationWarning> = []
): ValidationResult {
  return Object.freeze({
    valid: true,
    errors: Object.freeze([]),
    warnings: Object.freeze([...warnings]),
    metadata: Object.freeze(metadata),
  });
}

/**
 * Helper function to create a failed validation result
 */
export function createFailureResult(
  errors: ReadonlyArray<ValidationError>,
  metadata: ValidationMetadata,
  warnings: ReadonlyArray<ValidationWarning> = []
): ValidationResult {
  return Object.freeze({
    valid: false,
    errors: Object.freeze([...errors]),
    warnings: Object.freeze([...warnings]),
    metadata: Object.freeze(metadata),
  });
}

/**
 * Helper function to merge multiple validation results
 */
export function mergeValidationResults(
  results: ReadonlyArray<ValidationResult>,
  baseMetadata: Omit<ValidationMetadata, 'checksPerformed'>
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const allChecks: string[] = [];

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    allChecks.push(...result.metadata.checksPerformed);
  }

  const metadata: ValidationMetadata = Object.freeze({
    ...baseMetadata,
    checksPerformed: Object.freeze(Array.from(new Set(allChecks))),
  });

  if (allErrors.length === 0) {
    return createSuccessResult(metadata, allWarnings);
  }

  return createFailureResult(allErrors, metadata, allWarnings);
}
