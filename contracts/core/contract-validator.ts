/**
 * Contract Validator
 *
 * Implements strict contract enforcement at the HTTP boundary.
 * All incoming requests are validated exactly ONCE before any processing.
 *
 * Principles:
 * - Validation occurs exactly once per request at entry
 * - Invalid payloads are rejected immediately
 * - No implicit assumptions or partial validation
 * - All responses include execution proof
 *
 * @module contracts/core
 */

import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  ContractValidationResult,
  ContractValidationError,
  ExecutionProof,
  ExecutionId,
  LayerId,
  ExecutionGraph,
  ManifestType,
  RequestMetadata,
  ValidatedRequest,
} from '../types/contract-types.js';

// Load request schema at runtime (using process.cwd() for bundle compatibility)
const schemaPath = join(process.cwd(), 'schemas/v1/request.schema.json');
const requestSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

/**
 * Cached Ajv validator instance
 */
let cachedValidator: ValidateFunction | null = null;

/**
 * Create and cache the Ajv validator instance
 */
function getValidator(): ValidateFunction {
  if (cachedValidator) {
    return cachedValidator;
  }

  const ajv = new Ajv({
    allErrors: true,
    strict: false, // Allow draft-07 schema features
    allowUnionTypes: true,
    removeAdditional: false,
    useDefaults: false,
    coerceTypes: false,
  });

  addFormats(ajv);

  // Compile the request schema
  cachedValidator = ajv.compile(requestSchema);
  return cachedValidator;
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): ExecutionId {
  return `exec-${randomUUID()}`;
}

/**
 * Generate a layer ID
 */
function generateLayerId(name: string): LayerId {
  return `layer-${name}-${Date.now()}`;
}

/**
 * Detect manifest type from payload
 */
function detectManifestType(payload: unknown): ManifestType {
  if (typeof payload !== 'object' || payload === null) {
    return 'unknown';
  }

  const obj = payload as Record<string, unknown>;

  // Check for explicit type declaration
  if ('$manifest_type' in obj && typeof obj['$manifest_type'] === 'string') {
    const declaredType = obj['$manifest_type'].toLowerCase();
    if (['organization', 'team', 'role', 'capability', 'policy'].includes(declaredType)) {
      return declaredType as ManifestType;
    }
  }

  // Infer type from content structure
  if ('organization_id' in obj || 'legal_status' in obj || 'jurisdiction' in obj) {
    return 'organization';
  }

  if ('team_id' in obj || ('members' in obj && 'organization_ref' in obj)) {
    return 'team';
  }

  if ('role_id' in obj || ('permissions' in obj && 'responsibilities' in obj)) {
    return 'role';
  }

  if ('capability_id' in obj || 'skills' in obj) {
    return 'capability';
  }

  if ('policy_id' in obj || ('constraints' in obj && 'effective_date' in obj)) {
    return 'policy';
  }

  return 'unknown';
}

/**
 * Extract request metadata from payload
 */
function extractRequestMetadata(payload: unknown): RequestMetadata {
  if (typeof payload !== 'object' || payload === null) {
    return {
      manifest_type: 'unknown',
      has_explicit_type: false,
      schema_version: null,
      content_hash: null,
    };
  }

  const obj = payload as Record<string, unknown>;
  const manifestType = detectManifestType(payload);

  return {
    manifest_type: manifestType,
    has_explicit_type: '$manifest_type' in obj,
    schema_version: typeof obj['$schema_version'] === 'string' ? obj['$schema_version'] : null,
    content_hash: typeof obj['$content_hash'] === 'string' ? obj['$content_hash'] : null,
  };
}

/**
 * Validate request payload against contract schema
 *
 * This is the ONLY point where validation occurs.
 * All subsequent processing assumes the payload is valid.
 *
 * @param payload - The raw request payload
 * @returns Contract validation result
 */
export function validateRequestContract(payload: unknown): ContractValidationResult {
  const validator = getValidator();
  const validatedAt = new Date().toISOString();

  // Reject null/undefined payloads immediately
  if (payload === null || payload === undefined) {
    return {
      valid: false,
      errors: [
        {
          code: 'CONTRACT_001',
          path: '$',
          message: 'Request payload is required and cannot be null or undefined',
          severity: 'error',
        },
      ],
      validated_at: validatedAt,
      schema_used: 'manifests/v1/request.schema.json',
    };
  }

  // Reject non-object payloads immediately
  if (typeof payload !== 'object') {
    return {
      valid: false,
      errors: [
        {
          code: 'CONTRACT_002',
          path: '$',
          message: `Request payload must be an object, received ${typeof payload}`,
          severity: 'error',
        },
      ],
      validated_at: validatedAt,
      schema_used: 'manifests/v1/request.schema.json',
    };
  }

  // Reject empty objects for validation endpoint
  if (Object.keys(payload as object).length === 0) {
    return {
      valid: false,
      errors: [
        {
          code: 'CONTRACT_003',
          path: '$',
          message: 'Request payload cannot be an empty object',
          severity: 'error',
        },
      ],
      validated_at: validatedAt,
      schema_used: 'manifests/v1/request.schema.json',
    };
  }

  // Perform schema validation
  const isValid = validator(payload);

  if (isValid) {
    return {
      valid: true,
      errors: [],
      validated_at: validatedAt,
      schema_used: 'manifests/v1/request.schema.json',
    };
  }

  // Convert Ajv errors to contract validation errors
  const errors: ContractValidationError[] = (validator.errors || []).map((err) => ({
    code: `CONTRACT_SCHEMA_${err.keyword?.toUpperCase() || 'UNKNOWN'}`,
    path: err.instancePath || '$',
    message: err.message || 'Schema validation failed',
    severity: 'error' as const,
  }));

  return {
    valid: false,
    errors,
    validated_at: validatedAt,
    schema_used: 'manifests/v1/request.schema.json',
  };
}

/**
 * Create execution proof for API response
 *
 * @param executionId - Unique execution identifier
 * @param startTime - When execution started
 * @param layersExecuted - Ordered list of executed layers
 * @returns Complete execution proof
 */
export function createExecutionProof(
  executionId: ExecutionId,
  startTime: number,
  layersExecuted: readonly LayerId[]
): ExecutionProof {
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  // Build execution graph
  const nodes = layersExecuted.map((layerId, index) => ({
    node_id: `node-${index}`,
    layer_id: layerId,
    depends_on: index > 0 ? [`node-${index - 1}`] : [],
    status: 'completed' as const,
  }));

  const edges = nodes.slice(1).map((node, index) => ({
    from: `node-${index}`,
    to: node.node_id,
  }));

  const executionGraph: ExecutionGraph = {
    nodes,
    edges,
    root_node: nodes.length > 0 && nodes[0] ? nodes[0].node_id : 'empty',
  };

  return {
    execution_id: executionId,
    layers_executed: layersExecuted,
    execution_graph: executionGraph,
    total_duration_ms: totalDurationMs,
    started_at: new Date(startTime).toISOString(),
    completed_at: completedAt,
  };
}

/**
 * Validate and wrap request with execution context
 *
 * @param payload - Raw request payload
 * @returns Validated request with execution ID or null if invalid
 */
export function validateAndWrapRequest<T>(
  payload: unknown
): { validated: ValidatedRequest<T>; metadata: RequestMetadata } | { error: ContractValidationResult } {
  const executionId = generateExecutionId();
  const validation = validateRequestContract(payload);
  const metadata = extractRequestMetadata(payload);

  if (!validation.valid) {
    return { error: validation };
  }

  return {
    validated: {
      payload: payload as T,
      validation,
      execution_id: executionId,
    },
    metadata,
  };
}

/**
 * Layer names for execution tracking
 */
export const ExecutionLayers = {
  CONTRACT_VALIDATION: 'contract-validation',
  MANIFEST_PARSING: 'manifest-parsing',
  SCHEMA_VALIDATION: 'schema-validation',
  INTEGRITY_CHECK: 'integrity-check',
  PATTERN_DETECTION: 'pattern-detection',
  DOMAIN_RULES: 'domain-rules',
  RESPONSE_GENERATION: 'response-generation',
} as const;

/**
 * Clear the cached validator (for testing)
 */
export function clearValidatorCache(): void {
  cachedValidator = null;
}
