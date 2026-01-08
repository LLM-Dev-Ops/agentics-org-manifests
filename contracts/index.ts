/**
 * @agentics/contracts
 *
 * Contract enforcement module for HTTP boundary validation.
 * Ensures all incoming manifest requests are validated strictly and exactly once.
 *
 * Key principles:
 * - Strict validation at HTTP boundary using manifests/v1/request.schema.json
 * - Reject invalid organization or manifest payloads immediately
 * - No implicit assumptions or partial validation
 * - All responses include required execution proof
 * - Validation occurs exactly once per request
 *
 * @module contracts
 */

// Export all types
export type {
  ExecutionId,
  LayerId,
  ExecutionLayer,
  ExecutionGraphNode,
  ExecutionGraph,
  ExecutionProof,
  ContractValidationError,
  ContractValidationResult,
  ValidatedRequest,
  ContractEnforcedResponse,
  ContractEnforcedErrorResponse,
  ManifestType,
  RequestMetadata,
} from './types/contract-types.js';

// Export core validation functions
export {
  validateRequestContract,
  createExecutionProof,
  validateAndWrapRequest,
  generateExecutionId,
  clearValidatorCache,
  ExecutionLayers,
} from './core/contract-validator.js';
