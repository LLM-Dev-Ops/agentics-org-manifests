/**
 * Repository Governance Rules
 *
 * Domain-specific validation rules for repository governance manifests.
 * Validates access control declarations, environment scoping, and compliance boundaries.
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
 * Valid repository identifiers for Agentics platform
 */
export const KNOWN_REPOSITORIES: ReadonlyArray<string> = Object.freeze([
  'agentics-simulation-engine',
  'enterprise-roi-engine',
]);

/**
 * Valid environment scopes
 */
export const VALID_ENVIRONMENT_SCOPES: ReadonlyArray<string> = Object.freeze([
  'development',
  'staging',
  'sandbox',
  'audit-only',
  'executive-review',
  'production',
]);

/**
 * Valid access roles
 */
export const VALID_ACCESS_ROLES: ReadonlyArray<string> = Object.freeze([
  'initiator',
  'observer',
  'read-only',
]);

/**
 * Valid visibility boundary types
 */
export const VALID_VISIBILITY_BOUNDARIES: ReadonlyArray<string> = Object.freeze([
  'organization-internal',
  'cross-organization',
  'partner-visible',
  'public-aggregated',
]);

/**
 * Valid data classification levels
 */
export const VALID_DATA_CLASSIFICATIONS: ReadonlyArray<string> = Object.freeze([
  'public',
  'internal',
  'confidential',
  'restricted',
  'regulatory-sensitive',
]);

/**
 * Required fields for repository governance manifests
 */
export const REQUIRED_GOVERNANCE_FIELDS: ReadonlyArray<string> = Object.freeze([
  '$manifest',
  'id',
  'repository',
  'organizationId',
  'effectiveDate',
  'observedAt',
]);

/**
 * Validate that governance manifest has required fields
 */
export function validateGovernanceRequiredFields(
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
          'Repository governance manifest must be an object'
        ),
      ],
      {
        schemaVersion: 'unknown',
        validatedAt: new Date().toISOString(),
        checksPerformed: Object.freeze(['governance_required_fields']),
        strictnessLevel,
        durationMs: Date.now() - startTime,
      }
    );
  }

  const obj = manifest as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of REQUIRED_GOVERNANCE_FIELDS) {
    if (!(field in obj)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    errors.push(
      createValidationError(
        ValidationErrorCodes.REQUIRED_FIELD_MISSING,
        '$',
        `Repository governance manifest missing required fields: ${missingFields.join(', ')}`,
        { missingFields }
      )
    );
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['governance_required_fields']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate environment scope values
 */
export function validateEnvironmentScopes(
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
      checksPerformed: Object.freeze(['environment_scope_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Recursively check for environment arrays
  function checkEnvironments(data: unknown, path: string): void {
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        checkEnvironments(item, `${path}[${index}]`);
      });
    } else if (typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(objData)) {
        const fieldPath = `${path}.${key}`;

        if (key === 'environments' && Array.isArray(value)) {
          value.forEach((env, index) => {
            if (typeof env === 'string' && !VALID_ENVIRONMENT_SCOPES.includes(env)) {
              errors.push(
                createValidationError(
                  ValidationErrorCodes.ENUM_INVALID,
                  `${fieldPath}[${index}]`,
                  `Invalid environment scope: '${env}'. Valid scopes: ${VALID_ENVIRONMENT_SCOPES.join(', ')}`
                )
              );
            }
          });
        } else if (key === 'environmentRestrictions' && Array.isArray(value)) {
          value.forEach((env, index) => {
            if (typeof env === 'string' && !VALID_ENVIRONMENT_SCOPES.includes(env)) {
              errors.push(
                createValidationError(
                  ValidationErrorCodes.ENUM_INVALID,
                  `${fieldPath}[${index}]`,
                  `Invalid environment restriction: '${env}'. Valid scopes: ${VALID_ENVIRONMENT_SCOPES.join(', ')}`
                )
              );
            }
          });
        } else {
          checkEnvironments(value, fieldPath);
        }
      }
    }
  }

  checkEnvironments(obj, '$');

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['environment_scope_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate access role values
 */
export function validateAccessRoles(
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
      checksPerformed: Object.freeze(['access_role_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Recursively check for accessRole fields
  function checkAccessRoles(data: unknown, path: string): void {
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        checkAccessRoles(item, `${path}[${index}]`);
      });
    } else if (typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(objData)) {
        const fieldPath = `${path}.${key}`;

        if (key === 'accessRole' && typeof value === 'string') {
          if (!VALID_ACCESS_ROLES.includes(value)) {
            errors.push(
              createValidationError(
                ValidationErrorCodes.ENUM_INVALID,
                fieldPath,
                `Invalid access role: '${value}'. Valid roles: ${VALID_ACCESS_ROLES.join(', ')}`
              )
            );
          }
        } else {
          checkAccessRoles(value, fieldPath);
        }
      }
    }
  }

  checkAccessRoles(obj, '$');

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['access_role_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate execution vs visibility separation
 *
 * Ensures that execution authority and visibility are properly separated
 * (a key architectural principle for the governance manifests)
 */
export function validateExecutionVisibilitySeparation(
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
      checksPerformed: Object.freeze(['execution_visibility_separation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  // Check that initiator grants only use 'initiator' role
  function checkInitiatorGrants(grants: unknown, path: string): void {
    if (!Array.isArray(grants)) return;

    grants.forEach((grant, index) => {
      if (typeof grant === 'object' && grant !== null) {
        const grantObj = grant as Record<string, unknown>;
        if (grantObj['accessRole'] && grantObj['accessRole'] !== 'initiator') {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              `${path}[${index}].accessRole`,
              `Initiator grants must use 'initiator' role, found: '${grantObj['accessRole']}'`
            )
          );
        }
      }
    });
  }

  // Check that observer grants only use 'observer' role
  function checkObserverGrants(grants: unknown, path: string): void {
    if (!Array.isArray(grants)) return;

    grants.forEach((grant, index) => {
      if (typeof grant === 'object' && grant !== null) {
        const grantObj = grant as Record<string, unknown>;
        if (grantObj['accessRole'] && grantObj['accessRole'] !== 'observer') {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              `${path}[${index}].accessRole`,
              `Observer grants must use 'observer' role, found: '${grantObj['accessRole']}'`
            )
          );
        }
      }
    });
  }

  // Check that reader grants only use 'read-only' role
  function checkReaderGrants(grants: unknown, path: string): void {
    if (!Array.isArray(grants)) return;

    grants.forEach((grant, index) => {
      if (typeof grant === 'object' && grant !== null) {
        const grantObj = grant as Record<string, unknown>;
        if (grantObj['accessRole'] && grantObj['accessRole'] !== 'read-only') {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              `${path}[${index}].accessRole`,
              `Reader grants must use 'read-only' role, found: '${grantObj['accessRole']}'`
            )
          );
        }
      }
    });
  }

  // Check execution governance
  if ('executionGovernance' in obj) {
    const execGov = obj['executionGovernance'] as Record<string, unknown>;
    if (execGov && 'initiatorGrants' in execGov) {
      checkInitiatorGrants(execGov['initiatorGrants'], '$.executionGovernance.initiatorGrants');
    }
  }

  // Check simulation initiation
  if ('simulationInitiation' in obj) {
    const simInit = obj['simulationInitiation'] as Record<string, unknown>;
    if (simInit && 'initiatorGrants' in simInit) {
      checkInitiatorGrants(simInit['initiatorGrants'], '$.simulationInitiation.initiatorGrants');
    }
  }

  // Check output visibility
  if ('outputVisibility' in obj) {
    const outVis = obj['outputVisibility'] as Record<string, unknown>;
    if (outVis) {
      if ('liveOutputGrants' in outVis) {
        checkObserverGrants(outVis['liveOutputGrants'], '$.outputVisibility.liveOutputGrants');
      }
      if ('completedOutputGrants' in outVis) {
        checkReaderGrants(outVis['completedOutputGrants'], '$.outputVisibility.completedOutputGrants');
      }
    }
  }

  // Check simulation output visibility
  if ('simulationOutputVisibility' in obj) {
    const simVis = obj['simulationOutputVisibility'] as Record<string, unknown>;
    if (simVis) {
      if ('liveSimulationObservers' in simVis) {
        checkObserverGrants(simVis['liveSimulationObservers'], '$.simulationOutputVisibility.liveSimulationObservers');
      }
      if ('completedSimulationReaders' in simVis) {
        checkReaderGrants(simVis['completedSimulationReaders'], '$.simulationOutputVisibility.completedSimulationReaders');
      }
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['execution_visibility_separation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate that no business logic is embedded in manifests
 *
 * Governance manifests must be purely declarative - no calculations,
 * simulation behavior, ERP abstractions, or executable code
 */
export function validateNoBusinessLogic(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Patterns that suggest embedded business logic
  const BUSINESS_LOGIC_PATTERNS: ReadonlyArray<{
    readonly pattern: RegExp;
    readonly description: string;
  }> = [
    { pattern: /\bfunction\s*\(/, description: 'Function declaration' },
    { pattern: /\b(if|else|switch|case)\b/, description: 'Conditional logic' },
    { pattern: /\b(for|while|do)\b/, description: 'Loop construct' },
    { pattern: /\bcalculate|compute|derive\b/i, description: 'Calculation marker' },
    { pattern: /\bformula|equation\b/i, description: 'Formula marker' },
    { pattern: /\b(roi|npv|irr)\s*=/i, description: 'Financial calculation' },
    { pattern: /\bsimulate|model|predict\b/i, description: 'Simulation logic' },
    { pattern: /=>\s*\{/, description: 'Arrow function' },
    { pattern: /\$\{[^}]+\}/, description: 'Template interpolation' },
  ];

  if (typeof manifest !== 'object' || manifest === null) {
    return createSuccessResult({
      schemaVersion: '1.0.0',
      validatedAt: new Date().toISOString(),
      checksPerformed: Object.freeze(['no_business_logic']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  function checkForBusinessLogic(data: unknown, path: string): void {
    if (typeof data === 'string') {
      for (const { pattern, description } of BUSINESS_LOGIC_PATTERNS) {
        if (pattern.test(data)) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
              path,
              `Business logic detected: ${description}. Governance manifests must be purely declarative.`
            )
          );
        }
      }
    } else if (Array.isArray(data)) {
      data.forEach((item, index) => {
        checkForBusinessLogic(item, `${path}[${index}]`);
      });
    } else if (typeof data === 'object' && data !== null) {
      const objData = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(objData)) {
        checkForBusinessLogic(value, `${path}.${key}`);
      }
    }
  }

  checkForBusinessLogic(obj, '$');

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['no_business_logic']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate repository governance manifest against all governance-specific rules
 */
export function validateRepositoryGovernanceRules(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Collect all validation results
  const results: ValidationResult[] = [
    validateGovernanceRequiredFields(manifest, options),
    validateEnvironmentScopes(manifest, options),
    validateAccessRoles(manifest, options),
    validateExecutionVisibilitySeparation(manifest, options),
    validateNoBusinessLogic(manifest, options),
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
 * Get list of valid environment scopes
 */
export function getValidEnvironmentScopes(): ReadonlyArray<string> {
  return VALID_ENVIRONMENT_SCOPES;
}

/**
 * Get list of valid access roles
 */
export function getValidAccessRoles(): ReadonlyArray<string> {
  return VALID_ACCESS_ROLES;
}

/**
 * Get list of known Agentics repositories
 */
export function getKnownRepositories(): ReadonlyArray<string> {
  return KNOWN_REPOSITORIES;
}
