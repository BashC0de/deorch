# Provider Support Matrix

| Capability | Claude Code | OpenAI Codex | Gemini CLI | Copilot | Cursor |
|---|---|---|---|---|---|
| Session discovery | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Session status | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Tool activity | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Permission observation | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Permission interception | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Remote approval | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Message injection | DOCUMENTED_BUT_UNSUPPORTED | DOCUMENTED_BUT_UNSUPPORTED | DOCUMENTED_BUT_UNSUPPORTED | NOT_APPLICABLE | NOT_APPLICABLE |
| Session termination | DOCUMENTED_BUT_UNSUPPORTED | DOCUMENTED_BUT_UNSUPPORTED | DOCUMENTED_BUT_UNSUPPORTED | NOT_APPLICABLE | NOT_APPLICABLE |
| File change observation | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_APPLICABLE |
| Structured errors | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | IMPLEMENTED_AND_VERIFIED | NOT_APPLICABLE | NOT_APPLICABLE |

## Integration Mechanisms

| Provider | Hook System | Config Location | CLI Binary |
|---|---|---|---|
| Claude Code | settings.json hooks | `~/.claude/settings.json` | `claude` |
| OpenAI Codex | hooks.json | `~/.codex/hooks.json` | `codex` |
| Gemini CLI | Extension hooks | `~/.gemini/extensions/deorch/hooks/hooks.json` | `gemini` |

## Notes

- **Claude Code**: Reference implementation. All hook events fully tested. Adapter version 1.0.0.
- **OpenAI Codex**: Hook system (v0.150+) mirrors Claude Code's format. 12 hook events available. Adapter version 1.0.0.
- **Gemini CLI**: Hooks via extensions (v0.26+). 4 hook events supported. Extension-based installation. Adapter version 1.0.0.
- **GitHub Copilot**: No documented hook/extension system for CLI. Marked NOT_IMPLEMENTED.
- **Cursor**: No documented hook/extension system. Marked NOT_IMPLEMENTED.
