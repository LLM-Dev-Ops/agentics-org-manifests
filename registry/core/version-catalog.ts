/**
 * Version Catalog - Version management for manifests
 *
 * This module provides version management functionality for the manifest registry.
 * It supports semantic versioning comparison, version listing, and version lookup.
 *
 * All operations are READ-ONLY. Version data is derived from the manifest index.
 *
 * @module registry/core/version-catalog
 */

import type {
  ManifestId,
  ContentHash,
  SemanticVersion,
  ISODateTime,
  VersionInfo,
  VersionList,
} from '../types/registry-types.js';
import type { ManifestIndex } from './manifest-index.js';
import type { StorageAdapter } from '../storage/storage-adapter.js';

// ============================================================================
// Version Catalog Interface
// ============================================================================

/**
 * Version catalog interface for managing manifest versions
 *
 * Provides operations for listing, comparing, and retrieving version information.
 * All operations are READ-ONLY and deterministic.
 */
export interface VersionCatalog {
  /**
   * List all versions of a manifest
   * @param manifestId - Manifest identifier
   * @returns Array of version info, sorted by version (newest first)
   */
  listVersions(manifestId: ManifestId): ReadonlyArray<VersionInfo>;

  /**
   * Get the latest version of a manifest
   * @param manifestId - Manifest identifier
   * @returns Latest version info or null if manifest not found
   */
  getLatestVersion(manifestId: ManifestId): VersionInfo | null;

  /**
   * Get a specific version of a manifest
   * @param manifestId - Manifest identifier
   * @param version - Semantic version string
   * @returns Version info or null if not found
   */
  getVersion(manifestId: ManifestId, version: SemanticVersion): VersionInfo | null;

  /**
   * Get version info by content hash
   * @param hash - Content hash
   * @returns Version info or null if not found
   */
  getVersionByHash(hash: ContentHash): VersionInfo | null;

  /**
   * Compare two semantic versions
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersions(v1: SemanticVersion, v2: SemanticVersion): -1 | 0 | 1;

  /**
   * Check if a version satisfies a range
   * @param version - Version to check
   * @param range - Version range expression
   * @returns True if version satisfies range
   */
  satisfiesRange(version: SemanticVersion, range: string): boolean;

  /**
   * Get the version list for a manifest (includes metadata)
   * @param manifestId - Manifest identifier
   * @returns Version list with full metadata
   */
  getVersionList(manifestId: ManifestId): VersionList | null;

  /**
   * Check if a version exists for a manifest
   * @param manifestId - Manifest identifier
   * @param version - Semantic version string
   * @returns True if version exists
   */
  hasVersion(manifestId: ManifestId, version: SemanticVersion): boolean;

  /**
   * Get all manifests that have a specific version
   * @param version - Semantic version string
   * @returns Array of manifest IDs
   */
  getManifestsWithVersion(version: SemanticVersion): ReadonlyArray<ManifestId>;

  /**
   * Get version count for a manifest
   * @param manifestId - Manifest identifier
   * @returns Number of versions
   */
  getVersionCount(manifestId: ManifestId): number;
}

// ============================================================================
// Semantic Version Utilities
// ============================================================================

/**
 * Parsed semantic version components
 */
export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | undefined;
  readonly build: string | undefined;
}

/**
 * Parse a semantic version string
 * @param version - Semantic version string
 * @returns Parsed version components or null if invalid
 */
export function parseSemanticVersion(version: string): ParsedVersion | null {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
  );

  if (!match) {
    return null;
  }

  const major = match[1];
  const minor = match[2];
  const patch = match[3];

  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Compare two semantic versions
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareSemanticVersions(
  v1: SemanticVersion,
  v2: SemanticVersion
): -1 | 0 | 1 {
  const parsed1 = parseSemanticVersion(v1);
  const parsed2 = parseSemanticVersion(v2);

  // Invalid versions are considered equal
  if (!parsed1 && !parsed2) return 0;
  if (!parsed1) return -1;
  if (!parsed2) return 1;

  // Compare major
  if (parsed1.major !== parsed2.major) {
    return parsed1.major > parsed2.major ? 1 : -1;
  }

  // Compare minor
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor > parsed2.minor ? 1 : -1;
  }

  // Compare patch
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch > parsed2.patch ? 1 : -1;
  }

  // Compare prerelease (no prerelease > with prerelease)
  if (!parsed1.prerelease && parsed2.prerelease) return 1;
  if (parsed1.prerelease && !parsed2.prerelease) return -1;
  if (parsed1.prerelease && parsed2.prerelease) {
    return parsed1.prerelease > parsed2.prerelease ? 1 :
           parsed1.prerelease < parsed2.prerelease ? -1 : 0;
  }

  return 0;
}

/**
 * Check if a version satisfies a simple range expression
 * Supports: exact ("1.0.0"), gte (">=1.0.0"), lte ("<=1.0.0"),
 * gt (">1.0.0"), lt ("<1.0.0"), caret ("^1.0.0"), tilde ("~1.0.0")
 */
export function versionSatisfiesRange(
  version: SemanticVersion,
  range: string
): boolean {
  const trimmedRange = range.trim();

  // Handle "latest" as always matching
  if (trimmedRange === 'latest' || trimmedRange === '*') {
    return true;
  }

  // Handle exact match
  if (/^\d+\.\d+\.\d+/.test(trimmedRange) && !trimmedRange.includes(' ')) {
    return compareSemanticVersions(version, trimmedRange as SemanticVersion) === 0;
  }

  // Handle operators
  if (trimmedRange.startsWith('>=')) {
    const targetVersion = trimmedRange.slice(2).trim() as SemanticVersion;
    return compareSemanticVersions(version, targetVersion) >= 0;
  }

  if (trimmedRange.startsWith('<=')) {
    const targetVersion = trimmedRange.slice(2).trim() as SemanticVersion;
    return compareSemanticVersions(version, targetVersion) <= 0;
  }

  if (trimmedRange.startsWith('>') && !trimmedRange.startsWith('>=')) {
    const targetVersion = trimmedRange.slice(1).trim() as SemanticVersion;
    return compareSemanticVersions(version, targetVersion) > 0;
  }

  if (trimmedRange.startsWith('<') && !trimmedRange.startsWith('<=')) {
    const targetVersion = trimmedRange.slice(1).trim() as SemanticVersion;
    return compareSemanticVersions(version, targetVersion) < 0;
  }

  // Handle caret (^) - compatible with version
  if (trimmedRange.startsWith('^')) {
    const targetVersion = trimmedRange.slice(1).trim();
    const parsed = parseSemanticVersion(version);
    const target = parseSemanticVersion(targetVersion);

    if (!parsed || !target) return false;

    // ^1.2.3 allows >=1.2.3 and <2.0.0
    if (target.major > 0) {
      return parsed.major === target.major &&
             compareSemanticVersions(version, targetVersion as SemanticVersion) >= 0;
    }
    // ^0.2.3 allows >=0.2.3 and <0.3.0
    if (target.minor > 0) {
      return parsed.major === 0 &&
             parsed.minor === target.minor &&
             compareSemanticVersions(version, targetVersion as SemanticVersion) >= 0;
    }
    // ^0.0.3 allows only 0.0.3
    return compareSemanticVersions(version, targetVersion as SemanticVersion) === 0;
  }

  // Handle tilde (~) - approximately equivalent
  if (trimmedRange.startsWith('~')) {
    const targetVersion = trimmedRange.slice(1).trim();
    const parsed = parseSemanticVersion(version);
    const target = parseSemanticVersion(targetVersion);

    if (!parsed || !target) return false;

    // ~1.2.3 allows >=1.2.3 and <1.3.0
    return parsed.major === target.major &&
           parsed.minor === target.minor &&
           compareSemanticVersions(version, targetVersion as SemanticVersion) >= 0;
  }

  // Handle range with space (e.g., ">=1.0.0 <2.0.0")
  if (trimmedRange.includes(' ')) {
    const parts = trimmedRange.split(' ').filter(Boolean);
    return parts.every((part) => versionSatisfiesRange(version, part));
  }

  // Default: exact match
  return compareSemanticVersions(version, trimmedRange as SemanticVersion) === 0;
}

// ============================================================================
// Version Catalog Implementation
// ============================================================================

/**
 * Create a version catalog from a manifest index and storage
 *
 * @param index - Manifest index
 * @param storage - Storage adapter for reading version details
 * @returns Version catalog instance
 */
export function createVersionCatalog(
  index: ManifestIndex,
  storage: StorageAdapter
): VersionCatalog {
  // Cache for version information
  const versionCache = new Map<ManifestId, VersionInfo[]>();

  // Build version info from manifest reference
  const buildVersionInfo = (
    manifestId: ManifestId,
    version: SemanticVersion,
    hash: ContentHash,
    createdAt: ISODateTime,
    schemaVersion: SemanticVersion,
    parentHash: ContentHash | null = null
  ): VersionInfo => ({
    versionId: version,
    contentHash: hash,
    createdAt,
    schemaVersion,
    parentHash,
    deprecated: false,
  });

  // Get versions for a manifest (from cache or build)
  const getVersions = (manifestId: ManifestId): VersionInfo[] => {
    if (versionCache.has(manifestId)) {
      return versionCache.get(manifestId)!;
    }

    const ref = index.getById(manifestId);
    if (!ref) {
      return [];
    }

    // Build version info from reference
    // In a real implementation, we'd read detailed version info from storage
    const versions: VersionInfo[] = ref.versions.map((v: SemanticVersion, i: number) =>
      buildVersionInfo(
        manifestId,
        v,
        i === ref.versions.length - 1 ? ref.latestHash : `sha256:${'0'.repeat(64)}` as ContentHash,
        ref.createdAt,
        ref.schemaVersion,
        i > 0 ? `sha256:${'0'.repeat(64)}` as ContentHash : null
      )
    );

    // Sort by version (newest first)
    versions.sort((a, b) => -compareSemanticVersions(a.versionId, b.versionId));

    versionCache.set(manifestId, versions);
    return versions;
  };

  const catalog: VersionCatalog = {
    listVersions(manifestId: ManifestId): ReadonlyArray<VersionInfo> {
      return getVersions(manifestId);
    },

    getLatestVersion(manifestId: ManifestId): VersionInfo | null {
      const versions = getVersions(manifestId);
      const first = versions[0];
      return versions.length > 0 && first !== undefined ? first : null;
    },

    getVersion(manifestId: ManifestId, version: SemanticVersion): VersionInfo | null {
      const versions = getVersions(manifestId);
      const found = versions.find((v) => v.versionId === version);
      return found !== undefined ? found : null;
    },

    getVersionByHash(hash: ContentHash): VersionInfo | null {
      // Look up in index first
      const ref = index.getByHash(hash);
      if (!ref) {
        return null;
      }

      // Find the version with this hash
      const versions = getVersions(ref.id);
      const found = versions.find((v) => v.contentHash === hash);
      return found !== undefined ? found : null;
    },

    compareVersions(v1: SemanticVersion, v2: SemanticVersion): -1 | 0 | 1 {
      return compareSemanticVersions(v1, v2);
    },

    satisfiesRange(version: SemanticVersion, range: string): boolean {
      return versionSatisfiesRange(version, range);
    },

    getVersionList(manifestId: ManifestId): VersionList | null {
      const ref = index.getById(manifestId);
      if (!ref) {
        return null;
      }

      const versions = getVersions(manifestId);
      const firstVersion = versions[0];
      const latest = versions.length > 0 && firstVersion !== undefined ? firstVersion.versionId : '0.0.0';

      return {
        manifestId,
        versions,
        latestVersion: latest,
        totalCount: versions.length,
      };
    },

    hasVersion(manifestId: ManifestId, version: SemanticVersion): boolean {
      const ref = index.getById(manifestId);
      return ref?.versions.includes(version) ?? false;
    },

    getManifestsWithVersion(version: SemanticVersion): ReadonlyArray<ManifestId> {
      const result: ManifestId[] = [];

      for (const ref of index.list()) {
        if (ref.versions.includes(version)) {
          result.push(ref.id);
        }
      }

      // Sort using a comparator function to avoid issues with undefined
      return result.sort((a, b) => a.localeCompare(b));
    },

    getVersionCount(manifestId: ManifestId): number {
      const ref = index.getById(manifestId);
      return ref?.versions.length ?? 0;
    },
  };

  return catalog;
}

// ============================================================================
// Version Utilities
// ============================================================================

/**
 * Get the next version based on bump type
 */
export function bumpVersion(
  current: SemanticVersion,
  type: 'major' | 'minor' | 'patch'
): SemanticVersion {
  const parsed = parseSemanticVersion(current);
  if (!parsed) {
    return '1.0.0';
  }

  switch (type) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
}

/**
 * Validate a semantic version string
 */
export function isValidSemanticVersion(version: string): boolean {
  return parseSemanticVersion(version) !== null;
}

/**
 * Sort versions in descending order (newest first)
 */
export function sortVersionsDescending(
  versions: ReadonlyArray<SemanticVersion>
): SemanticVersion[] {
  return [...versions].sort((a, b) => -compareSemanticVersions(a, b));
}

/**
 * Sort versions in ascending order (oldest first)
 */
export function sortVersionsAscending(
  versions: ReadonlyArray<SemanticVersion>
): SemanticVersion[] {
  return [...versions].sort(compareSemanticVersions);
}

/**
 * Find the highest version that satisfies a range
 */
export function findBestVersion(
  versions: ReadonlyArray<SemanticVersion>,
  range: string
): SemanticVersion | null {
  const sorted = sortVersionsDescending(versions);
  return sorted.find((v) => versionSatisfiesRange(v, range)) ?? null;
}
