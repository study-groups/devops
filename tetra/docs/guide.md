# Assistant Guide

Concise reference for LLM assistants working on the Tetra infrastructure management system.

## Context Overview

**Tetra** is a modular bash environment providing structured service management, development tools, and multi-client infrastructure orchestration.

**Core Components:**
- **tmod**: Module manager and system orchestrator
- **TSM**: Service lifecycle management with named port registry
- **TDash**: Modal dashboard interface with dual-axis control
- **Organizations**: Multi-client infrastructure configurations

**Current Status**: Production-ready with complete testing infrastructure.

## Essential Session Reading

Read these files at session start to understand current state:

1. **`docs/changes.md`** - Recent implementations and current status
2. **`docs/next.md`** - Priorities and roadmap for ongoing work
3. **`docs/index.md`** - Architecture overview and quick reference

## Terminology

**Anthropic API Terms:**
- **User**: Human developer/operator working with Tetra
- **Assistant**: LLM providing development assistance
- **Context**: Current conversation state and codebase knowledge
- **Message**: Communication units in the conversation
- **Tool Use**: Function/API calls within assistant messages

**Tetra System Terms:**
- **Module**: Bash component managed by tmod (lazy-loaded)
- **Service**: Application process managed by TSM
- **Organization**: Multi-client infrastructure configuration
- **Environment**: Deployment target (dev → staging → prod)
- **Modal Interface**: TDash's dual-axis control system

## Default Task Approach

1. **Read Essential Docs**: Start with session reading list above
2. **Implement from Roadmap**: Work on features from `docs/next.md` priority list
3. **Update Documentation**: Update `docs/changes.md` when completing significant work
4. **Follow Patterns**: Use existing code patterns and module structure
5. **Test Changes**: Run appropriate test suites from `tests/` directory

## Code Standards

**Reference Format**: `file_path:line_number` for code locations

**Path Format**: `TETRA_SRC/bash/module_name` for tetra bash files

**File Operations**:
- Prefer editing existing files over creating new ones
- Avoid "fix/clean/new" prefixes in code/files
- Use `#!/usr/bin/env bash` for new scripts

**Module Structure**: Follow tmod patterns for new components

## System Integration

**Module Loading**: All components load through tmod system
**Service Management**: Use TSM for application lifecycle
**Testing**: Run comprehensive tests before significant changes
**Documentation**: Keep docs current with implementation

---

*For technical architecture details, see [architecture.md](architecture.md)*
*For development patterns, see [reference/development/](reference/development/)*