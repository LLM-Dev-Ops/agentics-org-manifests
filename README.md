<p align="center">
  <img src="https://img.shields.io/badge/🏢-Organizational_Truth-blue?style=for-the-badge&labelColor=1a1a2e" alt="Organizational Truth"/>
  <img src="https://img.shields.io/badge/🔒-Immutable-green?style=for-the-badge&labelColor=1a1a2e" alt="Immutable"/>
  <img src="https://img.shields.io/badge/✅-Contract_Enforced-orange?style=for-the-badge&labelColor=1a1a2e" alt="Contract Enforced"/>
</p>

<h1 align="center">
  <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" width="28" height="28" alt="TypeScript"/>
  agentics-org-manifests
  <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg" width="28" height="28" alt="Node.js"/>
</h1>

<p align="center">
  <strong>Immutable Organizational Truth Manifests for the Agentics Platform</strong>
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Features-📋-blue" alt="Features"/></a>
  <a href="#installation"><img src="https://img.shields.io/badge/Install-📦-green" alt="Installation"/></a>
  <a href="#api-reference"><img src="https://img.shields.io/badge/API-📖-orange" alt="API Reference"/></a>
  <a href="#contract-enforcement"><img src="https://img.shields.io/badge/Contracts-🔐-red" alt="Contract Enforcement"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?logo=node.js" alt="Node.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License"/>
  <img src="https://img.shields.io/badge/Cloud_Run-Deployed-4285F4?logo=google-cloud" alt="Cloud Run"/>
</p>

---

## 🎯 Overview

**agentics-org-manifests** is the single source of organizational truth for the Agentics platform. It provides immutable, versioned, and rigorously validated organizational manifests with strict contract enforcement at the HTTP boundary.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP Request Boundary                         │
├─────────────────────────────────────────────────────────────────┤
│  📥 Incoming Request                                             │
│       ↓                                                          │
│  🔐 Contract Validation (manifests/v1/request.schema.json)      │
│       ↓                                                          │
│  ✅ Pass → Continue to Manifest Validation                       │
│  ❌ Fail → Immediate Rejection (400)                             │
│       ↓                                                          │
│  📋 Schema Validation → Integrity Check → Pattern Detection      │
│       ↓                                                          │
│  📤 Response with Execution Proof                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Immutable Manifests** | Organizational data that cannot be modified after creation |
| 📋 **Strict Contract Enforcement** | All requests validated at HTTP boundary before processing |
| 🔍 **Execution Proof** | Every response includes `execution_id`, `layers_executed`, and `execution_graph` |
| ✅ **JSON Schema Validation** | Full validation against versioned schemas |
| 🔗 **Reference Integrity** | Cross-manifest reference validation |
| 🚫 **Pattern Detection** | Detects forbidden patterns and placeholders |
| 📊 **Version Control** | Content hashing and lineage tracking |

---

## 🚀 Quick Start

### Cloud Deployment

The service is deployed on Google Cloud Run:

```
https://agentics-org-manifests-1062287243982.us-central1.run.app
```

### Local Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start server
node dist/server.js
```

### Docker

```bash
# Build image
docker build -t agentics-org-manifests .

# Run container
docker run -p 8080:8080 agentics-org-manifests
```

---

## 📖 API Reference

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "agentics-manifests",
  "execution_id": "exec-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### List Manifest Types

```bash
GET /v1/manifests
```

**Response:**
```json
{
  "version": "1.0.0",
  "manifestTypes": ["organization", "team", "role", "capability", "policy"],
  "endpoints": {
    "validate": "POST /v1/manifests/validate",
    "detect": "POST /v1/manifests/detect"
  },
  "execution_proof": { ... }
}
```

### Validate Manifest

```bash
POST /v1/manifests/validate
Content-Type: application/json

{
  "$id": "manifest-123",
  "$schema_version": "1.0.0",
  "$created_at": "2024-01-01T00:00:00Z",
  "$content_hash": "sha256:abc123...",
  "organization_id": "org-456",
  ...
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "metadata": {
    "schemaVersion": "1.0.0",
    "validatedAt": "2024-01-01T00:00:00Z",
    "strictnessLevel": "STRICT",
    "checksPerformed": [...]
  },
  "execution_proof": {
    "execution_id": "exec-xxx",
    "layers_executed": [
      "contract-validation",
      "manifest-parsing",
      "schema-validation",
      "integrity-check",
      "pattern-detection",
      "domain-rules",
      "response-generation"
    ],
    "execution_graph": { ... }
  }
}
```

### Detect Manifest Type

```bash
POST /v1/manifests/detect
Content-Type: application/json

{
  "organization_id": "org-123"
}
```

**Response:**
```json
{
  "type": "organization",
  "execution_proof": { ... }
}
```

---

## 🔐 Contract Enforcement

All incoming requests are validated **exactly once** at the HTTP boundary using `@agentics/contracts`:

### Validation Rules

1. **Non-null payload** - Request body cannot be null or undefined
2. **Object type** - Must be a JSON object
3. **Non-empty** - Cannot be an empty object `{}`
4. **Recognizable structure** - Must match one of the known manifest patterns

### Contract Errors

| Code | Description |
|------|-------------|
| `CONTRACT_001` | Payload is null or undefined |
| `CONTRACT_002` | Payload is not an object |
| `CONTRACT_003` | Payload is an empty object |
| `CONTRACT_JSON_PARSE` | Invalid JSON syntax |

### Example: Invalid Request

```bash
curl -X POST https://agentics-org-manifests-xxx.run.app/v1/manifests/validate \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (400):**
```json
{
  "valid": false,
  "error": "Contract validation failed",
  "errors": [{
    "code": "CONTRACT_003",
    "path": "$",
    "message": "Request payload cannot be an empty object",
    "severity": "error"
  }],
  "execution_proof": {
    "execution_id": "exec-xxx",
    "layers_executed": ["contract-validation"]
  }
}
```

---

## 📁 Manifest Types

### Organization

```json
{
  "$manifest_type": "organization",
  "organization_id": "org-uuid",
  "name": "Acme Corporation",
  "legalName": "Acme Corporation Inc.",
  "incorporationCountry": "US",
  "fiscalYearEnd": "12-31"
}
```

### Team

```json
{
  "$manifest_type": "team",
  "team_id": "team-uuid",
  "name": "Engineering",
  "organization_ref": "org-uuid",
  "members": [...]
}
```

### Policy

```json
{
  "$manifest_type": "policy",
  "policy_id": "policy-uuid",
  "constraints": {...},
  "effective_date": "2024-01-01T00:00:00Z"
}
```

### Role

```json
{
  "$manifest_type": "role",
  "role_id": "role-uuid",
  "permissions": [...],
  "responsibilities": [...]
}
```

### Capability

```json
{
  "$manifest_type": "capability",
  "capability_id": "cap-uuid",
  "skills": [...]
}
```

---

## 🏗️ Architecture

```
agentics-org-manifests/
├── contracts/           # HTTP boundary contract enforcement
│   ├── core/           # Contract validator implementation
│   └── types/          # Contract types (ExecutionProof, etc.)
├── validation/          # Manifest validation engine
│   ├── core/           # Schema validator, integrity checker
│   ├── rules/          # Domain-specific validation rules
│   └── types/          # Validation result types
├── versioning/          # Version control and hashing
├── registry/            # Manifest indexing and queries
├── references/          # Cross-manifest reference resolution
├── schemas/             # JSON Schema definitions
│   ├── v1/             # Version 1 schemas
│   └── common/         # Shared schema components
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── server.ts            # HTTP server with contract enforcement
└── index.ts             # Public API exports
```

---

## 📦 Exports

```typescript
// Main package
import {
  // Validation
  validateManifest,
  detectManifestType,
  ValidationErrorCodes,

  // Contract Enforcement
  validateRequestContract,
  createExecutionProof,
  ExecutionLayers,

  // Versioning
  computeContentHash,
  verifyContentHash,

  // Registry
  createRegistry,
  createQueryEngine,

  // Types
  type ValidationResult,
  type ExecutionProof,
  type ContractValidationResult,
} from 'agentics-org-manifests';

// Sub-packages
import { ... } from 'agentics-org-manifests/validation';
import { ... } from 'agentics-org-manifests/contracts';
import { ... } from 'agentics-org-manifests/versioning';
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `NODE_ENV` | `development` | Environment mode |

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by the Agentics Platform Team</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Powered_by-Claude_Code-blueviolet?style=flat-square" alt="Powered by Claude Code"/>
</p>
