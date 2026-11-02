# Orchestration Architecture

DeOrch's orchestration layer allows developers to define engineering objectives, decompose them into tasks, assign tasks to AI coding agents, and track execution through a dependency-aware DAG engine.

## Domain Model

```
OrchestrationRun (1) ←→ (N) Task (1) ←→ (N) TaskDependency
                                    (1) ←→ (N) TaskArtifact
                                    (1) ←→ (0..1) AgentSession
```

### OrchestrationRun
Container for an engineering objective. Statuses: CREATED → PLANNING → AWAITING_APPROVAL → READY → RUNNING → PAUSED → COMPLETED/FAILED/CANCELLED.

### Task
Unit of work assigned to an agent. Statuses: CREATED → BLOCKED/READY → ASSIGNED → RUNNING → VALIDATING → COMPLETED/FAILED/CANCELLED.

### TaskDependency
DAG edges. Type: FINISH_TO_START. Validated for cycles before run start.

## Task Graph (DAG)

Tasks form a directed acyclic graph:
- Cycle detection via DFS before execution starts
- Ready task resolution: tasks with all dependencies SATISFIED
- Failure propagation: failed task marks dependents BLOCKED
- Completion propagation: completed task checks if dependents are now unblocked

## Execution Flow

1. User creates run with objective
2. User adds tasks with descriptions and priorities
3. User adds dependencies between tasks
4. User starts run → DAG validated → ready tasks marked READY
5. Runtime polls for READY tasks → assigns to providers → creates sessions
6. Task completes → propagate through DAG → schedule next ready tasks
7. All tasks complete → run marked COMPLETED

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/orchestration/runs | Create run |
| GET | /api/v1/orchestration/runs | List runs |
| GET | /api/v1/orchestration/runs/{id} | Get run |
| PATCH | /api/v1/orchestration/runs/{id} | Update run status |
| POST | /api/v1/orchestration/runs/{id}/start | Start execution |
| POST | /api/v1/orchestration/runs/{id}/tasks | Add task |
| GET | /api/v1/orchestration/runs/{id}/tasks | List tasks |
| PATCH | /api/v1/orchestration/tasks/{id} | Update task |
| POST | /api/v1/orchestration/tasks/{id}/retry | Retry failed task |
| POST | /api/v1/orchestration/runs/{id}/dependencies | Add dependency |
| GET | /api/v1/orchestration/runs/{id}/graph | Get full DAG |

## Concurrency Control

- `max_concurrent_tasks` per run (default 3)
- Task retry with configurable max_retries (default 2)
- DAG prevents duplicate execution (dependency tracking)

## Real-Time Updates

WebSocket events: `run_updated`, `task_updated` → invalidate dashboard queries.

## Security

- Runs owned by user (user_id FK)
- Tasks inherit run ownership
- All endpoints verify user_id match
- No cross-user run access
