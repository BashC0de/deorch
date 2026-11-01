/**
 * Generate the Claude Code settings.json hooks configuration
 * needed to integrate with the DeOrch local companion.
 */
export function generateHooksConfig(hooksPort = 8765): object {
  const base = `http://127.0.0.1:${hooksPort}`;

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${base}/hooks/pre-tool-use -H 'Content-Type: application/json' -d @-`,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${base}/hooks/post-tool-use -H 'Content-Type: application/json' -d @-`,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${base}/hooks/stop -H 'Content-Type: application/json' -d @-`,
            },
          ],
        },
      ],
      Notification: [
        {
          hooks: [
            {
              type: 'command',
              command: `curl -s -X POST ${base}/hooks/notification -H 'Content-Type: application/json' -d @-`,
            },
          ],
        },
      ],
    },
  };
}
