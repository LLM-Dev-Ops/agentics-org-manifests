/**
 * Validation Module - Public API
 *
 * This module provides the public interface for manifest validation
 * following SPARC Architecture principles.
 *
 * All validation functions are:
 * - Pure (no side effects)
 * - Deterministic (same input = same output)
 * - Stateless
 *
 * @module validation
 */

// Re-export all types
export {
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationMetadata,
  type ValidationFunction,
  type AsyncValidationFunction,
  type ValidationOptions,
  type StrictnessLevel,
  type ManifestReference,
  type ReferenceResolutionResult,
  type ReferenceType,
  ValidationErrorCodes,
  ValidationWarningCodes,
  createValidationError,
  createValidationWarning,
  createSuccessResult,
  createFailureResult,
  mergeValidationResults,
} from './types/validation-result.js';

// Re-export schema validation functions
export {
  validateAgainstSchema,
  validateRequiredMetadata,
  isValidSchemaVersion,
  extractSchemaVersion,
  clearSchemaCache,
  getSchemaCacheSize,
} from './core/schema-validator.js';

// Re-export integrity checking functions
export {
  validateReferentialIntegrity,
  validateReference,
  extractReferences,
  detectCircularReferences,
  resolveInternalReference,
  isReference,
  isInternalReference,
  isExternalReference,
} from './core/integrity-checker.js';

// Re-export pattern detection functions
export {
  detectForbiddenPatterns,
  validateImmutabilityConstraints,
  checkValueForPatterns,
  isPlaceholder,
  isMutableFieldName,
  getForbiddenPatternCategories,
  FORBIDDEN_PATTERNS,
  PROHIBITED_PLACEHOLDER_PATTERNS,
  PLACEHOLDER_DATES,
  MUTABLE_FIELD_NAMES,
} from './core/pattern-detector.js';

// Re-export organization rules
export {
  validateOrganizationRules,
  validateOrganizationCompleteness,
  validateEntityType,
  validateOrganizationStatus,
  validateNoSpeculativeData,
  getRequiredOrganizationSections,
  getValidEntityTypes,
  getValidOrganizationStatuses,
  REQUIRED_ORGANIZATION_SECTIONS,
  VALID_ENTITY_TYPES,
  VALID_ORGANIZATION_STATUSES,
  VALID_GOVERNANCE_TYPES,
} from './rules/organization-rules.js';

// Re-export team rules
export {
  validateTeamRules,
  validateTeamRequiredFields,
  validateTeamType,
  validateTeamMembers,
  validateTeamHierarchy,
  getRequiredTeamFields,
  getValidTeamTypes,
  getValidTeamStatuses,
  getValidMemberRoles,
  REQUIRED_TEAM_FIELDS,
  VALID_TEAM_TYPES,
  VALID_TEAM_STATUSES,
  VALID_MEMBER_ROLES,
} from './rules/team-rules.js';

// Re-export policy rules
export {
  validatePolicyRules,
  validatePolicyRequiredFields,
  validatePolicyType,
  validatePolicyScope,
  validatePolicyConstraints,
  validatePolicyDates,
  getRequiredPolicyFields,
  getValidPolicyTypes,
  getValidPolicyStatuses,
  getValidPolicyScopes,
  getValidEnforcementLevels,
  REQUIRED_POLICY_FIELDS,
  VALID_POLICY_TYPES,
  VALID_POLICY_STATUSES,
  VALID_POLICY_SCOPES,
  VALID_ENFORCEMENT_LEVELS,
} from './rules/policy-rules.js';

// Import for internal use
import {
  type ValidationResult,
  type ValidationOptions,
  type StrictnessLevel,
  mergeValidationResults,
} from './types/validation-result.js';
import { validateAgainstSchema, validateRequiredMetadata } from './core/schema-validator.js';
import { validateReferentialIntegrity } from './core/integrity-checker.js';
import { detectForbiddenPatterns, validateImmutabilityConstraints } from './core/pattern-detector.js';
import { validateOrganizationRules } from './rules/organization-rules.js';
import { validateTeamRules } from './rules/team-rules.js';
import { validatePolicyRules } from './rules/policy-rules.js';

/**
 * Manifest types supported by the validator
 */
export type ManifestType = 'organization' | 'team' | 'role' | 'capability' | 'policy' | 'unknown';

/**
 * Detect manifest type from content
 */
export function detectManifestType(manifest: unknown): ManifestType {
  if (typeof manifest !== 'object' || manifest === null) {
    return 'unknown';
  }

  const obj = manifest as Record<string, unknown>;

  // Check for explicit type declaration
  if ('$manifest_type' in obj && typeof obj['$manifest_type'] === 'string') {
    const declaredType = obj['$manifest_type'].toLowerCase();
    if (['organization', 'team', 'role', 'capability', 'policy'].includes(declaredType)) {
      return declaredType as ManifestType;
    }
  }

  // Infer type from content structure
  if ('organization_id' in obj || 'legal_status' in obj || 'jurisdiction' in obj) {
    return 'organization';
  }

  if ('team_id' in obj || ('members' in obj && 'organization_ref' in obj)) {
    return 'team';
  }

  if ('role_id' in obj || ('permissions' in obj && 'responsibilities' in obj)) {
    return 'role';
  }

  if ('capability_id' in obj || 'skills' in obj) {
    return 'capability';
  }

  if ('policy_id' in obj || ('constraints' in obj && 'effective_date' in obj)) {
    return 'policy';
  }

  return 'unknown';
}

/**
 * Complete manifest validation
 *
 * Performs all validation checks:
 * 1. Required metadata validation
 * 2. Schema validation (if schema provided)
 * 3. Referential integrity checking
 * 4. Forbidden pattern detection
 * 5. Immutability constraint validation
 * 6. Domain-specific rules (based on manifest type)
 *
 * @param manifest - The manifest to validate
 * @param options - Validation options
 * @param schema - Optional JSON Schema to validate against
 * @returns Complete validation result
 */
export function validateManifest(
  manifest: unknown,
  options: ValidationOptions = {},
  schema?: Record<string, unknown>
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';
  const results: ValidationResult[] = [];

  // Step 1: Validate required metadata
  results.push(validateRequiredMetadata(manifest, strictnessLevel));

  // Step 2: Schema validation if schema provided
  if (schema) {
    results.push(validateAgainstSchema(manifest, schema, options));
  }

  // Step 3: Referential integrity (if enabled)
  if (options.validateReferences !== false) {
    results.push(validateReferentialIntegrity(manifest, options));
  }

  // Step 4: Forbidden pattern detection (if enabled)
  if (options.checkForbiddenPatterns !== false) {
    results.push(detectForbiddenPatterns(manifest, options));
  }

  // Step 5: Immutability constraints
  results.push(validateImmutabilityConstraints(manifest, options));

  // Step 6: Domain-specific rules based on manifest type
  const manifestType = detectManifestType(manifest);

  switch (manifestType) {
    case 'organization':
      results.push(validateOrganizationRules(manifest, options));
      break;
    case 'team':
      results.push(validateTeamRules(manifest, options));
      break;
    case 'policy':
      results.push(validatePolicyRules(manifest, options));
      break;
    // role and capability rules would be added here
    default:
      // No specific rules for unknown type
      break;
  }

  const schemaVersion = (manifest as Record<string, unknown>)?.['$schema_version'] as string || '1.0.0';

  // Merge all results
  return mergeValidationResults(results, {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  });
}

/**
 * Quick validation check
 *
 * Performs minimal validation for quick rejection of invalid manifests.
 * Useful for pre-filtering before full validation.
 *
 * Checks:
 * 1. Manifest is an object
 * 2. Has required metadata fields
 * 3. No obvious placeholder values
 *
 * @param manifest - The manifest to validate
 * @returns True if manifest passes quick checks
 */
export function quickValidate(manifest: unknown): boolean {
  // Must be an object
  if (typeof manifest !== 'object' || manifest === null) {
    return false;
  }

  const obj = manifest as Record<string, unknown>;

  // Must have either $id or an identifier field
  const hasId = '$id' in obj ||
                'manifest_id' in obj ||
                'organization_id' in obj ||
                'team_id' in obj ||
                'policy_id' in obj ||
                'role_id' in obj ||
                'capability_id' in obj;

  if (!hasId) {
    return false;
  }

  // Must have $schema_version
  if (!('$schema_version' in obj)) {
    return false;
  }

  return true;
}

/**
 * Validate multiple manifests in batch
 *
 * @param manifests - Array of manifests to validate
 * @param options - Validation options
 * @param schema - Optional JSON Schema to validate against
 * @returns Array of validation results
 */
export function validateManifests(
  manifests: readonly unknown[],
  options: ValidationOptions = {},
  schema?: Record<string, unknown>
): ReadonlyArray<{ manifest: unknown; result: ValidationResult }> {
  return Object.freeze(
    manifests.map(manifest => Object.freeze({
      manifest,
      result: validateManifest(manifest, options, schema),
    }))
  );
}

/**
 * Get validation strictness level from string
 */
export function parseStrictnessLevel(level: string): StrictnessLevel {
  const normalized = level.toUpperCase();
  if (normalized === 'STRICT' || normalized === 'STANDARD' || normalized === 'PERMISSIVE') {
    return normalized as StrictnessLevel;
  }
  return 'STRICT'; // Default to STRICT
}

/**
 * Create default validation options
 */
export function createDefaultOptions(
  overrides: Partial<ValidationOptions> = {}
): ValidationOptions {
  return Object.freeze({
    strictnessLevel: 'STRICT',
    validateReferences: true,
    checkForbiddenPatterns: true,
    maxDepth: 100,
    ...overrides,
  });
}

/**
 * Module version
 */
export const VERSION = '1.0.0';

/**
 * Module information
 */
export const MODULE_INFO = Object.freeze({
  name: 'agentics-org-manifests/validation',
  version: VERSION,
  description: 'Pure validation functions for organizational truth manifests',
  features: [
    'JSON Schema validation',
    'Referential integrity checking',
    'Forbidden pattern detection',
    'Immutability constraint validation',
    'Domain-specific rules (organization, team, policy)',
  ],
  strictnessLevels: ['STRICT', 'STANDARD', 'PERMISSIVE'] as const,
});
