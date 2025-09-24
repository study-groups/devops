# TView Look & Feel Refactor Plan

## Current Issues
- Content area shows same action list regardless of ENVxMode combination
- No contextual information for specific environment/mode pairs
- Static, generic content that doesn't reflect actual capabilities
- Modal system works but content generation is scattered

## Proposed Architecture

### 1. Dynamic Content System
```
bash/tview/content/
├── registry/
│   ├── env_capabilities.sh     # What each env can do
│   ├── mode_definitions.sh     # Mode-specific functionality
│   └── combination_matrix.sh   # ENVxMode content mapping
├── generators/
│   ├── tetra_content.sh       # TETRA env content (overview)
│   ├── local_content.sh       # LOCAL env content
│   ├── remote_content.sh      # DEV/STAGING/PROD/QA content
│   └── mode_content.sh        # Mode-specific content generators
└── templates/
    ├── dashboard_template.sh   # Main content area template
    ├── status_template.sh     # Status information template
    └── action_template.sh     # Action list template
```

### 2. ENVxMode Content Matrix (42 combinations)

#### TETRA Environment (Overview/Summary)
- **TETRA×TOML**: Configuration overview, active org, validation status
- **TETRA×TKM**: SSH key summary, all environments status
- **TETRA×TSM**: Service manager overview, multi-env status
- **TETRA×DEPLOY**: Deployment pipeline status, readiness
- **TETRA×ORG**: Organization management, switching
- **TETRA×RCM**: Remote command center, environment selection
- **TETRA×SPAN**: Span system overview, storage summary

#### LOCAL Environment (Development machine)
- **LOCAL×TOML**: Local config, development settings
- **LOCAL×TKM**: Local SSH setup, key generation
- **LOCAL×TSM**: Local services, development processes
- **LOCAL×DEPLOY**: Local build status, deployment prep
- **LOCAL×ORG**: Local organization config, templates
- **LOCAL×RCM**: Local command execution, scripts
- **LOCAL×SPAN**: Local span storage, editing

#### Remote Environments (DEV/STAGING/PROD/QA)
- **REMOTE×TOML**: Environment-specific config, validation
- **REMOTE×TKM**: Remote SSH status, key deployment
- **REMOTE×TSM**: Remote service management, monitoring
- **REMOTE×DEPLOY**: Environment deployment status, history
- **REMOTE×ORG**: Environment org config, sync status
- **REMOTE×RCM**: Remote command execution, monitoring
- **REMOTE×SPAN**: Remote span access, synchronization

### 3. Content Components

#### Status Panel (Top of content area)
```
┌─ TETRA × TOML ─────────────────────────────────────────────┐
│ 🏢 pixeljam-arcade | ✅ Config Valid | 📊 3 Environments   │
│ 📄 Active: tetra.toml | 🔄 Last Updated: 2h ago             │
└─────────────────────────────────────────────────────────────┘
```

#### Context-Aware Actions (Middle area)
```
Configuration Management:
 ► View Active Configuration    📄 Show current TOML
   Edit Configuration          ✏️  Modify settings
   Validate Syntax             ✅ Check TOML validity
   Compare Environments        🔍 Diff configs

Environment Operations:
   Deploy to DEV               🚀 Push config
   Deploy to STAGING           🎯 Stage changes
   Sync from Production        ⬇️  Pull prod config
```

#### Real-time Information (Bottom area)
```
Environment Status:
DEV: ✅ Online | STAGING: ⚠️ Deploying | PROD: ✅ Stable
Last Activity: tsm restart tetra.service (2m ago)
```

### 4. Implementation Phases

#### Phase 1: Content Registry
- Create capability mapping system
- Define what each ENVxMode can do
- Build content generation framework

#### Phase 2: Template System
- Design responsive content templates
- Implement status panels
- Create action list generators

#### Phase 3: Real-time Updates
- Add live status information
- Implement content refresh system
- Add environment health indicators

#### Phase 4: Interaction Enhancement
- Improve navigation within content
- Add quick actions and shortcuts
- Enhance modal system integration

### 5. Content Examples

#### TETRA×TSM (Service Overview)
```
Service Manager Overview
═══════════════════════
🖥  Local:    3 services running
🌐 DEV:      ✅ 2/2 services healthy
🎯 STAGING:  ⚠️  1 service restarting
🏭 PROD:     ✅ 3/3 services optimal
🧪 QA:       ❌ Connection failed

Quick Actions:
→ Check all environments
→ Restart failed services
→ View aggregated logs
→ Deploy to environment
```

#### DEV×TKM (Key Management)
```
SSH Key Management - DEV Environment
═══════════════════════════════════════
🔗 Connection: tetra@dev.pixeljamarcade.com
🔑 Key Status: ✅ Authenticated
👤 Active User: tetra
⏱  Last Test: 5 minutes ago

Available Operations:
→ Test SSH Connection      🔍 Verify access
→ Deploy New Keys          🔑 Update authentication
→ Rotate Keys              🔄 Security rotation
→ Check Authorized Keys    📋 View server keys
→ Generate Backup Keys     💾 Create backups
```

#### LOCAL×SPAN (Span Management)
```
Span Storage - Local Development
═══════════════════════════════════
📚 Active Multispan: dev-workspace
💾 Storage: 12/50 slots used
🔄 Sync Status: ✅ Up to date
📁 Last Backup: 1 hour ago

Current Spans:
1. config-templates    (5 items)
2. deployment-scripts  (8 items)
3. api-endpoints      (12 items)
4. test-data         (3 items)

Actions:
→ Create New Multispan
→ Import/Export Data
→ Backup Current State
→ Sync with Remote
```

### 6. Technical Implementation

#### Dynamic Content Generation
```bash
# Main content generator
generate_env_mode_content() {
    local env="$1" mode="$2"

    # Load capability matrix
    local capabilities=$(get_env_mode_capabilities "$env" "$mode")

    # Generate status panel
    local status_panel=$(generate_status_panel "$env" "$mode")

    # Generate context-aware actions
    local action_list=$(generate_action_list "$env" "$mode" "$capabilities")

    # Generate real-time info
    local realtime_info=$(generate_realtime_info "$env" "$mode")

    # Combine into final content
    combine_content_sections "$status_panel" "$action_list" "$realtime_info"
}
```

This refactor will transform TView from a generic interface into a contextual, intelligent dashboard that adapts its content based on the specific environment and mode combination.