# TSM Reference Documentation

Technical reference documentation for the Tetra Service Manager (TSM).

## User Documentation

Start here if you're learning to use TSM:

**[TSM User Guide](../../../bash/tsm/README.md)** - Complete user guide with examples, commands, and troubleshooting

## Technical Documentation

For developers and contributors:

**[TSM Specification](../../../bash/tsm/TSM_SPECIFICATION.md)** - Complete technical specification including:
- Architecture overview
- Module structure (all 57 files documented)
- Function naming conventions
- Data structures (meta.json format)
- Loading sequence (7 phases explained)
- Process lifecycle (detailed call stacks)
- Port management system
- Public API reference

## Specialized Guides

### [Daemon Setup Guide](./daemon-setup.md)
**Audience**: System administrators, production deployments

How to run TSM as a systemd daemon for production environments:
- Systemd service configuration
- Multi-environment setup (@dev, @production)
- Auto-start on boot
- Service management with systemctl
- Log integration with journalctl

### [Testing Guide](./testing.md)
**Audience**: Contributors, QA engineers

Comprehensive testing documentation:
- Test suite overview (50 tests covering 93% of code)
- Individual test descriptions
- Running tests (all or specific)
- Test requirements (bash 5.2+, jq, lsof, nc)
- Coverage analysis
- Adding new tests

### [Architecture Review](./architecture-review.md)
**Audience**: Maintainers, architects

Historical analysis of TSM architecture decisions:
- Old refactoring recommendations (2025-10-23)
- What was fixed vs. what was rejected
- Why current architecture is sound
- File count justification (57 files)
- Performance considerations
- Future refactoring guidelines

## Quick Links

### User Guides
- [Quick Start](../../../bash/tsm/README.md#quick-start) - Get started in 2 minutes
- [Commands Reference](../../../bash/tsm/README.md#commands) - All TSM commands
- [Starting Processes](../../../bash/tsm/README.md#starting-processes) - Python, Node, bash examples
- [Diagnostics](../../../bash/tsm/README.md#diagnostics) - Port conflicts, orphaned processes, health checks
- [Interactive Mode](../../../bash/tsm/README.md#interactive-mode) - REPL usage
- [Troubleshooting](../../../bash/tsm/README.md#troubleshooting) - Common issues and fixes

### Technical Reference
- [Module Structure](../../../bash/tsm/TSM_SPECIFICATION.md#module-structure) - All 57 files documented
- [Function Naming](../../../bash/tsm/TSM_SPECIFICATION.md#naming-conventions) - tetra_tsm_*, tsm_*, _tsm_*
- [Data Structures](../../../bash/tsm/TSM_SPECIFICATION.md#data-structures) - meta.json format
- [Loading Sequence](../../../bash/tsm/TSM_SPECIFICATION.md#loading-sequence) - 7-phase bootstrap
- [Process Lifecycle](../../../bash/tsm/TSM_SPECIFICATION.md#process-lifecycle) - Start/stop flows
- [Port Management](../../../bash/tsm/TSM_SPECIFICATION.md#port-management) - Double-entry system
- [Public API](../../../bash/tsm/TSM_SPECIFICATION.md#public-api) - All API functions

### Developer Guides
- [Adding Commands](../../../bash/tsm/README.md#adding-new-commands) - Extend TSM CLI
- [Adding Services](../../../bash/tsm/README.md#adding-service-definitions) - Define new services
- [Running Tests](./testing.md#quick-start) - Test suite usage
- [Function Conventions](../../../bash/tsm/README.md#function-naming-conventions) - Coding standards

## Documentation Structure

```
tetra/
├── bash/tsm/
│   ├── README.md              # ← START HERE (User Guide)
│   ├── TSM_SPECIFICATION.md   # Technical specification
│   ├── core/                  # Source code
│   ├── process/
│   ├── system/
│   ├── services/
│   └── tests/
│       ├── README.md          # Test quick start
│       └── TEST_SUITE.md      # Detailed test docs
│
└── docs/reference/tsm/
    ├── README.md              # ← THIS FILE (Documentation Index)
    ├── daemon-setup.md        # Systemd integration
    ├── testing.md             # Complete testing guide
    └── architecture-review.md # Historical architecture analysis
```

## Contributing

When adding new features to TSM:

1. **Code**: Follow [function naming conventions](../../../bash/tsm/README.md#function-naming-conventions)
2. **Tests**: Add tests to `bash/tsm/tests/` - see [testing guide](./testing.md)
3. **Docs**: Update relevant sections:
   - User-facing features → [README.md](../../../bash/tsm/README.md)
   - Internal APIs → [TSM_SPECIFICATION.md](../../../bash/tsm/TSM_SPECIFICATION.md)
   - Systemd integration → [daemon-setup.md](./daemon-setup.md)

## Getting Help

- **User questions**: Start with [TSM README](../../../bash/tsm/README.md)
- **Technical questions**: See [TSM Specification](../../../bash/tsm/TSM_SPECIFICATION.md)
- **Troubleshooting**: Check [Troubleshooting section](../../../bash/tsm/README.md#troubleshooting)
- **Architecture questions**: Read [Architecture Review](./architecture-review.md)
- **Test failures**: See [Testing Guide](./testing.md)

## License

Part of the Tetra project. See main repository for license information.
