# Workflow Ecosystem Architecture

DeOrch Network enables developers to create, version, publish, discover, install, and execute reusable engineering workflows powered by multi-agent orchestration.

## Domain Model

```
Workflow → WorkflowVersion (immutable) → WorkflowInstallation → OrchestrationRun
                                                                        ↓
                                                                   Task → AgentSession
```

### Workflow
Reusable engineering process definition. Has metadata (name, category, tags, visibility), versions, and installations.

### WorkflowVersion
Immutable snapshot of a workflow definition. Contains the declarative task graph (tasks + dependencies + constraints). Checksummed for integrity. Trust status: UNVERIFIED → VALIDATED → VERIFIED.

### WorkflowInstallation
Links a specific workflow version to a user/project. Stores config overrides. Can be enabled/disabled.

### Organization
Team-level entity for shared workflow management. Members have roles (admin, developer, viewer).

## Workflow Definition Schema

```json
{
  "tasks": [
    { "id": "analyze", "title": "Analyze Architecture", "task_type": "research", "priority": 0 },
    { "id": "implement", "title": "Implement Feature", "task_type": "development", "priority": 1 }
  ],
  "dependencies": [
    { "source": "analyze", "dependent": "implement", "type": "FINISH_TO_START" }
  ],
  "constraints": {
    "maxConcurrentTasks": 3,
    "requireHumanApproval": true
  }
}
```

## Execution Bridge

When a user executes an installed workflow:
1. Read WorkflowVersion.definition
2. Create OrchestrationRun with workflow_version_id
3. Create Tasks from definition.tasks
4. Create TaskDependencies from definition.dependencies
5. Return the run (user starts via M6 API)

This reuses the entire M6 orchestration engine without duplication.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/workflows | Create workflow |
| GET | /api/v1/workflows | List/search workflows |
| GET | /api/v1/workflows/{id} | Get workflow detail |
| PATCH | /api/v1/workflows/{id} | Update workflow |
| POST | /api/v1/workflows/{id}/versions | Create version |
| GET | /api/v1/workflows/{id}/versions | List versions |
| POST | /api/v1/workflows/installations | Install workflow |
| GET | /api/v1/workflows/installations | List installations |
| DELETE | /api/v1/workflows/installations/{id} | Uninstall |
| POST | /api/v1/workflows/installations/{id}/execute | Execute → creates OrchestrationRun |
| POST | /api/v1/workflows/orgs | Create organization |
| GET | /api/v1/workflows/orgs | List user's organizations |

## Trust Model

| Status | Meaning |
|--------|---------|
| UNVERIFIED | Published, not yet validated |
| VALIDATED | Passes schema + graph + capability checks |
| VERIFIED | Passed test execution with evidence |
| DEPRECATED | No longer recommended |
| REVOKED | Disabled for security/policy |

## Security

- Workflow visibility controls (PRIVATE/PUBLIC/ORGANIZATION)
- Installation does not grant execution permission
- Execution goes through existing M6 approval engine
- Workflow definitions validated before version creation
- Checksummed versions prevent tampering
- Published versions are immutable
