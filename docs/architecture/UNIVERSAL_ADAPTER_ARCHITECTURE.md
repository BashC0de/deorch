# Universal Adapter Architecture

DeOrch supports multiple AI coding agents through a standardized adapter contract. Each provider implements the same interface, allowing the companion to manage hooks, sessions, and approvals provider-independently.

## Adapter Contract

```typescript
interface AgentAdapter {
  providerId: string;       // "claude-code", "codex", "gemini"
  providerName: string;     // Human-readable name
  adapterVersion: string;   // Adapter version
  
  detect(): DetectionResult;           // Is the CLI installed?
  getHooksConfig(port): Config;        // Generate hook settings
  install(port): InstallResult;        // Write hooks to provider config
  uninstall(): Result;                 // Remove hooks
  getCapabilities(): AgentCapabilities; // What this provider supports
  healthCheck(port): Promise<boolean>; // Is hooks server reachable?
  getSettingsPath(): string;           // Where config lives
  getHookEventNames(): string[];       // Supported hook events
}
```

## Adapter Registry

All adapters are registered in an `AdapterRegistry`. The CLI commands (`setup`, `uninstall`, `providers`) iterate the registry to detect, install, and report on all providers.

## Provider Integration Pattern

All three supported providers (Claude Code, Codex, Gemini CLI) use the same integration mechanism: **HTTP-based hooks**. The companion runs a single hooks server on `127.0.0.1:8765` that handles hook payloads from any provider — the payload format (`hook_event_name`, `tool_name`, `tool_input`) is identical across providers.

Each adapter differs only in:
- CLI binary name (`claude` vs `codex` vs `gemini`)
- Settings file location (`~/.claude/settings.json` vs `~/.codex/hooks.json` vs `~/.gemini/extensions/deorch/`)
- Hook config format (slight structural variations)
- Supported hook events (Codex has 12, Claude has 6, Gemini has 4)

## WebSocket Multi-Provider Support

The backend's ConnectionManager stores connections per `(device_id, provider_slug)`:

```python
_device_connections: dict[str, dict[str, WebSocket]]
# device_id → provider_slug → WebSocket
```

This allows multiple adapters on the same machine to connect simultaneously. Approval decisions are routed to the correct provider's connection via `send_to_device_provider()`.

## Capability Model

Each adapter declares its capabilities honestly:

| Capability | Description |
|-----------|-------------|
| sessionDiscovery | Can discover running sessions |
| sessionStatus | Can report session status |
| toolActivity | Can observe tool calls |
| permissionObservation | Can observe permission events |
| permissionInterception | Can intercept and block tool calls |
| remoteApprovalResolution | Can deliver remote approve/deny |
| messageInjection | Can inject messages (NOT SUPPORTED by any provider) |
| sessionInterruption | Can pause a session (NOT SUPPORTED) |
| sessionTermination | Can stop a session (NOT SUPPORTED) |
| fileChangeObservation | Can observe file changes |
| structuredErrors | Can capture structured error info |

Unsupported capabilities are never simulated.
