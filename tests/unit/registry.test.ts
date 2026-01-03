/**
 * Registry Tests
 *
 * Tests for manifest registry functionality including
 * storage, retrieval, and index management.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeContentHash } from '../../versioning/core/content-hasher.js';

const FIXTURES_PATH = '/workspaces/agentics-org-manifests/tests/fixtures';

describe('Registry Operations', () => {
  describe('Manifest Storage', () => {
    it('should index manifest by content hash', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const { $manifest, ...content } = validOrg;
      const hash = computeContentHash(content);

      // Simulate registry storage
      const registry = new Map<string, object>();
      registry.set(hash, validOrg);

      expect(registry.has(hash)).toBe(true);
      expect(registry.get(hash)).toEqual(validOrg);
    });

    it('should index manifest by ID', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      // Simulate registry storage by ID
      const registry = new Map<string, object>();
      registry.set(validOrg.id, validOrg);

      expect(registry.has(validOrg.id)).toBe(true);
      expect(registry.get(validOrg.id)).toEqual(validOrg);
    });

    it('should support composite key (ID@version)', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );

      const compositeKey = `${validOrg.id}@${validOrg.$manifest.version}`;

      const registry = new Map<string, object>();
      registry.set(compositeKey, validOrg);

      expect(registry.has(compositeKey)).toBe(true);
    });
  });

  describe('Version History', () => {
    it('should maintain version history for manifest', () => {
      const versions: Array<{ version: string; hash: string; content: object }> = [];

      // Simulate multiple versions
      const v1 = { name: 'Org v1', version: '1.0.0' };
      const v2 = { name: 'Org v2', version: '1.1.0' };
      const v3 = { name: 'Org v3', version: '2.0.0' };

      [v1, v2, v3].forEach((content) => {
        versions.push({
          version: content.version,
          hash: computeContentHash(content),
          content,
        });
      });

      expect(versions).toHaveLength(3);
      expect(versions.map((v) => v.version)).toEqual(['1.0.0', '1.1.0', '2.0.0']);

      // Each version should have unique hash
      const hashes = versions.map((v) => v.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(3);
    });

    it('should retrieve specific version by hash', () => {
      const registry = new Map<string, object>();
      const content = { name: 'Test', value: 42 };
      const hash = computeContentHash(content);

      registry.set(hash, content);

      const retrieved = registry.get(hash);
      expect(retrieved).toEqual(content);
    });
  });

  describe('Type-based Indexing', () => {
    it('should index manifests by type', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );
      const validTeam = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-team.json'), 'utf-8')
      );

      const typeIndex = new Map<string, object[]>();

      // Index organization
      const orgType = 'organization';
      if (!typeIndex.has(orgType)) {
        typeIndex.set(orgType, []);
      }
      typeIndex.get(orgType)!.push(validOrg);

      // Index team
      const teamType = 'team';
      if (!typeIndex.has(teamType)) {
        typeIndex.set(teamType, []);
      }
      typeIndex.get(teamType)!.push(validTeam);

      expect(typeIndex.get('organization')).toHaveLength(1);
      expect(typeIndex.get('team')).toHaveLength(1);
    });
  });

  describe('Reference Resolution', () => {
    it('should resolve organization reference from team', () => {
      const validOrg = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-organization.json'), 'utf-8')
      );
      const validTeam = JSON.parse(
        readFileSync(join(FIXTURES_PATH, 'valid-team.json'), 'utf-8')
      );

      // Build department -> organization index
      const deptToOrg = new Map<string, string>();
      validOrg.departments?.forEach((dept: { id: string }) => {
        deptToOrg.set(dept.id, validOrg.id);
      });

      // Resolve team's department reference
      const orgId = deptToOrg.get(validTeam.departmentId);
      expect(orgId).toBe(validOrg.id);
    });
  });
});
