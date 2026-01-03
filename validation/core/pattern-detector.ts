/**
 * Pattern Detector
 *
 * Pure functions for detecting forbidden patterns in manifests.
 * Implements pattern detection rules from SPARC_PSEUDOCODE and SPARC_REFINEMENT.
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
  ValidationErrorCodes,
  createValidationError,
  createSuccessResult,
  createFailureResult,
} from '../types/validation-result.js';

/**
 * Forbidden patterns from SPARC_PSEUDOCODE
 * These patterns indicate non-deterministic or inference-based content
 */
export const FORBIDDEN_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly category: string;
  readonly description: string;
}> = Object.freeze([
  // Natural language inference markers
  {
    pattern: /\b(probably|likely|maybe|perhaps|might|could be)\b/i,
    category: 'INFERENCE_MARKER',
    description: 'Contains natural language inference markers',
  },
  // AI/ML inference markers
  {
    pattern: /\b(inferred|predicted|estimated|approximated)\b/i,
    category: 'INFERENCE_MARKER',
    description: 'Contains AI/ML inference markers',
  },
  // Non-deterministic markers
  {
    pattern: /\b(random|uuid|timestamp|now|current)\b/i,
    category: 'NON_DETERMINISTIC',
    description: 'Contains non-deterministic markers',
  },
  // Execution markers (manifests should not execute)
  {
    pattern: /\b(execute|run|simulate|plan|decide)\b/i,
    category: 'EXECUTION_MARKER',
    description: 'Contains execution/action markers (manifests are data, not programs)',
  },
  // Placeholder markers from SPARC_REFINEMENT
  {
    pattern: /\b(TBD|TODO|FIXME|XXX)\b/i,
    category: 'PLACEHOLDER',
    description: 'Contains placeholder markers',
  },
]);

/**
 * Prohibited placeholder patterns from SPARC_REFINEMENT
 */
export const PROHIBITED_PLACEHOLDER_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly description: string;
}> = Object.freeze([
  { pattern: /^TBD$/i, description: 'To Be Determined' },
  { pattern: /^TODO$/i, description: 'To Do' },
  { pattern: /^PENDING$/i, description: 'Pending' },
  { pattern: /^N\/?A$/i, description: 'Not Applicable' },
  { pattern: /^UNKNOWN$/i, description: 'Unknown value' },
  { pattern: /^TO.?BE.?(COMPLETED|DETERMINED|ADDED)$/i, description: 'Incomplete marker' },
  { pattern: /^PLACEHOLDER$/i, description: 'Placeholder text' },
  { pattern: /^\?+$/, description: 'Question marks as placeholder' },
  { pattern: /^X+$/, description: 'X characters as placeholder' },
  { pattern: /^-+$/, description: 'Dashes as placeholder' },
  { pattern: /^\.\.\.+$/, description: 'Ellipsis as placeholder' },
  { pattern: /^DRAFT$/i, description: 'Draft marker' },
  { pattern: /^TEMP(ORARY)?$/i, description: 'Temporary marker' },
]);

/**
 * Prohibited placeholder dates from SPARC_REFINEMENT
 */
export const PLACEHOLDER_DATES: ReadonlyArray<string> = Object.freeze([
  '1970-01-01', // Unix epoch
  '1900-01-01', // Common default
  '0001-01-01', // Minimum date
  '9999-12-31', // Maximum date
  '2099-12-31', // Far future
]);

/**
 * Fields that suggest mutability (forbidden per SPARC_PSEUDOCODE)
 */
export const MUTABLE_FIELD_NAMES: ReadonlyArray<string> = Object.freeze([
  'updated_at',
  'last_modified',
  'modified_at',
  'last_updated',
  'updatedAt',
  'lastModified',
  'modifiedAt',
  'lastUpdated',
  '$mutable_fields',
]);

/**
 * Check a string value for forbidden patterns
 */
function checkStringForForbiddenPatterns(
  value: string,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const { pattern, category, description } of FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
          path,
          `Forbidden pattern found: ${description}`,
          { category, matchedPattern: pattern.source }
        )
      );
    }
  }

  return errors;
}

/**
 * Check a string value for placeholder patterns
 */
function checkStringForPlaceholders(
  value: string,
  path: string
): ValidationError[] {
  const trimmed = value.trim();

  for (const { pattern, description } of PROHIBITED_PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return [
        createValidationError(
          ValidationErrorCodes.PLACEHOLDER_DETECTED,
          path,
          `Placeholder value detected: ${description}. All fields must contain actual data.`,
          { value: trimmed }
        )
      ];
    }
  }

  return [];
}

/**
 * Check if a date string is a placeholder date
 */
function isPlaceholderDate(dateString: string): boolean {
  for (const placeholder of PLACEHOLDER_DATES) {
    if (dateString.startsWith(placeholder)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively detect forbidden patterns in data
 */
function detectPatternsRecursively(
  data: unknown,
  path: string,
  maxDepth: number,
  currentDepth: number = 0
): ValidationError[] {
  if (currentDepth > maxDepth) {
    return [];
  }

  const errors: ValidationError[] = [];

  if (data === null || data === undefined) {
    return errors;
  }

  if (typeof data === 'string') {
    // Check for forbidden patterns
    errors.push(...checkStringForForbiddenPatterns(data, path));

    // Check for placeholder values
    errors.push(...checkStringForPlaceholders(data, path));

    // Check for placeholder dates
    if (isPlaceholderDate(data)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.PLACEHOLDER_DETECTED,
          path,
          `Placeholder date detected: ${data}`,
          { value: data }
        )
      );
    }

    return errors;
  }

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      errors.push(
        ...detectPatternsRecursively(item, `${path}[${index}]`, maxDepth, currentDepth + 1)
      );
    });
    return errors;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = `${path}.${key}`;

      // Check for mutable field names
      if (MUTABLE_FIELD_NAMES.includes(key)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.MUTABLE_FIELD_DETECTED,
            fieldPath,
            `Field '${key}' suggests mutability - use versioning instead of in-place updates`,
            { fieldName: key }
          )
        );
      }

      // Recursively check the value
      errors.push(
        ...detectPatternsRecursively(value, fieldPath, maxDepth, currentDepth + 1)
      );
    }
  }

  return errors;
}

/**
 * Detect forbidden patterns in a manifest
 *
 * Checks for:
 * 1. Natural language inference markers
 * 2. AI/ML inference markers
 * 3. Non-deterministic markers
 * 4. Execution markers
 * 5. Placeholder markers (TBD, TODO, etc.)
 * 6. Mutable field names
 * 7. Placeholder dates
 *
 * @param manifest - The manifest to check
 * @param options - Validation options
 * @returns Validation result
 */
export function detectForbiddenPatterns(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const maxDepth = options.maxDepth ?? 100;
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  const errors = detectPatternsRecursively(manifest, '$', maxDepth);
  const warnings: ValidationWarning[] = [];

  const schemaVersion = (manifest as Record<string, unknown>)?.['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze([
      'forbidden_pattern_detection',
      'placeholder_detection',
      'mutable_field_detection',
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
 * Check if immutability constraints are violated
 *
 * Per SPARC_PSEUDOCODE, manifests:
 * - Cannot declare mutable fields
 * - Cannot have timestamp fields that suggest runtime mutation
 *
 * @param manifest - The manifest to check
 * @returns Validation result
 */
export function validateImmutabilityConstraints(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    const schemaVersion = '1.0.0';
    return createSuccessResult({
      schemaVersion,
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['immutability_constraints']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Check for $mutable_fields declaration
  if ('$mutable_fields' in obj) {
    errors.push(
      createValidationError(
        ValidationErrorCodes.IMMUTABILITY_VIOLATION,
        '$.$mutable_fields',
        'Manifests cannot declare mutable fields - all content is immutable'
      )
    );
  }

  // Check for forbidden timestamp fields that suggest mutation
  const forbiddenTimestampFields = ['updated_at', 'last_modified', 'modified_at'];

  for (const field of forbiddenTimestampFields) {
    if (field in obj) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.IMMUTABILITY_VIOLATION,
          `$.${field}`,
          `Field '${field}' suggests mutability - use versioning instead of in-place updates`
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['immutability_constraints']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Check a single string value for forbidden patterns
 *
 * Utility function for checking individual values
 *
 * @param value - The string value to check
 * @returns Array of detected pattern categories
 */
export function checkValueForPatterns(value: string): ReadonlyArray<string> {
  const matches: string[] = [];

  for (const { pattern, category } of FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      matches.push(category);
    }
  }

  return Object.freeze(matches);
}

/**
 * Check if a value is a placeholder
 *
 * @param value - The value to check
 * @returns True if the value is a placeholder
 */
export function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  for (const { pattern } of PROHIBITED_PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a field name suggests mutability
 *
 * @param fieldName - The field name to check
 * @returns True if the field name suggests mutability
 */
export function isMutableFieldName(fieldName: string): boolean {
  return MUTABLE_FIELD_NAMES.includes(fieldName);
}

/**
 * Get all forbidden pattern categories
 */
export function getForbiddenPatternCategories(): ReadonlyArray<string> {
  const categories = new Set<string>();
  for (const { category } of FORBIDDEN_PATTERNS) {
    categories.add(category);
  }
  return Object.freeze(Array.from(categories));
}
