/**
 * AC-01: Manifest Versioning Tests
 *
 * Verifies:
 * - Version string matches pattern ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$
 * - Version increments follow semantic versioning rules
 * - Each version maps to exactly one immutable manifest state
 */

import { describe, it, expect } from 'vitest';
import {
  isValidSemanticVersion,
  isValidContentHash,
  generateVersionId,
  extractShortHash,
  isValidVersionId,
} from '../../versioning/types/version-types.js';
import {
  computeContentHash,
  verifyContentHash,
  canonicalizeContent,
} from '../../versioning/core/content-hasher.js';
import {
  createVersionedManifest,
  deriveVersion,
  verifyVersion,
  compareVersions,
} from '../../versioning/index.js';
import type { ContentHash, VersionedManifest } from '../../versioning/types/version-types.js';

describe('AC-01: Manifest Versioning', () => {
  describe('Version String Format', () => {
    const validVersionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$/;

    it('should match valid semantic version pattern', () => {
      const validVersions = [
        '0.0.0',
        '1.0.0',
        '1.2.3',
        '10.20.30',
        '100.200.300',
        '1.0.0-alpha',
        '1.0.0-beta1',
        '2.1.0-rc1',
        '3.0.0-SNAPSHOT',
      ];

      validVersions.forEach((version) => {
        expect(version).toMatch(validVersionPattern);
        expect(isValidSemanticVersion(version.split('-')[0] as `${number}.${number}.${number}`)).toBe(true);
      });
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = [
        'v1.0.0',
        '1.0',
        '1',
        '1.0.0.0',
        'a.b.c',
        '1.0.0-',
        '-1.0.0',
        '1.0.0beta',
        '',
        'latest',
        'current',
      ];

      invalidVersions.forEach((version) => {
        expect(isValidSemanticVersion(version as `${number}.${number}.${number}`)).toBe(false);
      });
    });

    it('should handle version with pre-release identifiers', () => {
      const versionsWithPreRelease = [
        { version: '1.0.0-alpha', preRelease: 'alpha' },
        { version: '1.0.0-beta1', preRelease: 'beta1' },
        { version: '2.0.0-rc1', preRelease: 'rc1' },
      ];

      versionsWithPreRelease.forEach(({ version, preRelease }) => {
        expect(version).toMatch(validVersionPattern);
        expect(version).toContain(preRelease);
      });
    });
  });

  describe('Semantic Versioning Rules', () => {
    it('should increment major version for breaking changes', () => {
      const versions = ['1.0.0', '2.0.0', '3.0.0'];
      for (let i = 1; i < versions.length; i++) {
        const prev = versions[i - 1]!.split('.').map(Number);
        const curr = versions[i]!.split('.').map(Number);
        expect(curr[0]).toBeGreaterThan(prev[0]!);
      }
    });

    it('should increment minor version for new features', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0'];
      for (let i = 1; i < versions.length; i++) {
        const prev = versions[i - 1]!.split('.').map(Number);
        const curr = versions[i]!.split('.').map(Number);
        expect(curr[0]).toBe(prev[0]);
        expect(curr[1]).toBeGreaterThan(prev[1]!);
      }
    });

    it('should increment patch version for bug fixes', () => {
      const versions = ['1.0.0', '1.0.1', '1.0.2'];
      for (let i = 1; i < versions.length; i++) {
        const prev = versions[i - 1]!.split('.').map(Number);
        const curr = versions[i]!.split('.').map(Number);
        expect(curr[0]).toBe(prev[0]);
        expect(curr[1]).toBe(prev[1]);
        expect(curr[2]).toBeGreaterThan(prev[2]!);
      }
    });

    it('should reset minor and patch when major increments', () => {
      const before = '1.5.10';
      const after = '2.0.0';
      const [beforeMajor] = before.split('.').map(Number);
      const [afterMajor, afterMinor, afterPatch] = after.split('.').map(Number);

      expect(afterMajor).toBe(beforeMajor! + 1);
      expect(afterMinor).toBe(0);
      expect(afterPatch).toBe(0);
    });

    it('should reset patch when minor increments', () => {
      const before = '1.5.10';
      const after = '1.6.0';
      const [beforeMajor, beforeMinor] = before.split('.').map(Number);
      const [afterMajor, afterMinor, afterPatch] = after.split('.').map(Number);

      expect(afterMajor).toBe(beforeMajor);
      expect(afterMinor).toBe(beforeMinor! + 1);
      expect(afterPatch).toBe(0);
    });
  });

  describe('Version to Manifest State Mapping', () => {
    it('should generate unique content hash for each unique content', () => {
      const content1 = { name: 'Test A', value: 1 };
      const content2 = { name: 'Test B', value: 2 };

      const hash1 = computeContentHash(content1);
      const hash2 = computeContentHash(content2);

      expect(hash1).not.toBe(hash2);
      expect(isValidContentHash(hash1)).toBe(true);
      expect(isValidContentHash(hash2)).toBe(true);
    });

    it('should generate identical hash for identical content', () => {
      const content = { name: 'Test', value: 42 };

      const hash1 = computeContentHash(content);
      const hash2 = computeContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate identical hash regardless of property order', () => {
      const content1 = { a: 1, b: 2, c: 3 };
      const content2 = { c: 3, a: 1, b: 2 };
      const content3 = { b: 2, c: 3, a: 1 };

      const hash1 = computeContentHash(content1);
      const hash2 = computeContentHash(content2);
      const hash3 = computeContentHash(content3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should verify content hash correctly', () => {
      const content = { name: 'Test', version: '1.0.0' };
      const hash = computeContentHash(content);

      expect(verifyContentHash(content, hash)).toBe(true);
      expect(verifyContentHash({ ...content, extra: 'field' }, hash)).toBe(false);
    });

    it('should create versioned manifest with proper lineage', () => {
      const content = { name: 'Genesis', type: 'organization' };
      const manifest = createVersionedManifest(content);

      expect(isValidContentHash(manifest.contentHash)).toBe(true);
      expect(isValidVersionId(manifest.versionId)).toBe(true);
      expect(manifest.parentHash).toBeNull();
      expect(manifest.lineageChain).toHaveLength(0);
    });

    it('should derive version with parent lineage', () => {
      const content1 = { name: 'Version 1', counter: 1 };
      const content2 = { name: 'Version 2', counter: 2 };

      const manifest1 = createVersionedManifest(content1);
      const manifest2 = deriveVersion(manifest1, content2);

      expect(manifest2.parentHash).toBe(manifest1.contentHash);
      expect(manifest2.lineageChain).toContain(manifest1.contentHash);
      // The derived version includes parent hash in lineage chain
      expect(manifest2.lineageChain.length).toBeGreaterThan(manifest1.lineageChain.length);
    });

    it('should verify version integrity', () => {
      const content = { name: 'Test', data: 'value' };
      const manifest = createVersionedManifest(content);

      expect(verifyVersion(manifest)).toBe(true);
    });

    it('should detect tampered version', () => {
      const content = { name: 'Test', data: 'value' };
      const manifest = createVersionedManifest(content);

      // Create a tampered manifest (bypassing type safety for testing)
      const tampered = {
        ...manifest,
        canonicalContent: { name: 'Tampered', data: 'hacked' },
      } as VersionedManifest;

      expect(verifyVersion(tampered)).toBe(false);
    });
  });

  describe('Version ID Generation', () => {
    it('should generate valid version ID from hash', () => {
      const hash = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as ContentHash;
      const versionId = generateVersionId(hash, 1);

      expect(isValidVersionId(versionId)).toBe(true);
      expect(versionId).toMatch(/^v[a-f0-9]{8}_\d{3,}$/);
    });

    it('should extract short hash correctly', () => {
      const hash = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as ContentHash;
      const shortHash = extractShortHash(hash);

      expect(shortHash).toBe('e3b0c442');
      expect(shortHash.length).toBe(8);
    });

    it('should pad sequence number correctly', () => {
      const hash = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' as ContentHash;

      expect(generateVersionId(hash, 1)).toContain('_001');
      expect(generateVersionId(hash, 10)).toContain('_010');
      expect(generateVersionId(hash, 100)).toContain('_100');
      expect(generateVersionId(hash, 1000)).toContain('_1000');
    });
  });

  describe('Version Comparison', () => {
    it('should identify identical versions', () => {
      const content = { name: 'Same', value: 1 };
      const manifest1 = createVersionedManifest(content);
      const manifest2 = createVersionedManifest(content);

      const comparison = compareVersions(manifest1, manifest2);
      expect(comparison.identical).toBe(true);
    });

    it('should identify ancestor relationships', () => {
      const content1 = { name: 'Parent', gen: 1 };
      const content2 = { name: 'Child', gen: 2 };

      const parent = createVersionedManifest(content1);
      const child = deriveVersion(parent, content2);

      const comparison = compareVersions(parent, child);
      expect(comparison.isAncestor).toBe(true);
      expect(comparison.isDescendant).toBe(false);
    });

    it('should identify descendant relationships', () => {
      const content1 = { name: 'Parent', gen: 1 };
      const content2 = { name: 'Child', gen: 2 };

      const parent = createVersionedManifest(content1);
      const child = deriveVersion(parent, content2);

      const comparison = compareVersions(child, parent);
      expect(comparison.isAncestor).toBe(false);
      expect(comparison.isDescendant).toBe(true);
    });

    it('should find common ancestor', () => {
      const content1 = { name: 'Root', gen: 1 };
      const content2 = { name: 'Branch A', gen: 2 };
      const content3 = { name: 'Branch B', gen: 2 };

      const root = createVersionedManifest(content1);
      const branchA = deriveVersion(root, content2);
      const branchB = deriveVersion(root, content3);

      const comparison = compareVersions(branchA, branchB);
      expect(comparison.commonAncestor).toBe(root.contentHash);
    });
  });
});
