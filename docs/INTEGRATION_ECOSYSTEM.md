# Integration Ecosystem Architecture

## Overview

DeOrch supports external developer tool integrations through a standardized model. Integrations are registered in a catalog, connected per-organization, and interact via webhooks and API calls.

## Supported Integrations

| Integration | Category | Auth | Status | Capabilities |
|------------|----------|------|--------|-------------|
| GitHub | Source Control | Token | VERIFIED | repo_link, pr_context, branch_refs, commit_refs, webhook_events, status_checks |
| Slack | Communication | Token | VERIFIED | notifications, approval_alerts, workflow_completion, failure_alerts |

## Integration Model

```
Integration (catalog) → IntegrationConnection (per org) → WebhookEndpoint (outgoing)
                                                        → WebhookDelivery (delivery log)
```

### Integration
Catalog entry defining: slug, name, category, auth_type, capabilities, required_permissions, config_schema, trust_status.

### IntegrationConnection
Links an org to an integration with encrypted credentials and config. Status: ACTIVE or REVOKED. Unique per (integration, org).

### WebhookEndpoint
Registered outgoing webhook with subscribed events and secret for signing.

### WebhookDelivery
Delivery attempt log with status, attempts, response code.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/integrations | List available integrations |
| POST | /api/v1/integrations/connect | Connect integration to org |
| GET | /api/v1/integrations/connections | List org's connections |
| DELETE | /api/v1/integrations/connections/{id} | Disconnect + revoke |
| POST | /api/v1/webhooks/inbound/{slug} | Receive provider webhooks |

## Security

- Credentials stored encrypted (production: use vault or KMS)
- Credentials cleared on disconnect
- Org admin/owner required for connect/disconnect
- Webhook signatures validated (GitHub HMAC-SHA256)
- Audit trail for all connection/disconnection events
- Integration permissions declared and visible before connection
- Trust status: VERIFIED for first-party, UNVERIFIED for community

## GitHub Integration

**Webhook Events Supported:** push, pull_request, check_run, check_suite

**Inbound Processing:**
1. POST /api/v1/webhooks/inbound/github
2. Parse event type from X-GitHub-Event header
3. Extract structured data (push: ref/commits, PR: title/author/branches)
4. Record in audit log

## Slack Integration

**Capabilities:**
- Send approval request alerts with risk level and deep link
- Send workflow completion summaries
- Send failure alerts

**Implementation:** Uses Slack Web API (chat.postMessage) with bot token.
