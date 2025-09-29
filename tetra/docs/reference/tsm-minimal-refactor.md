# TSM Minimal Refactor Plan

## Current Status: TSM is Working Well ✅

After fixing the fork loop issue, TSM now loads all components successfully with the new organized structure. The system is stable and functional.

## Strategy: Minimal Risk, Incremental Improvement

Instead of a massive refactor, take a conservative approach that preserves stability while making targeted improvements.

## Phase 1: Remove Only Obvious Duplicates (Low Risk)

**Verified Safe Removals - Files with direct equivalents in new structure:**

```bash
# Core components (verified identical or obsolete)
rm bash/tsm/tsm_config.sh        # → core/config.sh (in use)
rm bash/tsm/tsm_utils.sh         # → core/utils.sh (in use)
rm bash/tsm/tsm_validation.sh    # → core/validation.sh (in use)
rm bash/tsm/tsm_environment.sh   # → core/environment.sh (in use)
rm bash/tsm/tsm_files.sh         # → core/files.sh (in use)
rm bash/tsm/tsm_helpers.sh       # → core/helpers.sh (in use)
rm bash/tsm/tsm_setup.sh         # → core/setup.sh (in use)

# System components (verified working in new location)
rm bash/tsm/tsm_formatting.sh    # → system/formatting.sh (in use)
rm bash/tsm/tsm_ports.sh         # → system/ports.sh (in use)
rm bash/tsm/tsm_doctor.sh        # → system/doctor.sh (in use)
rm bash/tsm/tsm_monitor.sh       # → system/monitor.sh (in use)

# Obviously obsolete
rm bash/tsm/OBSOLETE_tsm_core_improved.sh
```

**Files to Investigate Before Removal (Medium Risk):**
```bash
# Check these for unique functionality first
bash/tsm/tsm_core.sh         # Compare with core/core.sh
bash/tsm/tsm_interface.sh    # Compare with interfaces/cli.sh
bash/tsm/tsm_repl.sh         # Compare with interfaces/repl.sh
bash/tsm/index.sh            # Compare with tsm.sh
bash/tsm/includes.sh         # Compare with include.sh
bash/tsm/tserve.sh           # May be separate service
```

**Files to Keep For Now (High Risk to Remove):**
```bash
# These may contain unique functionality
bash/tsm/tsm_list.sh         # Process listing logic
bash/tsm/tsm_lifecycle.sh    # Process lifecycle management
bash/tsm/tsm_process.sh      # Process management
bash/tsm/tsm_service.sh      # Service definitions
bash/tsm/tsm_audit.sh        # Audit functionality
bash/tsm/tsm_analytics.sh    # Analytics features
```

## Phase 2: Proof of Concept - Lifecycle Interface (1-2 Components)

**Test the component lifecycle pattern on just 2 components to prove value:**

### Test Component 1: resource_manager (Already Has Interface)
```bash
# system/resource_manager.sh already has:
_tsm_component_resource_manager_info() { ... }
_tsm_component_resource_manager_init() { ... }
_tsm_component_resource_manager_start() { ... }
_tsm_component_resource_manager_stop() { ... }
```

### Test Component 2: Add to analytics
```bash
# Add to system/analytics.sh:
_tsm_component_analytics_info() {
    echo "name:analytics"
    echo "type:system"
    echo "dependencies:config,resource_manager"
    echo "description:System metrics collection"
    echo "implementations:bash"
}

_tsm_component_analytics_init() {
    # Move any initialization logic here
    echo "Analytics component initialized"
}

_tsm_component_analytics_start() {
    echo "Analytics monitoring started"
}

_tsm_component_analytics_stop() {
    echo "Analytics monitoring stopped"
}
```

## Phase 3: Simple Discovery Test

**Add basic component discovery to test value:**

```bash
# Add to core/core.sh or create simple core/discovery.sh:
tsm_list_components() {
    echo "Available TSM Components:"
    for func in $(declare -F | awk '{print $3}'); do
        if [[ $func =~ ^_tsm_component_(.+)_info$ ]]; then
            local component="${BASH_REMATCH[1]}"
            echo "  - $component"
        fi
    done
}

# Test with:
# tsm_list_components
```

## Implementation Commands

### Step 1: Backup Current State
```bash
cd /path/to/tetra
cp -r bash/tsm bash/tsm_backup_$(date +%Y%m%d)
```

### Step 2: Remove Safe Duplicates
```bash
cd bash/tsm

# Remove verified safe files
rm tsm_config.sh tsm_utils.sh tsm_validation.sh tsm_environment.sh
rm tsm_files.sh tsm_helpers.sh tsm_setup.sh
rm tsm_formatting.sh tsm_ports.sh tsm_doctor.sh tsm_monitor.sh
rm OBSOLETE_tsm_core_improved.sh

echo "Safe duplicates removed"
```

### Step 3: Test TSM Still Works
```bash
./bash/tsm/tsm.sh list
./bash/tsm/tsm.sh services
./bash/tsm/tsm.sh doctor

# Should work identically to before
```

### Step 4: Add Lifecycle to Analytics (If Step 3 Passes)
```bash
# Edit system/analytics.sh to add lifecycle interface
# Test the new pattern works
```

## Validation Criteria

**After Each Phase:**
```bash
# TSM must continue working normally
./bash/tsm/tsm.sh list                    # Should show process table
./bash/tsm/tsm.sh services               # Should show service audit
./bash/tsm/tsm.sh doctor                 # Should run diagnostics
./bash/tsm/tsm.sh ports                  # Should show port status

# No errors during loading
# All existing functionality preserved
```

## Success Metrics (Conservative)

- [ ] 10-15 obvious duplicate files removed safely
- [ ] TSM functionality completely preserved
- [ ] 2 components have lifecycle interface (proof of concept)
- [ ] Basic component discovery working
- [ ] Foundation established for future expansion
- [ ] Zero regression in functionality
- [ ] Codebase cleaner and more maintainable

## Next Steps (Future Iterations)

**Only if Phases 1-3 prove successful:**
1. Add lifecycle interface to 3-4 more components
2. Investigate remaining legacy files for unique functionality
3. Consider action signature standardization (if needed)
4. Evaluate multi-implementation support (if use cases emerge)

## Risk Level: LOW ✅

This approach:
- Preserves working system
- Makes incremental improvements
- Provides early validation of new patterns
- Allows rollback at any stage
- Focuses on proven value over theoretical benefits

Copy this plan and start with Phase 1 in a new chat session.