/**
 * Path Traverser Module
 *
 * Provides deterministic JSONPath traversal for reference resolution.
 * All functions are pure - same inputs always produce same outputs.
 *
 * Supports two reference formats:
 * - Internal refs: #/path/to/value
 * - External refs: manifest://id@version/path (path portion only)
 *
 * @module references/core/path-traverser
 */

import type {
  TraversalResult,
  TraversalError,
  TraversalErrorCode,
} from '../types/reference-types.js';
import {
  PATH_SEPARATORS,
  VALIDATION_PATTERNS,
} from '../types/reference-types.js';

// =============================================================================
// Path Parsing
// =============================================================================

/**
 * Parses a path string into an array of segments.
 * Handles both object properties and array indices.
 *
 * @param path - The path string to parse (without #/ prefix)
 * @returns Readonly array of path segments (strings for properties, numbers for indices)
 *
 * @example
 * parsePathSegments("organization/departments/0/name")
 * // Returns: ["organization", "departments", 0, "name"]
 *
 * @example
 * parsePathSegments("teams/[0]/members/[1]")
 * // Returns: ["teams", 0, "members", 1]
 */
export function parsePathSegments(path: string): ReadonlyArray<string | number> {
  if (path === '' || path === '/') {
    return [];
  }

  // Remove leading slash if present
  const normalizedPath = path.startsWith(PATH_SEPARATORS.PATH)
    ? path.slice(1)
    : path;

  if (normalizedPath === '') {
    return [];
  }

  const segments: Array<string | number> = [];
  const rawSegments = normalizedPath.split(PATH_SEPARATORS.PATH);

  for (const segment of rawSegments) {
    // Skip empty segments (from double slashes)
    if (segment === '') {
      continue;
    }

    // Check for bracket notation [0]
    const bracketMatch = VALIDATION_PATTERNS.ARRAY_INDEX.exec(segment);
    if (bracketMatch !== null && bracketMatch[1] !== undefined) {
      segments.push(parseInt(bracketMatch[1], 10));
      continue;
    }

    // Check for numeric segment (interpreted as array index)
    if (VALIDATION_PATTERNS.NUMERIC.test(segment)) {
      segments.push(parseInt(segment, 10));
      continue;
    }

    // Regular property name
    segments.push(segment);
  }

  return segments;
}

/**
 * Checks if a path segment represents an array index.
 *
 * @param segment - The segment to check
 * @returns true if the segment is a numeric array index
 */
export function isArrayIndex(segment: string): boolean {
  // Check bracket notation
  if (VALIDATION_PATTERNS.ARRAY_INDEX.test(segment)) {
    return true;
  }

  // Check numeric string
  return VALIDATION_PATTERNS.NUMERIC.test(segment);
}

/**
 * Parses an array index from a segment string.
 *
 * @param segment - The segment to parse (e.g., "0", "[0]", "[123]")
 * @returns The numeric index, or -1 if parsing fails
 */
export function parseArrayIndex(segment: string): number {
  // Check bracket notation first
  const bracketMatch = VALIDATION_PATTERNS.ARRAY_INDEX.exec(segment);
  if (bracketMatch !== null && bracketMatch[1] !== undefined) {
    return parseInt(bracketMatch[1], 10);
  }

  // Check numeric string
  if (VALIDATION_PATTERNS.NUMERIC.test(segment)) {
    return parseInt(segment, 10);
  }

  return -1;
}

// =============================================================================
// Path Traversal
// =============================================================================

/**
 * Creates a traversal error with consistent formatting.
 *
 * @param code - Error code
 * @param path - Path where error occurred
 * @param message - Error description
 * @returns Immutable TraversalError
 */
function createTraversalError(
  code: TraversalErrorCode,
  path: string,
  message: string
): TraversalError {
  return Object.freeze({
    code,
    path,
    message,
  });
}

/**
 * Creates a failed traversal result.
 *
 * @param traversedPath - Path segments successfully traversed
 * @param error - The error that caused traversal to fail
 * @returns Immutable TraversalResult with found=false
 */
function createFailedResult(
  traversedPath: ReadonlyArray<string>,
  error: TraversalError
): TraversalResult {
  return Object.freeze({
    found: false,
    value: null,
    traversedPath,
    error,
  });
}

/**
 * Creates a successful traversal result.
 *
 * @param value - The resolved value
 * @param traversedPath - Complete path that was traversed
 * @returns Immutable TraversalResult with found=true
 */
function createSuccessResult(
  value: unknown,
  traversedPath: ReadonlyArray<string>
): TraversalResult {
  return Object.freeze({
    found: true,
    value,
    traversedPath,
  });
}

/**
 * Traverses a path through an object structure deterministically.
 *
 * This function is PURE:
 * - Same content + same path = same result
 * - No side effects
 * - No mutation of input
 *
 * @param content - The object to traverse
 * @param path - The path to follow (without #/ prefix)
 * @returns TraversalResult with the found value or error details
 *
 * @example
 * const obj = { org: { teams: [{ name: "Alpha" }] } };
 * traversePath(obj, "org/teams/0/name")
 * // Returns: { found: true, value: "Alpha", traversedPath: ["org", "teams", "0", "name"] }
 *
 * @example
 * traversePath(obj, "org/missing")
 * // Returns: { found: false, value: null, error: { code: "PATH_NOT_FOUND", ... } }
 */
export function traversePath(content: object, path: string): TraversalResult {
  // Handle empty path - return the root content
  if (path === '' || path === '/') {
    return createSuccessResult(content, []);
  }

  const segments = parsePathSegments(path);
  const traversedPath: string[] = [];
  let currentValue: unknown = content;

  for (const segment of segments) {
    const segmentStr = String(segment);

    // Handle numeric segments (array access)
    if (typeof segment === 'number') {
      if (!Array.isArray(currentValue)) {
        return createFailedResult(
          traversedPath,
          createTraversalError(
            'PATH_TYPE_MISMATCH',
            traversedPath.join(PATH_SEPARATORS.PATH),
            `Expected array at '${traversedPath.join(PATH_SEPARATORS.PATH)}' but found ${typeof currentValue}`
          )
        );
      }

      if (segment < 0 || segment >= currentValue.length) {
        return createFailedResult(
          traversedPath,
          createTraversalError(
            'ARRAY_INDEX_OUT_OF_BOUNDS',
            [...traversedPath, segmentStr].join(PATH_SEPARATORS.PATH),
            `Array index ${segment} exceeds array length ${currentValue.length}`
          )
        );
      }

      currentValue = currentValue[segment];
      traversedPath.push(segmentStr);
      continue;
    }

    // Handle string segments (object property access)
    if (currentValue === null || typeof currentValue !== 'object') {
      return createFailedResult(
        traversedPath,
        createTraversalError(
          'PATH_TYPE_MISMATCH',
          traversedPath.join(PATH_SEPARATORS.PATH),
          `Expected object at '${traversedPath.join(PATH_SEPARATORS.PATH)}' but found ${currentValue === null ? 'null' : typeof currentValue}`
        )
      );
    }

    // Check if property exists
    if (!Object.prototype.hasOwnProperty.call(currentValue, segment)) {
      return createFailedResult(
        traversedPath,
        createTraversalError(
          'PATH_NOT_FOUND',
          [...traversedPath, segmentStr].join(PATH_SEPARATORS.PATH),
          `Property '${segment}' not found at path '${traversedPath.join(PATH_SEPARATORS.PATH)}'`
        )
      );
    }

    // Safe property access after hasOwnProperty check
    currentValue = (currentValue as Record<string, unknown>)[segment];
    traversedPath.push(segmentStr);
  }

  return createSuccessResult(currentValue, traversedPath);
}

/**
 * Checks if a value exists at the given path.
 * This is a convenience wrapper around traversePath.
 *
 * @param content - The object to check
 * @param path - The path to verify
 * @returns true if a value exists at the path
 */
export function pathExists(content: object, path: string): boolean {
  return traversePath(content, path).found;
}

/**
 * Gets a value at the given path, returning undefined if not found.
 * This is a convenience wrapper around traversePath.
 *
 * @param content - The object to traverse
 * @param path - The path to the value
 * @returns The value at the path, or undefined if not found
 */
export function getValueAtPath(content: object, path: string): unknown | undefined {
  const result = traversePath(content, path);
  return result.found ? result.value : undefined;
}

/**
 * Formats a path segment array back into a path string.
 *
 * @param segments - Array of path segments
 * @returns Formatted path string
 */
export function formatPath(segments: ReadonlyArray<string | number>): string {
  if (segments.length === 0) {
    return '';
  }

  return segments
    .map((s) => (typeof s === 'number' ? String(s) : s))
    .join(PATH_SEPARATORS.PATH);
}
