/**
 * Manifest Lifecycle Integration Tests
 *
 * Tests the complete lifecycle of organizational truth manifests:
 * 1. Creation and validation
 * 2. Versioning and lineage tracking
 * 3. Immutability enforcement
 * 4. Reference resolution
 * 5. Content hash verification
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  computeContentHash,
  verifyContentHash,
  canonicalizeContent,
} from '../../versioning/core/content-hasher.js';
import {
  deepFreeze,
  createImmutableManifest,
  checkDeepFrozen,
  enforceImmutability,
  validateManifestIntegrity,
} from '../../versioning/core/immutability-guard.js';
import {
  createVersionedManifest,
  deriveVersion,
  verifyVersion,
  compareVersions,
} from '../../versioning/index.js';
import {
  detectForbiddenPatterns,
  validateImmutabilityConstraints,
  checkValueForPatterns,
  isPlaceholder,
} from '../../validation/core/pattern-detector.js';
import type { ContentHash } from '../../versioning/types/version-types.js';

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

describe('Manifest Lifecycle Integration', () => {

  describe('Complete Manifest Creation Flow', () => {
    it('should create, validate, and freeze a manifest end-to-end', () => {
      // Step 1: Load raw content
      const rawContent = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Step 2: Create versioned manifest
      const { $manifest: _, ...contentOnly } = rawContent;
      const versionedManifest = createVersionedManifest(contentOnly);

      // Step 3: Verify content hash
      expect(verifyVersion(versionedManifest)).toBe(true);

      // Step 4: Check immutability
      expect(checkDeepFrozen(versionedManifest)).toBe(true);

      // Step 5: Validate no forbidden patterns
      const patternResult = detectForbiddenPatterns(contentOnly);
      expect(patternResult.valid).toBe(true);
    });

    it('should handle full version evolution lifecycle', () => {
      // Create genesis manifest
      const genesisContent = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
        version: '1.0.0',
        observedAt: '2024-01-15T10:00:00.000Z',
      };

      const genesis = createVersionedManifest(genesisContent);
      expect(genesis.parentHash).toBeNull();
      expect(genesis.lineageChain).toHaveLength(0);

      // Create first revision
      const revision1Content = {
        ...genesisContent,
        name: 'Test Organization - Updated',
        version: '1.1.0',
        observedAt: '2024-01-16T10:00:00.000Z',
      };

      const revision1 = deriveVersion(genesis, revision1Content);
      expect(revision1.parentHash).toBe(genesis.contentHash);
      expect(revision1.lineageChain.length).toBeGreaterThan(genesis.lineageChain.length);
      expect(revision1.lineageChain).toContain(genesis.contentHash);

      // Create second revision
      const revision2Content = {
        ...revision1Content,
        name: 'Test Organization - Final',
        version: '2.0.0',
        observedAt: '2024-01-17T10:00:00.000Z',
      };

      const revision2 = deriveVersion(revision1, revision2Content);
      expect(revision2.parentHash).toBe(revision1.contentHash);
      expect(revision2.lineageChain.length).toBeGreaterThan(revision1.lineageChain.length);

      // Verify complete lineage
      expect(revision2.lineageChain).toContain(genesis.contentHash);
      expect(revision2.lineageChain).toContain(revision1.contentHash);

      // Compare versions
      const genesisToRevision2 = compareVersions(genesis, revision2);
      expect(genesisToRevision2.isAncestor).toBe(true);
      expect(genesisToRevision2.isDescendant).toBe(false);
    });
  });

  describe('Validation Pipeline Integration', () => {
    it('should pass complete validation pipeline for valid manifest', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Schema validation
      const ajv = createAjvWithSchemas();
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );
      const validate = ajv.compile(organizationSchema);
      expect(validate(validOrg)).toBe(true);

      // Pattern detection
      const patternResult = detectForbiddenPatterns(validOrg);
      expect(patternResult.valid).toBe(true);

      // Immutability constraints
      const immutabilityResult = validateImmutabilityConstraints(validOrg);
      expect(immutabilityResult.valid).toBe(true);
    });

    it('should fail validation pipeline for invalid manifest', () => {
      const forbiddenManifest = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'), 'utf-8')
      );

      // Pattern detection should fail
      const patternResult = detectForbiddenPatterns(forbiddenManifest);
      expect(patternResult.valid).toBe(false);
      expect(patternResult.errors.length).toBeGreaterThan(0);
    });

    it('should detect multiple validation issues', () => {
      const forbiddenManifest = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'), 'utf-8')
      );

      const patternResult = detectForbiddenPatterns(forbiddenManifest);

      // Should detect inference markers
      const hasInferenceErrors = patternResult.errors.some((e) =>
        e.message.toLowerCase().includes('inference') ||
        e.message.toLowerCase().includes('probably') ||
        e.message.toLowerCase().includes('likely')
      );
      expect(hasInferenceErrors).toBe(true);

      // Should detect placeholder errors
      const hasPlaceholderErrors = patternResult.errors.some((e) =>
        e.message.toLowerCase().includes('placeholder') ||
        e.message.toLowerCase().includes('tbd') ||
        e.message.toLowerCase().includes('todo')
      );
      expect(hasPlaceholderErrors).toBe(true);
    });
  });

  describe('Hash-Based Integrity Verification', () => {
    it('should maintain integrity through serialization cycle', () => {
      const content = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test',
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      };

      const originalHash = computeContentHash(content);

      // Serialize and deserialize
      const serialized = JSON.stringify(content);
      const deserialized = JSON.parse(serialized);

      const deserializedHash = computeContentHash(deserialized);

      expect(deserializedHash).toBe(originalHash);
    });

    it('should detect tampering in any field', () => {
      const content = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
        departments: [
          { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Engineering' },
        ],
      };

      const originalHash = computeContentHash(content);

      // Test various tampering scenarios
      const tamperingScenarios = [
        { ...content, name: 'Tampered' },
        { ...content, newField: 'injected' },
        { ...content, departments: [] },
        {
          ...content,
          departments: [
            { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Hacked' },
          ],
        },
      ];

      tamperingScenarios.forEach((tampered) => {
        const tamperedHash = computeContentHash(tampered);
        expect(tamperedHash).not.toBe(originalHash);
        expect(verifyContentHash(tampered, originalHash)).toBe(false);
      });
    });
  });

  describe('Reference Chain Validation', () => {
    it('should validate organization-department-team hierarchy', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );
      const validTeam = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-team.json'), 'utf-8')
      );

      // Build reference map
      const orgId = validOrg.id;
      const departmentIds = validOrg.departments.map((d: { id: string }) => d.id);
      const teamDeptId = validTeam.departmentId;

      // Validate reference chain
      expect(validOrg.departments).toBeDefined();
      expect(validOrg.departments.length).toBeGreaterThan(0);

      // Team should reference a valid department
      expect(departmentIds).toContain(teamDeptId);

      // Department should reference back to organization
      validOrg.departments.forEach((dept: { organizationId: string }) => {
        expect(dept.organizationId).toBe(orgId);
      });
    });

    it('should validate lineage chain integrity', () => {
      // Create a lineage of 5 versions
      const versions = [];
      let currentContent = { name: 'Version 0', counter: 0 };

      let currentVersion = createVersionedManifest(currentContent);
      versions.push(currentVersion);

      for (let i = 1; i <= 4; i++) {
        currentContent = { name: `Version ${i}`, counter: i };
        currentVersion = deriveVersion(currentVersion, currentContent);
        versions.push(currentVersion);
      }

      // Verify lineage chain integrity
      for (let i = 1; i < versions.length; i++) {
        const current = versions[i]!;
        const previous = versions[i - 1]!;

        // Parent hash should match previous version's content hash
        expect(current.parentHash).toBe(previous.contentHash);

        // Lineage chain should grow
        expect(current.lineageChain.length).toBeGreaterThan(previous.lineageChain.length);

        // Current version should contain previous in lineage
        expect(current.lineageChain).toContain(previous.contentHash);
      }
    });
  });

  describe('Immutability Enforcement Integration', () => {
    it('should enforce complete immutability on loaded manifest', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Create immutable manifest
      const immutable = deepFreeze(validOrg);

      // Verify deep freeze
      expect(checkDeepFrozen(immutable)).toBe(true);

      // Attempt modifications should throw
      expect(() => {
        (immutable as Record<string, unknown>)['name'] = 'Modified';
      }).toThrow();

      expect(() => {
        const manifest = (immutable as Record<string, unknown>)['$manifest'] as Record<string, unknown>;
        manifest['version'] = '9.9.9';
      }).toThrow();

      expect(() => {
        const departments = (immutable as Record<string, unknown>)['departments'] as Array<Record<string, unknown>>;
        departments[0]!['name'] = 'Hacked';
      }).toThrow();
    });

    it('should create valid immutable manifest with computed hash', () => {
      const content = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
        observedAt: '2024-01-15T10:00:00.000Z',
      };

      const immutable = createImmutableManifest(content);

      // Should have $manifest with contentHash
      expect(immutable.$manifest).toBeDefined();
      expect(immutable.$manifest.contentHash).toBeDefined();
      expect(immutable.$manifest.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Should be deeply frozen
      expect(checkDeepFrozen(immutable)).toBe(true);

      // Should be frozen (basic immutability check)
      expect(Object.isFrozen(immutable)).toBe(true);
    });
  });

  describe('Determinism Across Operations', () => {
    it('should produce consistent results across 50 complete operations', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const results: Array<{
        hash: ContentHash;
        frozen: boolean;
        patternValid: boolean;
      }> = [];

      for (let i = 0; i < 50; i++) {
        // Parse fresh copy
        const content = JSON.parse(JSON.stringify(validOrg));

        // Compute hash
        const { $manifest: _, ...contentOnly } = content;
        const hash = computeContentHash(contentOnly);

        // Freeze
        const frozen = deepFreeze(content);
        const isFrozen = checkDeepFrozen(frozen);

        // Validate patterns
        const patternResult = detectForbiddenPatterns(contentOnly);

        results.push({
          hash,
          frozen: isFrozen,
          patternValid: patternResult.valid,
        });
      }

      // All results should be identical
      const firstResult = results[0]!;
      expect(results.every((r) => r.hash === firstResult.hash)).toBe(true);
      expect(results.every((r) => r.frozen === firstResult.frozen)).toBe(true);
      expect(results.every((r) => r.patternValid === firstResult.patternValid)).toBe(true);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle empty manifest gracefully', () => {
      const emptyManifest = {};

      const patternResult = detectForbiddenPatterns(emptyManifest);
      expect(patternResult.valid).toBe(true);

      const immutabilityResult = validateImmutabilityConstraints(emptyManifest);
      expect(immutabilityResult.valid).toBe(true);
    });

    it('should handle deeply nested structures', () => {
      let deepContent: Record<string, unknown> = { value: 'deep' };

      for (let i = 0; i < 50; i++) {
        deepContent = { nested: deepContent };
      }

      // Should not throw
      const hash = computeContentHash(deepContent);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);

      const frozen = deepFreeze(deepContent);
      expect(checkDeepFrozen(frozen)).toBe(true);
    });

    it('should handle large arrays', () => {
      const largeArray = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: `item-${i}`,
          value: i,
        })),
      };

      const hash = computeContentHash(largeArray);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Consistent hashing
      const hash2 = computeContentHash(largeArray);
      expect(hash).toBe(hash2);
    });

    it('should handle special characters in content', () => {
      const specialContent = {
        unicode: 'Hello World',
        quotes: 'He said "hello"',
        escapes: 'Line 1\nLine 2\tTab',
        backslash: 'Path\\to\\file',
      };

      const hash = computeContentHash(specialContent);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);

      const hash2 = computeContentHash(specialContent);
      expect(hash).toBe(hash2);
    });
  });

  describe('Acceptance Criteria Summary', () => {
    it('AC-01: Version string format validation', () => {
      const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$/;
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      expect(validOrg.$manifest.version).toMatch(versionPattern);
    });

    it('AC-02: Schema validation passes', () => {
      const ajv = createAjvWithSchemas();
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );
      const organizationSchema = JSON.parse(
        readFileSync(join(SCHEMAS_PATH, 'v1/organization.schema.json'), 'utf-8')
      );

      const validate = ajv.compile(organizationSchema);
      expect(validate(validOrg)).toBe(true);
    });

    it('AC-03: Immutability verification', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const frozen = deepFreeze(validOrg);
      expect(checkDeepFrozen(frozen)).toBe(true);

      // Hash verification
      const { $manifest: _, ...content } = validOrg;
      const hash = computeContentHash(content);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('AC-04: Determinism verification', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const hashes: string[] = [];
      for (let i = 0; i < 100; i++) {
        const { $manifest: _, ...content } = validOrg;
        hashes.push(computeContentHash(content));
      }

      expect(hashes.every((h) => h === hashes[0])).toBe(true);
    });

    it('AC-05: No runtime logic', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-organization.json'),
        'utf-8'
      );

      const runtimePatterns = [
        /function\s*\(/,
        /\beval\s*\(/,
        /\brequire\s*\(/,
        /\bimport\s+/,
      ];

      runtimePatterns.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('AC-06: No inference markers', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const result = detectForbiddenPatterns(validOrg);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
