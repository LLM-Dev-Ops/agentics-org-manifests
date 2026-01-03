/**
 * Team Rules
 *
 * Domain-specific validation rules for team manifests.
 * Validates team composition, membership, and structure.
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
 * Required fields for team manifests
 */
export const REQUIRED_TEAM_FIELDS: ReadonlyArray<string> = Object.freeze([
  'team_id',
  'name',
  'organization_ref',
]);

/**
 * Valid team types
 */
export const VALID_TEAM_TYPES: ReadonlyArray<string> = Object.freeze([
  'ENGINEERING',
  'PRODUCT',
  'DESIGN',
  'OPERATIONS',
  'SUPPORT',
  'SALES',
  'MARKETING',
  'FINANCE',
  'LEGAL',
  'HR',
  'EXECUTIVE',
  'CROSS_FUNCTIONAL',
  'PROJECT',
  'OTHER',
]);

/**
 * Valid team statuses
 */
export const VALID_TEAM_STATUSES: ReadonlyArray<string> = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'FORMING',
  'DISSOLVED',
  'REORGANIZING',
]);

/**
 * Valid member roles within a team
 */
export const VALID_MEMBER_ROLES: ReadonlyArray<string> = Object.freeze([
  'LEAD',
  'MANAGER',
  'MEMBER',
  'CONTRIBUTOR',
  'ADVISOR',
  'OBSERVER',
]);

/**
 * Validate team manifest has required fields
 */
export function validateTeamRequiredFields(
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
          'Team manifest must be an object'
        ),
      ],
      {
        schemaVersion: 'unknown',
        validatedAt: new Date().toISOString(),
        checksPerformed: Object.freeze(['team_required_fields']),
        strictnessLevel,
        durationMs: Date.now() - startTime,
      }
    );
  }

  const obj = manifest as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of REQUIRED_TEAM_FIELDS) {
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
          `Team manifest missing required fields: ${missingFields.join(', ')}`,
          { missingFields }
        )
      );
    } else {
      warnings.push(
        createValidationWarning(
          ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
          '$',
          `Team manifest may be incomplete. Missing: ${missingFields.join(', ')}`
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['team_required_fields']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate team type
 */
export function validateTeamType(
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
      checksPerformed: Object.freeze(['team_type_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  if ('team_type' in obj && typeof obj['team_type'] === 'string') {
    if (!VALID_TEAM_TYPES.includes(obj['team_type'])) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.ENUM_INVALID,
          '$.team_type',
          `Invalid team type: '${obj['team_type']}'. Valid types: ${VALID_TEAM_TYPES.join(', ')}`,
          { value: obj['team_type'], allowedValues: VALID_TEAM_TYPES }
        )
      );
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['team_type_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate team members structure and roles
 */
export function validateTeamMembers(
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
      checksPerformed: Object.freeze(['team_members_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;

  if ('members' in obj) {
    const members = obj['members'];

    if (!Array.isArray(members)) {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.members',
          'Team members must be an array'
        )
      );
    } else {
      // Validate each member
      const seenMemberIds = new Set<string>();

      members.forEach((member, index) => {
        const memberPath = `$.members[${index}]`;

        if (typeof member !== 'object' || member === null) {
          errors.push(
            createValidationError(
              ValidationErrorCodes.TYPE_MISMATCH,
              memberPath,
              'Team member must be an object'
            )
          );
          return;
        }

        const memberObj = member as Record<string, unknown>;

        // Check for required member fields
        if (!('member_id' in memberObj) && !('person_ref' in memberObj)) {
          if (strictnessLevel !== 'PERMISSIVE') {
            errors.push(
              createValidationError(
                ValidationErrorCodes.REQUIRED_FIELD_MISSING,
                memberPath,
                'Team member must have either member_id or person_ref'
              )
            );
          }
        }

        // Check for duplicate member IDs
        const memberId = (memberObj['member_id'] || memberObj['person_ref']) as string | undefined;
        if (memberId) {
          if (seenMemberIds.has(memberId)) {
            errors.push(
              createValidationError(
                ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
                memberPath,
                `Duplicate member ID: ${memberId}`
              )
            );
          } else {
            seenMemberIds.add(memberId);
          }
        }

        // Validate member role if present
        if ('role' in memberObj && typeof memberObj['role'] === 'string') {
          if (!VALID_MEMBER_ROLES.includes(memberObj['role'])) {
            errors.push(
              createValidationError(
                ValidationErrorCodes.ENUM_INVALID,
                `${memberPath}.role`,
                `Invalid member role: '${memberObj['role']}'. Valid roles: ${VALID_MEMBER_ROLES.join(', ')}`
              )
            );
          }
        }
      });

      // Check team has at least one lead
      const hasLead = members.some(
        (m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>)['role'] === 'LEAD'
      );

      if (!hasLead && strictnessLevel === 'STRICT') {
        warnings.push(
          createValidationWarning(
            ValidationWarningCodes.OPTIONAL_FIELD_EMPTY,
            '$.members',
            'Team has no member with LEAD role'
          )
        );
      }
    }
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['team_members_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate team hierarchy (parent/child relationships)
 */
export function validateTeamHierarchy(
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
      checksPerformed: Object.freeze(['team_hierarchy_validation']),
      strictnessLevel,
      durationMs: Date.now() - startTime,
    });
  }

  const obj = manifest as Record<string, unknown>;
  const teamId = obj['team_id'] as string | undefined;

  // Check parent_team_ref if present
  if ('parent_team_ref' in obj) {
    const parentRef = obj['parent_team_ref'];

    if (typeof parentRef !== 'string') {
      errors.push(
        createValidationError(
          ValidationErrorCodes.TYPE_MISMATCH,
          '$.parent_team_ref',
          'parent_team_ref must be a string reference'
        )
      );
    } else {
      // Check it's not self-referential
      if (teamId && parentRef.includes(teamId)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.CIRCULAR_REFERENCE,
            '$.parent_team_ref',
            'Team cannot be its own parent'
          )
        );
      }

      // Validate reference format (should be external reference or ID)
      if (!parentRef.startsWith('manifest://') && !parentRef.match(/^[a-zA-Z0-9_-]+$/)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.INVALID_EXTERNAL_REFERENCE,
            '$.parent_team_ref',
            'parent_team_ref must be a valid reference format'
          )
        );
      }
    }
  }

  // Check child_teams if present
  if ('child_teams' in obj && Array.isArray(obj['child_teams'])) {
    const childTeams = obj['child_teams'] as unknown[];
    const seenChildren = new Set<string>();

    childTeams.forEach((child, index) => {
      const childPath = `$.child_teams[${index}]`;

      if (typeof child !== 'string') {
        errors.push(
          createValidationError(
            ValidationErrorCodes.TYPE_MISMATCH,
            childPath,
            'Child team reference must be a string'
          )
        );
        return;
      }

      // Check for duplicates
      if (seenChildren.has(child)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.FORBIDDEN_PATTERN_DETECTED,
            childPath,
            `Duplicate child team reference: ${child}`
          )
        );
      } else {
        seenChildren.add(child);
      }

      // Check not self-referential
      if (teamId && child.includes(teamId)) {
        errors.push(
          createValidationError(
            ValidationErrorCodes.CIRCULAR_REFERENCE,
            childPath,
            'Team cannot be its own child'
          )
        );
      }
    });
  }

  const schemaVersion = obj['$schema_version'] as string || '1.0.0';

  const metadata = {
    schemaVersion,
    validatedAt: new Date().toISOString(),
    checksPerformed: Object.freeze(['team_hierarchy_validation']),
    strictnessLevel,
    durationMs: Date.now() - startTime,
  };

  if (errors.length === 0) {
    return createSuccessResult(metadata, warnings);
  }

  return createFailureResult(errors, metadata, warnings);
}

/**
 * Validate team manifest against all team-specific rules
 */
export function validateTeamRules(
  manifest: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  const startTime = Date.now();
  const strictnessLevel = options.strictnessLevel ?? 'STRICT';

  // Collect all validation results
  const results: ValidationResult[] = [
    validateTeamRequiredFields(manifest, options),
    validateTeamType(manifest, options),
    validateTeamMembers(manifest, options),
    validateTeamHierarchy(manifest, options),
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
 * Get list of required team fields
 */
export function getRequiredTeamFields(): ReadonlyArray<string> {
  return REQUIRED_TEAM_FIELDS;
}

/**
 * Get list of valid team types
 */
export function getValidTeamTypes(): ReadonlyArray<string> {
  return VALID_TEAM_TYPES;
}

/**
 * Get list of valid team statuses
 */
export function getValidTeamStatuses(): ReadonlyArray<string> {
  return VALID_TEAM_STATUSES;
}

/**
 * Get list of valid member roles
 */
export function getValidMemberRoles(): ReadonlyArray<string> {
  return VALID_MEMBER_ROLES;
}
