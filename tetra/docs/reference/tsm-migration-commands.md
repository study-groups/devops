# TSM Migration Commands - Ready to Execute

## Pre-Migration Validation

```bash
# Verify TSM is currently working
./bash/tsm/tsm.sh list
./bash/tsm/tsm.sh doctor

# Create backup of current state
git add -A
git commit -m "Pre-TSM-cleanup checkpoint - working state"
```

## Migration Execution

### Single Command - Remove All 27 Duplicate Files

```bash
# Copy and paste this entire command block:
cd "$TETRA_SRC" && rm -f \
  bash/tsm/tsm_config.sh \
  bash/tsm/tsm_utils.sh \
  bash/tsm/tsm_validation.sh \
  bash/tsm/tsm_environment.sh \
  bash/tsm/tsm_files.sh \
  bash/tsm/tsm_helpers.sh \
  bash/tsm/tsm_setup.sh \
  bash/tsm/tsm_core.sh \
  bash/tsm/tsm_formatting.sh \
  bash/tsm/tsm_ports.sh \
  bash/tsm/tsm_doctor.sh \
  bash/tsm/tsm_monitor.sh \
  bash/tsm/tsm_patrol.sh \
  bash/tsm/tsm_analytics.sh \
  bash/tsm/tsm_audit.sh \
  bash/tsm/tsm_resource_manager.sh \
  bash/tsm/tsm_session_aggregator.sh \
  bash/tsm/tsm_process.sh \
  bash/tsm/tsm_lifecycle.sh \
  bash/tsm/tsm_inspect.sh \
  bash/tsm/tsm_list.sh \
  bash/tsm/tsm_service.sh \
  bash/tsm/tsm_services_config.sh \
  bash/tsm/tsm_interface.sh \
  bash/tsm/tsm_repl.sh \
  bash/tsm/tsm_cli.sh \
  bash/tsm/tsm_nginx.sh \
  bash/tsm/tsm_systemd.sh \
  bash/tsm/tsm_tview.sh \
  bash/tsm/OBSOLETE_tsm_core_improved.sh \
  && echo "✅ Successfully removed 27 duplicate TSM files"
```

## Post-Migration Validation

### Immediate Tests
```bash
# Test core functionality
./bash/tsm/tsm.sh list
./bash/tsm/tsm.sh doctor
./bash/tsm/tsm.sh start web --port=3000 --env=dev
./bash/tsm/tsm.sh stop web

# Test include system
bash -n bash/tsm/include.sh
bash -n bash/tsm/tsm.sh

# Test REPL interface
echo "list" | ./bash/tsm/tsm.sh repl
```

### File Count Verification
```bash
# Before: Should show ~70 files
find bash/tsm -name "*.sh" | wc -l

# After cleanup: Should show ~43 files
find bash/tsm -name "*.sh" | wc -l

# Remaining structure should be clean
ls -la bash/tsm/
```

### Expected Clean Structure
```
bash/tsm/
├── core/           # 9 files (config, utils, helpers, etc.)
├── system/         # 9 files (analytics, monitor, ports, etc.)
├── process/        # 4 files (management, lifecycle, etc.)
├── services/       # 3 files (definitions, registry, startup)
├── interfaces/     # 2 files (cli, repl)
├── integrations/   # 3 files (nginx, systemd, tview)
├── tests/          # 13 test files
├── tview/          # 2 files (TView integration)
├── tsm.sh          # Main entry point
├── include.sh      # Component loader
├── tserve.sh       # Basic server
├── tserve_enhanced.sh  # Enhanced server
├── tsm_discover.sh # Service discovery
└── [other essential files]
```

## Rollback Plan

If anything breaks:
```bash
# Instant rollback - restores all removed files
git checkout HEAD -- bash/tsm/tsm_*.sh
git checkout HEAD -- bash/tsm/OBSOLETE_*.sh

# Verify rollback worked
./bash/tsm/tsm.sh list
```

## Success Criteria

✅ **Migration Successful When:**
- `./bash/tsm/tsm.sh list` works
- `./bash/tsm/tsm.sh doctor` reports healthy
- File count reduced from ~70 to ~43
- No tsm_*.sh duplicates remain (except tsm.sh and tsm_discover.sh)
- All organized directories intact (core/, system/, process/, etc.)

✅ **Benefits Achieved:**
- 40% reduction in file count
- Eliminated confusing dual structure
- Single source of truth for each component
- Cleaner directory structure
- Easier navigation and maintenance

## Post-Migration Cleanup

```bash
# Optional: Clean up git history
git add -A
git commit -m "TSM cleanup: Remove 27 duplicate tsm_*.sh files

- Removed flat structure duplicates that existed alongside organized structure
- Kept organized hierarchical structure (core/, system/, process/, etc.)
- Preserved unique files (tsm_discover.sh, tserve_enhanced.sh)
- Reduced file count by 40% while maintaining full functionality"
```

## Next Steps After Migration

1. **Update Documentation:** References to old tsm_*.sh files
2. **Test Edge Cases:** Any scripts that might reference old paths
3. **Consider Further Cleanup:** Look for other modules with similar patterns
4. **Celebrate:** You've successfully decluttered TSM! 🎉