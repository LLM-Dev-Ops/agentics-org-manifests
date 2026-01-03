/**
 * AC-02: Schema Validation Tests
 *
 * Verifies:
 * - All manifest files pass JSON Schema validation
 * - Zero required fields missing
 * - Zero type mismatches
 * - All cross-references resolve to valid entities
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Test fixtures paths
const FIXTURES_PATH = '/workspaces/agentics-org-manifests/tests/fixtures';
const SCHEMAS_PATH = '/workspaces/agentics-org-manifests/schemas';

// Helper to create fresh Ajv instance with schemas
function createAjvWithSchemas(): Ajv {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
  });
  addFormats(ajv);

  const primitivesSchema = JSON.parse(
    readFileSync(join(SCHEMAS_PATH, 'common/primitives.schema.json'), 'utf-8')
  );
  const identifiersSchema = JSON.parse(
    readFileSync(join(SCHEMAS_PATH, 'common/identifiers.schema.json'), 'utf-8')
  );
  const timestampsSchema = JSON.parse(
    readFileSync(join(SCHEMAS_PATH, 'common/timestamps.schema.json'), 'utf-8')
  );
  const metaSchema = JSON.parse(
    readFileSync(join(SCHEMAS_PATH, 'v1/_meta.schema.json'), 'utf-8')
  );

  ajv.addSchema(primitivesSchema, 'https://agentics.org/schemas/common/primitives.schema.json');
  ajv.addSchema(identifiersSchema, 'https://agentics.org/schemas/common/identifiers.schema.json');
  ajv.addSchema(timestampsSchema, 'https://agentics.org/schemas/common/timestamps.schema.json');
  ajv.addSchema(metaSchema, 'https://agentics.org/schemas/v1/_meta.schema.json');

  return ajv;
}

describe('AC-02: Schema Validation', () => {

  describe('Valid Manifest Validation', () => {
    it('should validate a complete organization manifest', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(validOrg);

      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate a complete team manifest', () => {
      const ajv = createAjvWithSchemas();
      const teamSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/team.schema.json'), 'utf-8')
      );
      const validTeam = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-team.json'), 'utf-8')
      );

      const validate = ajv.compile(teamSchema);
      const isValid = validate(validTeam);

      if (!isValid) {
        console.error('Validation errors:', validate.errors);
      }

      expect(isValid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject manifest with missing required $manifest field', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const missingManifest = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(missingManifest);

      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.some((e) => e.message?.includes('$manifest'))).toBe(true);
    });

    it('should reject manifest with missing required id field', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const missingId = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(missingId);

      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject manifest with missing observedAt timestamp', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const missingObservedAt = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(missingObservedAt);

      expect(isValid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });
  });

  describe('Type Mismatch Detection', () => {
    it('should reject manifest with invalid UUID format', () => {
      const ajv = createAjvWithSchemas();
      const teamSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/team.schema.json'), 'utf-8')
      );

      const invalidUuid = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
        id: 'not-a-valid-uuid',
        departmentId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test Team',
        function: 'engineering',
        headcount: 10,
        observedAt: '2024-01-15T11:00:00.000Z',
      };

      const validate = ajv.compile(teamSchema);
      const isValid = validate(invalidUuid);

      expect(isValid).toBe(false);
    });

    it('should reject manifest with invalid country code format', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const invalidCountry = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'INVALID',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(invalidCountry);

      expect(isValid).toBe(false);
    });

    it('should reject manifest with string where integer expected', () => {
      const ajv = createAjvWithSchemas();
      const teamSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/team.schema.json'), 'utf-8')
      );

      const invalidHeadcount = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
        id: '660e8400-e29b-41d4-a716-446655440010',
        departmentId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test Team',
        function: 'engineering',
        headcount: 'ten',
        observedAt: '2024-01-15T11:00:00.000Z',
      };

      const validate = ajv.compile(teamSchema);
      const isValid = validate(invalidHeadcount);

      expect(isValid).toBe(false);
    });

    it('should reject manifest with invalid date-time format', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const invalidTimestamp = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: 'not-a-datetime',
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(invalidTimestamp);

      expect(isValid).toBe(false);
    });

    it('should reject manifest with invalid enum value', () => {
      const ajv = createAjvWithSchemas();
      const teamSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/team.schema.json'), 'utf-8')
      );

      const invalidFunction = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
        id: '660e8400-e29b-41d4-a716-446655440010',
        departmentId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test Team',
        function: 'invalid-function-type',
        headcount: 10,
        observedAt: '2024-01-15T11:00:00.000Z',
      };

      const validate = ajv.compile(teamSchema);
      const isValid = validate(invalidFunction);

      expect(isValid).toBe(false);
    });
  });

  describe('Content Hash Format Validation', () => {
    it('should validate correct SHA-256 hash format', () => {
      const hashPattern = /^sha256:[a-f0-9]{64}$/;

      const validHashes = [
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ];

      validHashes.forEach((hash) => {
        expect(hash).toMatch(hashPattern);
      });
    });

    it('should reject invalid hash formats', () => {
      const hashPattern = /^sha256:[a-f0-9]{64}$/;

      const invalidHashes = [
        'sha256:tooshort',
        'sha256:UPPERCASE',
        'md5:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '',
        'sha256:',
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855extra',
      ];

      invalidHashes.forEach((hash) => {
        expect(hash).not.toMatch(hashPattern);
      });
    });
  });

  describe('Nested Object Validation', () => {
    it('should validate nested department objects in organization', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const orgWithInvalidDepartment = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
        departments: [
          {
            id: 'invalid-uuid',
            name: 'Engineering',
            headcount: -5,
          },
        ],
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(orgWithInvalidDepartment);

      expect(isValid).toBe(false);
    });

    it('should validate nested systemOwnerships in team', () => {
      const ajv = createAjvWithSchemas();
      const teamSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/team.schema.json'), 'utf-8')
      );

      const teamWithInvalidOwnership = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
        id: '660e8400-e29b-41d4-a716-446655440010',
        departmentId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test Team',
        function: 'infrastructure',
        headcount: 12,
        observedAt: '2024-01-15T11:00:00.000Z',
        systemOwnerships: [
          {
            systemId: 'invalid-uuid',
            ownershipType: 'invalid-type',
            since: 'not-a-date',
          },
        ],
      };

      const validate = ajv.compile(teamSchema);
      const isValid = validate(teamWithInvalidOwnership);

      expect(isValid).toBe(false);
    });
  });

  describe('Additional Properties Constraint', () => {
    it('should reject manifest with additional undefined properties', () => {
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const orgWithExtraProps = {
        $manifest: {
          version: '1.0.0',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2024-01-15T10:30:00.000Z',
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Org',
        legalName: 'Test Legal Name',
        incorporationCountry: 'US',
        fiscalYearEnd: '12-31',
        observedAt: '2024-01-15T10:30:00.000Z',
        dataSource: {
          type: 'legal-records',
          identifier: 'test',
          extractedAt: '2024-01-15T10:00:00.000Z',
        },
        undefinedProperty: 'should not be here',
        anotherExtra: 123,
      };

      const validate = ajv.compile(organizationSchema);
      const isValid = validate(orgWithExtraProps);

      expect(isValid).toBe(false);
      expect(validate.errors?.some((e) => e.keyword === 'additionalProperties')).toBe(true);
    });
  });
});
