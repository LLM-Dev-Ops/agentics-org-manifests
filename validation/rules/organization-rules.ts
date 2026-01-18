/**
 * Organization Rules
 *
 * Domain-specific validation rules for organization manifests.
 * Implements business rules from SPARC_REFINEMENT.
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
  ValidationWarningCodes,
  createValidationError,
  createValidationWarning,
  createSuccessResult,
  createFailureResult,
} from '../types/validation-result.js';

/**
 * Required sections for a complete organization manifest per SPARC_REFINEMENT
 */
export const REQUIRED_ORGANIZATION_SECTIONS: ReadonlyArray<string> = Object.freeze([
  'identification',
  'legal_status',
  'jurisdiction',
  'formation',
  'governance',
  'registered_agent',
  'principal_address',
]);

/**
 * Valid organization entity types
 */
export const VALID_ENTITY_TYPES: ReadonlyArray<string> = Object.freeze([
  'CORPORATION',
  'LLC',
  'PARTNERSHIP',
  'NONPROFIT',
  'SOLE_PROPRIETORSHIP',
  'TRUST',
  'GOVERNMENT',
  'COOPERATIVE',
]);

/**
 * Valid organization statuses
 */
export const VALID_ORGANIZATION_STATUSES: ReadonlyArray<string> = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'DISSOLVED',
  'SUSPENDED',
  'PENDING',
  'MERGED',
]);

/**
 * Valid governance types
 */
export const VALID_GOVERNANCE_TYPES: ReadonlyArray<string> = Object.freeze([
  'BOARD_MANAGED',
  'MEMBER_MANAGED',
  'MANAGER_MANAGED',
  'SOLE_PROPRIETOR',
  'TRUSTEE_MANAGED',
]);

/**
 * Stripe customer ID pattern (starts with cus_ prefix)
 */
export const STRIPE_CUSTOMER_ID_PATTERN = /^cus_[a-zA-Z0-9]{14,}$/;

/**
 * Validate that organization manifest has all required sections
 */
export function validateOrganizationCompleteness(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    return createFailureResult(
      [
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$',
          'Organization manifest must be an object'
        ),
      ],
      {
        schemaVersion: 'unknown',
        validatedAt: new Date().toISOString(),
        checksPerformed: Object.freeze(['organization_completeness']),
        strictnessLevel,
        durationMs: Date.now() - startTime,
      }
    );
  }

  const obj = manifest as Record<string, unknown>;
  const missingSections: string[] = [];

  for (const section of REQUIRED_ORGANIZATION_SECTIONS) {
    if (!(section in obj)) {
      missingSections.push(section);
    } else if (!isSectionComplete(obj[section], section)) {
      // Section exists but may be incomplete
      if (strictnessLevel === 'STRICT') {
        warnings.push(
          createValidationWarning(
            ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
            `$.${section}`,
            `Section '${section}' may be incomplete`
          )
        );
      }
    }
  }

  if (missingSections.length > 0) {
    if (strictnessLevel === 'STRICT' || strictnessLevel === 'STANDARD') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.REQUIRED_SECTION_INCOMPLETE,
          '$',
          `Organization manifest is incomplete. Missing sections: ${missingSections.join(', ')}`,
          { missingSections }
        )
      );
    } else {
      // PERMISSIVE mode - warn only
      warnings.push(
        createValidationWarning(
          ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
          '$',
          `Organization manifest may be incomplete. Missing sections: ${missingSections.join(', ')}`
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['organization_completeness']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Check if a section has required content
 */
function isSectionComplete(section: unknown, sectionName: string): boolean {
  if (typeof section !== 'object' || section === null) {
    return false;
  }

  const obj = section as Record<string, unknown>;

  // Each section has minimum required fields
  switch (sectionName) {
    case 'identification':
      return 'organization_id' in obj || 'manifest_id' in obj;
    case 'legal_status':
      return 'entity_type' in obj && 'status' in obj;
    case 'jurisdiction':
      return 'formation_jurisdiction' in obj;
    case 'formation':
      return 'formation_date' in obj;
    case 'governance':
      return 'governance_type' in obj;
    case 'registered_agent':
      return 'agent_name' in obj || 'agent_type' in obj;
    case 'principal_address':
      return 'country' in obj || 'street' in obj;
    default:
      return Object.keys(obj).length > 0;
  }
}

/**
 * Validate organization entity type
 */
export function validateEntityType(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    return createSuccessResult({
      schemaVersion: '1.0.0',
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['entity_type_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Look for entity_type in legal_status section or root
  let entityType: unknown = null;
  let path = '$';

  if ('legal_status' in obj && typeof obj['legal_status'] === 'object' && obj['legal_status'] !== null) {
    const legalStatus = obj['legal_status'] as Record<string, unknown>;
    if ('entity_type' in legalStatus) {
      entityType = legalStatus['entity_type'];
      path = '$.legal_status.entity_type';
    }
  } else if ('entity_type' in obj) {
    entityType = obj['entity_type'];
    path = '$.entity_type';
  }

  if (entityType !== null && typeof entityType === 'string') {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.ENUM_INVALID,
          path,
          `Invalid entity type: '${entityType}'. Valid types: ${VALID_ENTITY_TYPES.join(', ')}`,
          { value: entityType, allowedValues: VALID_ENTITY_TYPES }
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['entity_type_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate organization status
 */
export function validateOrganizationStatus(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    return createSuccessResult({
      schemaVersion: '1.0.0',
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['organization_status_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Look for status in legal_status section or root
  let status: unknown = null;
  let path = '$';

  if ('legal_status' in obj && typeof obj['legal_status'] === 'object' && obj['legal_status'] !== null) {
    const legalStatus = obj['legal_status'] as Record<string, unknown>;
    if ('status' in legalStatus) {
      status = legalStatus['status'];
      path = '$.legal_status.status';
    }
  } else if ('status' in obj) {
    status = obj['status'];
    path = '$.status';
  }

  if (status !== null && typeof status === 'string') {
    if (!VALID_ORGANIZATION_STATUSES.includes(status)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.ENUM_INVALID,
          path,
          `Invalid organization status: '${status}'. Valid statuses: ${VALID_ORGANIZATION_STATUSES.join(', ')}`,
          { value: status, allowedValues: VALID_ORGANIZATION_STATUSES }
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['organization_status_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate no speculative future state per SPARC_REFINEMENT
 * Manifests should not contain projections or conditional data
 */
export function validateNoSpeculativeData(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Speculative field patterns
  const speculativePatterns: ReadonlyArray<{ pattern: RegExp; description: string }> = [
    { pattern: /^projected_/i, description: 'Projected values' },
    { pattern: /^expected_/i, description: 'Expected values' },
    { pattern: /^anticipated_/i, description: 'Anticipated values' },
    { pattern: /^planned_/i, description: 'Planned values' },
    { pattern: /^estimated_/i, description: 'Estimated values' },
    { pattern: /^if_/i, description: 'Conditional values' },
    { pattern: /^proposed_/i, description: 'Proposed values' },
    { pattern: /_pending$/i, description: 'Pending state markers' },
  ];

  function checkRecursively(data: unknown, path: string): void {
    if (typeof data !== 'object' || data === null) {
      return;
    }

    const obj = data as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      const fieldPath = `${path}.${key}`;

      for (const { pattern, description } of speculativePatterns) {
        if (pattern.test(key)) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              fieldPath,
              `Speculative data detected: ${description}. Manifests should only contain factual, current state.`,
              { fieldName: key, category: 'SPECULATIVE' }
            )
          );
        }
      }

      // Recursively check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkRecursively(obj[key], fieldPath);
      }
    }
  }

  if (typeof manifest === 'object' && manifest !== null) {
    checkRecursively(manifest, '$');
  }

  const schemaVersion = (manifest as Record<string, unknown>)?.['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['no_speculative_data']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate Stripe customer ID format if present
 */
export function validateStripeCustomerId(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    return createSuccessResult({
      schemaVersion: '1.0.0',
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['stripe_customer_id_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;
  const stripeCustomerId = obj['stripeCustomerId'];

  // stripeCustomerId is optional (nullable) - only validate if present and non-null
  if (stripeCustomerId !== undefined && stripeCustomerId !== null) {
    if (typeof stripeCustomerId !== 'string') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.stripeCustomerId',
          'stripeCustomerId must be a string or null',
          { actualType: typeof stripeCustomerId }
        )
      );
    } else if (!STRIPE_CUSTOMER_ID_PATTERN.test(stripeCustomerId)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.PATTERN_INVALID,
          '$.stripeCustomerId',
          `Invalid Stripe customer ID format: '${stripeCustomerId}'. Must match pattern: cus_XXXXXXXXXXXXXX`,
          { value: stripeCustomerId, pattern: STRIPE_CUSTOMER_ID_PATTERN.source }
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['stripe_customer_id_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate deletion safety: prevent DISSOLVED status if Stripe customer exists
 * Per SPARC requirement: orgs with Stripe customers require soft delete only
 */
export function validateDeletionSafety(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  if (typeof manifest !== 'object' || manifest === null) {
    return createSuccessResult({
      schemaVersion: '1.0.0',
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['deletion_safety']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;
  const stripeCustomerId = obj['stripeCustomerId'];

  // Get organization status
  let status: unknown = null;
  if ('legal_status' in obj && typeof obj['legal_status'] === 'object' && obj['legal_status'] !== null) {
    const legalStatus = obj['legal_status'] as Record<string, unknown>;
    status = legalStatus['status'];
  } else if ('status' in obj) {
    status = obj['status'];
  }

  // If org has a Stripe customer and status is DISSOLVED, reject
  if (stripeCustomerId !== undefined && stripeCustomerId !== null && status === 'DISSOLVED') {
    errors.push(
      createValidationError(
        ValidationErrorCodes.INTEGRITY_VIOLATION,
        '$.status',
        'Cannot dissolve organization with active Stripe customer. Use SUSPENDED status for soft delete.',
        {
          stripeCustomerId,
          currentStatus: status,
          suggestion: 'Set status to SUSPENDED instead of DISSOLVED',
        }
      )
    );
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['deletion_safety']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate organization manifest against all organization-specific rules
 */
export function validateOrganizationRules(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Collect all validation results
  const results: ValidationResult[] = [
    validateOrganizationCompleteness(manifest, options),
    validateEntityType(manifest, options),
    validateOrganizationStatus(manifest, options),
    validateNoSpeculativeData(manifest, options),
    validateStripeCustomerId(manifest, options),
    validateDeletionSafety(manifest, options),
  ];

  // Merge all errors and warnings
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const allChecks: string[] = [];

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    allChecks.push(...result.metadata.checksPerformed);
  }

  const schemaVersion = (manifest as Record<string, unknown>)?.['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(Array.from(new Set(allChecks))),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (allErrors.length === 0) {
    return createSuccessResult(metadata, allWarnings);
  }

  return createFailureResult(allErrors, metadata, allWarnings);
}

/**
 * Get list of required organization sections
 */
export function getRequiredOrganizationSections(): ReadonlyArray<string> {
  return REQUIRED_ORGANIZATION_SECTIONS;
}

/**
 * Get list of valid entity types
 */
export function getValidEntityTypes(): ReadonlyArray<string> {
  return VALID_ENTITY_TYPES;
}

/**
 * Get list of valid organization statuses
 */
export function getValidOrganizationStatuses(): ReadonlyArray<string> {
  return VALID_ORGANIZATION_STATUSES;
}
