# Repository Access Governance

This document describes how organization manifests define availability, permissions, and governance boundaries for Agentics platform repositories, specifically the `agentics-simulation-engine` and `enterprise-roi-engine`.

## Overview

Repository governance manifests are **purely declarative** documents that express:
- **Intent**: What access patterns are permitted
- **Access Scope**: Who can access what, under which conditions
- **Compliance Boundaries**: Regulatory and organizational constraints

They do **NOT** contain:
- Business logic or calculations
- Simulation behavior or parameters
- ERP abstractions or financial formulas
- Executable code of any kind

## Key Concepts

### Environment Scopes

Access grants are scoped to specific environments:

| Environment | Purpose |
|------------|---------|
| `development` | Local development and testing |
| `staging` | Pre-production validation |
| `sandbox` | Isolated experimentation |
| `audit-only` | Read-only access for compliance review |
| `executive-review` | CFO/executive visibility |
| `production` | Live production systems |

### Access Roles

Three distinct access roles enforce separation between execution and visibility:

| Role | Description |
|------|-------------|
| `initiator` | Can execute/trigger operations (simulations, calculations) |
| `observer` | Can view live/in-progress outputs |
| `read-only` | Can view completed artifacts only |

### Execution vs. Visibility Separation

A core architectural principle: **execution authority and output visibility are separate concerns**.

- A role may have `initiator` access without `observer` or `read-only` access
- A role may have `read-only` access without `initiator` access
- This enables scenarios like:
  - Analysts can run simulations but cannot see financial summaries
  - Executives can review results but cannot initiate simulations
  - Auditors have read-only access to all completed artifacts

## Schema Structure

### Common Access Governance Types

Location: `schemas/common/access-governance.schema.json`

Provides shared definitions:
- `EnvironmentScope` - Environment enumeration
- `AccessRole` - Role type enumeration
- `AccessGrant` - Grant structure with role/team/department, access role, environments, and constraints
- `VisibilityBoundary` - Organizational visibility limits
- `ComplianceClassification` - Data classification and regulatory frameworks

### Repository Governance Manifest

Location: `schemas/v1/repository-governance.schema.json`

Base schema for any repository governance. Contains:
- `executionGovernance` - Who can execute operations
- `outputVisibility` - Who can view outputs
- `complianceClassification` - Compliance requirements

### Simulation Engine Governance

Location: `schemas/v1/simulation-engine-governance.schema.json`

Specialized for `agentics-simulation-engine`:
- `simulationInitiation` - Who can trigger simulations
- `simulationOutputVisibility` - Who can observe/read simulation results
- `resourceBoundaries` - Governance limits (not runtime config)

### ROI Engine Governance

Location: `schemas/v1/roi-engine-governance.schema.json`

Specialized for `enterprise-roi-engine`:
- `financialArtifactGovernance` - Access by artifact type (ROI, executive summary, etc.)
- `executiveVisibility` - CFO/board-level access
- `dataIntegrationGovernance` - ERP integration permissions
- `sensitivityLevels` - Hierarchical sensitivity classification

## Downstream System Integration

### CLI Integration

The CLI reads governance manifests to:

1. **Validate user permissions** before executing commands
2. **Filter available environments** based on user's access grants
3. **Enforce approval workflows** when required
4. **Log audit events** as specified in audit requirements

```
# CLI checks governance before simulation
agentics simulate --scenario cost-reduction

# CLI validates:
# 1. User's role has 'initiator' access for current environment
# 2. Environment is in environmentRestrictions
# 3. Approval workflow requirements are met
```

### Simulation Planner

The simulation planner consumes governance manifests to:

1. **Determine available simulation types** based on user role
2. **Enforce resource boundaries** (max concurrent simulations)
3. **Apply data retention policies** to results
4. **Route approval requests** to designated approver roles

### Simulator Runner

The simulator runner uses governance to:

1. **Authorize simulation execution** against initiatorGrants
2. **Restrict live observation** to observer-granted roles
3. **Apply redaction rules** to sensitive metrics
4. **Log all operations** according to audit requirements

### Exporters

Export systems use governance to:

1. **Filter visible data** based on completedOutputGrants
2. **Apply aggregation rules** for non-executive viewers
3. **Enforce format restrictions** (PDF, XLSX only for CFO data)
4. **Add watermarks** when required
5. **Enforce export approval workflows**

## Access Control Enforcement Pattern

```
                    ┌─────────────────────────────┐
                    │   Governance Manifest       │
                    │   (Declarative Rules)       │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │   Access Control Service    │
                    │   (Runtime Enforcement)     │
                    └─────────────┬───────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
    ┌──────▼──────┐       ┌───────▼──────┐       ┌──────▼──────┐
    │    CLI      │       │   Planner    │       │   Exporter  │
    │ (Commands)  │       │ (Scheduling) │       │  (Reports)  │
    └─────────────┘       └──────────────┘       └─────────────┘
```

### Enforcement Flow

1. **Request arrives** at any downstream system
2. **Load governance manifest** for target repository
3. **Resolve user identity** to roles/teams/departments
4. **Match access grants** against current environment
5. **Check constraints** (approval, time windows, etc.)
6. **Allow or deny** with audit logging

## Visibility Boundaries

### Organization-Internal

Default boundary. Only users within the owning organization can access outputs.

### Cross-Organization

Specific organizations can be granted visibility via `allowedOrganizations`.

### Partner-Visible

Designated partner organizations have limited visibility with higher redaction levels.

### Public-Aggregated

Aggregated, anonymized data may be exposed publicly (rarely used).

## Compliance Integration

Governance manifests declare compliance requirements that downstream systems enforce:

| Framework | Enforcement |
|-----------|-------------|
| SOX | Financial data audit trails, approval workflows |
| GDPR | PII redaction, data retention limits |
| SOC2 | Access logging, immutable audit trails |
| HIPAA | Enhanced access controls for health data |
| PCI-DSS | Payment data isolation |

## Preventing Unauthorized Access

### Simulation Execution

- `defaultDeny: true` ensures no access without explicit grants
- `environmentRestrictions` limits where simulations can run
- `approvalWorkflow` requires human approval for sensitive environments
- `auditRequirements` ensure all access is logged

### Financial Data Exposure

- `sensitivityLevels` create hierarchical clearance requirements
- `visibilityBoundary` prevents cross-organizational data leaks
- `aggregationRules` anonymize data for lower-privilege viewers
- `dataExportRestrictions` control bulk data extraction

## Example Workflow

### Running a Simulation

1. User requests simulation via CLI
2. CLI loads `simulation-engine-governance.schema.json` manifest
3. Checks user's role against `simulationInitiation.initiatorGrants`
4. Verifies current environment is in `environmentRestrictions`
5. If `approvalWorkflow.required` and environment in `approvalEnvironments`:
   - Routes to approver role
   - Waits for approval
6. Simulation executes with audit logging
7. Results stored with retention policy applied

### Viewing ROI Report

1. User requests ROI report
2. System loads `roi-engine-governance.schema.json` manifest
3. Determines artifact type (e.g., `executive-summary`)
4. Checks `financialArtifactGovernance.artifactTypeAccess` for this type
5. Verifies user's sensitivity clearance against `minimumSensitivityLevel`
6. Applies `aggregationRules` based on user's role
7. Returns data with appropriate redaction

## Best Practices

1. **Start with `defaultDeny: true`** - Explicit grants are safer than implicit
2. **Use environment scoping** - Production access should be minimal
3. **Separate execution from visibility** - Not everyone who can see should execute
4. **Define sensitivity levels** - Hierarchical clearance simplifies management
5. **Enable audit logging** - SOX/compliance requires comprehensive trails
6. **Use approval workflows** - Human review for sensitive operations
7. **Apply aggregation rules** - Protect individual data in summaries
