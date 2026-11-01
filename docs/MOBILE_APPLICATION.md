# Mobile Application

DeOrch is a Progressive Web App (PWA) that works on desktop, tablet, and mobile browsers. It can be installed on the home screen for a native-like experience.

## Installation

### iOS (Safari)
1. Open the DeOrch dashboard in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the DeOrch dashboard in Chrome
2. Tap the three-dot menu
3. Tap "Install app" or "Add to Home Screen"

### Desktop (Chrome/Edge)
1. Open the DeOrch dashboard
2. Click the install icon in the address bar
3. Click "Install"

## Features

### Mobile Navigation
- Bottom navigation bar with 5 tabs: Home, Approvals, Sessions, Devices, Activity
- Pending approval count badge on the Approvals tab
- Connection status indicator in the header
- Safe area support for notched devices (iPhone, modern Android)

### Real-Time Updates
- WebSocket connection with exponential backoff reconnection
- Automatic data reconciliation after reconnect
- Page visibility handling (reconnects when app returns to foreground)
- Network online/offline detection

### Push Notifications
- Web Push notifications for approval requests
- Enable/disable in the Activity page
- Deep links to relevant approval detail
- Notification deduplication via tags

### Offline Support
- Service worker caches static assets
- Offline fallback page when network unavailable
- App shell loads from cache for instant startup

## Architecture

### Service Worker (`public/sw.js`)
- Cache-first strategy for static assets (`/_next/static/`, `/icons/`)
- Network-first for page navigations with offline fallback
- API calls bypass the service worker (always network)
- Push notification handler with deep link support

### PWA Manifest (`public/manifest.json`)
- Standalone display mode (no browser chrome)
- Dark theme matching the app design
- SVG icon with maskable purpose

### Token Management
- Access tokens stored in sessionStorage (cleared on tab close)
- Tokens never stored in localStorage (prevents XSS persistence)
- WebSocket re-authenticates on every connection

## Design System

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `surface-base` | `#0a0a0b` | Page background |
| `surface-raised` | `#111114` | Card backgrounds |
| `accent` | `#5b63f5` | Primary actions, active states |
| `status-success` | `#22c55e` | Online, approved |
| `status-warning` | `#f59e0b` | Pending, attention needed |
| `status-error` | `#ef4444` | Denied, errors, failures |

### Touch Targets
- All interactive buttons: minimum 48px height
- Mobile nav items: minimum 52px width
- Approval decision buttons: 48px minimum height with full-width tap area

### Icons
- Lucide React icons throughout (Home, Shield, Terminal, Monitor, Bell)
- Consistent 16-20px size with stroke width varying by active state
