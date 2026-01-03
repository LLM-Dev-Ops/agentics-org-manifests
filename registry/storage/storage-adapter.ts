/**
 * Storage Adapter - File-based storage abstraction for the manifest registry
 *
 * This module provides a read-only storage interface for accessing manifest files.
 * The storage is file-based with Git providing versioning and audit trail.
 *
 * @module registry/storage/storage-adapter
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ManifestId,
  ManifestType,
  ContentHash,
  ManifestReference,
  Manifest,
} from '../types/registry-types.js';

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Base path for manifest storage */
  readonly basePath: string;

  /** Path to manifest index file */
  readonly indexPath: string;

  /** File extension for manifest files */
  readonly manifestExtension: string;

  /** Encoding for reading files */
  readonly encoding: BufferEncoding;

  /** Maximum file size in bytes */
  readonly maxFileSize: number;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  basePath: './manifests',
  indexPath: './registry/manifest-index.json',
  manifestExtension: '.json',
  encoding: 'utf-8',
  maxFileSize: 1024 * 1024, // 1 MB
};

// ============================================================================
// Storage Adapter Interface
// ============================================================================

/**
 * Storage adapter interface for file-based manifest access
 *
 * All operations are READ-ONLY.
 * NO write operations are exposed.
 */
export interface StorageAdapter {
  /** Base path for manifest storage */
  readonly basePath: string;

  /** Configuration for this adapter */
  readonly config: StorageConfig;

  /**
   * Read a manifest from the storage
   * @param relativePath - Path relative to basePath
   * @returns Parsed manifest object or null if not found
   */
  readManifest(relativePath: string): Promise<Manifest | null>;

  /**
   * Read raw JSON from a file
   * @param relativePath - Path relative to basePath
   * @returns Parsed JSON object or null if not found
   */
  readJson<T = unknown>(relativePath: string): Promise<T | null>;

  /**
   * Read the manifest index
   * @returns Manifest index object
   */
  readIndex(): Promise<ManifestIndex>;

  /**
   * Check if a file exists
   * @param relativePath - Path relative to basePath
   * @returns True if file exists
   */
  exists(relativePath: string): Promise<boolean>;

  /**
   * List all files in a directory
   * @param directory - Directory path relative to basePath
   * @returns Array of file paths
   */
  listFiles(directory: string): Promise<ReadonlyArray<string>>;

  /**
   * List all directories in a path
   * @param directory - Directory path relative to basePath
   * @returns Array of directory names
   */
  listDirectories(directory: string): Promise<ReadonlyArray<string>>;

  /**
   * Get file stats
   * @param relativePath - Path relative to basePath
   * @returns File stats or null if not found
   */
  getStats(relativePath: string): Promise<FileStats | null>;

  /**
   * Calculate storage usage
   * @returns Storage usage statistics
   */
  getStorageUsage(): Promise<StorageUsage>;
}

/**
 * Manifest index structure stored on disk
 */
export interface ManifestIndex {
  readonly version: string;
  readonly lastUpdated: string;
  readonly manifests: ReadonlyMap<ManifestId, ManifestReference>;
  readonly hashIndex: ReadonlyMap<ContentHash, ManifestId>;
  readonly typeIndex: ReadonlyMap<ManifestType, ReadonlyArray<ManifestId>>;
}

/**
 * File statistics
 */
export interface FileStats {
  readonly size: number;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

/**
 * Storage usage statistics
 */
export interface StorageUsage {
  readonly totalFiles: number;
  readonly totalSize: number;
  readonly byType: ReadonlyMap<ManifestType, number>;
  readonly calculatedAt: string;
}

// ============================================================================
// Storage Errors
// ============================================================================

/**
 * Storage operation error
 */
export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly path: string | undefined;
  public override readonly cause: Error | undefined;

  constructor(
    message: string,
    code: StorageErrorCode,
    path: string | undefined,
    cause: Error | undefined
  ) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.path = path;
    this.cause = cause;
  }
}

/**
 * Storage error codes
 */
export type StorageErrorCode =
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_JSON'
  | 'FILE_TOO_LARGE'
  | 'DIRECTORY_NOT_FOUND'
  | 'READ_ERROR'
  | 'INDEX_CORRUPT';

// ============================================================================
// File-Based Storage Adapter Implementation
// ============================================================================

/**
 * Create a file-based storage adapter
 *
 * @param config - Storage configuration (uses defaults if not provided)
 * @returns Storage adapter instance
 */
export function createStorageAdapter(
  config: Partial<StorageConfig> = {}
): StorageAdapter {
  const fullConfig: StorageConfig = {
    ...DEFAULT_STORAGE_CONFIG,
    ...config,
  };

  const resolvePath = (relativePath: string): string => {
    return path.resolve(fullConfig.basePath, relativePath);
  };

  const adapter: StorageAdapter = {
    basePath: fullConfig.basePath,
    config: fullConfig,

    async readManifest(relativePath: string): Promise<Manifest | null> {
      const content = await adapter.readJson<Manifest>(relativePath);
      return content;
    },

    async readJson<T = unknown>(relativePath: string): Promise<T | null> {
      const fullPath = resolvePath(relativePath);

      try {
        // Check if file exists
        const stats = await fs.stat(fullPath);

        if (!stats.isFile()) {
          return null;
        }

        // Check file size
        if (stats.size > fullConfig.maxFileSize) {
          throw new StorageError(
            `File exceeds maximum size of ${fullConfig.maxFileSize} bytes`,
            'FILE_TOO_LARGE',
            fullPath,
            undefined
          );
        }

        // Read and parse file
        const content = await fs.readFile(fullPath, fullConfig.encoding);
        return JSON.parse(content) as T;
      } catch (error) {
        if (error instanceof StorageError) {
          throw error;
        }

        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === 'ENOENT') {
          return null;
        }

        if (nodeError.code === 'EACCES') {
          throw new StorageError(
            `Permission denied reading file`,
            'PERMISSION_DENIED',
            fullPath,
            nodeError
          );
        }

        if (error instanceof SyntaxError) {
          throw new StorageError(
            `Invalid JSON in file`,
            'INVALID_JSON',
            fullPath,
            error
          );
        }

        throw new StorageError(
          `Error reading file: ${nodeError.message}`,
          'READ_ERROR',
          fullPath,
          nodeError
        );
      }
    },

    async readIndex(): Promise<ManifestIndex> {
      const indexPath = fullConfig.indexPath;

      try {
        const rawIndex = await adapter.readJson<RawManifestIndex>(indexPath);

        if (!rawIndex) {
          // Return empty index if file doesn't exist
          return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            manifests: new Map(),
            hashIndex: new Map(),
            typeIndex: new Map(),
          };
        }

        // Convert raw index to typed index with Maps
        const manifests = new Map<ManifestId, ManifestReference>();
        const hashIndex = new Map<ContentHash, ManifestId>();
        const typeIndex = new Map<ManifestType, ManifestId[]>();

        for (const [id, ref] of Object.entries(rawIndex.manifests || {})) {
          manifests.set(id, ref as ManifestReference);
          hashIndex.set((ref as ManifestReference).latestHash, id);

          const type = (ref as ManifestReference).type;
          const typeList = typeIndex.get(type) || [];
          typeList.push(id);
          typeIndex.set(type, typeList);
        }

        return {
          version: rawIndex.version || '1.0.0',
          lastUpdated: rawIndex.lastUpdated || new Date().toISOString(),
          manifests,
          hashIndex,
          typeIndex,
        };
      } catch (error) {
        if (error instanceof StorageError) {
          throw new StorageError(
            `Manifest index is corrupt: ${error.message}`,
            'INDEX_CORRUPT',
            indexPath,
            error
          );
        }
        throw error;
      }
    },

    async exists(relativePath: string): Promise<boolean> {
      const fullPath = resolvePath(relativePath);

      try {
        await fs.access(fullPath);
        return true;
      } catch {
        return false;
      }
    },

    async listFiles(directory: string): Promise<ReadonlyArray<string>> {
      const fullPath = resolvePath(directory);

      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => path.join(directory, entry.name));
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === 'ENOENT') {
          return [];
        }

        throw new StorageError(
          `Error listing directory: ${nodeError.message}`,
          'DIRECTORY_NOT_FOUND',
          fullPath,
          nodeError
        );
      }
    },

    async listDirectories(directory: string): Promise<ReadonlyArray<string>> {
      const fullPath = resolvePath(directory);

      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === 'ENOENT') {
          return [];
        }

        throw new StorageError(
          `Error listing directory: ${nodeError.message}`,
          'DIRECTORY_NOT_FOUND',
          fullPath,
          nodeError
        );
      }
    },

    async getStats(relativePath: string): Promise<FileStats | null> {
      const fullPath = resolvePath(relativePath);

      try {
        const stats = await fs.stat(fullPath);

        return {
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
        };
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code === 'ENOENT') {
          return null;
        }

        throw new StorageError(
          `Error getting file stats: ${nodeError.message}`,
          'READ_ERROR',
          fullPath,
          nodeError
        );
      }
    },

    async getStorageUsage(): Promise<StorageUsage> {
      const manifestTypes: ManifestType[] = [
        'organization',
        'team',
        'role',
        'capability',
        'policy',
      ];

      let totalFiles = 0;
      let totalSize = 0;
      const byType = new Map<ManifestType, number>();

      for (const type of manifestTypes) {
        const typeDir = path.join(fullConfig.basePath, `${type}s`);
        const files = await adapter.listFiles(typeDir);

        let typeSize = 0;
        for (const file of files) {
          const stats = await adapter.getStats(file);
          if (stats) {
            typeSize += stats.size;
            totalFiles++;
          }
        }

        byType.set(type, typeSize);
        totalSize += typeSize;
      }

      return {
        totalFiles,
        totalSize,
        byType,
        calculatedAt: new Date().toISOString(),
      };
    },
  };

  return adapter;
}

// ============================================================================
// Raw Index Type (for JSON deserialization)
// ============================================================================

/**
 * Raw manifest index as stored in JSON file
 */
interface RawManifestIndex {
  version?: string;
  lastUpdated?: string;
  manifests?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the storage path for a manifest
 * @param type - Manifest type
 * @param id - Manifest ID
 * @param version - Optional version string
 * @returns Relative path to manifest file
 */
export function getManifestPath(
  type: ManifestType,
  id: ManifestId,
  version?: string
): string {
  const typeDir = `${type}s`;
  const fileName = version
    ? `${id}@${version}.json`
    : `${id}.json`;
  return path.join(typeDir, fileName);
}

/**
 * Parse a manifest path into its components
 * @param manifestPath - Path to manifest file
 * @returns Parsed path components or null if invalid
 */
export function parseManifestPath(
  manifestPath: string
): { type: ManifestType; id: ManifestId; version: string | undefined } | null {
  const parts = manifestPath.split(path.sep);

  if (parts.length < 2) {
    return null;
  }

  const typeDir = parts[parts.length - 2];
  const fileName = parts[parts.length - 1];

  if (typeDir === undefined || fileName === undefined) {
    return null;
  }

  // Extract type from directory name (e.g., "organizations" -> "organization")
  const typeMatch = typeDir.match(/^(organization|team|role|capability|policy)s?$/);
  if (!typeMatch || typeMatch[1] === undefined) {
    return null;
  }
  const type = typeMatch[1] as ManifestType;

  // Parse file name for ID and optional version
  const fileMatch = fileName.match(/^(.+?)(?:@(.+))?\.json$/);
  if (!fileMatch || fileMatch[1] === undefined) {
    return null;
  }

  const id = fileMatch[1];
  const version = fileMatch[2];

  return { type, id, version };
}

/**
 * Create a storage adapter with default configuration for the repository
 */
export function createDefaultStorageAdapter(
  repositoryRoot: string
): StorageAdapter {
  return createStorageAdapter({
    basePath: path.join(repositoryRoot, 'manifests'),
    indexPath: path.join(repositoryRoot, 'registry', 'manifest-index.json'),
  });
}
