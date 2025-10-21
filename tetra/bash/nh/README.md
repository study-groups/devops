# NodeHolder Bridge

This directory is a **bridge** between NodeHolder and Tetra, not a duplication of functionality.

## Architecture Philosophy

### Single Source of Truth: `doctl` (DigitalOcean API)

```
doctl (DigitalOcean API)
         ↓
    NodeHolder
    (../nh)
         ↓
   digocean.json  ← THE BRIDGE
         ↓
      Tetra
    (./tetra)
```

### Clean Separation

**NodeHolder (../nh):**
- Stores doctl API credentials
- Fetches infrastructure from DigitalOcean
- Outputs: `digocean.json`

**Tetra (./tetra):**
- NO doctl credentials
- Converts `digocean.json` → `tetra.toml`
- Manages deployments, secrets, environments

**Bridge Contract:** `digocean.json` is the interface

## What bash/nh Does

✅ **Helper Functions:**
- Check if NodeHolder is available
- Validate digocean.json format
- Check age of infrastructure data
- Suggest when to refresh

✅ **Workflow Documentation:**
- Documents the nh ↔ tetra relationship
- Provides helpful error messages
- Shows examples

✅ **Optional Integration:**
- Can invoke NodeHolder commands (with user permission)
- Provides workflow convenience

## What bash/nh Does NOT Do

❌ **NOT a Duplication:**
- Does NOT store doctl credentials
- Does NOT fetch from DigitalOcean directly
- Does NOT duplicate NodeHolder code
- Does NOT make Tetra dependent on NodeHolder

## Usage

### Check NodeHolder Status
```bash
source bash/nh/nh_bridge.sh
nh_status
```

### Validate digocean.json
```bash
nh_validate_json ~/nh/myorg/digocean.json
```

### Check if Data is Stale
```bash
nh_suggest_refresh ~/nh/myorg/digocean.json 30  # 30 days
```

### Fetch Latest (with confirmation)
```bash
nh_fetch_latest myorg
```

### Show Workflow
```bash
nh_show_workflow
```

## Complete Workflow

### 1. Fetch Infrastructure (in NodeHolder)
```bash
cd ../nh
source bash/doctl.sh
nh_doctl_get_all
# Creates: ~/nh/<context>/digocean.json
```

### 2. Import to Tetra
```bash
org import nh ~/nh/myorg myorg
# Interactive discovery
# Creates org structure
```

### 3. Configure Secrets
```bash
org secrets init myorg
$EDITOR $TETRA_DIR/org/myorg/secrets.env
org secrets validate myorg
```

### 4. Compile and Deploy
```bash
org compile myorg
org switch myorg
org push myorg dev
```

## Refresh Workflow

When infrastructure changes:

```bash
# 1. Update in NodeHolder
cd ../nh
nh_doctl_get_all

# 2. Refresh in Tetra
org refresh myorg ~/nh/myorg/digocean.json
```

## Tetra Works Without NodeHolder

Tetra can work completely independently:
- Import any valid digocean.json from any source
- Manually create organization configs
- No dependency on NodeHolder installation

NodeHolder is recommended but optional.

## Files

```
bash/nh/
├── README.md           # This file
├── nh_bridge.sh       # Bridge helper functions
└── includes.sh        # Module loader
```

## Integration with Org REPL

The org REPL integrates NodeHolder awareness:

```bash
org> import nh ~/nh/myorg myorg
✓ NodeHolder directory found
⚠️  digocean.json is 45 days old
   Run: cd ../nh && nh_doctl_get_all
   Continue with existing data? [y/N]

org> refresh myorg
✓ Checking for updates...
  To fetch latest: nh_fetch_latest myorg
```

## See Also

- NodeHolder repository: `../nh`
- Org management: `bash/org/`
- Workflow help: `org help workflow nodeholder-to-toml`
