# Notification Architecture

DeOrch uses three notification channels to keep developers informed about their coding agents.

## 1. WebSocket (Real-Time)

Primary channel for instant updates. The dashboard maintains a persistent WebSocket connection to the backend.

**Events that trigger cache invalidation:**
- `approval_request` — Refresh approval list + browser notification
- `device_connected` / `device_disconnected` — Refresh device list
- `session_started` / `session_ended` — Refresh session list
- `agent_event` — Refresh active session

**Reconnection:**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
- Reconnects on page visibility change (background → foreground)
- Reconnects on network online event
- Full data reconciliation after every reconnect

## 2. Browser Notifications

Triggered by WebSocket events when the user has granted permission.

**Current triggers:**
- `approval_request` — "DeOrch: Approval Required" with action summary

**Behavior:**
- Uses `Notification` API directly
- Deduplication via `tag` parameter
- Does not send sensitive data (only action summary, max 50 chars)

## 3. Web Push Notifications

For when the app is closed or in background. Requires service worker + push subscription.

**Setup:**
- User enables push on the Activity page
- Frontend subscribes via `PushManager.subscribe()` with VAPID key
- Subscription sent to `POST /api/v1/notifications/subscribe`

**Delivery:**
- Backend sends push via web-push library
- Service worker receives `push` event, shows notification
- Click handler navigates to deep link URL

**Subscription management:**
- `POST /api/v1/notifications/subscribe` — register subscription
- `DELETE /api/v1/notifications/subscribe` — remove all subscriptions for user

**Security:**
- No secrets in push payloads
- Minimal content (title + short body only)
- Deep links only (no inline data)
- Subscriptions tied to authenticated users

## 4. In-App Notification Center

The Activity page shows a history of audit events relevant to the developer.

**Data source:** `GET /api/v1/audit?event_type=<type>` for each notification-relevant event type.

**Event types shown:**
- `approval_request.created`
- `approval_decision.approved`
- `approval_decision.denied`
- `approval_request.expired`
- `approval_request.cancelled`
- `device.registered`
- `device.revoked`

**Read/unread tracking:**
- Stored in localStorage (simple ID set)
- Unread items shown with accent left border
- Last 500 IDs tracked to prevent unbounded growth
