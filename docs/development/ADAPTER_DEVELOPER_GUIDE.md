# Adapter Developer Guide

This guide explains how to add a new agent provider to DeOrch.

## Prerequisites

Your agent CLI must support HTTP-based hooks with a JSON payload format that includes:
- `hook_event_name` — event type (e.g., "PreToolUse")
- `session_id` — unique session identifier
- `tool_name` — tool being invoked (for tool events)
- `tool_input` — tool parameters

## Step 1: Create the Adapter

Create a new file at `packages/local-companion/src/adapter/your-provider.ts`:

```typescript
import type { AgentAdapter, AgentCapabilities, DetectionResult, InstallResult } from './types.js';

export class YourProviderAdapter implements AgentAdapter {
  readonly providerId = 'your-provider';
  readonly providerName = 'Your Provider';
  readonly adapterVersion = '1.0.0';

  detect(): DetectionResult {
    // Check if CLI binary exists
  }

  getHooksConfig(hooksPort: number): Record<string, unknown> {
    // Return hook configuration for your provider's settings format
  }

  install(hooksPort: number): InstallResult {
    // Write hooks to your provider's config file
  }

  uninstall(): { success: boolean; error?: string } {
    // Remove hooks from config
  }

  getCapabilities(): AgentCapabilities {
    // Return honest capability assessment
  }

  // ... implement remaining interface methods
}
```

## Step 2: Register the Adapter

Add your adapter to the registry in:
- `src/cli/providers.ts` — `getRegistry()` function
- `src/cli/setup.ts` — `getRegistry()` function
- `src/cli/uninstall.ts` — `getRegistry()` function

## Step 3: Seed the Backend Provider

Add your provider to the seeded providers list in:
- `services/api/src/deorch_api/main.py` — `seed_agent_providers()` function

```python
{"slug": "your-provider", "display_name": "Your Provider", "is_supported": True, "capabilities": [...]}
```

## Step 4: Write Tests

Create `src/__tests__/your-provider-adapter.test.ts`:
- Test `getHooksConfig()` generates valid config
- Test `install()` writes to correct path
- Test `uninstall()` removes correctly
- Test `getCapabilities()` returns accurate values

## Step 5: Update Documentation

- Add entry to `docs/integrations/PROVIDER_SUPPORT_MATRIX.md`
- Create `docs/integrations/YOUR_PROVIDER_INTEGRATION.md`

## Rules

1. Never simulate unsupported capabilities
2. Never hardcode provider-specific logic in core companion code
3. Always declare capabilities honestly
4. Always test with a real provider installation
5. Keep the adapter stateless — all state is managed by the companion
