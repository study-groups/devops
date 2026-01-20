# Terrain Protocol Documentation Plan

## Overview

Document all logging and internal web communication protocols used in the TETRA dashboard for host/client-iframe communication.

---

## Phase 1: Message Bus Architecture

### 1.1 Terrain.Bus Core
- [ ] Document pub/sub pattern
- [ ] Wildcard subscriptions (`'*'`)
- [ ] Topic-specific subscriptions
- [ ] `_notify()` internal notification mechanism

### 1.2 Parent/Iframe Role Detection
- [ ] `_isParent` auto-detection (`window.parent === window`)
- [ ] Different behavior in parent vs iframe context
- [ ] `configure({ panels })` for parent mode

### 1.3 Routing Mechanisms
- [ ] `publish(msg)` - broadcast to all
- [ ] `route(panel, msg)` - targeted delivery
- [ ] `broadcast(msg, excludeSource)` - all except sender

---

## Phase 2: Message Format & Timestamps

### 2.1 Message Structure
- [ ] Required fields: `type`, `source`/`from`
- [ ] Routing annotations: `_from`, `_to`, `_trace`
- [ ] Payload conventions per message type

### 2.2 Dual Timestamp Convention
- [ ] **Message-level**: `timestamp: Date.now()` (milliseconds)
- [ ] **API-level**: `ts: Date.now() / 1000` (seconds, Unix epoch)
- [ ] When each is used and why

### 2.3 Message Types Catalog
- [ ] `ready` - iframe initialization complete
- [ ] `env-change` - context switch
- [ ] `mode-change` - panel/full-panel toggle
- [ ] `log-watch-change` - cross-panel log subscription
- [ ] `injectTokens` - CSS variable injection
- [ ] `request-timings` / `timing-update` - performance monitoring

---

## Phase 3: Client/Server Targeting

### 3.1 Target Resolution
- [ ] `panel.dataset.view` as target identifier
- [ ] `_to` field in routed messages
- [ ] How parent finds the right iframe

### 3.2 Communication Patterns
```
Pattern 1: Iframe → Parent
  Terrain.Iframe.send(msg)
  window.parent.postMessage(msg, '*')

Pattern 2: Parent → Single Iframe
  Terrain.Bus.route(panel, msg)
  iframe.contentWindow.postMessage({...msg, _to: target}, '*')

Pattern 3: Parent → All Iframes
  Terrain.Bus.publish(msg)
  panels.forEach(p => p.iframe.postMessage(msg, '*'))

Pattern 4: Iframe → Iframe (via Parent)
  Iframe A → Parent → Iframe B
  Uses broadcast() with excludeSource
```

### 3.3 Developer Panel Special Case
- [ ] Subscribes to `'*'` for message visualization
- [ ] Receives all routed messages for debugging

---

## Phase 4: Terrain.State (Shared Context)

### 4.1 State Properties
- [ ] `org` - organization namespace
- [ ] `env` - environment (local/dev/staging/prod)
- [ ] `user` - SSH user override

### 4.2 State Synchronization
- [ ] `initFromUrl()` - initial state from query params
- [ ] `update(msg)` - apply env-change message
- [ ] `onEnvChange(callback)` - react to changes
- [ ] `apiUrl(endpoint)` - build URL with context params

---

## Phase 5: Terrain.Iframe (Iframe Helpers)

### 5.1 Initialization
- [ ] `init({ name, onMessage, onReady, useSharedState })`
- [ ] Auto-detection of panel name from title/URL
- [ ] Ready signal emission

### 5.2 Event Delegation
- [ ] `on(action, handler)` - data-action binding
- [ ] Click and change event handling
- [ ] DOM action pattern

### 5.3 Message Handling
- [ ] Automatic `env-change` → State update
- [ ] Automatic `mode-change` → Mode.set()
- [ ] Automatic `injectTokens` → CSS variable application

---

## Phase 6: Terrain.Mode (Display Modes)

### 6.1 Mode Definition
- [ ] `define(name, cssVars)` - register modes
- [ ] CSS variable naming: camelCase → --terrain-kebab-case
- [ ] Built-in modes: panel, full-panel, single-page

### 6.2 Mode Detection & Switching
- [ ] `autoDetect({ iframe, standalone })`
- [ ] `detect()` - apply based on context
- [ ] `set(mode)` - manual switch
- [ ] `onChange(callback)` - react to changes

### 6.3 CSS Integration
- [ ] `body[data-terrain-mode="X"]` selectors
- [ ] `var(--terrain-padding)` etc.

---

## Phase 7: Terrain.Design (Token Viewer)

### 7.1 Activation
- [ ] URL param: `?design=true`
- [ ] `isEnabled()` check
- [ ] Auto-initialization

### 7.2 UI Components
- [ ] FAB button (bottom-right)
- [ ] Token panel with categories
- [ ] Click-to-copy functionality

### 7.3 Token Categories
- [ ] Colors, Paper/Background, Layout, Typography, Terrain Mode, Other
- [ ] Extraction from `:root` stylesheets
- [ ] Color swatch rendering

---

## Phase 8: Logging & Debugging

### 8.1 Console Logging
- [ ] `[Console] Message:` in parent
- [ ] `[Terrain.X] ...` prefix convention
- [ ] Debug flag for verbose logging

### 8.2 Performance Tracking
- [ ] `iframeTimings` Map in parent
- [ ] Load start/end timestamps
- [ ] Panel header timing display
- [ ] Admin panel timing table

### 8.3 Message Tracing
- [ ] `_trace` array for routing path
- [ ] `_from` / `_to` annotations
- [ ] Developer panel visualization

---

## Phase 9: Protocol Versioning

### 9.1 Legacy Protocol (v1 - Current)
- [ ] Simple `{ type, from, source, ... }` format
- [ ] Millisecond timestamps
- [ ] Used by all current iframes

### 9.2 SDK Protocol (v2 - Available)
- [ ] MQTT-style topics: `terrain/panel/deploy/ready`
- [ ] Packet types: EVENT, COMMAND, STATE, CONTROL, RESPONSE
- [ ] Second-based timestamps
- [ ] `_legacy` field for backwards compatibility

### 9.3 Migration Path
- [ ] `_normalize()` auto-conversion
- [ ] Dual-format support period

---

## Deliverables

1. **help-data.js** - Comprehensive help sections in admin panel
2. **PROTOCOL.md** - Full protocol specification
3. **MESSAGES.md** - Message type reference
4. **DEBUGGING.md** - Debugging guide with examples

---

## Priority Order

1. Message format & timestamps (most asked about)
2. Client/server targeting (core routing)
3. State synchronization (common issues)
4. Mode system (frequently customized)
5. Design tokens (new feature)
6. Protocol versioning (future planning)
