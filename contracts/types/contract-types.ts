/**
 * Contract Types for HTTP Boundary Validation
 *
 * This module defines types for strict contract enforcement at the HTTP boundary.
 * All incoming requests must be validated before any processing occurs.
 *
 * @module contracts/types
 */

/**
 * Execution identifier for tracing requests
 */
export type ExecutionId = string;

/**
 * Layer identifiers for execution tracking
 */
export type LayerId = string;

/**
 * Execution layer representing a step in request processing
 */
export interface ExecutionLayer {
  readonly layer_id: LayerId;
  readonly name: string;
  readonly status: 'pending' | 'executing' | 'completed' | 'failed';
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly duration_ms?: number;
}

/**
 * Execution graph node for tracking dependencies
 */
export interface ExecutionGraphNode {
  readonly node_id: string;
  readonly layer_id: LayerId;
  readonly depends_on: readonly string[];
  readonly status: 'pending' | 'completed' | 'failed';
}

/**
 * Execution graph representing the complete execution flow
 */
export interface ExecutionGraph {
  readonly nodes: readonly ExecutionGraphNode[];
  readonly edges: readonly { from: string; to: string }[];
  readonly root_node: string;
}

/**
 * Execution proof that must be included in all API responses
 */
export interface ExecutionProof {
  /** Unique identifier for this execution */
  readonly execution_id: ExecutionId;
  /** Ordered list of layers that were executed */
  readonly layers_executed: readonly LayerId[];
  /** Full execution graph showing dependencies */
  readonly execution_graph: ExecutionGraph;
  /** Total execution time in milliseconds */
  readonly total_duration_ms: number;
  /** Timestamp when execution started */
  readonly started_at: string;
  /** Timestamp when execution completed */
  readonly completed_at: string;
}

/**
 * Contract validation error
 */
export interface ContractValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: 'error';
}

/**
 * Result of contract validation at HTTP boundary
 */
export interface ContractValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ContractValidationError[];
  readonly validated_at: string;
  readonly schema_used: string;
}

/**
 * Validated request wrapper ensuring type safety
 */
export interface ValidatedRequest<T> {
  readonly payload: T;
  readonly validation: ContractValidationResult;
  readonly execution_id: ExecutionId;
}

/**
 * API response with required execution proof
 */
export interface ContractEnforcedResponse<T> {
  readonly data: T;
  readonly execution_proof: ExecutionProof;
}

/**
 * Error response with execution proof
 */
export interface ContractEnforcedErrorResponse {
  readonly error: string;
  readonly errors?: readonly ContractValidationError[];
  readonly execution_proof: ExecutionProof;
}

/**
 * Manifest types supported by the API
 */
export type ManifestType = 'organization' | 'team' | 'role' | 'capability' | 'policy' | 'unknown';

/**
 * Request metadata extracted during validation
 */
export interface RequestMetadata {
  readonly manifest_type: ManifestType;
  readonly has_explicit_type: boolean;
  readonly schema_version: string | null;
  readonly content_hash: string | null;
}
