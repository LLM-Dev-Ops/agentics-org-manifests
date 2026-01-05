# Downstream System Integration Guide

This guide explains how downstream systems (CLI, simulation planner, simulator runner, exporters) consume organization manifests to enforce access control and compliance.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Organization Manifest Store                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐ │
│  │ organization │ │    policy    │ │    repository-governance     │ │
│  │   .schema    │ │   .schema    │ │ (simulation/roi-engine)      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Access Control Service                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  resolveAccess(userId, repository, environment, operation)  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    ┌───────────┐      ┌───────────┐      ┌───────────┐
    │    CLI    │      │  Planner  │      │  Exporter │
    └───────────┘      └───────────┘      └───────────┘
```

## Access Resolution Algorithm

When a downstream system needs to check access, it follows this algorithm:

```typescript
interface AccessResolutionInput {
  userId: string;
  repository: 'agentics-simulation-engine' | 'enterprise-roi-engine';
  environment: EnvironmentScope;
  operation: 'initiate' | 'observe' | 'read';
  artifactType?: string; // For ROI engine
}

interface AccessResolutionResult {
  allowed: boolean;
  requiresApproval: boolean;
  approverRoles?: RoleId[];
  redactionLevel?: string;
  auditRequired: boolean;
  constraints: AccessConstraint[];
}

function resolveAccess(input: AccessResolutionInput): AccessResolutionResult {
  // 1. Load governance manifest for repository
  const manifest = loadGovernanceManifest(input.repository);

  // 2. Resolve user to roles, teams, departments
  const userContext = resolveUserContext(input.userId);

  // 3. Find matching access grants
  const matchingGrants = findMatchingGrants(
    manifest,
    userContext,
    input.environment,
    input.operation
  );

  // 4. Check if any grant allows the operation
  if (matchingGrants.length === 0) {
    return { allowed: false, auditRequired: true, constraints: [] };
  }

  // 5. Aggregate constraints from all matching grants
  const constraints = aggregateConstraints(matchingGrants);

  // 6. Check approval requirements
  const approvalRequired = checkApprovalRequirements(manifest, input.environment);

  // 7. Determine redaction level
  const redactionLevel = determineRedactionLevel(manifest, userContext);

  return {
    allowed: true,
    requiresApproval: approvalRequired,
    approverRoles: approvalRequired ? manifest.approvalWorkflow.approverRoles : undefined,
    redactionLevel,
    auditRequired: manifest.auditRequirements.logLevel !== 'minimal',
    constraints
  };
}
```

## CLI Integration

### Command Authorization

Before executing any command that interacts with governed repositories, the CLI must check access:

```typescript
class CLIAuthorization {
  async authorizeCommand(
    command: 'simulate' | 'export' | 'view',
    options: CommandOptions
  ): Promise<AuthorizationResult> {
    const repository = this.determineRepository(command);
    const operation = this.mapCommandToOperation(command);

    const accessResult = await this.accessService.resolveAccess({
      userId: this.currentUser.id,
      repository,
      environment: options.environment || this.defaultEnvironment,
      operation
    });

    if (!accessResult.allowed) {
      throw new AccessDeniedError(
        `Access denied: No ${operation} permission for ${repository} in ${options.environment}`
      );
    }

    if (accessResult.requiresApproval) {
      const approved = await this.requestApproval(accessResult.approverRoles);
      if (!approved) {
        throw new ApprovalDeniedError('Approval request was denied');
      }
    }

    return accessResult;
  }
}
```

### Environment Filtering

The CLI filters available environments based on the user's access grants:

```typescript
function getAvailableEnvironments(
  userId: string,
  repository: string
): EnvironmentScope[] {
  const manifest = loadGovernanceManifest(repository);
  const userContext = resolveUserContext(userId);

  return VALID_ENVIRONMENT_SCOPES.filter(env => {
    const grants = findMatchingGrants(manifest, userContext, env, 'any');
    return grants.length > 0;
  });
}
```

## Simulation Planner Integration

### Resource Boundary Enforcement

The simulation planner respects governance-defined resource limits:

```typescript
class SimulationPlanner {
  async planSimulation(request: SimulationRequest): Promise<SimulationPlan> {
    const governance = loadSimulationGovernance(request.organizationId);

    // Check concurrent simulation limits
    const currentCount = await this.getActiveSimulationCount(
      request.environment,
      request.initiatorRoleId
    );

    const envLimit = governance.resourceBoundaries
      .maxConcurrentSimulations.byEnvironment[request.environment];
    const roleLimit = governance.resourceBoundaries
      .maxConcurrentSimulations.byRole[request.initiatorRoleId];

    if (currentCount >= Math.min(envLimit, roleLimit || Infinity)) {
      throw new ResourceLimitExceededError(
        `Concurrent simulation limit reached for ${request.environment}`
      );
    }

    // Apply retention policy
    const retentionDays = governance.resourceBoundaries
      .dataRetentionPolicy.simulationResultsRetentionDays;

    return {
      ...request,
      resultExpiresAt: addDays(new Date(), retentionDays),
      auditLogExpiresAt: addDays(
        new Date(),
        governance.resourceBoundaries.dataRetentionPolicy.auditLogRetentionDays
      )
    };
  }
}
```

### Approval Workflow Routing

```typescript
async function routeApprovalRequest(
  request: SimulationRequest,
  governance: SimulationGovernance
): Promise<ApprovalTicket> {
  const workflow = governance.simulationInitiation.approvalWorkflow;

  if (!workflow.required) {
    return { approved: true, automatic: true };
  }

  // Check for auto-approve conditions
  const autoApprove = workflow.autoApproveConditions.some(condition => {
    switch (condition) {
      case 'sandbox-environment':
        return request.environment === 'sandbox';
      case 'development-environment':
        return request.environment === 'development';
      case 'same-team-ownership':
        return request.initiatorTeamId === request.targetTeamId;
      case 'below-resource-threshold':
        return request.estimatedCost < RESOURCE_THRESHOLD;
      default:
        return false;
    }
  });

  if (autoApprove) {
    return { approved: true, automatic: true, condition: 'auto-approved' };
  }

  // Check if environment requires approval
  if (!workflow.approvalEnvironments.includes(request.environment)) {
    return { approved: true, automatic: true };
  }

  // Route to approvers
  return createApprovalTicket({
    request,
    approverRoles: workflow.approverRoles,
    timeout: APPROVAL_TIMEOUT_HOURS
  });
}
```

## Simulator Runner Integration

### Execution Authorization

```typescript
class SimulatorRunner {
  async executeSimulation(
    simulationId: string,
    context: ExecutionContext
  ): Promise<SimulationResult> {
    const governance = loadSimulationGovernance(context.organizationId);

    // Verify initiator access
    const accessCheck = await this.accessService.resolveAccess({
      userId: context.userId,
      repository: 'agentics-simulation-engine',
      environment: context.environment,
      operation: 'initiate'
    });

    if (!accessCheck.allowed) {
      throw new UnauthorizedExecutionError();
    }

    // Start audit logging
    const auditSession = await this.startAuditSession(
      governance.simulationInitiation.auditRequirements
    );

    try {
      const result = await this.runSimulation(simulationId);

      // Apply redaction for result storage
      const redactedResult = this.applyRedaction(
        result,
        governance.simulationOutputVisibility.resultRedaction
      );

      await auditSession.logSuccess(redactedResult);
      return redactedResult;
    } catch (error) {
      await auditSession.logFailure(error);
      throw error;
    }
  }
}
```

### Live Observation Access

```typescript
class SimulationObserver {
  async subscribeToLiveOutput(
    simulationId: string,
    userId: string
  ): Promise<Observable<SimulationOutput>> {
    const simulation = await this.getSimulation(simulationId);
    const governance = loadSimulationGovernance(simulation.organizationId);

    // Check observer access
    const accessCheck = await this.accessService.resolveAccess({
      userId,
      repository: 'agentics-simulation-engine',
      environment: simulation.environment,
      operation: 'observe'
    });

    if (!accessCheck.allowed) {
      throw new ObservationDeniedError(
        'User does not have observer access to live simulation outputs'
      );
    }

    return this.createObservableStream(simulationId)
      .pipe(
        map(output => this.applyRedaction(
          output,
          governance.simulationOutputVisibility.resultRedaction
        ))
      );
  }
}
```

## Exporter Integration

### Data Export Authorization

```typescript
class DataExporter {
  async exportData(request: ExportRequest): Promise<ExportResult> {
    const governance = loadROIGovernance(request.organizationId);
    const restrictions = governance.dataIntegrationGovernance.dataExportRestrictions;

    // Check export access
    const accessCheck = await this.accessService.resolveAccess({
      userId: request.userId,
      repository: 'enterprise-roi-engine',
      environment: request.environment,
      operation: 'read',
      artifactType: request.artifactType
    });

    if (!accessCheck.allowed) {
      throw new ExportDeniedError();
    }

    // Check format restrictions
    if (!restrictions.allowedFormats.includes(request.format)) {
      throw new InvalidFormatError(
        `Format ${request.format} not allowed. Allowed: ${restrictions.allowedFormats.join(', ')}`
      );
    }

    // Check record limit
    if (request.recordCount > restrictions.maxExportRecords) {
      throw new RecordLimitExceededError(
        `Export limited to ${restrictions.maxExportRecords} records`
      );
    }

    // Check approval requirement
    if (restrictions.requireApproval) {
      const approval = await this.requestExportApproval(
        request,
        restrictions.approverRoles
      );
      if (!approval.approved) {
        throw new ExportApprovalDeniedError();
      }
    }

    // Generate export with watermark if required
    const exportData = await this.generateExport(request);

    if (restrictions.watermarkRequired) {
      return this.addWatermark(exportData, request.userId);
    }

    return exportData;
  }
}
```

### Aggregation and Redaction

```typescript
class FinancialDataProcessor {
  applyViewerTransformations(
    data: FinancialData,
    userContext: UserContext,
    governance: ROIGovernance
  ): FinancialData {
    const rules = governance.executiveVisibility.aggregationRules;

    // Check if user requires aggregated view
    const requiresAggregation = !this.hasExecutiveAccess(userContext, governance);

    if (requiresAggregation && rules.departmentLevelAggregation) {
      data = this.aggregateToDepartmentLevel(
        data,
        rules.minimumAggregationThreshold
      );
    }

    // Remove excluded fields
    for (const fieldPath of rules.excludedFields) {
      data = this.removeField(data, fieldPath);
    }

    // Apply rounding rules
    if (rules.roundingRules) {
      data = this.applyRounding(data, rules.roundingRules);
    }

    return data;
  }
}
```

## Audit Logging

All downstream systems must implement audit logging according to governance requirements:

```typescript
interface AuditEvent {
  timestamp: string;
  userId: string;
  repository: string;
  environment: string;
  operation: string;
  artifactType?: string;
  success: boolean;
  errorCode?: string;
  metadata: Record<string, unknown>;
}

class AuditLogger {
  async log(event: AuditEvent, requirements: AuditRequirements): Promise<void> {
    const logEntry = {
      ...event,
      logLevel: requirements.logLevel,
      retentionDays: requirements.retentionDays
    };

    // Store in immutable log if required
    if (requirements.immutableAuditTrail) {
      await this.appendToImmutableLog(logEntry);
    } else {
      await this.appendToStandardLog(logEntry);
    }

    // Generate real-time alert if required
    if (requirements.realTimeAlerts && this.isAlertableEvent(event)) {
      await this.sendAlert(logEntry);
    }
  }
}
```

## Error Handling

Downstream systems should provide clear error messages that don't leak sensitive governance details:

```typescript
class GovernanceErrorHandler {
  handleAccessDenied(error: AccessDeniedError): UserFriendlyError {
    // Don't expose which specific grant was missing
    return new UserFriendlyError(
      'ACCESS_DENIED',
      'You do not have permission to perform this operation. Contact your administrator.'
    );
  }

  handleApprovalRequired(approverRoles: RoleId[]): UserFriendlyError {
    return new UserFriendlyError(
      'APPROVAL_REQUIRED',
      'This operation requires approval. A request has been sent to the appropriate approvers.'
    );
  }

  handleEnvironmentRestriction(environment: string): UserFriendlyError {
    return new UserFriendlyError(
      'ENVIRONMENT_RESTRICTED',
      `Operations are not permitted in the ${environment} environment with your current access level.`
    );
  }
}
```

## Testing Integration

Downstream systems should test governance integration with these patterns:

```typescript
describe('Governance Integration', () => {
  it('denies access when no matching grant exists', async () => {
    const result = await accessService.resolveAccess({
      userId: 'user-without-access',
      repository: 'agentics-simulation-engine',
      environment: 'production',
      operation: 'initiate'
    });

    expect(result.allowed).toBe(false);
  });

  it('requires approval for staging environment', async () => {
    const result = await accessService.resolveAccess({
      userId: 'user-with-staging-access',
      repository: 'agentics-simulation-engine',
      environment: 'staging',
      operation: 'initiate'
    });

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('auto-approves sandbox environment', async () => {
    const result = await accessService.resolveAccess({
      userId: 'user-with-sandbox-access',
      repository: 'agentics-simulation-engine',
      environment: 'sandbox',
      operation: 'initiate'
    });

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });
});
```
