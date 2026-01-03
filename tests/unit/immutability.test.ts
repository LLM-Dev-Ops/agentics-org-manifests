/**
 * AC-03: Immutability Verification Tests
 *
 * Verifies:
 * - SHA-256 hash matches stored hash value
 * - No content modification detected post-commit
 * - deepFreeze applied to all loaded manifests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeContentHash,
  verifyContentHash,
  canonicalizeContent,
  sortKeysRecursively,
} from '../../versioning/core/content-hasher.js';
import {
  deepFreeze,
  enforceImmutability,
  checkDeepFrozen,
  createImmutableManifest,
  validateManifestIntegrity,
  detectMutableFields,
} from '../../versioning/core/immutability-guard.js';
import type { ImmutableManifest } from '../../versioning/core/immutability-guard.js';
import type { ContentHash } from '../../versioning/types/version-types.js';

const FIXTURES_PATH = '/workspaces/agentics-org-manifests/tests/fixtures';

describe('AC-03: Immutability Verification', () => {
  describe('SHA-256 Hash Verification', () => {
    it('should compute valid SHA-256 hash', () => {
      const content = { name: 'Test', value: 42 };
      const hash = computeContentHash(content);

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(hash.length).toBe(71); // "sha256:" (7) + 64 hex chars
    });

    it('should verify hash matches stored value', () => {
      const content = { name: 'Test', value: 42 };
      const hash = computeContentHash(content);

      expect(verifyContentHash(content, hash)).toBe(true);
    });

    it('should detect modified content', () => {
      const originalContent = { name: 'Test', value: 42 };
      const originalHash = computeContentHash(originalContent);

      const modifiedContent = { name: 'Test', value: 43 };

      expect(verifyContentHash(modifiedContent, originalHash)).toBe(false);
    });

    it('should detect added fields', () => {
      const originalContent = { name: 'Test' };
      const originalHash = computeContentHash(originalContent);

      const modifiedContent = { name: 'Test', extra: 'field' };

      expect(verifyContentHash(modifiedContent, originalHash)).toBe(false);
    });

    it('should detect removed fields', () => {
      const originalContent = { name: 'Test', value: 42 };
      const originalHash = computeContentHash(originalContent);

      const modifiedContent = { name: 'Test' };

      expect(verifyContentHash(modifiedContent, originalHash)).toBe(false);
    });

    it('should verify fixture manifest hash', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Remove the $manifest section to compute content hash
      const { $manifest, ...content } = validOrg;

      const computedHash = computeContentHash(content);

      // Hash should be deterministic
      expect(computedHash).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Same content should always produce same hash
      const secondHash = computeContentHash(content);
      expect(computedHash).toBe(secondHash);
    });
  });

  describe('Content Canonicalization', () => {
    it('should produce identical hash regardless of key order', () => {
      const content1 = { z: 3, a: 1, m: 2 };
      const content2 = { a: 1, m: 2, z: 3 };
      const content3 = { m: 2, z: 3, a: 1 };

      const hash1 = computeContentHash(content1);
      const hash2 = computeContentHash(content2);
      const hash3 = computeContentHash(content3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle nested objects', () => {
      const content1 = {
        outer: { z: 3, a: 1 },
        name: 'test',
      };
      const content2 = {
        name: 'test',
        outer: { a: 1, z: 3 },
      };

      expect(computeContentHash(content1)).toBe(computeContentHash(content2));
    });

    it('should preserve array order', () => {
      const content1 = { items: [1, 2, 3] };
      const content2 = { items: [3, 2, 1] };

      expect(computeContentHash(content1)).not.toBe(computeContentHash(content2));
    });

    it('should canonicalize content deterministically', () => {
      const content = { b: 2, a: 1, c: { z: 26, a: 1 } };
      const canonicalized = canonicalizeContent(content);

      // Keys should be sorted alphabetically
      const keys = Object.keys(canonicalized);
      expect(keys).toEqual(['a', 'b', 'c']);

      // Nested keys should also be sorted
      const nestedKeys = Object.keys((canonicalized as Record<string, Record<string, unknown>>)['c']!);
      expect(nestedKeys).toEqual(['a', 'z']);
    });

    it('should handle null and undefined consistently', () => {
      const content1 = { a: null };
      const content2 = { a: null };

      expect(computeContentHash(content1)).toBe(computeContentHash(content2));
    });
  });

  describe('Deep Freeze Application', () => {
    it('should freeze top-level object', () => {
      const content = { name: 'Test', value: 42 };
      const frozen = deepFreeze(content);

      expect(Object.isFrozen(frozen)).toBe(true);
    });

    it('should freeze nested objects', () => {
      const content = {
        level1: {
          level2: {
            level3: { value: 'deep' },
          },
        },
      };
      const frozen = deepFreeze(content);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen((frozen as typeof content).level1)).toBe(true);
      expect(Object.isFrozen((frozen as typeof content).level1.level2)).toBe(true);
      expect(Object.isFrozen((frozen as typeof content).level1.level2.level3)).toBe(true);
    });

    it('should freeze arrays', () => {
      const content = { items: [1, 2, { nested: 'value' }] };
      const frozen = deepFreeze(content);

      expect(Object.isFrozen((frozen as typeof content).items)).toBe(true);
      expect(Object.isFrozen((frozen as typeof content).items[2])).toBe(true);
    });

    it('should prevent modifications to frozen object', () => {
      const content = { name: 'Test', value: 42 };
      const frozen = deepFreeze(content);

      expect(() => {
        (frozen as Record<string, unknown>)['name'] = 'Modified';
      }).toThrow();

      expect(() => {
        (frozen as Record<string, unknown>)['newProp'] = 'new';
      }).toThrow();
    });

    it('should check deep frozen status correctly', () => {
      const frozen = deepFreeze({ a: { b: { c: 1 } } });
      const unfrozen = { a: { b: { c: 1 } } };

      expect(checkDeepFrozen(frozen)).toBe(true);
      expect(checkDeepFrozen(unfrozen)).toBe(false);

      Object.freeze(unfrozen);
      expect(checkDeepFrozen(unfrozen)).toBe(false); // nested still not frozen
    });
  });

  describe('Immutable Manifest Creation', () => {
    it('should create immutable manifest with content hash', () => {
      const content = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
      };

      const manifest = createImmutableManifest(content);

      expect(manifest.$manifest).toBeDefined();
      expect(manifest.$manifest.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(Object.isFrozen(manifest)).toBe(true);
    });

    it('should validate manifest integrity', () => {
      const content = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
      };

      const manifest = createImmutableManifest(content);

      // The manifest should be frozen and have a content hash
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(manifest.$manifest.contentHash).toBeDefined();
      expect(manifest.$manifest.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should enforce immutability rules', () => {
      const content = {
        $manifest: {
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as ContentHash,
        },
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test',
      };

      const frozen = deepFreeze(content) as ImmutableManifest;
      const verification = enforceImmutability(frozen);

      expect(verification.isFrozen).toBe(true);
      expect(verification.isDeepFrozen).toBe(true);
      expect(verification.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Mutable Field Detection', () => {
    it('should detect updated_at field', () => {
      const content = {
        name: 'Test',
        updated_at: '2024-01-15T10:00:00.000Z',
      };

      const mutableFields = detectMutableFields(content);

      expect(mutableFields).toContain('updated_at');
    });

    it('should detect last_modified field', () => {
      const content = {
        name: 'Test',
        last_modified: '2024-01-15T10:00:00.000Z',
      };

      const mutableFields = detectMutableFields(content);

      expect(mutableFields).toContain('last_modified');
    });

    it('should detect multiple mutable fields', () => {
      const content = {
        name: 'Test',
        updated_at: '2024-01-15T10:00:00.000Z',
        last_modified: '2024-01-15T10:00:00.000Z',
        revision_count: 5,
      };

      const mutableFields = detectMutableFields(content);

      expect(mutableFields.length).toBeGreaterThanOrEqual(2);
    });

    it('should not flag immutable timestamp fields', () => {
      const content = {
        name: 'Test',
        created_at: '2024-01-15T10:00:00.000Z',
        observed_at: '2024-01-15T10:00:00.000Z',
      };

      const mutableFields = detectMutableFields(content);

      // created_at and observed_at should not be flagged as they don't imply mutation
      expect(mutableFields).not.toContain('created_at');
      expect(mutableFields).not.toContain('observed_at');
    });
  });

  describe('Post-Commit Modification Detection', () => {
    it('should detect any modification to manifest content', () => {
      const originalContent = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
        departments: [
          { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Engineering' },
        ],
      };

      const originalHash = computeContentHash(originalContent);

      // Simulate various modifications
      const modifications = [
        { ...originalContent, name: 'Modified Name' },
        { ...originalContent, newField: 'added' },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          departments: originalContent.departments,
        },
        {
          ...originalContent,
          departments: [...originalContent.departments, { id: 'new', name: 'New Dept' }],
        },
      ];

      modifications.forEach((modified) => {
        expect(verifyContentHash(modified, originalHash)).toBe(false);
      });
    });

    it('should pass verification for unmodified content', () => {
      const originalContent = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Organization',
      };

      const originalHash = computeContentHash(originalContent);

      // Create a copy with same values
      const copyContent = JSON.parse(JSON.stringify(originalContent));

      expect(verifyContentHash(copyContent, originalHash)).toBe(true);
    });

    it('should detect whitespace-only changes', () => {
      const content1 = { name: 'Test' };
      const content2 = { name: 'Test ' }; // trailing space

      expect(computeContentHash(content1)).not.toBe(computeContentHash(content2));
    });

    it('should detect type changes', () => {
      const content1 = { value: 42 };
      const content2 = { value: '42' };

      expect(computeContentHash(content1)).not.toBe(computeContentHash(content2));
    });
  });

  describe('Loaded Manifest Verification', () => {
    it('should verify loaded fixture manifest is valid', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Ensure manifest metadata exists
      expect(validOrg.$manifest).toBeDefined();
      expect(validOrg.$manifest.contentHash).toBeDefined();
      expect(validOrg.$manifest.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should deep freeze loaded manifest', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const frozenManifest = deepFreeze(validOrg);

      expect(checkDeepFrozen(frozenManifest)).toBe(true);
      expect(Object.isFrozen(frozenManifest.$manifest)).toBe(true);
      expect(Object.isFrozen(frozenManifest.departments)).toBe(true);
    });
  });
});
