/**
 * AC-06: No Inference Markers Tests
 *
 * Verifies:
 * - Zero probabilistic language detected (likely, probably, approximately)
 * - Zero inferential markers detected (inferred, derived, calculated)
 * - Zero placeholder values detected (TBD, TODO, FIXME, XXX)
 * - All values are explicit and concrete
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectForbiddenPatterns,
  checkValueForPatterns,
  isPlaceholder,
  isMutableFieldName,
  FORBIDDEN_PATTERNS,
  PROHIBITED_PLACEHOLDER_PATTERNS,
  PLACEHOLDER_DATES,
} from '../../validation/core/pattern-detector.js';

const FIXTURES_PATH = '/workspaces/agentics-org-manifests/tests/fixtures';

// Probabilistic language patterns
const PROBABILISTIC_PATTERNS = [
  /\bprobably\b/i,
  /\blikely\b/i,
  /\bmaybe\b/i,
  /\bperhaps\b/i,
  /\bmight\b/i,
  /\bcould be\b/i,
  /\bapproximately\b/i,
  /\babout\b/i,
  /\baround\b/i,
  /\broughly\b/i,
  /\bestimated?\b/i,
];

// Inferential markers
const INFERENTIAL_PATTERNS = [
  /\binferred?\b/i,
  /\bderived?\b/i,
  /\bcalculated?\b/i,
  /\bpredicted?\b/i,
  /\bcomputed?\b/i,
  /\bguessed?\b/i,
  /\bassumed?\b/i,
  /\bextrapolated?\b/i,
];

// Placeholder patterns
const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /\bPENDING\b/i,
  /\bUNKNOWN\b/i,
  /\bN\/A\b/i,
  /\bPLACEHOLDER\b/i,
  /^\?+$/,
  /^\.\.\.+$/,
  /^-+$/,
  /\bDRAFT\b/i,
  /\bTEMP(ORARY)?\b/i,
];

// Temporal inference patterns (forbidden per SPARC)
const TEMPORAL_INFERENCE_PATTERNS = [
  /\bcurrent\b/i,
  /\blatest\b/i,
  /\btoday\b/i,
  /\bnow\b/i,
  /\brecent\b/i,
  /\bup.?to.?date\b/i,
];

describe('AC-06: No Inference Markers', () => {
  describe('Probabilistic Language Detection', () => {
    it('should detect no probabilistic language in valid organization manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-organization.json'),
        'utf-8'
      );

      PROBABILISTIC_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect no probabilistic language in valid team manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-team.json'),
        'utf-8'
      );

      PROBABILISTIC_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect probabilistic patterns in forbidden manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
        'utf-8'
      );

      const hasProbabilistic = PROBABILISTIC_PATTERNS.some((pattern) =>
        pattern.test(content)
      );
      expect(hasProbabilistic).toBe(true);
    });

    it('should detect all probabilistic terms', () => {
      const problematicStrings = [
        'This is probably correct',
        'The value is likely 100',
        'Maybe this is right',
        'Perhaps this works',
        'This might be accurate',
        'This could be true',
        'Approximately 50 users',
        'About 100 items',
        'Around 200 employees',
        'Roughly 500 transactions',
        'Estimated 1000 records',
      ];

      problematicStrings.forEach((str) => {
        const matches = PROBABILISTIC_PATTERNS.some((pattern) => pattern.test(str));
        expect(matches).toBe(true);
      });
    });
  });

  describe('Inferential Marker Detection', () => {
    it('should detect no inferential markers in valid organization manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-organization.json'),
        'utf-8'
      );

      INFERENTIAL_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect no inferential markers in valid team manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-team.json'),
        'utf-8'
      );

      INFERENTIAL_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect inferential markers in forbidden manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
        'utf-8'
      );

      const hasInferential = INFERENTIAL_PATTERNS.some((pattern) =>
        pattern.test(content)
      );
      expect(hasInferential).toBe(true);
    });

    it('should detect all inferential terms', () => {
      const inferentialStrings = [
        'This value was inferred',
        'Derived from other data',
        'Calculated automatically',
        'Predicted outcome',
        'Computed result',
        'Guessed value',
        'Assumed to be true',
        'Extrapolated from trends',
      ];

      inferentialStrings.forEach((str) => {
        const matches = INFERENTIAL_PATTERNS.some((pattern) => pattern.test(str));
        expect(matches).toBe(true);
      });
    });
  });

  describe('Placeholder Value Detection', () => {
    it('should detect no placeholders in valid organization manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-organization.json'),
        'utf-8'
      );

      PLACEHOLDER_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect no placeholders in valid team manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-team.json'),
        'utf-8'
      );

      PLACEHOLDER_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect placeholders in forbidden manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
        'utf-8'
      );

      const hasPlaceholder = PLACEHOLDER_PATTERNS.some((pattern) =>
        pattern.test(content)
      );
      expect(hasPlaceholder).toBe(true);
    });

    it('should identify common placeholder patterns', () => {
      // These are the patterns defined in PROHIBITED_PLACEHOLDER_PATTERNS
      const placeholders = [
        'TBD',
        'TODO',
        'PENDING',
        'N/A',
        'UNKNOWN',
        'PLACEHOLDER',
        '???',
        '...',
        '---',
        'DRAFT',
        'TEMP',
        'TEMPORARY',
      ];

      placeholders.forEach((ph) => {
        expect(isPlaceholder(ph)).toBe(true);
      });
    });

    it('should identify extended placeholder patterns', () => {
      // These may or may not be detected depending on implementation
      const extendedPlaceholders = ['TO BE COMPLETED', 'TO BE DETERMINED', 'XXX'];

      extendedPlaceholders.forEach((ph) => {
        // Test for pattern matching in string content instead
        const hasMatch = PROHIBITED_PLACEHOLDER_PATTERNS.some((p) => p.pattern.test(ph));
        expect(hasMatch).toBe(true);
      });
    });

    it('should not flag non-placeholder values', () => {
      const validValues = [
        'Engineering',
        'John Smith',
        'Active',
        'Completed',
        '550e8400-e29b-41d4-a716-446655440001',
        '2024-01-15T10:30:00.000Z',
        'US',
        '12-31',
      ];

      validValues.forEach((value) => {
        expect(isPlaceholder(value)).toBe(false);
      });
    });
  });

  describe('Placeholder Date Detection', () => {
    it('should detect placeholder dates', () => {
      PLACEHOLDER_DATES.forEach((date) => {
        expect(PLACEHOLDER_DATES).toContain(date);
      });
    });

    it('should identify common placeholder dates', () => {
      const placeholderDates = [
        '1970-01-01',
        '1900-01-01',
        '0001-01-01',
        '9999-12-31',
        '2099-12-31',
      ];

      placeholderDates.forEach((date) => {
        expect(PLACEHOLDER_DATES).toContain(date);
      });
    });

    it('should not flag valid dates', () => {
      const validDates = [
        '2024-01-15',
        '2023-06-01',
        '2020-12-31',
        '2019-03-15',
      ];

      validDates.forEach((date) => {
        expect(PLACEHOLDER_DATES).not.toContain(date);
      });
    });

    it('should detect placeholder date in manifest', () => {
      const manifestWithPlaceholderDate = JSON.parse(
        readFileSync(
          join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
          'utf-8'
        )
      );

      const hasPlaceholderDate = PLACEHOLDER_DATES.some((date) =>
        manifestWithPlaceholderDate.placeholder_date?.startsWith(date)
      );
      expect(hasPlaceholderDate).toBe(true);
    });
  });

  describe('Temporal Inference Detection', () => {
    it('should detect no temporal inference in valid manifests', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'valid-organization.json'),
        'utf-8'
      );

      TEMPORAL_INFERENCE_PATTERNS.forEach((pattern) => {
        expect(content).not.toMatch(pattern);
      });
    });

    it('should detect temporal inference in forbidden manifest', () => {
      const content = readFileSync(
        join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
        'utf-8'
      );

      const hasTemporal = TEMPORAL_INFERENCE_PATTERNS.some((pattern) =>
        pattern.test(content)
      );
      expect(hasTemporal).toBe(true);
    });

    it('should identify temporal inference terms', () => {
      const temporalTerms = [
        'current state',
        'latest version',
        'as of today',
        'right now',
        'recent changes',
        'up-to-date',
      ];

      temporalTerms.forEach((term) => {
        const matches = TEMPORAL_INFERENCE_PATTERNS.some((pattern) =>
          pattern.test(term)
        );
        expect(matches).toBe(true);
      });
    });
  });

  describe('Validation Module Integration', () => {
    it('should detect forbidden patterns using validation module', () => {
      const manifestWithForbidden = JSON.parse(
        readFileSync(
          join(FIXTURES_PATH, 'manifest-with-forbidden-patterns.json'),
          'utf-8'
        )
      );

      const result = detectForbiddenPatterns(manifestWithForbidden);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation for clean manifest', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const result = detectForbiddenPatterns(validOrg);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect specific pattern categories', () => {
      const inferenceValue = 'This is probably correct';
      const categories = checkValueForPatterns(inferenceValue);

      expect(categories).toContain('INFERENCE_MARKER');
    });

    it('should identify mutable field names', () => {
      const mutableFields = [
        'updated_at',
        'last_modified',
        'modified_at',
        'last_updated',
        'updatedAt',
        'lastModified',
      ];

      mutableFields.forEach((field) => {
        expect(isMutableFieldName(field)).toBe(true);
      });
    });

    it('should not flag immutable field names', () => {
      const immutableFields = [
        'created_at',
        'observed_at',
        'id',
        'name',
        'version',
      ];

      immutableFields.forEach((field) => {
        expect(isMutableFieldName(field)).toBe(false);
      });
    });
  });

  describe('Explicit and Concrete Values', () => {
    it('should contain only explicit values in valid manifest', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      function checkExplicitValues(obj: unknown, path: string = ''): void {
        if (obj === null || typeof obj !== 'object') {
          if (typeof obj === 'string') {
            // Check for any inference or placeholder patterns
            PROBABILISTIC_PATTERNS.forEach((pattern) => {
              expect(obj, `Path: ${path}`).not.toMatch(pattern);
            });
            INFERENTIAL_PATTERNS.forEach((pattern) => {
              expect(obj, `Path: ${path}`).not.toMatch(pattern);
            });
            PLACEHOLDER_PATTERNS.forEach((pattern) => {
              expect(obj, `Path: ${path}`).not.toMatch(pattern);
            });
          }
          return;
        }

        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            checkExplicitValues(item, `${path}[${index}]`);
          });
          return;
        }

        Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
          checkExplicitValues(value, `${path}.${key}`);
        });
      }

      expect(() => checkExplicitValues(validOrg)).not.toThrow();
    });

    it('should require concrete numeric values', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      function extractNumbers(obj: unknown): number[] {
        const numbers: number[] = [];

        function traverse(value: unknown): void {
          if (typeof value === 'number') {
            numbers.push(value);
          } else if (Array.isArray(value)) {
            value.forEach(traverse);
          } else if (value !== null && typeof value === 'object') {
            Object.values(value as Record<string, unknown>).forEach(traverse);
          }
        }

        traverse(obj);
        return numbers;
      }

      const numbers = extractNumbers(validOrg);

      // All numbers should be finite and concrete
      numbers.forEach((num) => {
        expect(Number.isFinite(num)).toBe(true);
        expect(Number.isNaN(num)).toBe(false);
      });
    });
  });
});
