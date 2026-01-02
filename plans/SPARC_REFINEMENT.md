# SPARC Refinement Phase: Organizational Truth Manifests

## Document Metadata

| Property | Value |
|----------|-------|
| Document Version | 1.0.0 |
| Phase | Refinement |
| Repository | agentics-org-manifests |
| Purpose | Enterprise Auditability and Diligence Review |
| Classification | Immutable Organizational Truth |

---

## 1. Schema Evolution Rules

### 1.1 Semantic Versioning for Schemas

All manifest schemas follow strict semantic versioning: `MAJOR.MINOR.PATCH`

```
MAJOR: Breaking changes that invalidate existing manifests
MINOR: Additive-only changes, backward compatible
PATCH: Bug fixes, documentation updates, no schema changes
```

### 1.2 Additive-Only Changes for Minor Versions

**PERMITTED in Minor Versions:**
- New optional fields with explicit defaults
- New enum values appended to existing enumerations
- New validation rules that accept previously valid data
- Additional metadata fields in reserved namespaces

**PROHIBITED in Minor Versions:**
- Renaming existing fields
- Changing field types
- Removing fields (even optional ones)
- Changing cardinality (single to array or vice versa)
- Modifying enum value semantics

#### Example: Valid Minor Version Change

```yaml
# v1.0.0 Schema
organization:
  id: string (required)
  name: string (required)

# v1.1.0 Schema (VALID additive change)
organization:
  id: string (required)
  name: string (required)
  display_name: string (optional, default: null)  # NEW FIELD
  metadata:  # NEW OPTIONAL SECTION
    created_at: timestamp (optional)
```

#### Example: Invalid Minor Version Change

```yaml
# v1.0.0 Schema
organization:
  id: string (required)

# v1.1.0 Schema (INVALID - would require MAJOR bump)
organization:
  organization_id: string (required)  # RENAMED - BREAKING
```

### 1.3 Breaking Changes Require Major Version Bump

**Breaking changes include:**
- Field removal or renaming
- Type changes (string to integer, etc.)
- Cardinality changes
- Semantic changes to existing fields
- Validation rule tightening
- Required field additions

**Major Version Change Protocol:**

```
1. Announce deprecation in current version (minimum 6 months notice)
2. Provide migration tooling
3. Document all breaking changes in CHANGELOG
4. Maintain parallel support for N-1 major version
5. Update compatibility matrix
6. Notify all registered consumers
```

### 1.4 Deprecation Policy

| Deprecation Type | Minimum Support Window | Notice Period |
|-----------------|------------------------|---------------|
| Field Deprecation | 12 months | 6 months before deprecation |
| Schema Version EOL | 24 months | 12 months before EOL |
| API Endpoint | 18 months | 9 months before removal |
| Validation Rule | 6 months | 3 months before enforcement |

#### Deprecation Manifest Structure

```json
{
  "deprecation_notice": {
    "schema_version": "2.3.0",
    "deprecated_elements": [
      {
        "path": "$.organization.legacy_code",
        "deprecated_in": "2.3.0",
        "removal_version": "3.0.0",
        "removal_date": "2027-01-01T00:00:00Z",
        "migration_path": "$.organization.classification_code",
        "migration_documentation": "https://docs.example.com/migration/legacy-code"
      }
    ],
    "announcement_date": "2025-07-01T00:00:00Z",
    "notification_sent": true,
    "affected_consumers": ["system-a", "system-b", "audit-platform"]
  }
}
```

### 1.5 Migration Path Documentation Requirements

Every breaking change MUST include:

```yaml
migration_documentation:
  change_id: "BREAK-2025-001"
  affected_versions:
    from: "1.x.x"
    to: "2.0.0"

  impact_assessment:
    severity: critical | high | medium | low
    affected_fields: [list of JSON paths]
    estimated_effort: "X hours per 1000 manifests"

  automated_migration:
    available: true
    tool_location: "/tools/migrate-v1-to-v2"
    command: "npx manifest-migrate --from 1 --to 2 --input ./manifests"
    dry_run_supported: true
    rollback_supported: true

  manual_steps:
    - step: 1
      description: "Export current manifests"
      command: "npx manifest-export --version 1"
    - step: 2
      description: "Review transformation report"
      action: "manual_review"

  validation:
    pre_migration_checks:
      - "All manifests pass v1 strict validation"
      - "No orphan references exist"
    post_migration_checks:
      - "All manifests pass v2 strict validation"
      - "Cryptographic hashes regenerated"
      - "Audit trail updated"

  rollback_procedure:
    available: true
    time_limit: "72 hours post-migration"
    command: "npx manifest-rollback --to 1 --snapshot <id>"
```

### 1.6 Schema Version Compatibility Matrix

```
+----------+-------+-------+-------+-------+-------+
| Reader → | v1.0  | v1.1  | v2.0  | v2.1  | v3.0  |
| Writer ↓ |       |       |       |       |       |
+----------+-------+-------+-------+-------+-------+
| v1.0     |  RW   |  R    |  R*   |  R*   |  -    |
| v1.1     |  -    |  RW   |  R*   |  R*   |  -    |
| v2.0     |  -    |  -    |  RW   |  R    |  R*   |
| v2.1     |  -    |  -    |  -    |  RW   |  R*   |
| v3.0     |  -    |  -    |  -    |  -    |  RW   |
+----------+-------+-------+-------+-------+-------+

Legend:
  RW  = Full read/write compatibility
  R   = Read-only compatibility (forward compatible)
  R*  = Read with migration transformation required
  -   = Not compatible, migration required before read
```

---

## 2. Backward Compatibility Guarantees

### 2.1 Immutability Principle

**Core Guarantee:** Once a manifest is created and sealed, its content is immutable and valid indefinitely.

```typescript
interface ImmutabilityGuarantee {
  // Manifests never expire
  manifest_expiration: never;

  // Old schema versions always parseable
  schema_support: "perpetual";

  // Historical queries always possible
  historical_access: "guaranteed";

  // Cryptographic proofs remain verifiable
  proof_validity: "indefinite";
}
```

### 2.2 Old Manifests Remain Valid Indefinitely

**Implementation Requirements:**

1. **Schema Registry Preservation**
   - All historical schema versions stored permanently
   - Schema definitions are themselves immutable manifests
   - Version detection automatic from manifest headers

2. **Validation Engine Support**
   ```typescript
   class ManifestValidator {
     validate(manifest: Manifest): ValidationResult {
       const schemaVersion = this.detectVersion(manifest);
       const schema = this.schemaRegistry.get(schemaVersion);

       // GUARANTEED: Schema always exists for any valid version
       if (!schema) {
         throw new ImpossibleStateError(
           `Schema registry corruption: ${schemaVersion} not found`
         );
       }

       return this.validateAgainstSchema(manifest, schema);
     }
   }
   ```

3. **Storage Format Stability**
   - JSON encoding remains primary format
   - Binary formats include embedded schema version
   - Compression algorithms versioned and preserved

### 2.3 New Schema Versions Must Read Old Data

**Reading Protocol:**

```typescript
interface SchemaReader {
  read(data: RawManifest): ParsedManifest {
    const declaredVersion = data.$schema_version;
    const currentVersion = this.getCurrentVersion();

    if (declaredVersion === currentVersion) {
      return this.parseNative(data);
    }

    if (declaredVersion < currentVersion) {
      // MANDATORY: Transform old data to current representation
      return this.transformFromLegacy(data, declaredVersion);
    }

    // Future version from newer system
    return this.parseWithUnknownFieldHandling(data);
  }

  private transformFromLegacy(
    data: RawManifest,
    sourceVersion: SemanticVersion
  ): ParsedManifest {
    let transformed = data;

    // Apply sequential transformations
    for (const migration of this.getMigrationPath(sourceVersion)) {
      transformed = migration.transform(transformed);
    }

    // Result includes provenance of transformation
    return {
      ...transformed,
      _provenance: {
        original_version: sourceVersion,
        transformed_at: new Date().toISOString(),
        transformation_chain: this.getMigrationPath(sourceVersion).map(m => m.id)
      }
    };
  }
}
```

### 2.4 No Forced Migrations

**Anti-Patterns PROHIBITED:**

```typescript
// PROHIBITED: Forced migration on read
function readManifest(id: string): Manifest {
  const data = storage.get(id);
  if (data.version < CURRENT_VERSION) {
    // WRONG: Mutating stored data
    const migrated = migrate(data);
    storage.put(id, migrated);  // PROHIBITED
    return migrated;
  }
  return data;
}

// CORRECT: Read-time transformation without storage mutation
function readManifest(id: string): ManifestView {
  const data = storage.get(id);
  return {
    original: data,
    view: transformToCurrentView(data),
    version_info: {
      stored_as: data.version,
      viewed_as: CURRENT_VERSION
    }
  };
}
```

**Migration Opt-In Requirements:**

```yaml
migration_policy:
  trigger: manual_only | scheduled_with_approval

  approval_requirements:
    - type: system_owner
      count: 1
    - type: data_steward
      count: 1
    - type: compliance_officer
      count: 1

  execution_window:
    type: maintenance_window
    notification_hours: 48

  audit_requirements:
    pre_migration_snapshot: required
    detailed_logging: required
    rollback_test: required
```

### 2.5 Explicit Compatibility Testing Requirements

**Mandatory Test Suite:**

```typescript
describe('Schema Compatibility', () => {
  const ALL_HISTORICAL_VERSIONS = SchemaRegistry.getAllVersions();

  describe('Forward Compatibility', () => {
    ALL_HISTORICAL_VERSIONS.forEach(version => {
      it(`current reader can parse ${version} manifests`, () => {
        const samples = TestFixtures.getSamplesForVersion(version);
        const reader = new ManifestReader(CURRENT_VERSION);

        samples.forEach(sample => {
          const result = reader.read(sample);
          expect(result.isValid).toBe(true);
          expect(result.dataIntegrity).toBe('complete');
        });
      });
    });
  });

  describe('Roundtrip Preservation', () => {
    it('transforms preserve semantic equivalence', () => {
      const v1Manifest = TestFixtures.getV1Manifest();
      const reader = new ManifestReader(CURRENT_VERSION);

      const viewed = reader.read(v1Manifest);
      const v1View = reader.viewAs(viewed, 'v1.0.0');

      expect(semanticEquals(v1Manifest, v1View)).toBe(true);
    });
  });

  describe('Cryptographic Integrity', () => {
    it('historical proofs remain verifiable', () => {
      ALL_HISTORICAL_VERSIONS.forEach(version => {
        const manifests = TestFixtures.getSignedManifests(version);

        manifests.forEach(manifest => {
          expect(verifyProof(manifest)).toBe(true);
        });
      });
    });
  });
});
```

### 2.6 Version Negotiation Protocols

**Client-Server Negotiation:**

```http
# Request
GET /manifests/org-12345 HTTP/1.1
Accept-Schema-Version: 2.1, 2.0, 1.5
Minimum-Schema-Version: 1.0

# Response (best match)
HTTP/1.1 200 OK
Content-Schema-Version: 2.0
X-Schema-Negotiated: true
X-Available-Versions: 1.0, 1.5, 2.0, 2.1

{
  "$schema_version": "2.0.0",
  "data": { ... }
}
```

**Version Negotiation Algorithm:**

```typescript
function negotiateVersion(
  clientAccepts: SemanticVersion[],
  clientMinimum: SemanticVersion,
  serverSupports: SemanticVersion[],
  manifestStoredAs: SemanticVersion
): NegotiationResult {
  // Find best common version
  const commonVersions = intersect(clientAccepts, serverSupports)
    .filter(v => v >= clientMinimum)
    .sort(descending);

  if (commonVersions.length === 0) {
    return {
      success: false,
      error: 'NO_COMMON_VERSION',
      clientAccepts,
      serverSupports
    };
  }

  const selectedVersion = commonVersions[0];

  return {
    success: true,
    version: selectedVersion,
    requiresTransformation: selectedVersion !== manifestStoredAs,
    transformationPath: getTransformationPath(manifestStoredAs, selectedVersion)
  };
}
```

---

## 3. Validation Strictness Levels

### 3.1 STRICT Mode

**Definition:** Maximum validation rigor for production manifests.

```typescript
interface StrictValidation {
  mode: 'STRICT';

  rules: {
    // All schema-defined fields must be present
    required_fields: 'all_must_exist';

    // No fields outside schema definition allowed
    unknown_fields: 'reject';

    // All references must resolve
    reference_integrity: 'mandatory';

    // All constraints enforced
    constraint_validation: 'full';

    // Format validation (dates, emails, etc.)
    format_validation: 'strict';

    // Enumeration values must match exactly
    enum_validation: 'exact_match';

    // Numeric ranges enforced
    range_validation: 'enforced';
  };

  on_violation: 'reject_manifest';
}
```

**STRICT Mode Example:**

```json
{
  "mode": "STRICT",
  "manifest": {
    "organization_id": "ORG-2025-001",
    "legal_name": "Acme Corporation",
    "jurisdiction": "US-DE",
    "formation_date": "2020-03-15",
    "status": "ACTIVE"
  },
  "validation_result": {
    "valid": true,
    "warnings": [],
    "errors": []
  }
}

// STRICT rejection example
{
  "mode": "STRICT",
  "manifest": {
    "organization_id": "ORG-2025-001",
    "legal_name": "Acme Corporation",
    "unknown_field": "some value"  // NOT IN SCHEMA
  },
  "validation_result": {
    "valid": false,
    "errors": [
      {
        "code": "UNKNOWN_FIELD",
        "path": "$.unknown_field",
        "message": "Field 'unknown_field' is not defined in schema v2.0.0",
        "severity": "error"
      }
    ]
  }
}
```

### 3.2 STANDARD Mode

**Definition:** Balanced validation for operational use.

```typescript
interface StandardValidation {
  mode: 'STANDARD';

  rules: {
    // Required fields must exist
    required_fields: 'must_exist';

    // Unknown fields trigger warnings but don't reject
    unknown_fields: 'warn';

    // References checked, broken refs are warnings
    reference_integrity: 'warn_on_missing';

    // Core constraints enforced
    constraint_validation: 'core_only';

    // Format validation with some flexibility
    format_validation: 'lenient';

    // Enum validation with unknown value handling
    enum_validation: 'warn_unknown';
  };

  on_violation: 'accept_with_warnings';
}
```

**STANDARD Mode Example:**

```json
{
  "mode": "STANDARD",
  "manifest": {
    "organization_id": "ORG-2025-001",
    "legal_name": "Acme Corporation",
    "future_field": "from newer version"
  },
  "validation_result": {
    "valid": true,
    "warnings": [
      {
        "code": "UNKNOWN_FIELD",
        "path": "$.future_field",
        "message": "Field 'future_field' is not recognized in schema v2.0.0",
        "severity": "warning"
      }
    ],
    "errors": []
  }
}
```

### 3.3 PERMISSIVE Mode

**Definition:** Minimal validation for migration purposes only.

```typescript
interface PermissiveValidation {
  mode: 'PERMISSIVE';

  // RESTRICTED USAGE
  allowed_contexts: ['migration', 'data_recovery', 'legacy_import'];
  requires_approval: true;
  audit_logging: 'mandatory';

  rules: {
    // Only basic structure validated
    required_fields: 'skip';

    // Unknown fields allowed
    unknown_fields: 'allow';

    // References not validated
    reference_integrity: 'skip';

    // Only JSON structure validated
    constraint_validation: 'structure_only';

    // Minimal format checking
    format_validation: 'minimal';
  };

  on_violation: 'log_only';

  // Auto-escalation
  post_import_requirement: 'must_pass_standard_within_24h';
}
```

**PERMISSIVE Mode Example (Migration):**

```json
{
  "mode": "PERMISSIVE",
  "context": {
    "reason": "legacy_system_import",
    "approved_by": "data-steward-001",
    "approval_timestamp": "2025-01-02T10:00:00Z",
    "expiration": "2025-01-03T10:00:00Z"
  },
  "manifest": {
    "id": "LEGACY-001",
    "name": "Old Format Corp",
    "weird_legacy_field": true,
    "another_legacy_thing": [1, 2, 3]
  },
  "validation_result": {
    "valid": true,
    "mode_warnings": [
      "PERMISSIVE mode active - manifest must pass STANDARD validation within 24 hours"
    ],
    "skipped_checks": [
      "required_field_validation",
      "unknown_field_rejection",
      "reference_integrity"
    ]
  }
}
```

### 3.4 Default Mode for Production Manifests

```typescript
const VALIDATION_DEFAULTS = {
  // Production environments ALWAYS use STRICT
  production: 'STRICT',

  // Staging uses STANDARD
  staging: 'STANDARD',

  // Development allows STANDARD
  development: 'STANDARD',

  // Migration contexts can use PERMISSIVE
  migration: 'PERMISSIVE',

  // PERMISSIVE never allowed in production writes
  production_write_floor: 'STRICT'
};

function getValidationMode(
  context: ExecutionContext
): ValidationMode {
  if (context.isProduction && context.isWrite) {
    return 'STRICT';  // NON-NEGOTIABLE
  }

  return VALIDATION_DEFAULTS[context.environment];
}
```

### 3.5 Validation Mode Escalation

```
PERMISSIVE → STANDARD → STRICT

Escalation Rules:
1. PERMISSIVE manifests must pass STANDARD within 24 hours
2. STANDARD manifests must pass STRICT before audit snapshot
3. Production writes ALWAYS require STRICT
4. Compliance reports require STRICT validation pass
```

---

## 4. Forbidden Ambiguity Handling

### 4.1 Natural Language Fields: PROHIBITED

**Rule:** No free-text fields that affect manifest semantics.

```typescript
// PROHIBITED: Natural language affecting interpretation
interface ProhibitedSchema {
  organization_description: string;  // NO: Ambiguous
  notes: string;                      // NO: Unstructured
  comments: string;                   // NO: Natural language
  reason: string;                     // NO: Requires interpretation
}

// PERMITTED: Structured alternatives
interface PermittedSchema {
  // Constrained to enumeration
  organization_type: 'CORPORATION' | 'LLC' | 'PARTNERSHIP' | 'NONPROFIT';

  // Metadata with structured typing
  metadata: {
    display_name: string;        // Display only, no semantic meaning
    locale: 'en-US' | 'en-GB';   // Constrained
  };

  // Structured reason codes
  status_reason: {
    code: 'VOLUNTARY_DISSOLUTION' | 'MERGER' | 'REGULATORY_ACTION';
    effective_date: ISO8601DateTime;
    reference_document_id: string;
  };
}
```

**Exception: Display-Only Annotations**

```typescript
// Permitted display-only natural language
interface DisplayAnnotations {
  // Marked as non-semantic
  _display: {
    friendly_name: string;      // For UI only
    description: string;        // For UI only
    // CRITICAL: _display fields NEVER affect validation or logic
  };

  // Actual data uses structured fields
  legal_name: string;           // Formal name, validated
  classification: ClassificationCode;
}
```

### 4.2 Inferred Values: PROHIBITED

**Rule:** All values must be explicitly stated; no derivation from context.

```typescript
// PROHIBITED: Value inference
interface ProhibitedInference {
  // NO: Inferring from other fields
  country: undefined;  // Inferred from address

  // NO: Inferring from context
  created_by: undefined;  // Inferred from API caller

  // NO: Default inference
  status: undefined;  // Defaults to "ACTIVE"
}

// MANDATORY: Explicit values
interface RequiredExplicit {
  // Explicit country field
  country: ISO3166Alpha2;

  // Explicit actor identification
  created_by: {
    actor_type: 'USER' | 'SYSTEM' | 'INTEGRATION';
    actor_id: string;
    actor_name: string;
  };

  // Explicit status
  status: OrganizationStatus;
}
```

### 4.3 Placeholder Markers: PROHIBITED

**Prohibited Patterns:**

```json
// ALL OF THESE ARE REJECTED

{
  "legal_name": "TBD",
  "jurisdiction": "TODO",
  "formation_date": "PENDING",
  "tax_id": "N/A",
  "status": "UNKNOWN",
  "officers": "TO_BE_COMPLETED",
  "address": null,
  "subsidiaries": []  // Empty when required
}
```

**Validation Rules:**

```typescript
const PROHIBITED_PLACEHOLDER_PATTERNS = [
  /^TBD$/i,
  /^TODO$/i,
  /^PENDING$/i,
  /^N\/?A$/i,
  /^UNKNOWN$/i,
  /^TO.?BE.?(COMPLETED|DETERMINED|ADDED)$/i,
  /^PLACEHOLDER$/i,
  /^\?+$/,
  /^X+$/,
  /^-+$/,
  /^\.\.\.$/,
  /^DRAFT$/i,
  /^TEMP(ORARY)?$/i,
];

function validateNoPlaceholders(value: string, path: string): ValidationError[] {
  for (const pattern of PROHIBITED_PLACEHOLDER_PATTERNS) {
    if (pattern.test(value.trim())) {
      return [{
        code: 'PLACEHOLDER_PROHIBITED',
        path,
        value,
        message: `Placeholder value "${value}" is not permitted. All fields must contain actual data.`
      }];
    }
  }
  return [];
}
```

### 4.4 Optional Fields with Defaults: EXPLICIT ONLY

**Rule:** Default values must be explicitly declared in schema and manifest.

```typescript
// Schema definition with explicit defaults
interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;

  // If optional, default MUST be specified
  default?: {
    value: unknown;
    explicit_in_manifest: boolean;  // Must be true for production
  };
}

// CORRECT: Explicit default in manifest
{
  "$schema_version": "2.0.0",
  "organization": {
    "id": "ORG-001",
    "name": "Acme Corp",
    "preferred_currency": "USD",  // Explicit, even if matches default
    "_defaults_applied": []       // Empty = all values explicit
  }
}

// REJECTED: Implicit default application
{
  "$schema_version": "2.0.0",
  "organization": {
    "id": "ORG-001",
    "name": "Acme Corp"
    // preferred_currency omitted, would default to USD
    // THIS IS REJECTED - must be explicit
  }
}
```

### 4.5 Null vs Absent Distinction: REQUIRED

**Semantic Difference:**

```typescript
// null = Explicitly no value (known to be absent)
// absent = Field not provided (state unknown)

interface NullVsAbsent {
  // null: "We know there is no middle name"
  middle_name: null;

  // absent: "We don't know if there's a middle name"
  // (Field simply not in object)
}

// Validation enforces distinction
function validateNullability(
  field: SchemaField,
  value: unknown,
  isPresent: boolean
): ValidationResult {
  if (field.required && !isPresent) {
    return error('REQUIRED_FIELD_MISSING');
  }

  if (field.nullable === false && value === null) {
    return error('NULL_NOT_PERMITTED');
  }

  if (field.nullable === true && value === null) {
    return valid();  // Explicit null is OK
  }

  if (!isPresent && field.allow_absent === false) {
    return error('FIELD_MUST_BE_PRESENT');
  }

  return valid();
}
```

**Schema Definition:**

```yaml
fields:
  - name: tax_id
    type: string
    required: true
    nullable: false
    allow_absent: false
    # MUST be present, MUST have non-null value

  - name: dissolution_date
    type: datetime
    required: false
    nullable: true
    allow_absent: true
    # Optional, can be null (no dissolution), can be absent (not yet evaluated)

  - name: formation_date
    type: datetime
    required: true
    nullable: false
    allow_absent: false
    # Every organization MUST have a formation date
```

---

## 5. Guardrails Against Invalid Data

### 5.1 No Partial Organizational Data Allowed

**Completeness Requirements:**

```typescript
interface CompletenessValidator {
  validateCompleteness(manifest: OrganizationManifest): CompletionResult {
    const required_sections = [
      'identification',
      'legal_status',
      'jurisdiction',
      'formation',
      'governance',
      'registered_agent',
      'principal_address'
    ];

    const missing = required_sections.filter(
      section => !this.isSectionComplete(manifest, section)
    );

    if (missing.length > 0) {
      return {
        complete: false,
        error: 'PARTIAL_DATA_PROHIBITED',
        missing_sections: missing,
        message: 'Organizational manifests must be complete. Partial data is not permitted.'
      };
    }

    return { complete: true };
  }
}
```

**Minimum Viable Manifest:**

```json
{
  "$schema_version": "2.0.0",
  "$manifest_type": "organization",

  "identification": {
    "manifest_id": "MAN-2025-001-ORG",
    "organization_id": "ORG-2025-001",
    "legal_name": "Acme Corporation"
  },

  "legal_status": {
    "entity_type": "CORPORATION",
    "status": "ACTIVE",
    "status_effective_date": "2020-03-15T00:00:00Z"
  },

  "jurisdiction": {
    "formation_jurisdiction": "US-DE",
    "governing_law": "US-DE"
  },

  "formation": {
    "formation_date": "2020-03-15",
    "formation_document_id": "DOC-2020-DE-12345"
  },

  "governance": {
    "governance_type": "BOARD_MANAGED",
    "fiscal_year_end": "--12-31"
  },

  "registered_agent": {
    "agent_type": "REGISTERED_SERVICE",
    "agent_name": "Corporation Service Company",
    "agent_address": {
      "street": "251 Little Falls Drive",
      "city": "Wilmington",
      "state": "DE",
      "postal_code": "19808",
      "country": "US"
    }
  },

  "principal_address": {
    "street": "100 Main Street",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  }
}
```

### 5.2 No Speculative Future State

**Prohibited Patterns:**

```json
// REJECTED: Future projections
{
  "organization_id": "ORG-001",
  "current_employees": 50,
  "projected_employees_2026": 75,      // PROHIBITED
  "anticipated_revenue": 1000000,       // PROHIBITED
  "planned_acquisitions": ["CompanyX"], // PROHIBITED
  "expected_status": "PUBLIC"           // PROHIBITED
}

// REJECTED: Conditional states
{
  "merger_pending": true,               // PROHIBITED: use actual status
  "if_approved": { ... },               // PROHIBITED: conditional data
  "proposed_name": "New Corp Name"      // PROHIBITED: speculative
}
```

**Valid Temporal Handling:**

```json
// CORRECT: Historical and current states only
{
  "organization_id": "ORG-001",
  "status_history": [
    {
      "status": "ACTIVE",
      "effective_from": "2020-03-15T00:00:00Z",
      "effective_to": null,
      "is_current": true
    }
  ],
  "pending_actions": {
    "type": "NAME_CHANGE_FILING",
    "filed_date": "2025-01-02T00:00:00Z",
    "filing_reference": "DE-2025-NC-12345",
    "status": "FILED",
    // Note: No "expected_outcome" or "projected_date"
  }
}
```

### 5.3 No "To Be Determined" Placeholders

**Validation Rule Set:**

```typescript
const TBD_DETECTION_RULES: ValidationRule[] = [
  {
    id: 'NO_TBD_TEXT',
    check: (value: string) => !/(TBD|TBA|TBC)/i.test(value),
    message: 'Values containing TBD/TBA/TBC are not permitted'
  },
  {
    id: 'NO_PENDING_MARKERS',
    check: (value: string) => !/(pending|awaiting|expected)/i.test(value),
    message: 'Pending/awaiting markers indicate incomplete data'
  },
  {
    id: 'NO_EMPTY_REQUIRED',
    check: (value: unknown, schema: SchemaField) => {
      if (schema.required && (value === '' || value === null)) {
        return false;
      }
      return true;
    },
    message: 'Required fields cannot be empty'
  },
  {
    id: 'NO_PLACEHOLDER_DATES',
    check: (value: string, schema: SchemaField) => {
      if (schema.type === 'datetime') {
        const placeholder_dates = [
          '1970-01-01', '1900-01-01', '0001-01-01',
          '9999-12-31', '2099-12-31'
        ];
        return !placeholder_dates.some(p => value.startsWith(p));
      }
      return true;
    },
    message: 'Placeholder dates are not permitted'
  }
];
```

### 5.4 All References Must Resolve or Error

**Reference Integrity Enforcement:**

```typescript
interface ReferenceValidator {
  validateReferences(manifest: Manifest): ReferenceValidationResult {
    const references = this.extractReferences(manifest);
    const results: ReferenceCheck[] = [];

    for (const ref of references) {
      const resolved = this.resolveReference(ref);

      if (!resolved.exists) {
        results.push({
          reference: ref,
          status: 'UNRESOLVED',
          error: {
            code: 'REFERENCE_NOT_FOUND',
            message: `Referenced entity ${ref.target_type}:${ref.target_id} does not exist`,
            path: ref.source_path
          }
        });
      } else if (resolved.is_deleted) {
        results.push({
          reference: ref,
          status: 'DELETED_TARGET',
          error: {
            code: 'REFERENCE_TO_DELETED',
            message: `Referenced entity ${ref.target_id} has been deleted`,
            deleted_at: resolved.deleted_at
          }
        });
      } else {
        results.push({
          reference: ref,
          status: 'RESOLVED',
          target: resolved.entity
        });
      }
    }

    const unresolved = results.filter(r => r.status !== 'RESOLVED');

    return {
      valid: unresolved.length === 0,
      total_references: references.length,
      resolved: results.filter(r => r.status === 'RESOLVED').length,
      unresolved: unresolved.length,
      errors: unresolved.map(r => r.error)
    };
  }
}
```

**Reference Types:**

```yaml
reference_types:
  - type: organization_reference
    format: "org::{organization_id}"
    target: organization_manifest
    required_state: [ACTIVE, INACTIVE]

  - type: document_reference
    format: "doc::{document_id}"
    target: document_registry
    required_state: [FILED, CERTIFIED]

  - type: person_reference
    format: "person::{person_id}"
    target: person_registry
    required_state: [VERIFIED]

  - type: address_reference
    format: "addr::{address_id}"
    target: address_registry
    required_state: [VALIDATED]
```

### 5.5 Orphan Detection and Rejection

**Orphan Definition:**

```typescript
type OrphanType =
  | 'UNREFERENCED_SUBSIDIARY'    // Subsidiary with no parent
  | 'DANGLING_OFFICER'           // Officer role with no organization
  | 'FLOATING_DOCUMENT'          // Document not linked to entity
  | 'DISCONNECTED_ADDRESS'       // Address not used by any entity
  | 'HEADLESS_HIERARCHY'         // Child nodes with deleted parent
  ;

interface OrphanDetector {
  detectOrphans(manifest: Manifest): OrphanReport {
    const orphans: Orphan[] = [];

    // Check subsidiary relationships
    for (const subsidiary of manifest.subsidiaries || []) {
      if (!this.parentExists(subsidiary.parent_id)) {
        orphans.push({
          type: 'UNREFERENCED_SUBSIDIARY',
          entity_id: subsidiary.id,
          missing_parent: subsidiary.parent_id
        });
      }
    }

    // Check officer assignments
    for (const officer of manifest.officers || []) {
      if (!this.organizationExists(officer.organization_id)) {
        orphans.push({
          type: 'DANGLING_OFFICER',
          entity_id: officer.id,
          missing_organization: officer.organization_id
        });
      }
    }

    // ... additional orphan checks

    return {
      has_orphans: orphans.length > 0,
      orphans,
      recommendation: orphans.length > 0
        ? 'REJECT_MANIFEST'
        : 'ACCEPT'
    };
  }
}
```

**Cascade Rules:**

```yaml
cascade_rules:
  on_parent_deletion:
    action: PREVENT
    message: "Cannot delete organization with active subsidiaries"

  on_officer_removal:
    action: REQUIRE_REPLACEMENT
    message: "Must designate replacement before removing officer"

  on_address_change:
    action: UPDATE_REFERENCES
    audit: true
    message: "All references will be updated to new address"
```

---

## 6. Enterprise Auditability Requirements

### 6.1 Complete Change History for Every Field

**Field-Level Audit Trail:**

```typescript
interface FieldAuditEntry {
  field_path: string;           // JSON path: $.organization.legal_name
  previous_value: unknown;      // Value before change
  new_value: unknown;           // Value after change
  changed_at: ISO8601DateTime;  // Timestamp of change
  changed_by: ActorIdentifier;  // Who made the change
  change_type: ChangeType;      // CREATE | UPDATE | DELETE
  change_reason: ChangeReason;  // Structured reason code
  authorization: Authorization; // Approval chain
  source_system: SystemId;      // Originating system
  correlation_id: UUID;         // Request correlation
}

interface ManifestAuditLog {
  manifest_id: string;
  manifest_version: number;

  // Every field change recorded
  field_history: Map<string, FieldAuditEntry[]>;

  // Aggregate operations
  operations: AuditOperation[];

  // Proof chain
  merkle_root: string;
  proof_chain: ProofLink[];
}
```

**Audit Entry Example:**

```json
{
  "manifest_id": "MAN-2025-001-ORG",
  "field_audit": {
    "$.organization.legal_name": [
      {
        "version": 1,
        "previous_value": null,
        "new_value": "Acme Corporation",
        "changed_at": "2020-03-15T10:00:00Z",
        "changed_by": {
          "actor_type": "USER",
          "actor_id": "user-12345",
          "actor_name": "Jane Smith"
        },
        "change_type": "CREATE",
        "change_reason": {
          "code": "INITIAL_REGISTRATION",
          "reference": "FILING-2020-001"
        },
        "authorization": {
          "approved_by": ["user-99999"],
          "approval_timestamp": "2020-03-15T09:55:00Z"
        }
      },
      {
        "version": 2,
        "previous_value": "Acme Corporation",
        "new_value": "Acme Holdings Corporation",
        "changed_at": "2023-06-01T14:30:00Z",
        "changed_by": {
          "actor_type": "USER",
          "actor_id": "user-12345",
          "actor_name": "Jane Smith"
        },
        "change_type": "UPDATE",
        "change_reason": {
          "code": "NAME_CHANGE_FILING",
          "reference": "DE-2023-NC-98765",
          "effective_date": "2023-06-01"
        },
        "authorization": {
          "approved_by": ["user-99999", "compliance-001"],
          "approval_timestamp": "2023-05-28T11:00:00Z"
        }
      }
    ]
  }
}
```

### 6.2 Cryptographic Proof of Lineage

**Merkle Tree Structure:**

```
                    Root Hash
                   /         \
            Hash(A+B)        Hash(C+D)
           /       \        /       \
       Hash(A)  Hash(B)  Hash(C)  Hash(D)
          |        |        |        |
       Field A  Field B  Field C  Field D
```

**Implementation:**

```typescript
interface CryptographicProof {
  manifest_id: string;
  version: number;
  timestamp: ISO8601DateTime;

  // Content integrity
  content_hash: {
    algorithm: 'SHA-256';
    value: string;
  };

  // Merkle proof for field-level verification
  merkle_root: string;
  field_proofs: Map<string, MerkleProof>;

  // Chain to previous version
  previous_version_hash: string | null;
  chain_proof: {
    algorithm: 'SHA-256';
    value: string;  // Hash of current + previous
  };

  // Digital signature
  signature: {
    algorithm: 'Ed25519';
    public_key: string;
    signature: string;
    signed_at: ISO8601DateTime;
    signer_identity: string;
  };
}

function verifyLineage(manifest: Manifest, proofs: CryptographicProof[]): boolean {
  // Sort proofs by version
  const sorted = proofs.sort((a, b) => a.version - b.version);

  for (let i = 0; i < sorted.length; i++) {
    const proof = sorted[i];

    // Verify content hash
    const computedHash = sha256(canonicalize(manifest.versions[proof.version]));
    if (computedHash !== proof.content_hash.value) {
      return false;
    }

    // Verify chain to previous
    if (i > 0) {
      const expectedPrevHash = sorted[i - 1].content_hash.value;
      if (proof.previous_version_hash !== expectedPrevHash) {
        return false;
      }
    }

    // Verify signature
    if (!verifySignature(proof)) {
      return false;
    }
  }

  return true;
}
```

### 6.3 Tamper-Evident Storage

**Storage Architecture:**

```typescript
interface TamperEvidentStorage {
  // Write-once, read-many
  immutable: true;

  // Append-only log
  operations: 'APPEND_ONLY';

  // Deletion handling
  deletion_mode: 'SOFT_DELETE_WITH_TOMBSTONE';

  // Integrity verification
  verification: {
    on_read: true;
    on_write: true;
    periodic_audit: '24h';
  };

  // Replication
  replication: {
    mode: 'SYNCHRONOUS';
    factor: 3;
    geographic_distribution: true;
  };
}

interface StorageEntry {
  id: string;
  payload: Manifest;

  // Integrity markers
  checksum: string;
  written_at: ISO8601DateTime;
  write_sequence: number;

  // Storage metadata
  storage_location: {
    primary: StorageNode;
    replicas: StorageNode[];
  };

  // Tamper detection
  seal: {
    sealed_at: ISO8601DateTime;
    sealed_by: SystemId;
    seal_hash: string;
    witness_signatures: WitnessSignature[];
  };
}
```

**Tamper Detection:**

```typescript
async function detectTampering(
  manifestId: string
): Promise<TamperReport> {
  const storedEntry = await storage.get(manifestId);
  const auditLog = await audit.getLog(manifestId);
  const proofChain = await proofs.getChain(manifestId);

  const checks: TamperCheck[] = [
    // Verify content hash matches stored
    {
      check: 'CONTENT_HASH',
      expected: storedEntry.checksum,
      actual: computeHash(storedEntry.payload),
      match: null  // Filled below
    },

    // Verify audit log consistency
    {
      check: 'AUDIT_CONSISTENCY',
      expected: auditLog.merkle_root,
      actual: computeAuditRoot(auditLog.entries),
      match: null
    },

    // Verify proof chain
    {
      check: 'PROOF_CHAIN',
      expected: proofChain.root,
      actual: computeChainRoot(proofChain.proofs),
      match: null
    }
  ];

  // Execute checks
  for (const check of checks) {
    check.match = check.expected === check.actual;
  }

  const tampered = checks.some(c => !c.match);

  return {
    manifest_id: manifestId,
    tampered,
    checks,
    recommendation: tampered ? 'QUARANTINE_AND_INVESTIGATE' : 'VERIFIED'
  };
}
```

### 6.4 Point-in-Time Reconstruction Capability

**Temporal Query API:**

```typescript
interface TemporalQuery {
  // Get manifest as of specific time
  getAsOf(manifestId: string, timestamp: ISO8601DateTime): Manifest;

  // Get all versions
  getVersionHistory(manifestId: string): ManifestVersion[];

  // Get state at specific version
  getAtVersion(manifestId: string, version: number): Manifest;

  // Reconstruct from audit log
  reconstructFromAudit(
    manifestId: string,
    targetTimestamp: ISO8601DateTime
  ): ReconstructedManifest;

  // Diff between points in time
  diff(
    manifestId: string,
    from: ISO8601DateTime,
    to: ISO8601DateTime
  ): ManifestDiff;
}
```

**Reconstruction Example:**

```typescript
async function reconstructAtTimestamp(
  manifestId: string,
  targetTimestamp: Date
): Promise<Manifest> {
  // Get initial creation state
  const initialVersion = await storage.getVersion(manifestId, 1);
  let reconstructed = deepClone(initialVersion);

  // Get all audit entries up to target time
  const auditEntries = await audit.getEntriesUntil(
    manifestId,
    targetTimestamp
  );

  // Apply changes in order
  for (const entry of auditEntries) {
    if (new Date(entry.changed_at) <= targetTimestamp) {
      reconstructed = applyAuditEntry(reconstructed, entry);
    }
  }

  // Verify reconstruction
  const verification = await verifyReconstruction(
    manifestId,
    targetTimestamp,
    reconstructed
  );

  if (!verification.valid) {
    throw new ReconstructionError(
      `Cannot verify reconstruction: ${verification.errors}`
    );
  }

  return {
    ...reconstructed,
    _reconstruction_metadata: {
      reconstructed_at: new Date().toISOString(),
      target_timestamp: targetTimestamp.toISOString(),
      entries_applied: auditEntries.length,
      verification_status: 'VERIFIED'
    }
  };
}
```

### 6.5 Compliance Attestation Hooks

**Attestation Framework:**

```typescript
interface ComplianceAttestation {
  manifest_id: string;
  attestation_id: string;

  // What is being attested
  scope: {
    manifest_version: number;
    fields: string[] | 'ALL';
    timestamp: ISO8601DateTime;
  };

  // Attestation details
  attestation: {
    type: AttestationType;
    statement: string;
    evidence_refs: string[];
    attestor: {
      identity: string;
      role: string;
      organization: string;
    };
    attested_at: ISO8601DateTime;
  };

  // Compliance frameworks
  frameworks: ComplianceFramework[];

  // Digital signature
  signature: DigitalSignature;
}

type AttestationType =
  | 'DATA_ACCURACY'
  | 'COMPLETENESS'
  | 'AUTHORIZATION'
  | 'REGULATORY_COMPLIANCE'
  | 'INTERNAL_CONTROL'
  | 'THIRD_PARTY_VERIFICATION'
  ;

interface ComplianceFramework {
  name: string;
  version: string;
  requirements_met: string[];
  controls_evidenced: string[];
}
```

**Attestation Hook Integration:**

```typescript
const attestationHooks = {
  // Hook: Before manifest creation
  beforeCreate: async (manifest: Manifest): Promise<void> => {
    // Verify required attestations exist
    const requiredAttestations = getRequiredAttestations(manifest.type);

    for (const required of requiredAttestations) {
      if (!manifest.attestations?.includes(required)) {
        throw new MissingAttestationError(required);
      }
    }
  },

  // Hook: After significant change
  afterUpdate: async (
    manifest: Manifest,
    changes: Change[]
  ): Promise<void> => {
    // Check if change requires re-attestation
    const significantChanges = changes.filter(
      c => SIGNIFICANT_FIELDS.includes(c.field)
    );

    if (significantChanges.length > 0) {
      await notifyAttestors(manifest, significantChanges);
      await markAttestationsStale(manifest.id, significantChanges);
    }
  },

  // Hook: Periodic compliance check
  scheduledAudit: async (manifestId: string): Promise<AuditResult> => {
    const manifest = await storage.get(manifestId);
    const attestations = await getAttestations(manifestId);

    return {
      manifest_id: manifestId,
      attestation_status: validateAttestations(attestations),
      compliance_gaps: findComplianceGaps(manifest, attestations),
      next_audit_due: calculateNextAudit(attestations)
    };
  }
};
```

---

## 7. Diligence Review Support

### 7.1 Machine-Readable Audit Trails

**Structured Audit Format:**

```json
{
  "$schema": "https://schemas.agentics.org/audit-trail/v1.0.0",
  "audit_trail_id": "AUDIT-2025-001",
  "manifest_id": "MAN-2025-001-ORG",

  "summary": {
    "created_at": "2020-03-15T10:00:00Z",
    "last_modified": "2025-01-02T14:30:00Z",
    "total_versions": 5,
    "total_changes": 23,
    "unique_actors": 4
  },

  "entries": [
    {
      "sequence": 1,
      "timestamp": "2020-03-15T10:00:00Z",
      "operation": "CREATE",
      "actor": {
        "type": "USER",
        "id": "user-12345",
        "name": "Jane Smith",
        "role": "ADMINISTRATOR"
      },
      "changes": [
        {
          "path": "$.organization.legal_name",
          "operation": "SET",
          "value": "Acme Corporation"
        }
      ],
      "authorization": {
        "mechanism": "ROLE_BASED",
        "permissions_used": ["ORG_CREATE"],
        "approval_chain": []
      },
      "context": {
        "source_system": "ADMIN_PORTAL",
        "correlation_id": "req-abc123",
        "ip_address_hash": "sha256:...",
        "session_id_hash": "sha256:..."
      },
      "integrity": {
        "entry_hash": "sha256:...",
        "cumulative_hash": "sha256:..."
      }
    }
  ],

  "verification": {
    "merkle_root": "sha256:...",
    "chain_valid": true,
    "last_verified": "2025-01-02T15:00:00Z"
  }
}
```

### 7.2 Human-Readable Change Summaries

**Summary Generation:**

```typescript
interface ChangesSummary {
  generateHumanReadable(
    manifestId: string,
    options: SummaryOptions
  ): HumanReadableSummary;
}

interface HumanReadableSummary {
  manifest_id: string;
  organization_name: string;

  executive_summary: string;

  timeline: TimelineEvent[];

  key_changes: {
    category: string;
    description: string;
    date: string;
    significance: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];

  actors_involved: {
    name: string;
    role: string;
    change_count: number;
  }[];

  compliance_notes: string[];

  generated_at: string;
  generated_by: string;
}
```

**Example Human-Readable Summary:**

```markdown
# Organization Change Summary

**Organization:** Acme Holdings Corporation (formerly Acme Corporation)
**Period:** March 15, 2020 - January 2, 2025
**Total Changes:** 23 across 5 versions

## Executive Summary

Acme Corporation was formed in Delaware on March 15, 2020. The organization
underwent a name change to Acme Holdings Corporation on June 1, 2023,
reflecting its expanded scope as a holding company. Key governance changes
include the appointment of two new board members and the establishment of
an Audit Committee.

## Timeline of Significant Events

| Date | Event | Actor | Significance |
|------|-------|-------|--------------|
| 2020-03-15 | Organization formed | Jane Smith | HIGH |
| 2020-03-15 | Initial officers appointed | Jane Smith | HIGH |
| 2021-08-01 | Registered agent changed | John Doe | MEDIUM |
| 2023-06-01 | Name changed to Acme Holdings Corporation | Jane Smith | HIGH |
| 2024-01-15 | New board member appointed | Board Resolution | MEDIUM |

## Key Changes by Category

### Legal Status
- Organization formed as Corporation under Delaware law
- Remains in good standing with all filing obligations met

### Governance
- 3 board member additions since formation
- Audit Committee established (2024)
- Compensation Committee established (2024)

### Officers
- 8 officer changes recorded
- Current officer count: 5

## Actors Involved

| Name | Role | Changes Made |
|------|------|--------------|
| Jane Smith | Administrator | 12 |
| John Doe | Compliance Officer | 6 |
| System (Automated) | System | 3 |
| External Auditor | Third Party | 2 |

## Compliance Notes

- All changes properly authorized per governance documents
- No compliance violations recorded
- Annual attestations current through 2024
```

### 7.3 Diff Generation Between Versions

**Diff Engine:**

```typescript
interface ManifestDiff {
  from_version: number;
  to_version: number;
  from_timestamp: ISO8601DateTime;
  to_timestamp: ISO8601DateTime;

  summary: {
    fields_added: number;
    fields_removed: number;
    fields_modified: number;
    sections_affected: string[];
  };

  changes: FieldChange[];

  semantic_changes: SemanticChange[];
}

interface FieldChange {
  path: string;
  change_type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  previous_value: unknown;
  new_value: unknown;

  // For display
  field_label: string;
  human_readable: string;
}

interface SemanticChange {
  category: string;
  description: string;
  impact: string;
  related_fields: string[];
}
```

**Diff Example:**

```json
{
  "diff_id": "DIFF-2025-001",
  "manifest_id": "MAN-2025-001-ORG",
  "from_version": 3,
  "to_version": 4,
  "from_timestamp": "2023-05-31T23:59:59Z",
  "to_timestamp": "2023-06-01T14:30:00Z",

  "summary": {
    "fields_added": 2,
    "fields_removed": 0,
    "fields_modified": 3,
    "sections_affected": ["identification", "legal_status"]
  },

  "changes": [
    {
      "path": "$.identification.legal_name",
      "change_type": "MODIFIED",
      "previous_value": "Acme Corporation",
      "new_value": "Acme Holdings Corporation",
      "field_label": "Legal Name",
      "human_readable": "Legal name changed from 'Acme Corporation' to 'Acme Holdings Corporation'"
    },
    {
      "path": "$.identification.previous_names",
      "change_type": "ADDED",
      "previous_value": null,
      "new_value": [{"name": "Acme Corporation", "effective_until": "2023-06-01"}],
      "field_label": "Previous Names",
      "human_readable": "Added historical name record for 'Acme Corporation'"
    },
    {
      "path": "$.legal_status.name_change_filings",
      "change_type": "ADDED",
      "previous_value": null,
      "new_value": [{"filing_id": "DE-2023-NC-98765", "filed_date": "2023-05-15", "effective_date": "2023-06-01"}],
      "field_label": "Name Change Filings",
      "human_readable": "Recorded name change filing with Delaware Secretary of State"
    }
  ],

  "semantic_changes": [
    {
      "category": "Corporate Identity",
      "description": "Organization underwent formal name change reflecting transition to holding company structure",
      "impact": "All legal documents, contracts, and filings should reference new name after effective date",
      "related_fields": [
        "$.identification.legal_name",
        "$.identification.previous_names",
        "$.legal_status.name_change_filings"
      ]
    }
  ]
}
```

### 7.4 Provenance Tracking for All Data

**Provenance Model:**

```typescript
interface DataProvenance {
  // Where did this data come from?
  source: {
    type: 'PRIMARY' | 'DERIVED' | 'IMPORTED' | 'INFERRED';
    system: string;
    reference: string;
    timestamp: ISO8601DateTime;
  };

  // How was it transformed?
  transformations: {
    step: number;
    operation: string;
    input_refs: string[];
    output_ref: string;
    performed_by: string;
    performed_at: ISO8601DateTime;
  }[];

  // Chain of custody
  custody_chain: {
    holder: string;
    from: ISO8601DateTime;
    to: ISO8601DateTime | null;
    access_level: string;
  }[];

  // Verification status
  verification: {
    verified: boolean;
    verified_by: string;
    verified_at: ISO8601DateTime;
    method: string;
    evidence: string[];
  };
}
```

**Field-Level Provenance:**

```json
{
  "manifest_id": "MAN-2025-001-ORG",
  "field_provenance": {
    "$.identification.legal_name": {
      "source": {
        "type": "PRIMARY",
        "system": "DELAWARE_SOS",
        "reference": "Entity #12345",
        "timestamp": "2020-03-15T10:00:00Z"
      },
      "transformations": [],
      "custody_chain": [
        {
          "holder": "DELAWARE_SOS",
          "from": "2020-03-15T10:00:00Z",
          "to": "2020-03-15T10:05:00Z",
          "access_level": "SOURCE_OF_RECORD"
        },
        {
          "holder": "MANIFEST_SYSTEM",
          "from": "2020-03-15T10:05:00Z",
          "to": null,
          "access_level": "CUSTODIAN"
        }
      ],
      "verification": {
        "verified": true,
        "verified_by": "compliance-001",
        "verified_at": "2020-03-15T10:10:00Z",
        "method": "DOCUMENT_REVIEW",
        "evidence": ["DOC-2020-DE-12345"]
      }
    },
    "$.financial.revenue_range": {
      "source": {
        "type": "DERIVED",
        "system": "FINANCIAL_SYSTEM",
        "reference": "FIN-CALC-2024-001",
        "timestamp": "2024-04-15T00:00:00Z"
      },
      "transformations": [
        {
          "step": 1,
          "operation": "AGGREGATE_REVENUE",
          "input_refs": ["FIN-Q1-2024", "FIN-Q2-2024", "FIN-Q3-2024", "FIN-Q4-2024"],
          "output_ref": "FIN-ANNUAL-2024",
          "performed_by": "system-finance",
          "performed_at": "2025-01-02T00:00:00Z"
        },
        {
          "step": 2,
          "operation": "CLASSIFY_RANGE",
          "input_refs": ["FIN-ANNUAL-2024"],
          "output_ref": "REVENUE_RANGE_2024",
          "performed_by": "system-finance",
          "performed_at": "2025-01-02T00:01:00Z"
        }
      ],
      "verification": {
        "verified": true,
        "verified_by": "external-auditor-001",
        "verified_at": "2025-01-05T00:00:00Z",
        "method": "AUDIT",
        "evidence": ["AUDIT-REPORT-2024"]
      }
    }
  }
}
```

### 7.5 Third-Party Verification Interfaces

**Verification API:**

```typescript
interface ThirdPartyVerificationAPI {
  // Request verification of manifest data
  requestVerification(
    request: VerificationRequest
  ): Promise<VerificationTicket>;

  // Check verification status
  getVerificationStatus(
    ticketId: string
  ): Promise<VerificationStatus>;

  // Retrieve verification certificate
  getVerificationCertificate(
    ticketId: string
  ): Promise<VerificationCertificate>;

  // Validate a certificate
  validateCertificate(
    certificate: VerificationCertificate
  ): Promise<CertificateValidation>;
}

interface VerificationRequest {
  manifest_id: string;
  verification_scope: {
    fields: string[] | 'ALL';
    depth: 'CURRENT' | 'HISTORICAL';
  };
  verification_type:
    | 'EXISTENCE'      // Verify entity exists
    | 'ACCURACY'       // Verify data matches source
    | 'COMPLETENESS'   // Verify all required data present
    | 'COMPLIANCE'     // Verify regulatory compliance
    | 'FULL';          // All of the above

  requester: {
    organization: string;
    purpose: string;
    authorization: string;
  };

  preferred_verifiers: string[];
  deadline: ISO8601DateTime;
}

interface VerificationCertificate {
  certificate_id: string;
  manifest_id: string;
  manifest_version: number;

  issued_at: ISO8601DateTime;
  expires_at: ISO8601DateTime;

  verifier: {
    id: string;
    name: string;
    accreditation: string[];
    public_key: string;
  };

  verification_performed: {
    type: string;
    scope: string[];
    methods: string[];
    findings: 'VERIFIED' | 'VERIFIED_WITH_NOTES' | 'UNVERIFIED';
    notes: string[];
  };

  signature: {
    algorithm: string;
    value: string;
    signed_fields: string[];
  };

  chain_of_trust: {
    root_ca: string;
    intermediate_certs: string[];
  };
}
```

**Verification Flow:**

```
1. Diligence Reviewer requests verification
   └─> API: requestVerification()

2. System routes to accredited verifier
   └─> Verifier accesses manifest data

3. Verifier performs verification
   └─> Cross-references with authoritative sources
   └─> Documents findings

4. Verifier issues certificate
   └─> Digitally signed
   └─> Timestamped
   └─> Registered in certificate registry

5. Certificate delivered to requester
   └─> API: getVerificationCertificate()

6. Requester validates certificate
   └─> API: validateCertificate()
   └─> Checks signature
   └─> Verifies chain of trust
   └─> Confirms not revoked
```

---

## 8. Quality Gates

### 8.1 Pre-Commit Validation Hooks

**Git Pre-Commit Hook:**

```bash
#!/bin/bash
# .git/hooks/pre-commit

set -e

echo "Running manifest validation..."

# Get staged manifest files
STAGED_MANIFESTS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.manifest\.json$' || true)

if [ -z "$STAGED_MANIFESTS" ]; then
    echo "No manifest files staged, skipping validation"
    exit 0
fi

# Run validation for each staged manifest
VALIDATION_FAILED=0

for manifest in $STAGED_MANIFESTS; do
    echo "Validating: $manifest"

    # Schema validation
    if ! npx manifest-validate --mode STRICT "$manifest"; then
        echo "FAILED: Schema validation for $manifest"
        VALIDATION_FAILED=1
        continue
    fi

    # Reference integrity
    if ! npx manifest-validate --check references "$manifest"; then
        echo "FAILED: Reference integrity for $manifest"
        VALIDATION_FAILED=1
        continue
    fi

    # Placeholder detection
    if ! npx manifest-validate --check no-placeholders "$manifest"; then
        echo "FAILED: Placeholder detected in $manifest"
        VALIDATION_FAILED=1
        continue
    fi

    # Completeness check
    if ! npx manifest-validate --check completeness "$manifest"; then
        echo "FAILED: Incomplete manifest $manifest"
        VALIDATION_FAILED=1
        continue
    fi

    echo "PASSED: $manifest"
done

if [ $VALIDATION_FAILED -eq 1 ]; then
    echo ""
    echo "Commit rejected: Manifest validation failed"
    echo "Fix the above issues and try again"
    exit 1
fi

echo "All manifest validations passed"
exit 0
```

### 8.2 CI/CD Validation Pipelines

**GitHub Actions Workflow:**

```yaml
name: Manifest Validation Pipeline

on:
  push:
    paths:
      - 'manifests/**'
  pull_request:
    paths:
      - 'manifests/**'

jobs:
  validate-schema:
    name: Schema Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run STRICT validation
        run: |
          npx manifest-validate \
            --mode STRICT \
            --recursive \
            --path ./manifests \
            --report ./reports/schema-validation.json

      - name: Upload validation report
        uses: actions/upload-artifact@v4
        with:
          name: schema-validation-report
          path: ./reports/schema-validation.json

  validate-references:
    name: Reference Integrity
    runs-on: ubuntu-latest
    needs: validate-schema
    steps:
      - uses: actions/checkout@v4

      - name: Check reference integrity
        run: |
          npx manifest-validate \
            --check references \
            --recursive \
            --path ./manifests \
            --fail-on-unresolved

  validate-compliance:
    name: Compliance Checks
    runs-on: ubuntu-latest
    needs: [validate-schema, validate-references]
    steps:
      - uses: actions/checkout@v4

      - name: Run compliance validation
        run: |
          npx manifest-compliance-check \
            --frameworks SOX,GDPR,SOC2 \
            --path ./manifests \
            --report ./reports/compliance.json

      - name: Check for compliance violations
        run: |
          VIOLATIONS=$(jq '.violations | length' ./reports/compliance.json)
          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "Compliance violations found: $VIOLATIONS"
            jq '.violations' ./reports/compliance.json
            exit 1
          fi

  generate-proofs:
    name: Generate Cryptographic Proofs
    runs-on: ubuntu-latest
    needs: [validate-schema, validate-references, validate-compliance]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Generate proofs for new manifests
        run: |
          npx manifest-seal \
            --path ./manifests \
            --proof-type merkle \
            --sign \
            --output ./proofs

      - name: Commit proofs
        run: |
          git config user.name "Manifest Bot"
          git config user.email "bot@example.com"
          git add ./proofs
          git commit -m "chore: generate cryptographic proofs [skip ci]"
          git push
```

### 8.3 Automated Schema Compliance Checks

**Compliance Check Implementation:**

```typescript
interface SchemaComplianceChecker {
  check(manifest: Manifest): ComplianceReport;
}

class ManifestComplianceChecker implements SchemaComplianceChecker {
  private rules: ComplianceRule[] = [
    {
      id: 'SCHEMA_VERSION_DECLARED',
      severity: 'ERROR',
      check: (m) => !!m.$schema_version,
      message: 'Schema version must be declared'
    },
    {
      id: 'SCHEMA_VERSION_VALID',
      severity: 'ERROR',
      check: (m) => this.schemaRegistry.exists(m.$schema_version),
      message: 'Schema version must exist in registry'
    },
    {
      id: 'REQUIRED_FIELDS_PRESENT',
      severity: 'ERROR',
      check: (m) => this.validateRequiredFields(m),
      message: 'All required fields must be present'
    },
    {
      id: 'NO_UNKNOWN_FIELDS',
      severity: 'ERROR',
      check: (m) => this.validateNoUnknownFields(m),
      message: 'No unknown fields in STRICT mode'
    },
    {
      id: 'FIELD_TYPES_VALID',
      severity: 'ERROR',
      check: (m) => this.validateFieldTypes(m),
      message: 'All field types must match schema'
    },
    {
      id: 'ENUMS_VALID',
      severity: 'ERROR',
      check: (m) => this.validateEnums(m),
      message: 'Enum values must be in allowed set'
    },
    {
      id: 'DATES_VALID',
      severity: 'ERROR',
      check: (m) => this.validateDates(m),
      message: 'Date formats must be ISO8601'
    },
    {
      id: 'REFERENCES_VALID',
      severity: 'ERROR',
      check: (m) => this.validateReferences(m),
      message: 'All references must resolve'
    },
    {
      id: 'NO_PLACEHOLDERS',
      severity: 'ERROR',
      check: (m) => this.validateNoPlaceholders(m),
      message: 'No placeholder values allowed'
    },
    {
      id: 'CRYPTOGRAPHIC_INTEGRITY',
      severity: 'ERROR',
      check: (m) => this.validateCryptographicIntegrity(m),
      message: 'Cryptographic proofs must be valid'
    }
  ];

  check(manifest: Manifest): ComplianceReport {
    const results = this.rules.map(rule => ({
      rule_id: rule.id,
      passed: rule.check(manifest),
      severity: rule.severity,
      message: rule.message
    }));

    const errors = results.filter(r => !r.passed && r.severity === 'ERROR');
    const warnings = results.filter(r => !r.passed && r.severity === 'WARNING');

    return {
      manifest_id: manifest.manifest_id,
      schema_version: manifest.$schema_version,
      compliant: errors.length === 0,
      total_rules: this.rules.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      errors,
      warnings
    };
  }
}
```

### 8.4 Referential Integrity Verification

**Integrity Verification Engine:**

```typescript
interface ReferentialIntegrityVerifier {
  verify(manifest: Manifest): IntegrityReport;
}

class ManifestIntegrityVerifier implements ReferentialIntegrityVerifier {
  async verify(manifest: Manifest): Promise<IntegrityReport> {
    const references = this.extractAllReferences(manifest);
    const results: ReferenceCheck[] = [];

    for (const ref of references) {
      const check = await this.checkReference(ref);
      results.push(check);
    }

    // Check for orphans (entities that should have references)
    const orphanCheck = await this.checkForOrphans(manifest);

    // Check for circular references
    const circularCheck = this.checkCircularReferences(references);

    // Check for stale references
    const staleCheck = await this.checkStaleReferences(manifest);

    return {
      manifest_id: manifest.manifest_id,
      total_references: references.length,
      valid_references: results.filter(r => r.valid).length,
      invalid_references: results.filter(r => !r.valid).length,
      reference_details: results,
      orphan_check: orphanCheck,
      circular_reference_check: circularCheck,
      stale_reference_check: staleCheck,
      overall_integrity: this.calculateOverallIntegrity(
        results, orphanCheck, circularCheck, staleCheck
      )
    };
  }

  private async checkReference(ref: Reference): Promise<ReferenceCheck> {
    const target = await this.resolve(ref);

    if (!target) {
      return {
        reference: ref,
        valid: false,
        error: 'TARGET_NOT_FOUND',
        message: `Referenced ${ref.target_type} with ID ${ref.target_id} does not exist`
      };
    }

    if (target.deleted) {
      return {
        reference: ref,
        valid: false,
        error: 'TARGET_DELETED',
        message: `Referenced ${ref.target_type} with ID ${ref.target_id} has been deleted`,
        deleted_at: target.deleted_at
      };
    }

    if (!this.isCompatibleVersion(ref, target)) {
      return {
        reference: ref,
        valid: false,
        error: 'VERSION_MISMATCH',
        message: `Reference expects version ${ref.expected_version} but target is ${target.version}`
      };
    }

    return {
      reference: ref,
      valid: true,
      target_version: target.version,
      target_status: target.status
    };
  }
}
```

### 8.5 Coverage Metrics for Organizational Completeness

**Completeness Metrics:**

```typescript
interface CompletenessMetrics {
  // Required section coverage
  section_coverage: {
    section: string;
    required_fields: number;
    present_fields: number;
    coverage_percentage: number;
  }[];

  // Overall manifest completeness
  overall_completeness: number;

  // Field quality scores
  field_quality: {
    field: string;
    quality_score: number;  // 0-100
    issues: string[];
  }[];

  // Missing elements
  missing_elements: {
    element: string;
    required_by: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }[];

  // Recommendations
  recommendations: {
    priority: number;
    action: string;
    impact: string;
  }[];
}

class CompletenessAnalyzer {
  analyze(manifest: Manifest): CompletenessMetrics {
    const schema = this.schemaRegistry.get(manifest.$schema_version);

    const sectionCoverage = schema.sections.map(section => {
      const required = this.getRequiredFields(section);
      const present = this.getPresentFields(manifest, section);

      return {
        section: section.name,
        required_fields: required.length,
        present_fields: present.length,
        coverage_percentage: (present.length / required.length) * 100
      };
    });

    const overallCompleteness = this.calculateOverallCompleteness(
      sectionCoverage
    );

    const fieldQuality = this.analyzeFieldQuality(manifest, schema);

    const missingElements = this.identifyMissingElements(
      manifest, schema
    );

    const recommendations = this.generateRecommendations(
      sectionCoverage, fieldQuality, missingElements
    );

    return {
      section_coverage: sectionCoverage,
      overall_completeness: overallCompleteness,
      field_quality: fieldQuality,
      missing_elements: missingElements,
      recommendations
    };
  }
}
```

**Completeness Dashboard Output:**

```json
{
  "manifest_id": "MAN-2025-001-ORG",
  "analysis_timestamp": "2025-01-02T15:00:00Z",

  "section_coverage": [
    {
      "section": "identification",
      "required_fields": 5,
      "present_fields": 5,
      "coverage_percentage": 100
    },
    {
      "section": "legal_status",
      "required_fields": 4,
      "present_fields": 4,
      "coverage_percentage": 100
    },
    {
      "section": "governance",
      "required_fields": 8,
      "present_fields": 6,
      "coverage_percentage": 75
    },
    {
      "section": "officers",
      "required_fields": 3,
      "present_fields": 3,
      "coverage_percentage": 100
    },
    {
      "section": "compliance",
      "required_fields": 5,
      "present_fields": 4,
      "coverage_percentage": 80
    }
  ],

  "overall_completeness": 91,

  "field_quality": [
    {
      "field": "$.governance.board_members",
      "quality_score": 85,
      "issues": [
        "2 members missing appointment dates",
        "1 member missing term end date"
      ]
    }
  ],

  "missing_elements": [
    {
      "element": "$.governance.audit_committee.charter_document",
      "required_by": "SOX Compliance",
      "severity": "HIGH"
    },
    {
      "element": "$.compliance.last_audit_date",
      "required_by": "Annual Audit Policy",
      "severity": "MEDIUM"
    }
  ],

  "recommendations": [
    {
      "priority": 1,
      "action": "Upload Audit Committee charter document",
      "impact": "Required for SOX compliance certification"
    },
    {
      "priority": 2,
      "action": "Complete board member appointment dates",
      "impact": "Improves governance section quality by 15%"
    },
    {
      "priority": 3,
      "action": "Record last audit date",
      "impact": "Required for annual compliance attestation"
    }
  ]
}
```

---

## Appendix A: Validation Error Codes

| Code | Severity | Description |
|------|----------|-------------|
| `SCHEMA_NOT_FOUND` | ERROR | Referenced schema version does not exist |
| `REQUIRED_FIELD_MISSING` | ERROR | Required field is not present |
| `UNKNOWN_FIELD` | ERROR | Field not defined in schema (STRICT mode) |
| `TYPE_MISMATCH` | ERROR | Field value does not match expected type |
| `ENUM_INVALID` | ERROR | Value not in allowed enumeration |
| `FORMAT_INVALID` | ERROR | Value does not match required format |
| `REFERENCE_NOT_FOUND` | ERROR | Referenced entity does not exist |
| `REFERENCE_DELETED` | ERROR | Referenced entity has been deleted |
| `PLACEHOLDER_DETECTED` | ERROR | Placeholder value detected |
| `INCOMPLETE_SECTION` | ERROR | Required section is incomplete |
| `ORPHAN_DETECTED` | ERROR | Entity has no valid parent reference |
| `CIRCULAR_REFERENCE` | ERROR | Circular reference detected |
| `INTEGRITY_FAILURE` | ERROR | Cryptographic integrity check failed |
| `DEPRECATED_FIELD` | WARNING | Field is deprecated |
| `FUTURE_FIELD` | WARNING | Field from newer schema version |

---

## Appendix B: Schema Migration Checklist

```markdown
## Pre-Migration Checklist

- [ ] All manifests pass current version STRICT validation
- [ ] Migration tool tested on staging environment
- [ ] Rollback procedure documented and tested
- [ ] Stakeholders notified of migration window
- [ ] Backup of all manifests completed
- [ ] Audit logging enabled for migration

## Migration Execution

- [ ] Start migration in maintenance window
- [ ] Execute migration in batches (recommended: 1000 manifests/batch)
- [ ] Monitor for errors after each batch
- [ ] Validate migrated manifests pass new schema STRICT validation
- [ ] Verify cryptographic proofs regenerated
- [ ] Update audit trails with migration records

## Post-Migration Verification

- [ ] All manifests pass new schema STRICT validation
- [ ] Reference integrity verified
- [ ] Completeness metrics maintained or improved
- [ ] Performance benchmarks acceptable
- [ ] Rollback window active (72 hours)

## Closure

- [ ] Rollback window expired without issues
- [ ] Stakeholders notified of successful migration
- [ ] Old schema version marked as deprecated
- [ ] Documentation updated
```

---

## Appendix C: Compliance Framework Mappings

| Framework | Relevant Sections | Required Controls |
|-----------|-------------------|-------------------|
| SOX | Governance, Financial, Audit | Change management, Access control, Audit trail |
| SOC 2 | All | Data integrity, Availability, Confidentiality |
| GDPR | Personal Data | Consent tracking, Data provenance, Right to erasure |
| CCPA | Personal Data | Consumer rights, Data tracking |
| HIPAA | Health Data | Access logging, Encryption, Audit controls |

---

*Document Version: 1.0.0*
*Last Updated: 2025-01-02*
*Classification: Internal - Operational*
