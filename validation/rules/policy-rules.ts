/**
 * Policy Rules
 *
 * Domain-specific validation rules for policy manifests.
 * Validates governance policies, constraints, and compliance requirements.
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
 * Required fields for policy manifests
 */
export const REQUIRED_POLICY_FIELDS: ReadonlyArray<string> = Object.freeze([
  'policy_id',
  'name',
  'type',
  'scope',
  'effective_date',
]);

/**
 * Valid policy types
 */
export const VALID_POLICY_TYPES: ReadonlyArray<string> = Object.freeze([
  'GOVERNANCE',
  'SECURITY',
  'COMPLIANCE',
  'ACCESS_CONTROL',
  'DATA_HANDLING',
  'OPERATIONAL',
  'FINANCIAL',
  'HR',
  'LEGAL',
  'TECHNICAL',
]);

/**
 * Valid policy statuses
 */
export const VALID_POLICY_STATUSES: ReadonlyArray<string> = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'DEPRECATED',
  'ARCHIVED',
]);

/**
 * Valid policy scopes
 */
export const VALID_POLICY_SCOPES: ReadonlyArray<string> = Object.freeze([
  'ORGANIZATION',
  'DEPARTMENT',
  'TEAM',
  'ROLE',
  'INDIVIDUAL',
  'GLOBAL',
]);

/**
 * Valid enforcement levels
 */
export const VALID_ENFORCEMENT_LEVELS: ReadonlyArray<string> = Object.freeze([
  'MANDATORY',
  'RECOMMENDED',
  'OPTIONAL',
  'INFORMATIONAL',
]);

/**
 * Validate policy manifest has required fields
 */
export function validatePolicyRequiredFields(
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
          'Policy manifest must be an object'
        ),
      ],
      {
        schemaVersion: 'unknown',
        validatedAt: new Date().toISOString(),
        checksPerformed: Object.freeze(['policy_required_fields']),
        strictnessLevel,
        durationMs: Date.now() - startTime,
      }
    );
  }

  const obj = manifest as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of REQUIRED_POLICY_FIELDS) {
    if (!(field in obj)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    if (strictnessLevel === 'STRICT' || strictnessLevel === 'STANDARD') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.REQUIRED_FIELD_MISSING,
          '$',
          `Policy manifest missing required fields: ${missingFields.join(', ')}`,
          { missingFields }
        )
      );
    } else {
      warnings.push(
        createValidationWarning(
          ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
          '$',
          `Policy manifest may be incomplete. Missing: ${missingFields.join(', ')}`
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['policy_required_fields']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate policy type
 */
export function validatePolicyType(
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
      checksPerformed: Object.freeze(['policy_type_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  if ('type' in obj && typeof obj['type'] === 'string') {
    if (!VALID_POLICY_TYPES.includes(obj['type'])) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.ENUM_INVALID,
          '$.type',
          `Invalid policy type: '${obj['type']}'. Valid types: ${VALID_POLICY_TYPES.join(', ')}`,
          { value: obj['type'], allowedValues: VALID_POLICY_TYPES }
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['policy_type_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate policy scope
 */
export function validatePolicyScope(
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
      checksPerformed: Object.freeze(['policy_scope_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  if ('scope' in obj) {
    const scope = obj['scope'];

    if (typeof scope === 'string') {
      if (!VALID_POLICY_SCOPES.includes(scope)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.ENUM_INVALID,
            '$.scope',
            `Invalid policy scope: '${scope}'. Valid scopes: ${VALID_POLICY_SCOPES.join(', ')}`,
            { value: scope, allowedValues: VALID_POLICY_SCOPES }
          )
        );
      }
    } else if (typeof scope === 'object' && scope !== null) {
      // Scope can be an object with level and targets
      const scopeObj = scope as Record<string, unknown>;

      if ('level' in scopeObj && typeof scopeObj['level'] === 'string') {
        if (!VALID_POLICY_SCOPES.includes(scopeObj['level'])) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.ENUM_INVALID,
              '$.scope.level',
              `Invalid policy scope level: '${scopeObj['level']}'`
            )
          );
        }
      }
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['policy_scope_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate policy constraints
 */
export function validatePolicyConstraints(
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
      checksPerformed: Object.freeze(['policy_constraints_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Validate constraints array if present
  if ('constraints' in obj) {
    const constraints = obj['constraints'];

    if (!Array.isArray(constraints)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.constraints',
          'Policy constraints must be an array'
        )
      );
    } else {
      constraints.forEach((constraint, index) => {
        const constraintPath = `$.constraints[${index}]`;

        if (typeof constraint !== 'object' || constraint === null) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.TYPE_MISMATCH,
              constraintPath,
              'Policy constraint must be an object'
            )
          );
          return;
        }

        const constraintObj = constraint as Record<string, unknown>;

        // Each constraint should have a type and rule
        if (!('type' in constraintObj) && !('rule' in constraintObj)) {
          if (strictnessLevel !== 'PERMISSIVE') {
            errors.push(
              createValidationError(
                ValidationErrorCodes.REQUIRED_FIELD_MISSING,
                constraintPath,
                'Policy constraint must have either type or rule'
              )
            );
          }
        }

        // Validate enforcement level if present
        if ('enforcement' in constraintObj && typeof constraintObj['enforcement'] === 'string') {
          if (!VALID_ENFORCEMENT_LEVELS.includes(constraintObj['enforcement'])) {
            errors.push(
              createValidationError(
                ValidationErrorCodes.ENUM_INVALID,
                `${constraintPath}.enforcement`,
                `Invalid enforcement level: '${constraintObj['enforcement']}'`
              )
            );
          }
        }
      });
    }
  }

  // Validate rules array if present
  if ('rules' in obj) {
    const rules = obj['rules'];

    if (!Array.isArray(rules)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.rules',
          'Policy rules must be an array'
        )
      );
    } else {
      rules.forEach((rule, index) => {
        const rulePath = `$.rules[${index}]`;

        if (typeof rule !== 'object' || rule === null) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.TYPE_MISMATCH,
              rulePath,
              'Policy rule must be an object'
            )
          );
          return;
        }

        const ruleObj = rule as Record<string, unknown>;

        // Rules should not contain executable code markers
        if ('execute' in ruleObj || 'script' in ruleObj || 'code' in ruleObj) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              rulePath,
              'Policy rules cannot contain executable code. Manifests are data, not programs.'
            )
          );
        }
      });
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['policy_constraints_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate policy effective dates
 */
export function validatePolicyDates(
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
      checksPerformed: Object.freeze(['policy_dates_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Validate effective_date
  if ('effective_date' in obj) {
    const effectiveDate = obj['effective_date'];

    if (typeof effectiveDate !== 'string') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.effective_date',
          'effective_date must be a string in ISO 8601 format'
        )
      );
    } else {
      const parsed = Date.parse(effectiveDate);
      if (isNaN(parsed)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.FORMAT_INVALID,
            '$.effective_date',
            `Invalid date format: '${effectiveDate}'. Expected ISO 8601 format.`
          )
        );
      }
    }
  }

  // Validate expiration_date if present
  if ('expiration_date' in obj) {
    const expirationDate = obj['expiration_date'];

    if (expirationDate !== null && typeof expirationDate !== 'string') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.expiration_date',
          'expiration_date must be a string in ISO 8601 format or null'
        )
      );
    } else if (typeof expirationDate === 'string') {
      const parsed = Date.parse(expirationDate);
      if (isNaN(parsed)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.FORMAT_INVALID,
            '$.expiration_date',
            `Invalid date format: '${expirationDate}'. Expected ISO 8601 format.`
          )
        );
      }

      // Validate expiration is after effective date
      if ('effective_date' in obj && typeof obj['effective_date'] === 'string') {
        const effectiveParsed = Date.parse(obj['effective_date']);
        if (!isNaN(effectiveParsed) && !isNaN(parsed) && parsed <= effectiveParsed) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              '$.expiration_date',
              'expiration_date must be after effective_date'
            )
          );
        }
      }
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['policy_dates_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate policy manifest against all policy-specific rules
 */
export function validatePolicyRules(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Collect all validation results
  const results: ValidationResult[] = [
    validatePolicyRequiredFields(manifest, options),
    validatePolicyType(manifest, options),
    validatePolicyScope(manifest, options),
    validatePolicyConstraints(manifest, options),
    validatePolicyDates(manifest, options),
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
 * Get list of required policy fields
 */
export function getRequiredPolicyFields(): ReadonlyArray<string> {
  return REQUIRED_POLICY_FIELDS;
}

/**
 * Get list of valid policy types
 */
export function getValidPolicyTypes(): ReadonlyArray<string> {
  return VALID_POLICY_TYPES;
}

/**
 * Get list of valid policy statuses
 */
export function getValidPolicyStatuses(): ReadonlyArray<string> {
  return VALID_POLICY_STATUSES;
}

/**
 * Get list of valid policy scopes
 */
export function getValidPolicyScopes(): ReadonlyArray<string> {
  return VALID_POLICY_SCOPES;
}

/**
 * Get list of valid enforcement levels
 */
export function getValidEnforcementLevels(): ReadonlyArray<string> {
  return VALID_ENFORCEMENT_LEVELS;
}
