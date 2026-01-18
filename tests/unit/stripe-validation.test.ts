/**
 * Stripe Customer ID Validation Tests
 *
 * Verifies:
 * - stripeCustomerId field validates correct format (cus_XXXXXX)
 * - Null stripeCustomerId is allowed (lazy creation)
 * - Deletion safety: DISSOLVED status blocked when Stripe customer exists
 */

import { describe, it, expect } from 'vitest';
import {
  validateStripeCustomerId,
  validateDeletionSafety,
  STRIPE_CUSTOMER_ID_PATTERN,
} from '../../validation/rules/organization-rules.js';

describe('Stripe Customer ID Validation', () => {
  describe('Pattern Matching', () => {
    it('should match valid Stripe customer IDs', () => {
      const validIds = [
        'cus_NffrFeUfNV2Hib',
        'cus_123456789012345',
        'cus_abcdefghijklmno',
        'cus_AbCdEfGhIjKlMnO',
      ];

      validIds.forEach((id) => {
        expect(id).toMatch(STRIPE_CUSTOMER_ID_PATTERN);
      });
    });

    it('should reject invalid Stripe customer IDs', () => {
      const invalidIds = [
        'cust_123456789012345',   // Wrong prefix
        'cus_short',               // Too short
        'sub_123456789012345',     // Wrong prefix (subscription)
        '123456789012345',         // No prefix
        '',                        // Empty
        'cus_',                    // Prefix only
      ];

      invalidIds.forEach((id) => {
        expect(id).not.toMatch(STRIPE_CUSTOMER_ID_PATTERN);
      });
    });
  });

  describe('validateStripeCustomerId', () => {
    it('should pass for valid Stripe customer ID', () => {
      const manifest = {
        stripeCustomerId: 'cus_NffrFeUfNV2Hib',
      };

      const result = validateStripeCustomerId(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for null stripeCustomerId (lazy creation)', () => {
      const manifest = {
        stripeCustomerId: null,
      };

      const result = validateStripeCustomerId(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when stripeCustomerId is undefined', () => {
      const manifest = {
        name: 'Test Org',
      };

      const result = validateStripeCustomerId(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid Stripe customer ID format', () => {
      const manifest = {
        stripeCustomerId: 'invalid_customer_id',
      };

      const result = validateStripeCustomerId(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PATTERN_003');
      expect(result.errors[0].path).toBe('$.stripeCustomerId');
    });

    it('should fail for non-string stripeCustomerId', () => {
      const manifest = {
        stripeCustomerId: 12345,
      };

      const result = validateStripeCustomerId(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TYPE_001');
    });
  });

  describe('validateDeletionSafety', () => {
    it('should pass when org has no Stripe customer and status is DISSOLVED', () => {
      const manifest = {
        status: 'DISSOLVED',
        stripeCustomerId: null,
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when org has Stripe customer and status is SUSPENDED (soft delete)', () => {
      const manifest = {
        status: 'SUSPENDED',
        stripeCustomerId: 'cus_NffrFeUfNV2Hib',
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when org has Stripe customer and status is ACTIVE', () => {
      const manifest = {
        status: 'ACTIVE',
        stripeCustomerId: 'cus_NffrFeUfNV2Hib',
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when org has Stripe customer and status is DISSOLVED', () => {
      const manifest = {
        status: 'DISSOLVED',
        stripeCustomerId: 'cus_NffrFeUfNV2Hib',
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INTEGRITY_001');
      expect(result.errors[0].message).toContain('Cannot dissolve organization');
      expect(result.errors[0].message).toContain('SUSPENDED');
    });

    it('should fail when org has Stripe customer in legal_status section and status is DISSOLVED', () => {
      const manifest = {
        legal_status: {
          status: 'DISSOLVED',
        },
        stripeCustomerId: 'cus_NffrFeUfNV2Hib',
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INTEGRITY_001');
    });

    it('should pass when stripeCustomerId is undefined and status is DISSOLVED', () => {
      const manifest = {
        status: 'DISSOLVED',
      };

      const result = validateDeletionSafety(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
