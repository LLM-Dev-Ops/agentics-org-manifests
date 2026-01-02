# SPARC Pseudocode: Agentics Organization Manifests

## Overview

This document defines the algorithmic logic for the agentics-org-manifests repository. All operations are purely declarative, deterministic, and side-effect free. This repository provides immutable organizational truth manifests - it does NOT execute, simulate, or plan.

---

## 1. Manifest Loading Flow

```
ALGORITHM: LoadManifest
INPUT: manifest_id (string), version (string or null)
OUTPUT: ImmutableManifest or ManifestError

CONSTANTS:
    MANIFEST_REGISTRY_PATH = "/registry/manifests.json"
    MANIFEST_STORAGE_PATH = "/manifests"
    LATEST_VERSION_MARKER = "latest"

DATA STRUCTURES:
    ManifestReference:
        id: string              // Unique manifest identifier
        path: string            // Relative file path from storage root
        versions: List<string>  // Ordered list of version identifiers
        schema_version: string  // Schema version for this manifest type

    ImmutableManifest:
        id: string              // Manifest identifier
        version: string         // Specific version loaded
        schema_version: string  // Schema version used
        content: FrozenObject   // Immutable content - cannot be modified
        hash: string            // Content-addressable hash
        lineage: List<string>   // Chain of parent version hashes

BEGIN
    // Step 1: Resolve manifest reference from registry
    // Registry is the single source of truth for manifest locations
    registry ← ReadRegistryFile(MANIFEST_REGISTRY_PATH)

    IF registry is null THEN
        RETURN ManifestError("REGISTRY_NOT_FOUND",
            "Manifest registry does not exist at expected path")
    END IF

    manifest_ref ← registry.manifests.find(m => m.id == manifest_id)

    IF manifest_ref is null THEN
        RETURN ManifestError("MANIFEST_NOT_REGISTERED",
            "Manifest ID not found in registry: " + manifest_id)
    END IF

    // Step 2: Resolve version to specific version identifier
    // Version resolution is deterministic - no "current" or relative versions
    resolved_version ← ResolveVersion(manifest_ref, version)

    IF resolved_version is Error THEN
        RETURN resolved_version
    END IF

    // Step 3: Construct deterministic file path
    // Path format: /manifests/{manifest_id}/{version}.json
    file_path ← MANIFEST_STORAGE_PATH + "/" +
                manifest_id + "/" +
                resolved_version + ".json"

    // Step 4: Load raw manifest content
    raw_content ← ReadManifestFile(file_path)

    IF raw_content is null THEN
        RETURN ManifestError("MANIFEST_FILE_NOT_FOUND",
            "Manifest file does not exist: " + file_path)
    END IF

    // Step 5: Parse and validate JSON structure
    parsed_content ← ParseJSON(raw_content)

    IF parsed_content is Error THEN
        RETURN ManifestError("MANIFEST_PARSE_ERROR",
            "Invalid JSON in manifest file: " + parsed_content.message)
    END IF

    // Step 6: Detect and validate schema version
    schema_version ← DetectSchemaVersion(parsed_content, manifest_ref)

    IF schema_version is Error THEN
        RETURN schema_version
    END IF

    // Step 7: Compute content hash for integrity verification
    computed_hash ← ComputeContentHash(parsed_content)

    IF manifest_ref.expected_hash is not null THEN
        IF computed_hash != manifest_ref.expected_hash THEN
            RETURN ManifestError("MANIFEST_INTEGRITY_VIOLATION",
                "Content hash mismatch - manifest may be corrupted")
        END IF
    END IF

    // Step 8: Extract lineage information
    lineage ← ExtractLineage(parsed_content)

    // Step 9: Freeze content to ensure immutability
    // Once frozen, no modifications are possible
    frozen_content ← DeepFreeze(parsed_content)

    // Step 10: Construct and return immutable manifest object
    RETURN ImmutableManifest {
        id: manifest_id,
        version: resolved_version,
        schema_version: schema_version,
        content: frozen_content,
        hash: computed_hash,
        lineage: lineage
    }
END


SUBROUTINE: ResolveVersion
INPUT: manifest_ref (ManifestReference), version (string or null)
OUTPUT: string or ManifestError

BEGIN
    // Null version resolves to latest registered version
    IF version is null OR version == LATEST_VERSION_MARKER THEN
        IF manifest_ref.versions.isEmpty() THEN
            RETURN ManifestError("NO_VERSIONS_AVAILABLE",
                "Manifest has no registered versions")
        END IF
        // Latest is the last entry in the ordered versions list
        RETURN manifest_ref.versions.last()
    END IF

    // Explicit version must exist in registry
    IF version NOT IN manifest_ref.versions THEN
        RETURN ManifestError("VERSION_NOT_FOUND",
            "Version not registered: " + version +
            ". Available: " + manifest_ref.versions.join(", "))
    END IF

    RETURN version
END


SUBROUTINE: DetectSchemaVersion
INPUT: parsed_content (Object), manifest_ref (ManifestReference)
OUTPUT: string or ManifestError

BEGIN
    // Schema version can be explicit in content or inherited from reference
    IF parsed_content.hasKey("$schema_version") THEN
        content_schema ← parsed_content["$schema_version"]

        // Validate schema version format
        IF NOT IsValidSchemaVersion(content_schema) THEN
            RETURN ManifestError("INVALID_SCHEMA_VERSION",
                "Schema version format invalid: " + content_schema)
        END IF

        RETURN content_schema
    END IF

    // Fall back to manifest reference schema version
    IF manifest_ref.schema_version is not null THEN
        RETURN manifest_ref.schema_version
    END IF

    // No schema version - use default
    RETURN "1.0.0"
END


SUBROUTINE: DeepFreeze
INPUT: obj (any)
OUTPUT: FrozenObject

// Recursively freezes object to prevent any modifications
// This is a pure function - no side effects

BEGIN
    IF obj is null OR obj is primitive THEN
        RETURN obj
    END IF

    IF obj is Array THEN
        frozen_array ← []
        FOR EACH item IN obj DO
            frozen_array.append(DeepFreeze(item))
        END FOR
        RETURN Freeze(frozen_array)
    END IF

    IF obj is Object THEN
        frozen_obj ← {}
        FOR EACH key, value IN obj DO
            frozen_obj[key] ← DeepFreeze(value)
        END FOR
        RETURN Freeze(frozen_obj)
    END IF

    RETURN obj
END
```

### Complexity Analysis: LoadManifest

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Registry lookup | O(n) where n = manifest count | O(1) |
| Version resolution | O(v) where v = version count | O(1) |
| File read | O(m) where m = file size | O(m) |
| JSON parse | O(m) | O(m) |
| Content hash | O(m) | O(1) |
| Deep freeze | O(k) where k = total keys | O(k) |
| **Total** | **O(n + v + m + k)** | **O(m + k)** |

---

## 2. Manifest Validation Flow

```
ALGORITHM: ValidateManifest
INPUT: manifest_data (Object), schema_version (string)
OUTPUT: ValidationResult

DATA STRUCTURES:
    ValidationResult:
        valid: boolean
        errors: List<ValidationError>
        warnings: List<ValidationWarning>

    ValidationError:
        code: string            // Error code for programmatic handling
        path: string            // JSON path to error location
        message: string         // Human-readable description
        severity: "error"       // Always error for ValidationError

    ValidationWarning:
        code: string
        path: string
        message: string
        severity: "warning"

    SchemaRule:
        path: string            // JSON path pattern
        type: string            // Expected type
        required: boolean       // Whether field is required
        constraints: Object     // Additional validation constraints

CONSTANTS:
    // Forbidden patterns - these indicate non-deterministic content
    FORBIDDEN_PATTERNS = [
        // Natural language inference markers
        /\b(probably|likely|maybe|perhaps|might|could be)\b/i,
        // AI/ML inference markers
        /\b(inferred|predicted|estimated|approximated)\b/i,
        // Non-deterministic markers
        /\b(random|uuid|timestamp|now|current)\b/i,
        // Execution markers (this repo doesn't execute)
        /\b(execute|run|simulate|plan|decide)\b/i
    ]

    // Required metadata fields for all manifests
    REQUIRED_METADATA = [
        "$id",
        "$schema_version",
        "$created_at",      // ISO 8601 format, set at creation only
        "$content_hash"     // Self-referential integrity hash
    ]

BEGIN
    errors ← []
    warnings ← []

    // Phase 1: Load schema for version
    schema ← LoadSchema(schema_version)

    IF schema is Error THEN
        errors.append(ValidationError {
            code: "SCHEMA_NOT_FOUND",
            path: "$",
            message: "Schema version not available: " + schema_version
        })
        RETURN ValidationResult { valid: false, errors: errors, warnings: [] }
    END IF

    // Phase 2: Structural JSON Schema validation
    schema_errors ← ValidateAgainstJSONSchema(manifest_data, schema)

    FOR EACH error IN schema_errors DO
        errors.append(ValidationError {
            code: "SCHEMA_VIOLATION",
            path: error.path,
            message: error.message
        })
    END FOR

    // Phase 3: Required field validation
    required_errors ← ValidateRequiredFields(manifest_data, schema)
    errors.extend(required_errors)

    // Phase 4: Referential integrity validation
    ref_errors ← ValidateReferentialIntegrity(manifest_data)
    errors.extend(ref_errors)

    // Phase 5: Forbidden pattern detection
    forbidden_errors ← DetectForbiddenPatterns(manifest_data, "$")
    errors.extend(forbidden_errors)

    // Phase 6: Type-specific validation
    type_errors ← ValidateManifestType(manifest_data, schema)
    errors.extend(type_errors)

    // Phase 7: Immutability constraint validation
    immutability_errors ← ValidateImmutabilityConstraints(manifest_data)
    errors.extend(immutability_errors)

    // Compile final result
    RETURN ValidationResult {
        valid: errors.isEmpty(),
        errors: errors,
        warnings: warnings
    }
END


SUBROUTINE: ValidateRequiredFields
INPUT: manifest_data (Object), schema (Schema)
OUTPUT: List<ValidationError>

BEGIN
    errors ← []

    // Check metadata fields
    FOR EACH field IN REQUIRED_METADATA DO
        IF NOT manifest_data.hasKey(field) THEN
            errors.append(ValidationError {
                code: "REQUIRED_FIELD_MISSING",
                path: "$." + field,
                message: "Required metadata field missing: " + field
            })
        END IF
    END FOR

    // Check schema-defined required fields
    FOR EACH rule IN schema.rules DO
        IF rule.required THEN
            value ← GetValueAtPath(manifest_data, rule.path)

            IF value is undefined THEN
                errors.append(ValidationError {
                    code: "REQUIRED_FIELD_MISSING",
                    path: rule.path,
                    message: "Required field missing per schema: " + rule.path
                })
            END IF
        END IF
    END FOR

    RETURN errors
END


SUBROUTINE: ValidateReferentialIntegrity
INPUT: manifest_data (Object)
OUTPUT: List<ValidationError>

// Validates that all internal references point to existing paths
// and all external references use valid manifest IDs

BEGIN
    errors ← []
    references ← ExtractAllReferences(manifest_data)

    FOR EACH ref IN references DO
        IF ref.type == "internal" THEN
            // Internal reference: points to path within same manifest
            target ← GetValueAtPath(manifest_data, ref.target_path)

            IF target is undefined THEN
                errors.append(ValidationError {
                    code: "BROKEN_INTERNAL_REFERENCE",
                    path: ref.source_path,
                    message: "Internal reference points to non-existent path: " +
                             ref.target_path
                })
            END IF

        ELSE IF ref.type == "external" THEN
            // External reference: points to another manifest
            // Validate format only - actual resolution happens at runtime
            IF NOT IsValidManifestReference(ref.target) THEN
                errors.append(ValidationError {
                    code: "INVALID_EXTERNAL_REFERENCE",
                    path: ref.source_path,
                    message: "External reference format invalid: " + ref.target
                })
            END IF
        END IF
    END FOR

    RETURN errors
END


SUBROUTINE: DetectForbiddenPatterns
INPUT: data (any), path (string)
OUTPUT: List<ValidationError>

// Recursively scans all string values for forbidden patterns
// These patterns indicate non-deterministic or inference-based content

BEGIN
    errors ← []

    IF data is String THEN
        FOR EACH pattern IN FORBIDDEN_PATTERNS DO
            IF pattern.test(data) THEN
                errors.append(ValidationError {
                    code: "FORBIDDEN_PATTERN_DETECTED",
                    path: path,
                    message: "Forbidden pattern found: content contains " +
                             "non-deterministic or inference markers"
                })
            END IF
        END FOR

    ELSE IF data is Array THEN
        FOR index, item IN enumerate(data) DO
            item_path ← path + "[" + index + "]"
            errors.extend(DetectForbiddenPatterns(item, item_path))
        END FOR

    ELSE IF data is Object THEN
        FOR EACH key, value IN data DO
            field_path ← path + "." + key
            errors.extend(DetectForbiddenPatterns(value, field_path))
        END FOR
    END IF

    RETURN errors
END


SUBROUTINE: ValidateImmutabilityConstraints
INPUT: manifest_data (Object)
OUTPUT: List<ValidationError>

// Validates that manifest adheres to immutability requirements

BEGIN
    errors ← []

    // Check for mutable field markers
    IF manifest_data.hasKey("$mutable_fields") THEN
        errors.append(ValidationError {
            code: "IMMUTABILITY_VIOLATION",
            path: "$.$mutable_fields",
            message: "Manifests cannot declare mutable fields - all content is immutable"
        })
    END IF

    // Check for timestamp fields that suggest runtime mutation
    forbidden_timestamp_fields ← ["updated_at", "last_modified", "modified_at"]

    FOR EACH field IN forbidden_timestamp_fields DO
        IF manifest_data.hasKey(field) THEN
            errors.append(ValidationError {
                code: "IMMUTABILITY_VIOLATION",
                path: "$." + field,
                message: "Field '" + field + "' suggests mutability - " +
                         "use versioning instead of in-place updates"
            })
        END IF
    END FOR

    RETURN errors
END
```

### Complexity Analysis: ValidateManifest

| Phase | Time Complexity | Space Complexity |
|-------|----------------|------------------|
| Schema validation | O(n * r) where n = nodes, r = rules | O(e) errors |
| Required fields | O(f) where f = field count | O(e) |
| Referential integrity | O(ref) where ref = reference count | O(e) |
| Forbidden patterns | O(n * p * s) where p = patterns, s = string length | O(e) |
| **Total** | **O(n * r + n * p * s)** | **O(e)** |

---

## 3. Manifest Versioning Flow

```
ALGORITHM: VersionManifest
INPUT: manifest_data (Object), parent_version (string or null)
OUTPUT: VersionedManifest or VersioningError

DATA STRUCTURES:
    VersionedManifest:
        version_id: string          // Content-addressable version identifier
        content_hash: string        // SHA-256 of canonical content
        parent_hash: string or null // Hash of parent version
        lineage_chain: List<string> // Complete ancestry
        creation_timestamp: string  // ISO 8601 - set once, never changes
        canonical_content: Object   // Normalized, deterministic content

CONSTANTS:
    HASH_ALGORITHM = "SHA-256"
    VERSION_PREFIX = "v"
    HASH_ENCODING = "hex"

BEGIN
    // Step 1: Validate manifest before versioning
    validation ← ValidateManifest(manifest_data, manifest_data["$schema_version"])

    IF NOT validation.valid THEN
        RETURN VersioningError("VALIDATION_FAILED",
            "Cannot version invalid manifest: " +
            validation.errors.map(e => e.message).join("; "))
    END IF

    // Step 2: Canonicalize content for deterministic hashing
    // This ensures same logical content always produces same hash
    canonical_content ← CanonicializeContent(manifest_data)

    // Step 3: Compute content-addressable hash
    content_hash ← ComputeContentHash(canonical_content)

    // Step 4: Resolve parent version if specified
    parent_hash ← null
    lineage_chain ← []

    IF parent_version is not null THEN
        parent_manifest ← LoadManifest(manifest_data["$id"], parent_version)

        IF parent_manifest is Error THEN
            RETURN VersioningError("PARENT_NOT_FOUND",
                "Parent version does not exist: " + parent_version)
        END IF

        parent_hash ← parent_manifest.hash
        lineage_chain ← parent_manifest.lineage.copy()
        lineage_chain.append(parent_hash)

        // Step 5: Verify content differs from parent
        IF content_hash == parent_hash THEN
            RETURN VersioningError("DUPLICATE_CONTENT",
                "New version has identical content to parent - " +
                "no new version needed")
        END IF
    END IF

    // Step 6: Generate version identifier
    // Format: v{short_hash}_{sequence_number}
    version_id ← GenerateVersionId(content_hash, lineage_chain)

    // Step 7: Embed version metadata into content
    versioned_content ← canonical_content.copy()
    versioned_content["$version_id"] ← version_id
    versioned_content["$content_hash"] ← content_hash
    versioned_content["$parent_hash"] ← parent_hash
    versioned_content["$lineage"] ← lineage_chain
    versioned_content["$created_at"] ← GetCreationTimestamp(manifest_data)

    // Step 8: Recompute hash with embedded metadata
    // This creates a self-referential integrity check
    final_hash ← ComputeContentHash(versioned_content)
    versioned_content["$final_hash"] ← final_hash

    // Step 9: Construct versioned manifest
    RETURN VersionedManifest {
        version_id: version_id,
        content_hash: final_hash,
        parent_hash: parent_hash,
        lineage_chain: lineage_chain,
        creation_timestamp: versioned_content["$created_at"],
        canonical_content: DeepFreeze(versioned_content)
    }
END


SUBROUTINE: CanonicializeContent
INPUT: content (Object)
OUTPUT: Object

// Produces deterministic canonical form of content
// Ensures same logical content always serializes identically

BEGIN
    // Step 1: Remove non-canonical metadata
    canonical ← RemoveNonCanonicalFields(content)

    // Step 2: Sort all object keys alphabetically (recursive)
    canonical ← SortKeysRecursively(canonical)

    // Step 3: Normalize whitespace in strings
    canonical ← NormalizeStrings(canonical)

    // Step 4: Normalize number representations
    canonical ← NormalizeNumbers(canonical)

    // Step 5: Remove null/undefined values
    canonical ← RemoveNullValues(canonical)

    RETURN canonical
END


SUBROUTINE: SortKeysRecursively
INPUT: obj (any)
OUTPUT: any

BEGIN
    IF obj is null OR obj is primitive THEN
        RETURN obj
    END IF

    IF obj is Array THEN
        sorted_array ← []
        FOR EACH item IN obj DO
            sorted_array.append(SortKeysRecursively(item))
        END FOR
        RETURN sorted_array
    END IF

    IF obj is Object THEN
        sorted_obj ← OrderedMap()  // Preserves insertion order
        sorted_keys ← obj.keys().sort()  // Alphabetical sort

        FOR EACH key IN sorted_keys DO
            sorted_obj[key] ← SortKeysRecursively(obj[key])
        END FOR

        RETURN sorted_obj
    END IF

    RETURN obj
END


SUBROUTINE: ComputeContentHash
INPUT: content (Object)
OUTPUT: string

// Computes SHA-256 hash of canonicalized JSON content

BEGIN
    // Serialize to deterministic JSON
    // No whitespace, sorted keys, UTF-8 encoding
    json_string ← JSON.stringify(content, {
        sortKeys: true,
        indent: null,
        encoding: "UTF-8"
    })

    // Compute hash
    hash_bytes ← SHA256(json_string.toBytes("UTF-8"))

    // Encode as lowercase hexadecimal
    RETURN hash_bytes.toHex().toLowerCase()
END


SUBROUTINE: GenerateVersionId
INPUT: content_hash (string), lineage_chain (List<string>)
OUTPUT: string

// Generates human-readable version identifier
// Format: v{short_hash}_{sequence}

BEGIN
    // Use first 8 characters of hash for readability
    short_hash ← content_hash.substring(0, 8)

    // Sequence number is lineage length + 1
    sequence ← lineage_chain.length() + 1

    // Pad sequence to 4 digits for sorting
    padded_sequence ← sequence.toString().padStart(4, "0")

    RETURN VERSION_PREFIX + short_hash + "_" + padded_sequence
END


SUBROUTINE: GetCreationTimestamp
INPUT: manifest_data (Object)
OUTPUT: string

// Returns creation timestamp - uses existing if present, otherwise current time
// This is the ONLY place external time enters the system

BEGIN
    IF manifest_data.hasKey("$created_at") THEN
        // Preserve original creation time
        RETURN manifest_data["$created_at"]
    END IF

    // New manifest - record creation time
    // This is a controlled exception to pure determinism
    // The timestamp becomes part of the immutable record
    RETURN ISO8601.format(SystemTime.now(), "UTC")
END
```

### Lineage Chain Integrity

```
ALGORITHM: VerifyLineageChain
INPUT: manifest (ImmutableManifest)
OUTPUT: LineageVerificationResult

DATA STRUCTURES:
    LineageVerificationResult:
        valid: boolean
        chain_length: integer
        breaks: List<LineageBreak>  // Empty if valid

BEGIN
    IF manifest.lineage.isEmpty() THEN
        // Root manifest - no lineage to verify
        RETURN LineageVerificationResult { valid: true, chain_length: 0, breaks: [] }
    END IF

    breaks ← []
    previous_hash ← null

    FOR index, hash IN enumerate(manifest.lineage) DO
        // Load each ancestor
        ancestor ← LoadManifestByHash(manifest.id, hash)

        IF ancestor is Error THEN
            breaks.append(LineageBreak {
                position: index,
                expected_hash: hash,
                error: "Ancestor not found"
            })
            CONTINUE
        END IF

        // Verify hash matches content
        computed_hash ← ComputeContentHash(ancestor.content)
        IF computed_hash != hash THEN
            breaks.append(LineageBreak {
                position: index,
                expected_hash: hash,
                actual_hash: computed_hash,
                error: "Hash mismatch"
            })
        END IF

        // Verify chain continuity
        IF previous_hash is not null THEN
            IF ancestor.parent_hash != previous_hash THEN
                breaks.append(LineageBreak {
                    position: index,
                    error: "Chain discontinuity - parent hash mismatch"
                })
            END IF
        END IF

        previous_hash ← hash
    END FOR

    RETURN LineageVerificationResult {
        valid: breaks.isEmpty(),
        chain_length: manifest.lineage.length(),
        breaks: breaks
    }
END
```

### Complexity Analysis: VersionManifest

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Validation | O(n * r) | O(e) |
| Canonicalization | O(n log n) for key sorting | O(n) |
| Content hash | O(n) | O(1) |
| Parent resolution | O(log v) with index | O(1) |
| Version ID generation | O(1) | O(1) |
| **Total** | **O(n * r + n log n)** | **O(n + e)** |

---

## 4. Manifest Reference Resolution

```
ALGORITHM: ResolveReference
INPUT: reference_path (string), manifest_context (ImmutableManifest)
OUTPUT: ResolvedValue or ReferenceError

DATA STRUCTURES:
    ResolvedValue:
        value: any              // The resolved value
        source_manifest: string // ID of manifest containing value
        source_version: string  // Version of source manifest
        resolution_path: string // Full path to resolved value

    ReferenceError:
        code: string
        reference: string
        message: string

CONSTANTS:
    // Reference path formats
    INTERNAL_REF_PREFIX = "#/"              // #/path/to/value
    EXTERNAL_REF_PREFIX = "manifest://"     // manifest://id@version/path

    // Path separators
    PATH_SEPARATOR = "/"
    VERSION_SEPARATOR = "@"

BEGIN
    // Step 1: Determine reference type
    ref_type ← DetermineReferenceType(reference_path)

    IF ref_type == "internal" THEN
        RETURN ResolveInternalReference(reference_path, manifest_context)

    ELSE IF ref_type == "external" THEN
        RETURN ResolveExternalReference(reference_path, manifest_context)

    ELSE
        RETURN ReferenceError {
            code: "INVALID_REFERENCE_FORMAT",
            reference: reference_path,
            message: "Reference must start with '#/' for internal or " +
                     "'manifest://' for external references"
        }
    END IF
END


SUBROUTINE: ResolveInternalReference
INPUT: reference_path (string), context (ImmutableManifest)
OUTPUT: ResolvedValue or ReferenceError

// Resolves reference within the same manifest
// Path format: #/path/to/value

BEGIN
    // Step 1: Strip prefix and parse path
    path_without_prefix ← reference_path.substring(2)  // Remove "#/"
    path_segments ← path_without_prefix.split(PATH_SEPARATOR)

    // Step 2: Traverse path deterministically
    current_value ← context.content
    traversed_path ← []

    FOR EACH segment IN path_segments DO
        // Skip empty segments
        IF segment.isEmpty() THEN
            CONTINUE
        END IF

        // Handle array index notation
        IF IsArrayIndex(segment) THEN
            index ← ParseArrayIndex(segment)

            IF current_value is not Array THEN
                RETURN ReferenceError {
                    code: "PATH_TYPE_MISMATCH",
                    reference: reference_path,
                    message: "Expected array at '" + traversed_path.join("/") +
                             "' but found " + typeof(current_value)
                }
            END IF

            IF index >= current_value.length() THEN
                RETURN ReferenceError {
                    code: "ARRAY_INDEX_OUT_OF_BOUNDS",
                    reference: reference_path,
                    message: "Array index " + index + " exceeds length " +
                             current_value.length()
                }
            END IF

            current_value ← current_value[index]

        ELSE
            // Object property access
            IF current_value is not Object THEN
                RETURN ReferenceError {
                    code: "PATH_TYPE_MISMATCH",
                    reference: reference_path,
                    message: "Expected object at '" + traversed_path.join("/") +
                             "' but found " + typeof(current_value)
                }
            END IF

            IF NOT current_value.hasKey(segment) THEN
                RETURN ReferenceError {
                    code: "PATH_NOT_FOUND",
                    reference: reference_path,
                    message: "Property '" + segment + "' not found at path '" +
                             traversed_path.join("/") + "'"
                }
            END IF

            current_value ← current_value[segment]
        END IF

        traversed_path.append(segment)
    END FOR

    // Step 3: Return resolved value with full provenance
    RETURN ResolvedValue {
        value: DeepFreeze(current_value),
        source_manifest: context.id,
        source_version: context.version,
        resolution_path: reference_path
    }
END


SUBROUTINE: ResolveExternalReference
INPUT: reference_path (string), context (ImmutableManifest)
OUTPUT: ResolvedValue or ReferenceError

// Resolves reference to another manifest
// Path format: manifest://manifest_id@version/path/to/value

BEGIN
    // Step 1: Parse external reference
    parsed ← ParseExternalReference(reference_path)

    IF parsed is Error THEN
        RETURN parsed
    END IF

    // Step 2: Load referenced manifest
    // Version is REQUIRED for external references to ensure determinism
    IF parsed.version is null THEN
        RETURN ReferenceError {
            code: "VERSION_REQUIRED",
            reference: reference_path,
            message: "External references must specify version for determinism. " +
                     "Use format: manifest://id@version/path"
        }
    END IF

    target_manifest ← LoadManifest(parsed.manifest_id, parsed.version)

    IF target_manifest is Error THEN
        RETURN ReferenceError {
            code: "EXTERNAL_MANIFEST_NOT_FOUND",
            reference: reference_path,
            message: "Referenced manifest not found: " + parsed.manifest_id +
                     "@" + parsed.version
        }
    END IF

    // Step 3: Resolve path within target manifest
    internal_ref ← "#/" + parsed.path
    resolution ← ResolveInternalReference(internal_ref, target_manifest)

    IF resolution is Error THEN
        // Enhance error with external context
        RETURN ReferenceError {
            code: resolution.code,
            reference: reference_path,
            message: "Error resolving path in external manifest: " +
                     resolution.message
        }
    END IF

    // Step 4: Return with full provenance
    RETURN ResolvedValue {
        value: resolution.value,
        source_manifest: parsed.manifest_id,
        source_version: parsed.version,
        resolution_path: reference_path
    }
END


SUBROUTINE: ParseExternalReference
INPUT: reference_path (string)
OUTPUT: ParsedExternalRef or ReferenceError

DATA STRUCTURES:
    ParsedExternalRef:
        manifest_id: string
        version: string or null
        path: string

BEGIN
    // Remove prefix
    path_without_prefix ← reference_path.substring(11)  // Remove "manifest://"

    // Split manifest identifier from path
    first_slash_index ← path_without_prefix.indexOf("/")

    IF first_slash_index == -1 THEN
        manifest_part ← path_without_prefix
        value_path ← ""
    ELSE
        manifest_part ← path_without_prefix.substring(0, first_slash_index)
        value_path ← path_without_prefix.substring(first_slash_index + 1)
    END IF

    // Parse version from manifest identifier
    version_index ← manifest_part.indexOf(VERSION_SEPARATOR)

    IF version_index == -1 THEN
        manifest_id ← manifest_part
        version ← null
    ELSE
        manifest_id ← manifest_part.substring(0, version_index)
        version ← manifest_part.substring(version_index + 1)
    END IF

    // Validate manifest ID format
    IF NOT IsValidManifestId(manifest_id) THEN
        RETURN ReferenceError {
            code: "INVALID_MANIFEST_ID",
            reference: reference_path,
            message: "Invalid manifest ID format: " + manifest_id
        }
    END IF

    RETURN ParsedExternalRef {
        manifest_id: manifest_id,
        version: version,
        path: value_path
    }
END


SUBROUTINE: DetermineReferenceType
INPUT: reference_path (string)
OUTPUT: string

BEGIN
    IF reference_path.startsWith(INTERNAL_REF_PREFIX) THEN
        RETURN "internal"
    ELSE IF reference_path.startsWith(EXTERNAL_REF_PREFIX) THEN
        RETURN "external"
    ELSE
        RETURN "unknown"
    END IF
END
```

### Reference Resolution Examples

```
EXAMPLES:

1. Internal Reference:
   Input:  "#/organization/departments/0/name"
   Context: { organization: { departments: [{ name: "Engineering" }] } }
   Output: ResolvedValue { value: "Engineering", ... }

2. External Reference:
   Input:  "manifest://org-structure@v1.2.0/teams/backend"
   Action: Loads org-structure manifest version v1.2.0
   Then:   Resolves path "teams/backend" within that manifest
   Output: ResolvedValue { value: {...}, source_manifest: "org-structure", ... }

3. Error Case - Missing Path:
   Input:  "#/nonexistent/path"
   Output: ReferenceError { code: "PATH_NOT_FOUND", ... }

4. Error Case - No Version:
   Input:  "manifest://other-manifest/some/path"
   Output: ReferenceError { code: "VERSION_REQUIRED", ... }
```

### Complexity Analysis: ResolveReference

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Reference type detection | O(1) | O(1) |
| Path parsing | O(p) where p = path length | O(s) segments |
| Path traversal | O(s) where s = segment count | O(1) |
| External manifest load | O(log v + m) | O(m) |
| **Total (internal)** | **O(p + s)** | **O(s)** |
| **Total (external)** | **O(p + s + log v + m)** | **O(s + m)** |

---

## 5. Manifest Selection by Downstream Systems

```
ALGORITHM: SelectManifestForSimulation
INPUT: criteria (SelectionCriteria)
OUTPUT: SelectedManifest or SelectionError

// NOTE: This repository provides the selection API
// The actual selection logic is owned by agentics-simulation-planner
// This pseudocode defines the CONTRACT, not the implementation

DATA STRUCTURES:
    SelectionCriteria:
        manifest_type: string           // Required: type of manifest needed
        version_constraint: string      // Required: exact version or constraint
        required_fields: List<string>   // Optional: fields that must exist
        filters: Map<string, any>       // Optional: field value filters

    SelectedManifest:
        manifest: ImmutableManifest     // The selected manifest
        selection_reason: string        // Why this manifest was selected
        alternatives: List<string>      // Other matching manifest versions

    SelectionError:
        code: string
        criteria: SelectionCriteria
        message: string

CONSTANTS:
    // Version constraint formats
    EXACT_VERSION = /^v[a-f0-9]{8}_\d{4}$/       // Exact version
    SEMVER_RANGE = /^[\^~]?\d+\.\d+\.\d+$/       // Semantic version range
    LATEST_MARKER = "latest"

BEGIN
    // Step 1: Validate selection criteria
    validation ← ValidateSelectionCriteria(criteria)

    IF NOT validation.valid THEN
        RETURN SelectionError {
            code: "INVALID_CRITERIA",
            criteria: criteria,
            message: validation.errors.join("; ")
        }
    END IF

    // Step 2: Query manifest registry for matching manifests
    candidates ← QueryManifestRegistry({
        type: criteria.manifest_type,
        version: criteria.version_constraint
    })

    IF candidates.isEmpty() THEN
        RETURN SelectionError {
            code: "NO_MATCHING_MANIFESTS",
            criteria: criteria,
            message: "No manifests match type '" + criteria.manifest_type +
                     "' with version constraint '" + criteria.version_constraint + "'"
        }
    END IF

    // Step 3: Filter by required fields
    IF criteria.required_fields is not empty THEN
        candidates ← FilterByRequiredFields(candidates, criteria.required_fields)

        IF candidates.isEmpty() THEN
            RETURN SelectionError {
                code: "REQUIRED_FIELDS_NOT_FOUND",
                criteria: criteria,
                message: "No manifests contain all required fields: " +
                         criteria.required_fields.join(", ")
            }
        END IF
    END IF

    // Step 4: Apply value filters
    IF criteria.filters is not empty THEN
        candidates ← ApplyValueFilters(candidates, criteria.filters)

        IF candidates.isEmpty() THEN
            RETURN SelectionError {
                code: "FILTERS_NOT_SATISFIED",
                criteria: criteria,
                message: "No manifests satisfy all filter criteria"
            }
        END IF
    END IF

    // Step 5: Select best match (deterministic selection)
    // Selection is DETERMINISTIC - same criteria always selects same manifest
    selected ← SelectBestMatch(candidates, criteria)

    // Step 6: Load full manifest
    manifest ← LoadManifest(selected.id, selected.version)

    IF manifest is Error THEN
        RETURN SelectionError {
            code: "MANIFEST_LOAD_FAILED",
            criteria: criteria,
            message: "Failed to load selected manifest: " + manifest.message
        }
    END IF

    // Step 7: Verify immutability guarantee
    // The manifest content MUST NOT change during or after selection
    hash_before ← manifest.hash

    // Re-compute hash to verify integrity
    hash_verification ← ComputeContentHash(manifest.content)

    IF hash_before != hash_verification THEN
        RETURN SelectionError {
            code: "IMMUTABILITY_VIOLATION",
            criteria: criteria,
            message: "Manifest content changed during selection - " +
                     "this should never happen"
        }
    END IF

    // Step 8: Return selected manifest with metadata
    RETURN SelectedManifest {
        manifest: manifest,
        selection_reason: GenerateSelectionReason(criteria, selected),
        alternatives: candidates.filter(c => c.id != selected.id)
                               .map(c => c.id + "@" + c.version)
    }
END


SUBROUTINE: QueryManifestRegistry
INPUT: query (RegistryQuery)
OUTPUT: List<ManifestReference>

// Queries the manifest registry for matching manifests
// This is a pure query - no side effects

BEGIN
    registry ← ReadRegistryFile(MANIFEST_REGISTRY_PATH)
    results ← []

    FOR EACH manifest_ref IN registry.manifests DO
        // Match by type
        IF manifest_ref.type != query.type THEN
            CONTINUE
        END IF

        // Match by version constraint
        matching_versions ← FilterVersionsByConstraint(
            manifest_ref.versions,
            query.version
        )

        FOR EACH version IN matching_versions DO
            results.append({
                id: manifest_ref.id,
                version: version,
                type: manifest_ref.type,
                schema_version: manifest_ref.schema_version
            })
        END FOR
    END FOR

    // Sort results deterministically for consistent selection
    results.sort((a, b) => {
        // Primary: version (newest first)
        version_cmp ← CompareVersions(b.version, a.version)
        IF version_cmp != 0 THEN RETURN version_cmp END IF

        // Secondary: manifest ID (alphabetical)
        RETURN a.id.localeCompare(b.id)
    })

    RETURN results
END


SUBROUTINE: FilterVersionsByConstraint
INPUT: versions (List<string>), constraint (string)
OUTPUT: List<string>

BEGIN
    IF constraint == LATEST_MARKER THEN
        // Return only the latest version
        IF versions.isEmpty() THEN
            RETURN []
        END IF
        RETURN [versions.last()]
    END IF

    IF EXACT_VERSION.test(constraint) THEN
        // Exact version match
        IF constraint IN versions THEN
            RETURN [constraint]
        END IF
        RETURN []
    END IF

    IF SEMVER_RANGE.test(constraint) THEN
        // Semantic version range matching
        matching ← []
        FOR EACH version IN versions DO
            IF SemverSatisfies(version, constraint) THEN
                matching.append(version)
            END IF
        END FOR
        RETURN matching
    END IF

    // Unknown constraint format - no matches
    RETURN []
END


SUBROUTINE: SelectBestMatch
INPUT: candidates (List<ManifestReference>), criteria (SelectionCriteria)
OUTPUT: ManifestReference

// Deterministic selection from candidates
// Same inputs ALWAYS produce same output

BEGIN
    // Candidates are already sorted by QueryManifestRegistry
    // Selection is simply the first (highest priority) candidate
    RETURN candidates[0]
END
```

### Selection Contract for Downstream Systems

```
INTERFACE: ManifestSelectionAPI

// This interface defines the contract between this repository
// and downstream systems like agentics-simulation-planner

METHODS:

    // Query available manifest types
    listManifestTypes() -> List<ManifestType>

    // Query versions for a manifest
    listVersions(manifest_id: string) -> List<VersionInfo>

    // Select manifest by criteria
    selectManifest(criteria: SelectionCriteria) -> SelectedManifest

    // Load specific manifest (pinned version)
    loadManifest(manifest_id: string, version: string) -> ImmutableManifest

    // Validate manifest exists and is valid
    validateManifest(manifest_id: string, version: string) -> ValidationResult

GUARANTEES:

    1. DETERMINISM
       - Same criteria always selects same manifest
       - No randomness in selection logic
       - No time-dependent selection

    2. IMMUTABILITY
       - Selected manifest content never changes
       - Version pinning is absolute
       - No in-place updates

    3. REPRODUCIBILITY
       - Selection can be replayed with identical results
       - Audit trail of all selections
       - Content-addressable verification
```

### Complexity Analysis: SelectManifestForSimulation

| Operation | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Criteria validation | O(f) where f = field count | O(1) |
| Registry query | O(n * v) manifests * versions | O(c) candidates |
| Required field filter | O(c * r) candidates * required | O(c) |
| Value filter | O(c * k) candidates * filters | O(c) |
| Best match selection | O(1) - already sorted | O(1) |
| Manifest load | O(m) manifest size | O(m) |
| **Total** | **O(n * v + c * (r + k) + m)** | **O(c + m)** |

---

## 6. Determinism Guarantees

```
ALGORITHM: VerifyDeterminism
INPUT: operation (Function), inputs (List<any>), expected_output (any)
OUTPUT: DeterminismVerification

// This meta-algorithm verifies that any operation in this system
// is truly deterministic

DATA STRUCTURES:
    DeterminismVerification:
        is_deterministic: boolean
        iterations_tested: integer
        failures: List<DeterminismFailure>

    DeterminismFailure:
        iteration: integer
        expected: any
        actual: any
        diff: string

CONSTANTS:
    VERIFICATION_ITERATIONS = 100
    MAX_FAILURES_TO_RECORD = 10

BEGIN
    failures ← []

    // Run operation multiple times with identical inputs
    FOR i FROM 1 TO VERIFICATION_ITERATIONS DO
        // Create fresh copy of inputs to ensure no mutation
        input_copy ← DeepCopy(inputs)

        // Execute operation
        actual_output ← operation(input_copy...)

        // Compare outputs
        IF NOT DeepEquals(actual_output, expected_output) THEN
            IF failures.length() < MAX_FAILURES_TO_RECORD THEN
                failures.append(DeterminismFailure {
                    iteration: i,
                    expected: expected_output,
                    actual: actual_output,
                    diff: ComputeDiff(expected_output, actual_output)
                })
            END IF
        END IF
    END FOR

    RETURN DeterminismVerification {
        is_deterministic: failures.isEmpty(),
        iterations_tested: VERIFICATION_ITERATIONS,
        failures: failures
    }
END
```

### Determinism Requirements

```
REQUIREMENTS: System Determinism Guarantees

RULE 1: Pure Functions Only
    - All functions must be pure (no side effects)
    - Same inputs must always produce same outputs
    - No hidden state or global variables

    VALID:
        ComputeHash(content) -> hash
        ValidateManifest(data, schema) -> result
        ResolveReference(path, context) -> value

    INVALID:
        GetCurrentTime() -> timestamp  // Time-dependent
        GenerateUUID() -> uuid          // Random
        ReadDatabase() -> data          // External state

RULE 2: No Random Elements
    - No random number generation
    - No UUID generation (use content-addressable hashes)
    - No shuffling or random selection

    ENFORCEMENT:
        FUNCTION generateIdentifier(content):
            // WRONG: return UUID.random()
            // RIGHT: return SHA256(canonicalize(content)).substring(0, 16)

RULE 3: No Timestamps in Content
    - Created timestamps are set once at creation
    - No "updated_at" or "modified_at" fields
    - Time is external to content identity

    EXCEPTION:
        $created_at is allowed as it represents historical fact
        It is set once and never changes

RULE 4: No Environment-Dependent Behavior
    - No reading environment variables for logic
    - No machine-specific paths in content
    - No locale-dependent formatting

    ENFORCEMENT:
        FUNCTION formatNumber(n):
            // WRONG: return n.toLocaleString()
            // RIGHT: return n.toString()

RULE 5: Canonical Serialization
    - JSON keys always sorted alphabetically
    - Numbers always in standard notation
    - Strings always UTF-8 normalized

    FUNCTION canonicalize(obj):
        sorted_json = JSON.stringify(obj, {
            sortKeys: true,
            numberFormat: "standard",
            stringEncoding: "UTF-8-NFC"
        })
        return sorted_json
```

### Immutability Enforcement

```
ALGORITHM: EnforceImmutability
INPUT: manifest (ImmutableManifest)
OUTPUT: ImmutabilityVerification

// Verifies that a manifest cannot be modified

DATA STRUCTURES:
    ImmutabilityVerification:
        is_immutable: boolean
        violations: List<ImmutabilityViolation>

BEGIN
    violations ← []

    // Test 1: Direct property modification
    TRY
        manifest.content.test_property = "modified"
        violations.append(ImmutabilityViolation {
            type: "DIRECT_MODIFICATION",
            message: "Was able to add property to frozen content"
        })
    CATCH TypeError
        // Expected - object is frozen
    END TRY

    // Test 2: Nested property modification
    TRY
        IF manifest.content.hasKey("nested") THEN
            manifest.content.nested.value = "modified"
            violations.append(ImmutabilityViolation {
                type: "NESTED_MODIFICATION",
                message: "Was able to modify nested property"
            })
        END IF
    CATCH TypeError
        // Expected - nested objects are also frozen
    END TRY

    // Test 3: Array modification
    TRY
        IF manifest.lineage is Array THEN
            manifest.lineage.push("new_hash")
            violations.append(ImmutabilityViolation {
                type: "ARRAY_MODIFICATION",
                message: "Was able to modify lineage array"
            })
        END IF
    CATCH TypeError
        // Expected - arrays are frozen
    END TRY

    // Test 4: Property deletion
    TRY
        delete manifest.content["$id"]
        violations.append(ImmutabilityViolation {
            type: "PROPERTY_DELETION",
            message: "Was able to delete property from frozen content"
        })
    CATCH TypeError
        // Expected - cannot delete from frozen object
    END TRY

    RETURN ImmutabilityVerification {
        is_immutable: violations.isEmpty(),
        violations: violations
    }
END
```

### Pure Functional Transformation Pattern

```
PATTERN: Pure Functional Transformation

// All transformations in this system follow this pattern

TEMPLATE:
    FUNCTION transform(input: Immutable<T>) -> Immutable<U>:
        // 1. Input is immutable - cannot be modified
        // 2. Create new output structure
        // 3. Populate output from input
        // 4. Freeze output before returning
        // 5. Return immutable result

        output = {}

        FOR EACH key, value IN input DO
            output[key] = transformValue(value)
        END FOR

        RETURN DeepFreeze(output)

EXAMPLE: Schema Migration

    FUNCTION migrateManifest(
        manifest: ImmutableManifest,
        target_schema: string
    ) -> ImmutableManifest:

        // Never modify input
        // Create new manifest with migrated content

        migrated_content = {}

        // Copy all fields
        FOR EACH key, value IN manifest.content DO
            migrated_content[key] = value
        END FOR

        // Apply schema-specific transformations
        migrations = GetMigrationSteps(manifest.schema_version, target_schema)

        FOR EACH migration IN migrations DO
            migrated_content = ApplyMigration(migrated_content, migration)
        END FOR

        // Update schema version
        migrated_content["$schema_version"] = target_schema

        // Create new versioned manifest (this handles hashing, etc.)
        RETURN VersionManifest(migrated_content, manifest.version)
```

---

## Data Flow Diagram

```
                    +------------------+
                    |   MANIFEST       |
                    |   REGISTRY       |
                    |  (manifests.json)|
                    +--------+---------+
                             |
                             | lookup
                             v
+-------------+     +--------+---------+     +------------------+
|   SCHEMA    |     |   LOAD           |     |   MANIFEST       |
|   STORE     +---->+   MANIFEST       +---->+   FILE           |
| (schemas/)  |     |                  |     | (manifests/*.json)|
+-------------+     +--------+---------+     +------------------+
                             |
                             | validate & freeze
                             v
                    +--------+---------+
                    |   IMMUTABLE      |
                    |   MANIFEST       |
                    |   OBJECT         |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                |                |
            v                v                v
    +-------+------+  +------+-------+  +-----+-------+
    |  REFERENCE   |  |  VERSION     |  |  SELECTION  |
    |  RESOLUTION  |  |  CREATION    |  |  API        |
    +--------------+  +--------------+  +-------------+
            |                |                |
            v                v                v
    +-------+------+  +------+-------+  +-----+-------+
    | ResolvedValue|  | VersionedMfst|  | SelectedMfst|
    +--------------+  +--------------+  +-------------+
                             |
                             | write (new version only)
                             v
                    +--------+---------+
                    |   MANIFEST       |
                    |   STORAGE        |
                    | (manifests/*.json)|
                    +------------------+
```

---

## Error Taxonomy

```
ERROR HIERARCHY:

ManifestError (base)
├── RegistryError
│   ├── REGISTRY_NOT_FOUND
│   └── MANIFEST_NOT_REGISTERED
│
├── LoadError
│   ├── MANIFEST_FILE_NOT_FOUND
│   ├── MANIFEST_PARSE_ERROR
│   └── MANIFEST_INTEGRITY_VIOLATION
│
├── ValidationError
│   ├── SCHEMA_NOT_FOUND
│   ├── SCHEMA_VIOLATION
│   ├── REQUIRED_FIELD_MISSING
│   ├── FORBIDDEN_PATTERN_DETECTED
│   └── IMMUTABILITY_VIOLATION
│
├── VersionError
│   ├── VERSION_NOT_FOUND
│   ├── PARENT_NOT_FOUND
│   ├── DUPLICATE_CONTENT
│   └── LINEAGE_BROKEN
│
├── ReferenceError
│   ├── INVALID_REFERENCE_FORMAT
│   ├── PATH_NOT_FOUND
│   ├── PATH_TYPE_MISMATCH
│   ├── ARRAY_INDEX_OUT_OF_BOUNDS
│   ├── VERSION_REQUIRED
│   └── EXTERNAL_MANIFEST_NOT_FOUND
│
└── SelectionError
    ├── INVALID_CRITERIA
    ├── NO_MATCHING_MANIFESTS
    ├── REQUIRED_FIELDS_NOT_FOUND
    └── FILTERS_NOT_SATISFIED
```

---

## Summary

This pseudocode document defines the complete algorithmic logic for the agentics-org-manifests repository. Key principles:

1. **Pure Declarative Operations**: All operations are pure functions with no side effects
2. **Deterministic Behavior**: Same inputs always produce same outputs
3. **Immutability Guarantees**: Manifests cannot be modified once created
4. **Content-Addressable Versioning**: Versions are derived from content hashes
5. **Clear Error Handling**: Explicit errors, never inference or guessing
6. **Separation of Concerns**: This repo provides data; downstream systems own logic

The system serves as the single source of truth for organizational manifests, providing immutable, versioned, and deterministically accessible data to downstream systems like agentics-simulation-planner.
