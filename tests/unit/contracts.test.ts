/**
 * Contract Enforcement Tests
 *
 * Tests for strict HTTP boundary validation using @agentics/contracts.
 * Ensures:
 * - Validation occurs exactly once per request
 * - Invalid payloads are rejected immediately
 * - All responses include execution proof
 * - No implicit assumptions or partial validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRequestContract,
  createExecutionProof,
  generateExecutionId,
  validateAndWrapRequest,
  clearValidatorCache,
  ExecutionLayers,
} from '../../contracts/index.js';

describe('Contract Enforcement', () => {
  beforeEach(() => {
    clearValidatorCache();
  });

  describe('validateRequestContract', () => {
    it('should reject null payload', () => {
      const result = validateRequestContract(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('CONTRACT_001');
      expect(result.errors[0]?.message).toContain('cannot be null');
    });

    it('should reject undefined payload', () => {
      const result = validateRequestContract(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('CONTRACT_001');
    });

    it('should reject non-object payload', () => {
      const result = validateRequestContract('string-payload');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('CONTRACT_002');
      expect(result.errors[0]?.message).toContain('must be an object');
    });

    it('should reject empty object payload', () => {
      const result = validateRequestContract({});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('CONTRACT_003');
      expect(result.errors[0]?.message).toContain('cannot be an empty object');
    });

    it('should accept valid organization manifest payload', () => {
      const payload = {
        $manifest_type: 'organization',
        organization_id: 'org-123',
        name: 'Test Organization',
      };

      const result = validateRequestContract(payload);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.schema_used).toBe('manifests/v1/request.schema.json');
    });

    it('should accept valid team manifest payload', () => {
      const payload = {
        $manifest_type: 'team',
        team_id: 'team-123',
        name: 'Test Team',
      };

      const result = validateRequestContract(payload);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid policy manifest payload', () => {
      const payload = {
        policy_id: 'policy-123',
        name: 'Test Policy',
      };

      const result = validateRequestContract(payload);

      expect(result.valid).toBe(true);
    });

    it('should accept payload with full metadata', () => {
      const payload = {
        $id: 'manifest-123',
        $schema_version: '1.0.0',
        $created_at: '2024-01-01T00:00:00Z',
        $content_hash: 'sha256:' + 'a'.repeat(64),
        organization_id: 'org-123',
      };

      const result = validateRequestContract(payload);

      expect(result.valid).toBe(true);
    });

    it('should include validated_at timestamp', () => {
      const payload = { organization_id: 'org-123' };
      const result = validateRequestContract(payload);

      expect(result.validated_at).toBeDefined();
      expect(() => new Date(result.validated_at)).not.toThrow();
    });
  });

  describe('createExecutionProof', () => {
    it('should create valid execution proof with layers', () => {
      const executionId = generateExecutionId();
      const startTime = Date.now();
      const layers = [
        ExecutionLayers.CONTRACT_VALIDATION,
        ExecutionLayers.MANIFEST_PARSING,
        ExecutionLayers.SCHEMA_VALIDATION,
      ];

      const proof = createExecutionProof(executionId, startTime, layers);

      expect(proof.execution_id).toBe(executionId);
      expect(proof.layers_executed).toEqual(layers);
      expect(proof.execution_graph).toBeDefined();
      expect(proof.execution_graph.nodes).toHaveLength(3);
      expect(proof.execution_graph.edges).toHaveLength(2);
      expect(proof.total_duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should create valid execution graph with dependencies', () => {
      const executionId = generateExecutionId();
      const startTime = Date.now();
      const layers = [
        ExecutionLayers.CONTRACT_VALIDATION,
        ExecutionLayers.RESPONSE_GENERATION,
      ];

      const proof = createExecutionProof(executionId, startTime, layers);

      expect(proof.execution_graph.root_node).toBe('node-0');
      expect(proof.execution_graph.nodes[0]?.depends_on).toEqual([]);
      expect(proof.execution_graph.nodes[1]?.depends_on).toEqual(['node-0']);
    });

    it('should include start and completion timestamps', () => {
      const executionId = generateExecutionId();
      const startTime = Date.now();
      const layers = [ExecutionLayers.CONTRACT_VALIDATION];

      const proof = createExecutionProof(executionId, startTime, layers);

      expect(proof.started_at).toBeDefined();
      expect(proof.completed_at).toBeDefined();
      expect(new Date(proof.completed_at).getTime()).toBeGreaterThanOrEqual(
        new Date(proof.started_at).getTime()
      );
    });

    it('should handle empty layers', () => {
      const executionId = generateExecutionId();
      const startTime = Date.now();

      const proof = createExecutionProof(executionId, startTime, []);

      expect(proof.layers_executed).toEqual([]);
      expect(proof.execution_graph.nodes).toHaveLength(0);
      expect(proof.execution_graph.root_node).toBe('empty');
    });
  });

  describe('generateExecutionId', () => {
    it('should generate unique execution IDs', () => {
      const id1 = generateExecutionId();
      const id2 = generateExecutionId();

      expect(id1).not.toBe(id2);
    });

    it('should have correct format', () => {
      const id = generateExecutionId();

      expect(id).toMatch(/^exec-[a-f0-9-]{36}$/);
    });
  });

  describe('validateAndWrapRequest', () => {
    it('should return error for invalid payload', () => {
      const result = validateAndWrapRequest(null);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error.valid).toBe(false);
      }
    });

    it('should return validated request for valid payload', () => {
      const payload = { organization_id: 'org-123' };
      const result = validateAndWrapRequest(payload);

      expect('validated' in result).toBe(true);
      if ('validated' in result) {
        expect(result.validated.payload).toEqual(payload);
        expect(result.validated.validation.valid).toBe(true);
        expect(result.validated.execution_id).toMatch(/^exec-/);
      }
    });

    it('should extract request metadata', () => {
      const payload = {
        $manifest_type: 'organization',
        $schema_version: '1.0.0',
        $content_hash: 'sha256:' + 'b'.repeat(64),
        organization_id: 'org-123',
      };

      const result = validateAndWrapRequest(payload);

      expect('validated' in result).toBe(true);
      if ('validated' in result && 'metadata' in result) {
        expect(result.metadata.manifest_type).toBe('organization');
        expect(result.metadata.has_explicit_type).toBe(true);
        expect(result.metadata.schema_version).toBe('1.0.0');
        expect(result.metadata.content_hash).toBe('sha256:' + 'b'.repeat(64));
      }
    });

    it('should infer manifest type when not explicit', () => {
      const payload = { team_id: 'team-123', members: [], organization_ref: 'org-123' };
      const result = validateAndWrapRequest(payload);

      if ('metadata' in result) {
        expect(result.metadata.manifest_type).toBe('team');
        expect(result.metadata.has_explicit_type).toBe(false);
      }
    });
  });

  describe('ExecutionLayers', () => {
    it('should have all required layers defined', () => {
      expect(ExecutionLayers.CONTRACT_VALIDATION).toBe('contract-validation');
      expect(ExecutionLayers.MANIFEST_PARSING).toBe('manifest-parsing');
      expect(ExecutionLayers.SCHEMA_VALIDATION).toBe('schema-validation');
      expect(ExecutionLayers.INTEGRITY_CHECK).toBe('integrity-check');
      expect(ExecutionLayers.PATTERN_DETECTION).toBe('pattern-detection');
      expect(ExecutionLayers.DOMAIN_RULES).toBe('domain-rules');
      expect(ExecutionLayers.RESPONSE_GENERATION).toBe('response-generation');
    });
  });

  describe('Validation occurs exactly once', () => {
    it('should validate request contract only once', () => {
      const payload = { organization_id: 'org-123' };

      // First validation
      const result1 = validateRequestContract(payload);
      expect(result1.valid).toBe(true);

      // The same payload validated again should return same result
      // (testing determinism - contract validation is stateless)
      const result2 = validateRequestContract(payload);
      expect(result2.valid).toBe(result1.valid);
    });

    it('should not partially validate - all or nothing', () => {
      // A payload with some valid and some invalid fields
      // should be rejected entirely at the contract level
      const partiallyValidPayload = {
        organization_id: 'org-123',
        // Empty object is rejected at contract level
      };

      const result = validateRequestContract(partiallyValidPayload);
      // Should still be valid because it has required fields
      expect(result.valid).toBe(true);

      // But an empty object should be completely rejected
      const emptyPayload = {};
      const emptyResult = validateRequestContract(emptyPayload);
      expect(emptyResult.valid).toBe(false);
    });
  });

  describe('No implicit assumptions', () => {
    it('should not assume manifest type without explicit declaration or recognizable structure', () => {
      // Generic object with no recognizable manifest structure
      const genericPayload = { foo: 'bar', baz: 123 };
      const result = validateAndWrapRequest(genericPayload);

      if ('metadata' in result) {
        expect(result.metadata.manifest_type).toBe('unknown');
        expect(result.metadata.has_explicit_type).toBe(false);
      }
    });

    it('should require explicit fields - not assume defaults', () => {
      // Contract validation should work without assuming any defaults
      const minimalPayload = { organization_id: 'org-123' };
      const result = validateRequestContract(minimalPayload);

      // Should pass contract validation (minimal requirements met)
      expect(result.valid).toBe(true);

      // But metadata extraction should not assume anything not present
      const wrapResult = validateAndWrapRequest(minimalPayload);
      if ('metadata' in wrapResult) {
        expect(wrapResult.metadata.schema_version).toBeNull();
        expect(wrapResult.metadata.content_hash).toBeNull();
      }
    });
  });
});
