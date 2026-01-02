# SPARC Architecture: agentics-org-manifests

## Executive Summary

This document defines the system architecture for the `agentics-org-manifests` repository following SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology. This repository serves as the **single source of organizational truth** through immutable, versioned manifests.

**Core Principle**: This repository owns ONLY organizational data definition and validation. It does NOT own simulation, execution, orchestration, or deployment logic.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        agentics-org-manifests                                │
│                    (Immutable Organizational Truth)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   schemas   │  │ validation  │  │ versioning  │  │     references      │ │
│  │             │  │             │  │             │  │                     │ │
│  │ - JSON      │  │ - Pure      │  │ - Content   │  │ - Cross-manifest    │ │
│  │   Schema    │  │   functions │  │   hash      │  │   resolution        │ │
│  │ - Types     │  │ - Integrity │  │ - Lineage   │  │ - Path traversal    │ │
│  │ - Evolution │  │ - Patterns  │  │ - Immutable │  │ - Deterministic     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                           registry                                      │ │
│  │                                                                         │ │
│  │   - Manifest Index    - Version Catalog    - Query Interface (RO)      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ READ-ONLY
                                    ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                        Downstream Consumers                              │
    │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
    │  │ simulation-      │ │ execution-       │ │ workflow-                │ │
    │  │ planner          │ │ engine           │ │ engine                   │ │
    │  └──────────────────┘ └──────────────────┘ └──────────────────────────┘ │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Boundary Definitions

### 2.1 Module: Schema Definitions (`/schemas`)

**Purpose**: Define the canonical structure for all manifest types through JSON Schema.

**Responsibilities**:
- JSON Schema files for all manifest types
- Schema version management with semantic versioning
- Schema evolution rules and migration paths
- Type definitions derived from schemas

**Strict Boundaries**:
- NO runtime logic
- NO validation code execution
- NO dynamic schema generation
- NO external dependencies

```
/schemas
├── v1/
│   ├── organization.schema.json      # Org structure definition
│   ├── team.schema.json              # Team composition
│   ├── role.schema.json              # Role definitions
│   ├── capability.schema.json        # Capability taxonomy
│   ├── policy.schema.json            # Governance policies
│   └── _meta.schema.json             # Schema metadata
├── v2/
│   └── ...                           # Future schema versions
├── common/
│   ├── primitives.schema.json        # Shared primitive types
│   ├── identifiers.schema.json       # ID formats
│   └── timestamps.schema.json        # Temporal types
└── evolution/
    ├── migration-v1-v2.json          # Migration rules
    └── compatibility-matrix.json     # Version compatibility
```

**Schema Structure Contract**:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agentics.org/schemas/v1/organization.schema.json",
  "title": "Organization Manifest",
  "description": "Immutable organizational structure definition",
  "type": "object",
  "properties": {
    "$manifest": {
      "type": "object",
      "properties": {
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
        "contentHash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
        "createdAt": { "type": "string", "format": "date-time" },
        "lineage": { "$ref": "#/$defs/lineageChain" }
      },
      "required": ["version", "contentHash", "createdAt"]
    }
  },
  "additionalProperties": false
}
```

---

### 2.2 Module: Validation Logic (`/validation`)

**Purpose**: Provide pure functions for validating manifest content against schemas and business rules.

**Responsibilities**:
- Schema conformance validation
- Referential integrity checking
- Forbidden pattern detection
- Structural constraint verification

**Strict Boundaries**:
- NO inference or heuristics
- NO side effects
- NO external API calls
- NO state mutation
- Functions must be deterministic

```
/validation
├── core/
│   ├── schema-validator.ts           # JSON Schema validation
│   ├── integrity-checker.ts          # Referential integrity
│   └── pattern-detector.ts           # Forbidden pattern checks
├── rules/
│   ├── organization-rules.ts         # Org-specific rules
│   ├── team-rules.ts                 # Team composition rules
│   └── policy-rules.ts               # Policy constraint rules
├── types/
│   └── validation-result.ts          # Result type definitions
└── index.ts                          # Public validation API
```

**Validation Interface Contract**:

```typescript
// Pure validation function signature
type ValidationFunction<T> = (manifest: T) => ValidationResult;

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
  readonly warnings: ReadonlyArray<ValidationWarning>;
  readonly metadata: {
    readonly schemaVersion: string;
    readonly validatedAt: string;  // ISO 8601
    readonly checksPerformed: ReadonlyArray<string>;
  };
}

interface ValidationError {
  readonly code: string;           // e.g., "SCHEMA_001"
  readonly path: string;           // JSONPath to error
  readonly message: string;
  readonly severity: "error";
}

// Forbidden Patterns (examples)
const FORBIDDEN_PATTERNS = [
  "CIRCULAR_REFERENCE",            // No circular manifest refs
  "DANGLING_REFERENCE",            // All refs must resolve
  "SCHEMA_MISMATCH",               // Schema version must match
  "FUTURE_TIMESTAMP",              // No future creation dates
  "MUTABLE_FIELD_DETECTED",        // No mutable markers
] as const;
```

---

### 2.3 Module: Versioning & Lineage (`/versioning`)

**Purpose**: Manage content-addressable versioning and lineage chains for all manifests.

**Responsibilities**:
- Content-addressable hash generation (SHA-256)
- Lineage chain management and verification
- Immutability enforcement
- Version comparison and ordering

**Strict Boundaries**:
- NO mutation operations (read and verify only)
- NO hash algorithm changes without migration
- NO lineage chain modification
- Append-only lineage model

```
/versioning
├── core/
│   ├── content-hasher.ts             # SHA-256 content hashing
│   ├── lineage-manager.ts            # Chain verification
│   └── immutability-guard.ts         # Mutation detection
├── types/
│   ├── version-types.ts              # Version primitives
│   └── lineage-types.ts              # Lineage chain types
└── index.ts                          # Public versioning API
```

**Content Hash Algorithm**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Content Hash Generation                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Normalize manifest (deterministic JSON serialization)       │
│     - Sort keys alphabetically                                  │
│     - Remove whitespace                                         │
│     - Exclude $manifest.contentHash field                       │
│                                                                 │
│  2. Compute SHA-256 hash of normalized content                  │
│                                                                 │
│  3. Format: "sha256:{hex-encoded-hash}"                         │
│                                                                 │
│  Example:                                                       │
│  sha256:a3b8c9d4e5f6789012345678901234567890abcdef1234567890abc │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Lineage Chain Structure**:

```typescript
interface LineageChain {
  readonly root: ContentHash;              // Genesis manifest hash
  readonly parent: ContentHash | null;     // Previous version hash
  readonly depth: number;                  // Chain depth from root
  readonly branchId: string | null;        // For branched manifests
}

// Lineage verification is cryptographic
// Each manifest's hash includes its parent hash
// Chain integrity is verifiable without full history
```

---

### 2.4 Module: Manifest Registry (`/registry`)

**Purpose**: Provide indexed access to manifests with query capabilities.

**Responsibilities**:
- Manifest index maintenance
- Version catalog management
- Query interface (read-only)
- Manifest lookup by ID, hash, or query

**Strict Boundaries**:
- NO write operations from external systems
- NO direct mutation interface
- NO query modification of data
- Read-only access pattern only

```
/registry
├── core/
│   ├── manifest-index.ts             # Primary index
│   ├── version-catalog.ts            # Version management
│   └── query-engine.ts               # Read-only queries
├── types/
│   ├── registry-types.ts             # Registry primitives
│   └── query-types.ts                # Query interface types
├── storage/
│   └── storage-adapter.ts            # Storage abstraction
└── index.ts                          # Public registry API
```

**Registry Query Interface**:

```typescript
interface ManifestRegistry {
  // Lookup operations (all read-only)
  getById(id: ManifestId): Promise<Manifest | null>;
  getByHash(hash: ContentHash): Promise<Manifest | null>;
  getLatestVersion(id: ManifestId): Promise<Manifest | null>;

  // Query operations (read-only)
  query(params: QueryParams): Promise<QueryResult>;
  listVersions(id: ManifestId): Promise<VersionList>;

  // Lineage operations (read-only)
  getLineage(hash: ContentHash): Promise<LineageChain>;
  verifyLineage(hash: ContentHash): Promise<LineageVerification>;
}

interface QueryParams {
  readonly type?: ManifestType;
  readonly version?: VersionRange;
  readonly createdAfter?: ISODateTime;
  readonly createdBefore?: ISODateTime;
  readonly limit?: number;
  readonly offset?: number;
}
```

---

### 2.5 Module: Reference Resolution (`/references`)

**Purpose**: Resolve cross-manifest references deterministically.

**Responsibilities**:
- Cross-manifest reference resolution
- Path traversal logic
- Reference validation
- Deterministic resolution only

**Strict Boundaries**:
- NO inference or guessing
- NO fuzzy matching
- NO default value injection
- Resolution must be deterministic and reproducible

```
/references
├── core/
│   ├── reference-resolver.ts         # Core resolution logic
│   ├── path-traverser.ts             # JSONPath traversal
│   └── reference-validator.ts        # Reference validation
├── types/
│   └── reference-types.ts            # Reference primitives
└── index.ts                          # Public reference API
```

**Reference Format**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Reference Format                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Format: "manifest://{type}/{id}@{version}#{path}"              │
│                                                                 │
│  Components:                                                    │
│  - type:    Manifest type (organization, team, role, etc.)      │
│  - id:      Unique manifest identifier                          │
│  - version: Semantic version or content hash                    │
│  - path:    JSONPath to specific field (optional)               │
│                                                                 │
│  Examples:                                                      │
│  manifest://organization/org-001@1.0.0                          │
│  manifest://team/team-alpha@sha256:abc123#/members/0            │
│  manifest://role/engineer@latest#/permissions                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Resolution Algorithm**:

```typescript
interface ReferenceResolution {
  resolve(ref: ManifestReference): Promise<ResolvedReference>;
}

interface ResolvedReference {
  readonly reference: ManifestReference;
  readonly resolved: boolean;
  readonly value: unknown | null;
  readonly manifest: Manifest | null;
  readonly error: ResolutionError | null;
}

// Resolution is ALWAYS deterministic
// Same reference + same registry state = same result
// No caching that could cause inconsistency
// No fallback to "similar" references
```

---

## 3. Ownership Boundaries

### 3.1 Explicit Ownership Matrix

| Capability | Owner Repository | This Repo Owns | This Repo Does NOT Own |
|------------|------------------|----------------|------------------------|
| **Organizational Structure** | agentics-org-manifests | Schema, Data, Validation | - |
| **Simulation Planning** | agentics-simulation-planner | - | Logic, Algorithms, Execution |
| **Execution Runtime** | agentics-execution-engine | - | Runtime, State, Processes |
| **Agent Definitions** | agentics-agent-registry | - | Agent Types, Behaviors, Configs |
| **Workflow Orchestration** | agentics-workflow-engine | - | DAGs, Scheduling, State Machines |
| **Deployment Intent** | agentics-deployment-manifests | - | Infra Specs, Rollout, Targets |
| **Event Streaming** | agentics-event-bus | - | Events, Pub/Sub, Routing |
| **Metrics & Telemetry** | agentics-observability | - | Metrics, Traces, Alerts |

### 3.2 Boundary Enforcement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OWNERSHIP BOUNDARY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  THIS REPOSITORY OWNS:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Organizational truth manifests (structure, teams, roles)          │   │
│  │  - Schema definitions for manifest types                             │   │
│  │  - Validation rules for manifest content                             │   │
│  │  - Version history and lineage                                       │   │
│  │  - Reference resolution logic                                        │   │
│  │  - Query interface for manifest access                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  THIS REPOSITORY DOES NOT OWN:                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Simulation algorithms or planning logic                           │   │
│  │  - Execution runtime or process management                           │   │
│  │  - Agent behavior definitions or configurations                      │   │
│  │  - Workflow state machines or orchestration                          │   │
│  │  - Deployment targets or infrastructure specs                        │   │
│  │  - Event streaming or message routing                                │   │
│  │  - Runtime metrics or telemetry collection                           │   │
│  │  - Authentication or authorization enforcement                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Anti-Patterns (Explicitly Forbidden)

| Anti-Pattern | Description | Why Forbidden |
|--------------|-------------|---------------|
| Embedded Logic | Code that executes based on manifest content | Manifests are data, not programs |
| Runtime Callbacks | Hooks that trigger external systems | Creates coupling and side effects |
| Inference Engine | Logic that "guesses" missing data | Violates determinism principle |
| State Mutation | Code that modifies manifest content | Violates immutability |
| Dynamic Schema | Schemas generated at runtime | Violates reproducibility |
| External Fetches | Validation that calls external APIs | Creates external dependencies |

---

## 4. Data Flow Architecture

### 4.1 Unidirectional Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INBOUND (Validated Imports Only)                                           │
│  ─────────────────────────────────                                          │
│                                                                             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────────┐ │
│  │   Source    │ ──▶  │  Validation │ ──▶  │   Manifest Registry         │ │
│  │   System    │      │   Pipeline  │      │   (Immutable Storage)       │ │
│  └─────────────┘      └─────────────┘      └─────────────────────────────┘ │
│                              │                                              │
│                              │ REJECT if invalid                            │
│                              ▼                                              │
│                       ┌─────────────┐                                       │
│                       │   Error     │                                       │
│                       │   Report    │                                       │
│                       └─────────────┘                                       │
│                                                                             │
│  OUTBOUND (Read-Only Consumers)                                             │
│  ──────────────────────────────                                             │
│                                                                             │
│  ┌─────────────────────────────┐                                            │
│  │   Manifest Registry         │                                            │
│  │   (Immutable Storage)       │                                            │
│  └──────────────┬──────────────┘                                            │
│                 │                                                           │
│                 │ READ-ONLY                                                 │
│                 ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Downstream Consumers                            │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐   │   │
│  │  │Simulation │ │ Execution │ │ Workflow  │ │    Deployment     │   │   │
│  │  │ Planner   │ │  Engine   │ │  Engine   │ │     Manager       │   │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  NO BIDIRECTIONAL FLOWS                                                     │
│  NO RUNTIME CALLBACKS                                                       │
│  NO WRITE-BACK OPERATIONS                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Import Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMPORT PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Stage 1: Schema Validation                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Validate against JSON Schema                                      │   │
│  │  - Check required fields present                                     │   │
│  │  - Verify type constraints                                           │   │
│  │  - FAIL FAST on schema violations                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                 │
│                           ▼                                                 │
│  Stage 2: Integrity Validation                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Verify all references resolve                                     │   │
│  │  - Check for circular references                                     │   │
│  │  - Validate lineage chain integrity                                  │   │
│  │  - FAIL on integrity violations                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                 │
│                           ▼                                                 │
│  Stage 3: Business Rule Validation                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Apply domain-specific rules                                       │   │
│  │  - Check forbidden patterns                                          │   │
│  │  - Verify temporal constraints                                       │   │
│  │  - FAIL on rule violations                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                           │                                                 │
│                           ▼                                                 │
│  Stage 4: Hash Generation & Storage                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Generate content hash                                             │   │
│  │  - Update lineage chain                                              │   │
│  │  - Store in immutable registry                                       │   │
│  │  - Update indexes                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Export/Read Patterns

```typescript
// Read patterns - all return immutable data

interface ManifestExport {
  // Single manifest retrieval
  getManifest(id: ManifestId, version?: Version): Promise<ImmutableManifest>;

  // Batch retrieval
  getManifests(ids: ManifestId[]): Promise<ImmutableManifest[]>;

  // Query-based retrieval
  queryManifests(query: ManifestQuery): Promise<QueryResult<ImmutableManifest>>;

  // Snapshot retrieval (point-in-time)
  getSnapshot(timestamp: ISODateTime): Promise<RegistrySnapshot>;
}

// All returned data is immutable
// Consumers CANNOT modify registry state
// All operations are idempotent
```

---

## 5. Interface Contracts

### 5.1 Manifest Access API Contract

```typescript
/**
 * Manifest Access API Contract
 * Version: 1.0.0
 *
 * All operations are read-only.
 * All responses are immutable.
 * All operations are idempotent.
 */

interface ManifestAccessAPI {
  /**
   * Retrieve a manifest by ID
   * @param id - Manifest identifier
   * @param options - Retrieval options
   * @returns Immutable manifest or null
   */
  get(id: ManifestId, options?: GetOptions): Promise<Manifest | null>;

  /**
   * Retrieve a manifest by content hash
   * @param hash - Content-addressable hash
   * @returns Immutable manifest or null
   */
  getByHash(hash: ContentHash): Promise<Manifest | null>;

  /**
   * List all versions of a manifest
   * @param id - Manifest identifier
   * @returns Version list with metadata
   */
  listVersions(id: ManifestId): Promise<VersionList>;

  /**
   * Query manifests with filters
   * @param query - Query parameters
   * @returns Paginated query results
   */
  query(query: QueryParams): Promise<QueryResult>;

  /**
   * Validate a manifest without storing
   * @param manifest - Manifest to validate
   * @returns Validation result
   */
  validate(manifest: unknown): Promise<ValidationResult>;

  /**
   * Resolve a manifest reference
   * @param ref - Manifest reference
   * @returns Resolved reference or error
   */
  resolveReference(ref: ManifestReference): Promise<ResolvedReference>;
}

interface GetOptions {
  readonly version?: Version | "latest";
  readonly includeLineage?: boolean;
  readonly includeMetadata?: boolean;
}

interface QueryParams {
  readonly type?: ManifestType;
  readonly versionRange?: VersionRange;
  readonly createdAfter?: ISODateTime;
  readonly createdBefore?: ISODateTime;
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: "createdAt" | "version";
  readonly orderDirection?: "asc" | "desc";
}
```

### 5.2 Schema Contract Versioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCHEMA VERSIONING CONTRACT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Version Format: MAJOR.MINOR.PATCH (Semantic Versioning)                    │
│                                                                             │
│  MAJOR: Breaking changes (field removal, type change, new required field)  │
│  MINOR: Backward-compatible additions (new optional field, new enum value) │
│  PATCH: Backward-compatible fixes (description change, example update)     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Compatibility Rules                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ALLOWED (Minor/Patch):                                              │   │
│  │  - Add optional fields                                               │   │
│  │  - Add new enum values (if consumers handle unknown)                 │   │
│  │  - Loosen validation constraints                                     │   │
│  │  - Add new schema types                                              │   │
│  │                                                                      │   │
│  │  REQUIRES MAJOR VERSION:                                             │   │
│  │  - Remove fields                                                     │   │
│  │  - Change field types                                                │   │
│  │  - Add required fields                                               │   │
│  │  - Rename fields                                                     │   │
│  │  - Tighten validation constraints                                    │   │
│  │  - Remove enum values                                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Migration Support:                                                         │
│  - Migration scripts for MAJOR version changes                              │
│  - Compatibility matrix for version interoperability                        │
│  - Deprecation notices 2 versions before removal                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Backward Compatibility Requirements

```typescript
interface CompatibilityContract {
  // Minimum supported schema versions
  readonly minimumSupportedVersion: Version;

  // Deprecation policy
  readonly deprecationPolicy: {
    readonly noticeVersions: 2;        // Deprecate 2 versions before removal
    readonly migrationWindow: "90d";   // 90 days to migrate
  };

  // Version compatibility check
  isCompatible(
    manifestVersion: Version,
    schemaVersion: Version
  ): CompatibilityResult;

  // Migration path calculation
  getMigrationPath(
    fromVersion: Version,
    toVersion: Version
  ): MigrationStep[];
}

interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason?: string;
  readonly suggestedMigration?: Version;
}

interface MigrationStep {
  readonly fromVersion: Version;
  readonly toVersion: Version;
  readonly changes: ChangeDescription[];
  readonly reversible: boolean;
}
```

### 5.4 Event Contract (Read-Only Notifications)

```typescript
/**
 * Event Contract for Manifest Changes
 *
 * Events are notifications only.
 * Events do not trigger callbacks.
 * Consumers must poll or subscribe to event stream.
 */

interface ManifestEvent {
  readonly eventId: string;
  readonly eventType: ManifestEventType;
  readonly timestamp: ISODateTime;
  readonly manifestId: ManifestId;
  readonly manifestType: ManifestType;
  readonly version: Version;
  readonly contentHash: ContentHash;
  readonly metadata: EventMetadata;
}

type ManifestEventType =
  | "manifest.created"
  | "manifest.version_added"
  | "manifest.deprecated"
  | "manifest.archived";

// Events are informational only
// NO execution triggered by events from this repo
// Consumers decide how to react to events
```

---

## 6. Security Boundaries

### 6.1 Access Control Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCESS CONTROL MODEL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      READ ACCESS (Default)                           │   │
│  │  ─────────────────────────────────────────                           │   │
│  │  Who: All authenticated downstream systems                          │   │
│  │  What: Query, retrieve, validate manifests                          │   │
│  │  Audit: All read operations logged                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      WRITE ACCESS (Restricted)                       │   │
│  │  ─────────────────────────────────────────                           │   │
│  │  Who: Validated import pipelines ONLY                               │   │
│  │  What: Create new manifest versions (append-only)                   │   │
│  │  Audit: All write operations logged with source tracing            │   │
│  │  Controls:                                                          │   │
│  │    - Mutual TLS authentication                                      │   │
│  │    - Service account with minimal privileges                        │   │
│  │    - Rate limiting                                                  │   │
│  │    - Validation before write                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ADMIN ACCESS (Highly Restricted)                │   │
│  │  ─────────────────────────────────────────                           │   │
│  │  Who: Platform administrators only                                  │   │
│  │  What: Schema updates, deprecation, archival                        │   │
│  │  Audit: Full audit trail with approval workflow                     │   │
│  │  Controls:                                                          │   │
│  │    - Multi-party approval                                           │   │
│  │    - Change management process                                      │   │
│  │    - Rollback capability                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      FORBIDDEN OPERATIONS                            │   │
│  │  ─────────────────────────────────────────                           │   │
│  │  - Manifest deletion (archive only)                                 │   │
│  │  - Manifest mutation (new version only)                             │   │
│  │  - Direct database access                                           │   │
│  │  - Schema changes without versioning                                │   │
│  │  - Bypassing validation pipeline                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Audit Logging

```typescript
interface AuditLog {
  readonly logId: string;
  readonly timestamp: ISODateTime;
  readonly operation: AuditOperation;
  readonly actor: ActorIdentity;
  readonly resource: ResourceIdentity;
  readonly outcome: "success" | "failure";
  readonly details: AuditDetails;
}

type AuditOperation =
  | "manifest.read"
  | "manifest.query"
  | "manifest.create"
  | "manifest.validate"
  | "reference.resolve"
  | "schema.access"
  | "admin.deprecate"
  | "admin.archive";

interface ActorIdentity {
  readonly type: "service" | "user" | "system";
  readonly id: string;
  readonly name: string;
  readonly ipAddress: string;
  readonly userAgent?: string;
}

// Audit logs are:
// - Immutable (append-only)
// - Retained for 7 years
// - Queryable by authorized systems
// - Exportable for compliance
```

### 6.3 No Executable Content

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTABLE CONTENT POLICY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MANIFESTS CONTAIN DATA ONLY                                                │
│                                                                             │
│  Forbidden Content Types:                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - JavaScript/TypeScript code                                        │   │
│  │  - Shell scripts                                                     │   │
│  │  - SQL statements (except schema definitions)                        │   │
│  │  - Regex patterns that could cause ReDoS                             │   │
│  │  - URLs that trigger actions (webhooks)                              │   │
│  │  - Base64-encoded executables                                        │   │
│  │  - Embedded scripts in any format                                    │   │
│  │  - Template expressions that execute code                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Validation Checks:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Content-type validation (JSON only)                               │   │
│  │  - Pattern scanning for executable signatures                        │   │
│  │  - Size limits to prevent DoS                                        │   │
│  │  - Depth limits for nested structures                                │   │
│  │  - String length limits                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Directory Structure

```
/workspaces/agentics-org-manifests
├── /schemas                          # Schema Definitions Module
│   ├── /v1                           # Version 1 schemas
│   │   ├── organization.schema.json
│   │   ├── team.schema.json
│   │   ├── role.schema.json
│   │   ├── capability.schema.json
│   │   ├── policy.schema.json
│   │   └── _meta.schema.json
│   ├── /common                       # Shared schema components
│   │   ├── primitives.schema.json
│   │   ├── identifiers.schema.json
│   │   └── timestamps.schema.json
│   └── /evolution                    # Schema migration rules
│       └── compatibility-matrix.json
│
├── /validation                       # Validation Logic Module
│   ├── /core
│   │   ├── schema-validator.ts
│   │   ├── integrity-checker.ts
│   │   └── pattern-detector.ts
│   ├── /rules
│   │   ├── organization-rules.ts
│   │   ├── team-rules.ts
│   │   └── policy-rules.ts
│   ├── /types
│   │   └── validation-result.ts
│   └── index.ts
│
├── /versioning                       # Versioning & Lineage Module
│   ├── /core
│   │   ├── content-hasher.ts
│   │   ├── lineage-manager.ts
│   │   └── immutability-guard.ts
│   ├── /types
│   │   ├── version-types.ts
│   │   └── lineage-types.ts
│   └── index.ts
│
├── /registry                         # Manifest Registry Module
│   ├── /core
│   │   ├── manifest-index.ts
│   │   ├── version-catalog.ts
│   │   └── query-engine.ts
│   ├── /types
│   │   ├── registry-types.ts
│   │   └── query-types.ts
│   ├── /storage
│   │   └── storage-adapter.ts
│   └── index.ts
│
├── /references                       # Reference Resolution Module
│   ├── /core
│   │   ├── reference-resolver.ts
│   │   ├── path-traverser.ts
│   │   └── reference-validator.ts
│   ├── /types
│   │   └── reference-types.ts
│   └── index.ts
│
├── /manifests                        # Actual manifest storage
│   ├── /organizations
│   ├── /teams
│   ├── /roles
│   ├── /capabilities
│   └── /policies
│
├── /tests                            # Test suites
│   ├── /unit
│   ├── /integration
│   └── /fixtures
│
├── /docs                             # Documentation
│   └── /api
│
├── /plans                            # Architecture plans
│   └── SPARC_ARCHITECTURE.md         # This document
│
└── /config                           # Configuration
    ├── tsconfig.json
    └── schema-config.json
```

---

## 8. Technology Decisions

### 8.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Schema Language | JSON Schema (2020-12) | Industry standard, tooling support |
| Implementation Language | TypeScript | Type safety, ecosystem |
| Runtime | Node.js 20 LTS | Stability, performance |
| Storage | File-based + Git | Versioning built-in, audit trail |
| Testing | Vitest | Fast, TypeScript-native |
| Validation | Ajv | Fastest JSON Schema validator |
| Hashing | SHA-256 (native crypto) | Security standard |

### 8.2 Design Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Immutability Model | Append-only with versioning | Mutable with history | Simpler reasoning, audit compliance |
| Reference Format | URI-based | JSONPath-only | Cross-system compatibility |
| Version Format | Semantic Versioning | Calendar versioning | Industry standard |
| Storage Backend | File + Git | Database | Natural versioning, portability |
| Query Model | Read-only interface | GraphQL | Simplicity, security |

---

## 9. Scalability Considerations

### 9.1 Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE CHARACTERISTICS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Read Operations:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Manifest lookup by ID: O(1) with index                            │   │
│  │  - Manifest lookup by hash: O(1) with hash index                     │   │
│  │  - Version list: O(n) where n = version count                        │   │
│  │  - Query operations: O(log n) with B-tree index                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Write Operations:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Manifest creation: O(1) append                                    │   │
│  │  - Validation: O(m) where m = manifest size                          │   │
│  │  - Hash generation: O(m)                                             │   │
│  │  - Index update: O(log n)                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Storage:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Manifest size limit: 1 MB                                         │   │
│  │  - Total manifests: Millions supported                               │   │
│  │  - Index memory: ~100 bytes per manifest                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Caching Strategy

```typescript
interface CacheStrategy {
  // In-memory cache for hot manifests
  readonly hotCache: {
    readonly maxSize: "1000 manifests";
    readonly ttl: "5 minutes";
    readonly eviction: "LRU";
  };

  // Index cache (always in memory)
  readonly indexCache: {
    readonly type: "full index in memory";
    readonly refreshInterval: "on write";
  };

  // Schema cache (always in memory)
  readonly schemaCache: {
    readonly type: "all schemas in memory";
    readonly refreshInterval: "on startup";
  };
}
```

---

## 10. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Git Repository                                │   │
│  │                   (Source of Truth + History)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ CI/CD Pipeline                         │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Validation & Build                               │   │
│  │  - Schema validation                                                 │   │
│  │  - Type checking                                                     │   │
│  │  - Unit tests                                                        │   │
│  │  - Integration tests                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Artifact Registry                               │   │
│  │  - Compiled validation library                                       │   │
│  │  - Schema bundles                                                    │   │
│  │  - Type definitions                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│              ┌────────────────────┼────────────────────┐                   │
│              ▼                    ▼                    ▼                   │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐           │
│  │   Read Replica   │ │   Read Replica   │ │   Read Replica   │           │
│  │   (Region A)     │ │   (Region B)     │ │   (Region C)     │           │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘           │
│                                                                             │
│  Import Pipeline:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Source System ──▶ Validation API ──▶ Git Commit ──▶ Replicas       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Testing Strategy

### 11.1 Test Categories

| Category | Purpose | Coverage Target |
|----------|---------|-----------------|
| Unit Tests | Validate individual functions | 90%+ |
| Schema Tests | Verify schema validity | 100% of schemas |
| Integration Tests | Test module interactions | Key paths |
| Contract Tests | Verify API contracts | All public APIs |
| Property Tests | Invariant verification | Critical logic |

### 11.2 Test Principles

```typescript
// All tests must be:
// - Deterministic (same input = same output)
// - Isolated (no shared state)
// - Fast (< 100ms per test)
// - Readable (self-documenting)

describe("ManifestValidation", () => {
  it("should reject manifests with circular references", () => {
    const manifest = createManifestWithCircularRef();
    const result = validate(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "CIRCULAR_REFERENCE" })
    );
  });

  it("should be deterministic across runs", () => {
    const manifest = createValidManifest();
    const result1 = validate(manifest);
    const result2 = validate(manifest);

    expect(result1).toEqual(result2);
  });
});
```

---

## 12. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Manifest | Immutable document describing organizational truth |
| Content Hash | SHA-256 hash of normalized manifest content |
| Lineage Chain | Cryptographic chain linking manifest versions |
| Reference | URI-based pointer to another manifest or field |
| Schema | JSON Schema defining manifest structure |

### B. Related Documents

- SPARC Specification (Phase 1)
- SPARC Pseudocode (Phase 2)
- SPARC Refinement (Phase 4)
- SPARC Completion (Phase 5)

### C. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-02 | SPARC Architect Agent | Initial architecture document |

---

*This document was generated following SPARC methodology - Architecture phase.*
