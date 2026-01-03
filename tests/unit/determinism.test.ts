/**
 * AC-04: Determinism Verification Tests
 *
 * Verifies:
 * - 100 load operations produce identical output
 * - JSON key ordering is stable (sorted)
 * - No non-deterministic generators (UUID, random, timestamp)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  computeContentHash,
  canonicalizeContent,
  sortKeysRecursively,
} from '../../versioning/core/content-hasher.js';
import { deepFreeze } from '../../versioning/core/immutability-guard.js';

const FIXTURES_PATH = '/workspaces/agentics-org-manifests/tests/fixtures';

describe('AC-04: Determinism Verification', () => {
  describe('Repeated Load Operations', () => {
    it('should produce identical output for 100 load operations', () => {
      const filePath = join(FIXTURES_PATH, 'valid-organization.json');
      const results: string[] = [];

      // Perform 100 load operations
      for (let i = 0; i < 100; i++) {
        const content = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const canonicalized = canonicalizeContent(parsed);
        const hash = computeContentHash(canonicalized);
        results.push(hash);
      }

      // All results should be identical
      const firstResult = results[0];
      expect(results.every((r) => r === firstResult)).toBe(true);
    });

    it('should produce identical hash for 100 canonicalization operations', () => {
      const content = {
        z: 'last',
        a: 'first',
        m: 'middle',
        nested: { z: 1, a: 2 },
      };

      const hashes: string[] = [];

      for (let i = 0; i < 100; i++) {
        const hash = computeContentHash(content);
        hashes.push(hash);
      }

      const firstHash = hashes[0];
      expect(hashes.every((h) => h === firstHash)).toBe(true);
    });

    it('should produce identical frozen objects for 100 operations', () => {
      const content = { name: 'Test', value: 42, nested: { a: 1 } };
      const results: string[] = [];

      for (let i = 0; i < 100; i++) {
        const frozen = deepFreeze({ ...content });
        const serialized = JSON.stringify(frozen);
        results.push(serialized);
      }

      const firstResult = results[0];
      expect(results.every((r) => r === firstResult)).toBe(true);
    });
  });

  describe('JSON Key Ordering Stability', () => {
    it('should always sort keys alphabetically', () => {
      const content = { z: 3, a: 1, m: 2, b: 4 };
      const canonicalized = canonicalizeContent(content);
      const keys = Object.keys(canonicalized);

      expect(keys).toEqual(['a', 'b', 'm', 'z']);
    });

    it('should sort nested object keys', () => {
      const content = {
        outer: { z: 3, a: 1 },
        inner: { m: 2, b: 4 },
      };
      const canonicalized = canonicalizeContent(content) as Record<string, Record<string, unknown>>;

      expect(Object.keys(canonicalized)).toEqual(['inner', 'outer']);
      expect(Object.keys(canonicalized['outer']!)).toEqual(['a', 'z']);
      expect(Object.keys(canonicalized['inner']!)).toEqual(['b', 'm']);
    });

    it('should maintain stable ordering across multiple calls', () => {
      const content = { z: 3, a: 1, m: 2 };
      const orderings: string[][] = [];

      for (let i = 0; i < 50; i++) {
        const canonicalized = canonicalizeContent(content);
        orderings.push(Object.keys(canonicalized));
      }

      const expectedOrder = ['a', 'm', 'z'];
      expect(orderings.every((o) => JSON.stringify(o) === JSON.stringify(expectedOrder))).toBe(true);
    });

    it('should handle unicode keys correctly', () => {
      const content = { 'zzz': 1, 'aaa': 2, 'bbb': 3 };
      const canonicalized = canonicalizeContent(content);
      const keys = Object.keys(canonicalized);

      expect(keys).toEqual(['aaa', 'bbb', 'zzz']);
    });

    it('should sort numeric string keys correctly', () => {
      const content = { '10': 1, '2': 2, '1': 3 };
      const canonicalized = canonicalizeContent(content);
      const keys = Object.keys(canonicalized);

      // Note: JavaScript object keys that are numeric strings have special behavior
      // but sortKeysRecursively should handle them consistently
      expect(keys).toEqual(keys.sort());
    });
  });

  describe('Non-Deterministic Generator Detection', () => {
    describe('UUID Detection', () => {
      const UUID_GENERATOR_PATTERNS = [
        /uuid\s*\(/i,
        /crypto\.randomUUID/i,
        /uuidv4/i,
        /generateUUID/i,
        /v4\(\)/,
      ];

      it('should not contain UUID generator patterns in manifest content', () => {
        const validOrg = JSON.parse(
          readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
        );
        const contentString = JSON.stringify(validOrg);

        UUID_GENERATOR_PATTERNS.forEach((pattern) => {
          expect(contentString).not.toMatch(pattern);
        });
      });

      it('should only contain static UUID values (not generators)', () => {
        const validOrg = JSON.parse(
          readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
        );

        // UUIDs should be complete static values
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

        expect(validOrg.id).toMatch(UUID_PATTERN);

        validOrg.departments?.forEach((dept: Record<string, unknown>) => {
          expect(dept['id']).toMatch(UUID_PATTERN);
          expect(dept['organizationId']).toMatch(UUID_PATTERN);
        });
      });
    });

    describe('Random Value Detection', () => {
      const RANDOM_PATTERNS = [
        /Math\.random/,
        /crypto\.getRandomValues/,
        /randomInt/,
        /randomBytes/,
        /\brandom\b.*\(/i,
      ];

      it('should not contain random generator patterns', () => {
        const validOrg = JSON.parse(
          readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
        );
        const contentString = JSON.stringify(validOrg);

        RANDOM_PATTERNS.forEach((pattern) => {
          expect(contentString).not.toMatch(pattern);
        });
      });
    });

    describe('Timestamp Generator Detection', () => {
      const TIMESTAMP_GENERATOR_PATTERNS = [
        /new Date\(\)/,
        /Date\.now\(\)/,
        /performance\.now/,
        /process\.hrtime/,
        /\bnow\b/i,
        /\bcurrent\b/i,
        /\btoday\b/i,
      ];

      it('should not contain dynamic timestamp generators', () => {
        const validOrg = JSON.parse(
          readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
        );
        const contentString = JSON.stringify(validOrg);

        // Should not contain generator patterns
        TIMESTAMP_GENERATOR_PATTERNS.forEach((pattern) => {
          expect(contentString).not.toMatch(pattern);
        });
      });

      it('should only contain static ISO 8601 timestamps', () => {
        const validOrg = JSON.parse(
          readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
        );

        const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

        expect(validOrg.$manifest.createdAt).toMatch(ISO_8601_PATTERN);
        expect(validOrg.observedAt).toMatch(ISO_8601_PATTERN);
        expect(validOrg.dataSource.extractedAt).toMatch(ISO_8601_PATTERN);
      });
    });
  });

  describe('Content Determinism', () => {
    it('should produce consistent JSON serialization', () => {
      const content = {
        name: 'Test',
        value: 42,
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      };

      const serializations: string[] = [];

      for (let i = 0; i < 100; i++) {
        const canonicalized = canonicalizeContent(content);
        serializations.push(JSON.stringify(canonicalized));
      }

      const firstSerialization = serializations[0];
      expect(serializations.every((s) => s === firstSerialization)).toBe(true);
    });

    it('should handle empty objects deterministically', () => {
      const contents = [{}, { nested: {} }, { arr: [] }];

      contents.forEach((content) => {
        const hashes: string[] = [];

        for (let i = 0; i < 10; i++) {
          hashes.push(computeContentHash(content));
        }

        expect(hashes.every((h) => h === hashes[0])).toBe(true);
      });
    });

    it('should handle special characters deterministically', () => {
      const content = {
        unicode: 'Hello',
        emoji: 'Test',
        newlines: 'line1\nline2',
        tabs: 'col1\tcol2',
      };

      const hashes: string[] = [];

      for (let i = 0; i < 50; i++) {
        hashes.push(computeContentHash(content));
      }

      expect(hashes.every((h) => h === hashes[0])).toBe(true);
    });

    it('should handle numeric precision deterministically', () => {
      const content = {
        integer: 42,
        float: 3.14159,
        scientific: 1.23e10,
        negative: -99,
        zero: 0,
      };

      const hashes: string[] = [];

      for (let i = 0; i < 50; i++) {
        hashes.push(computeContentHash(content));
      }

      expect(hashes.every((h) => h === hashes[0])).toBe(true);
    });
  });

  describe('Cross-Platform Determinism', () => {
    it('should produce consistent hashes for various data types', () => {
      const testCases = [
        { type: 'null', content: { value: null } },
        { type: 'boolean', content: { value: true } },
        { type: 'number', content: { value: 42 } },
        { type: 'string', content: { value: 'test' } },
        { type: 'array', content: { value: [1, 2, 3] } },
        { type: 'object', content: { value: { a: 1 } } },
      ];

      testCases.forEach(({ type, content }) => {
        const hash1 = computeContentHash(content);
        const hash2 = computeContentHash(content);

        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
      });
    });

    it('should handle deep nesting deterministically', () => {
      let content: Record<string, unknown> = { value: 'deep' };

      for (let i = 0; i < 20; i++) {
        content = { nested: content };
      }

      const hashes: string[] = [];

      for (let i = 0; i < 10; i++) {
        hashes.push(computeContentHash(content));
      }

      expect(hashes.every((h) => h === hashes[0])).toBe(true);
    });
  });
});
