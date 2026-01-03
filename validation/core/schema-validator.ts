/**
 * Schema Validator
 *
 * Pure function module for validating manifests against JSON Schema.
 * Uses Ajv for fast, standards-compliant validation.
 *
 * All functions are:
 * - Pure (no side effects)
 * - Deterministic (same input = same output)
 * - Stateless
 */

import AjvModule from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import {
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationOptions,
  type StrictnessLevel,
  ValidationErrorCodes,
  ValidationWarningCodes,
  createValidationError,
  createValidationWarning,
  createSuccessResult,
  createFailureResult,
} from '../types/validation-result.js';

// Handle CommonJS/ESM interop
const Ajv = (AjvModule as unknown as { default?: typeof AjvModule }).default ?? AjvModule;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ?? addFormatsModule;

/**
 * Schema cache for compiled validators
 * Key: schemaVersion, Value: compiled validator
 */
const schemaCache = new Map<string, ValidateFunction>();

/**
 * Create a new Ajv instance with appropriate settings
 */
function createAjvInstance(strictnessLevel: StrictnessLevel): InstanceType<typeof AjvModule> {
  const ajv = new Ajv({
    allErrors: true, // Collect all errors, not just first
    strict: strictnessLevel === 'STRICT',
    strictSchema: strictnessLevel === 'STRICT',
    strictTypes: strictnessLevel === 'STRICT',
    strictRequired: strictnessLevel !== 'PERMISSIVE',
    allowUnionTypes: true,
    removeAdditional: false, // Never mutate input
    useDefaults: false, // Never inject defaults (violates immutability)
    coerceTypes: false, // Never coerce types
  });

  // Add standard formats (date-time, uri, email, etc.)
  addFormats(ajv);

  return ajv;
}

/**
 * Convert Ajv error to ValidationError
 */
function ajvErrorToValidationError(error: ErrorObject): ValidationError {
  const path = error.instancePath || '$';
  const jsonPath = path === '' ? '$' : `$${path.replace(/\//g, '.')}`;

  let code: string = ValidationErrorCodes.SCHEMA_VIOLATION;
  let message = error.message || 'Schema validation failed';

  // Map specific Ajv keywords to error codes
  switch (error.keyword) {
    case 'required':
      code = ValidationErrorCodes.REQUIRED_FIELD_MISSING;
      message = `Required field missing: ${error.params?.['missingProperty'] as string || 'unknown'}`;
      break;
    case 'type':
      code = ValidationErrorCodes.TYPE_MISMATCH;
      message = `Type mismatch: expected ${error.params?.['type'] as string || 'unknown'}`;
      break;
    case 'enum':
      code = ValidationErrorCodes.ENUM_INVALID;
      message = `Invalid enum value. Allowed values: ${JSON.stringify(error.params?.['allowedValues'])}`;
      break;
    case 'format':
      code = ValidationErrorCodes.FORMAT_INVALID;
      message = `Invalid format: expected ${error.params?.['format'] as string || 'unknown'}`;
      break;
    case 'additionalProperties':
      code = ValidationErrorCodes.UNKNOWN_FIELD;
      message = `Unknown field: ${error.params?.['additionalProperty'] as string || 'unknown'}`;
      break;
    case 'pattern':
      code = ValidationErrorCodes.FORMAT_INVALID;
      message = `Value does not match required pattern`;
      break;
    default:
      // Use default code and message
      break;
  }

  return createValidationError(code, jsonPath, message, {
    keyword: error.keyword,
    params: error.params,
    schemaPath: error.schemaPath,
  });
}

/**
 * Check for unknown fields and convert to warnings (for STANDARD mode)
 */
function checkUnknownFieldsAsWarnings(
  manifest: Record<string, unknown>,
  schema: Record<string, unknown>,
  basePath: string = '$'
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (typeof manifest !== 'object' || manifest === null) {
    return warnings;
  }

  const schemaProperties = (schema['properties'] as Record<string, unknown>) || {};
  const additionalProperties = schema['additionalProperties'];

  // If additionalProperties is true or undefined (permissive), skip check
  if (additionalProperties === true || additionalProperties === undefined) {
    return warnings;
  }

  for (const key of Object.keys(manifest)) {
    // Skip schema metadata fields
    if (key.startsWith('$')) {
      continue;
    }

    const path = `${basePath}.${key}`;

    if (!(key in schemaProperties)) {
      warnings.push(
        createValidationWarning(
          ValidationWarningCodes.UNKNOWN_FIELD_PERMISSIVE,
          path,
          `Unknown field '${key}' is not defined in schema`
        )
      );
    } else {
      // Recursively check nested objects
      const value = manifest[key];
      const propertySchema = schemaProperties[key];
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof propertySchema === 'object' &&
        propertySchema !== null
      ) {
        warnings.push(
          ...checkUnknownFieldsAsWarnings(
            value as Record<string, unknown>,
            propertySchema as Record<string, unknown>,
            path
          )
        );
      }
    }
  }

  return warnings;
}

/**
 * Validate manifest against JSON Schema
 *
 * Pure function - no side effects, deterministic output
 *
 * @param manifest - The manifest to validate
 * @param schema - The JSON Schema to validate against
 * @param options - Validation options
 * @returns Validation result
 */
export function validateAgainstSchema(
  manifest: unknown,
  schema: Record<string, unknown>,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';
  const schemaVersion = (schema['$id'] as string) ||
                        (manifest as Record<string, unknown>)?.['$schema_version'] as string ||
                        '1.0.0';

  // Create Ajv instance based on strictness level
  const ajv = createAjvInstance(strictnessLevel);

  // Compile or retrieve cached validator
  let validate: ValidateFunction;
  const cacheKey = `${schemaVersion}:${strictnessLevel}`;

  if (schemaCache.has(cacheKey)) {
    validate = schemaCache.get(cacheKey)!;
  } else {
    try {
      validate = ajv.compile(schema);
      schemaCache.set(cacheKey, validate);
    } catch (error) {
      const err = error as Error;
      return createFailureResult(
        [
          createValidationError(
            ValidationErrorCodes.SCHEMA_NOT_FOUND,
            '$',
            `Failed to compile schema: ${err.message}`
          ),
        ],
        {
          schemaVersion,
          validatedAt: new Date().toISOString(),
          checksPerformed: ['schema_compilation'],
          strictnessLevel,
          durationMs: Date.now() - startTime,
        }
      );
    }
  }

  // Perform validation
  const isValid = validate(manifest);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!isValid && validate.errors) {
    // In STRICT mode, all errors are fatal
    // In STANDARD mode, unknown fields become warnings
    // In PERMISSIVE mode, only required field errors are fatal
    for (const ajvError of validate.errors) {
      if (strictnessLevel === 'PERMISSIVE') {
        // Only required fields are errors in PERMISSIVE mode
        if (ajvError.keyword === 'required') {
          errors.push(ajvErrorToValidationError(ajvError));
        } else {
          // Convert to warning
          const validationError = ajvErrorToValidationError(ajvError);
          warnings.push(
            createValidationWarning(
              validationError.code,
              validationError.path,
              validationError.message,
              validationError.context as Record<string, unknown>
            )
          );
        }
      } else if (strictnessLevel === 'STANDARD') {
        // Unknown fields are warnings, everything else is an error
        if (ajvError.keyword === 'additionalProperties') {
          const validationError = ajvErrorToValidationError(ajvError);
          warnings.push(
            createValidationWarning(
              ValidationWarningCodes.UNKNOWN_FIELD_PERMISSIVE,
              validationError.path,
              validationError.message,
              validationError.context as Record<string, unknown>
            )
          );
        } else {
          errors.push(ajvErrorToValidationError(ajvError));
        }
      } else {
        // STRICT mode - all errors are fatal
        errors.push(ajvErrorToValidationError(ajvError));
      }
    }
  }

  // In STANDARD mode with no schema additionalProperties check, manually check for warnings
  if (strictnessLevel === 'STANDARD' && typeof manifest === 'object' && manifest !== null) {
    warnings.push(
      ...checkUnknownFieldsAsWarnings(
        manifest as Record<string, unknown>,
        schema
      )
    );
  }

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['json_schema_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate schema version format
 *
 * Schema versions must follow semantic versioning: MAJOR.MINOR.PATCH
 *
 * @param version - The version string to validate
 * @returns True if valid, false otherwise
 */
export function isValidSchemaVersion(version: string): boolean {
  // Semantic versioning pattern
  const semverPattern = /^\d+\.\d+\.\d+$/;
  return semverPattern.test(version);
}

/**
 * Extract schema version from manifest
 *
 * @param manifest - The manifest to extract version from
 * @returns The schema version or null if not found
 */
export function extractSchemaVersion(manifest: unknown): string | null {
  if (typeof manifest !== 'object' || manifest === null) {
    return null;
  }

  const manifestObj = manifest as Record<string, unknown>;

  // Check for $schema_version field
  if (typeof manifestObj['$schema_version'] === 'string') {
    return manifestObj['$schema_version'];
  }

  // Check for nested $manifest.version
  if (typeof manifestObj['$manifest'] === 'object' && manifestObj['$manifest'] !== null) {
    const metaManifest = manifestObj['$manifest'] as Record<string, unknown>;
    if (typeof metaManifest['version'] === 'string') {
      return metaManifest['version'];
    }
  }

  return null;
}

/**
 * Validate that a manifest has required metadata fields
 *
 * Required metadata fields per SPARC_PSEUDOCODE:
 * - $id
 * - $schema_version
 * - $created_at
 * - $content_hash
 *
 * @param manifest - The manifest to validate
 * @param strictnessLevel - The strictness level
 * @returns Validation result
 */
export function validateRequiredMetadata(
  manifest: unknown,
  strictnessLevel: StrictnessLevel = 'STRICT'
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (typeof manifest !== 'object' || manifest === null) {
    return createFailureResult(
      [
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$',
          'Manifest must be an object'
        ),
      ],
      {
        schemaVersion: 'unknown',
        validatedAt: new Date().toISOString(),
        checksPerformed: ['required_metadata'],
        strictnessLevel,
        durationMs: Date.now() - startTime,
      }
    );
  }

  const manifestObj = manifest as Record<string, unknown>;

  // Required metadata fields
  const requiredFields = ['$id', '$schema_version', '$created_at', '$content_hash'];

  for (const field of requiredFields) {
    if (!(field in manifestObj)) {
      if (strictnessLevel === 'STRICT' || strictnessLevel === 'STANDARD') {
        errors.push(
          createValidationError(
            ValidationErrorCodes.REQUIRED_FIELD_MISSING,
            `$.${field}`,
            `Required metadata field missing: ${field}`
          )
        );
      } else {
        // PERMISSIVE mode - warn only
        warnings.push(
          createValidationWarning(
            ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
            `$.${field}`,
            `Metadata field '${field}' is not present`
          )
        );
      }
    }
  }

  // Validate $schema_version format if present
  const schemaVersion = extractSchemaVersion(manifest);
  if (schemaVersion !== null && !isValidSchemaVersion(schemaVersion)) {
    errors.push(
      createValidationError(
        ValidationErrorCodes.INVALID_SCHEMA_VERSION,
        '$.$schema_version',
        `Invalid schema version format: ${schemaVersion}. Expected MAJOR.MINOR.PATCH`
      )
    );
  }

  // Validate $created_at format if present
  if ('$created_at' in manifestObj) {
    const createdAt = manifestObj['$created_at'];
    if (typeof createdAt !== 'string' || isNaN(Date.parse(createdAt))) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.FORMAT_INVALID,
          '$.$created_at',
          'Invalid date format for $created_at. Expected ISO 8601 format'
        )
      );
    }
  }

  // Validate $content_hash format if present
  if ('$content_hash' in manifestObj) {
    const contentHash = manifestObj['$content_hash'];
    if (typeof contentHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(contentHash)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.FORMAT_INVALID,
          '$.$content_hash',
          'Invalid content hash format. Expected sha256:{64 hex characters}'
        )
      );
    }
  }

  const metadata = {
    schemaVersion: schemaVersion || 'unknown',
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['required_metadata']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Clear the schema cache
 * Useful for testing or when schemas are updated
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/**
 * Get the number of cached schemas
 * Useful for testing and monitoring
 */
export function getSchemaCacheSize(): number {
  return schemaCache.size;
}
