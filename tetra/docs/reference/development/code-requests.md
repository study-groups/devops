# Crafting Code Requests for Tetra

Guide for structuring development requests when working with Tetra infrastructure.

## Request Structure

### 1. **Context Setting**
Always provide current system state:
```
"Based on docs/changes.md and docs/next.md, I need to..."
```

### 2. **Specific Component Reference**
Use proper Tetra terminology:
- **Module**: `tmod load tsm` (not "the TSM thing")
- **Service**: `tsm start devpages` (not "the devpages app")
- **Organization**: `tetra org switch pixeljam`
- **Environment**: `tetra env promote dev staging`

### 3. **Implementation Scope**
Be explicit about boundaries:
- "Implement TSM port scanning in tsm_ports.sh:45-67"
- "Add TDash ORG mode rendering for LOCAL environment"
- "Create organization template validation in tetra_org.sh"

## Anthropic + Tetra Hybrid Terminology

### User Intent Patterns
- **"I need the assistant to..."** - Clear delegation to LLM
- **"The user wants..."** - Referencing yourself in context
- **"The system should..."** - Describing Tetra behavior
- **"The module needs..."** - Component-specific requirements

### Context References
- **"Current context shows..."** - Referring to conversation state
- **"System context indicates..."** - Referring to Tetra state
- **"Message history suggests..."** - Conversation analysis
- **"Tool use results show..."** - Previous command outputs

## Module-Specific Request Patterns

### TSM (Service Manager) Requests
```bash
# Good
"Implement named port validation in TSM_NAMED_PORTS array"
"Add service restart functionality to tsm_core.sh:service_restart()"

# Avoid
"Fix the port stuff" or "Make services work better"
```

### TDash (Modal Dashboard) Requests
```bash
# Good
"Add ORG:STAGING mode rendering with organization config display"
"Implement dual-axis navigation state persistence"

# Avoid
"Improve the dashboard" or "Make navigation smoother"
```

### tmod (Module Manager) Requests
```bash
# Good
"Add dependency resolution to tetra_load_module() function"
"Implement module unloading in tmod_core.sh"

# Avoid
"Better module loading" or "Module system enhancements"
```

## File Operation Requests

### Editing Preferences
```bash
# Preferred
"Edit TETRA_SRC/bash/tsm/tsm_ports.sh to add port conflict detection"

# Acceptable
"Modify the TSM port registry to include conflict checking"

# Avoid
"Fix the port conflicts in TSM"
```

### Path References
```bash
# Correct Format
"Update tsm_interface.sh:127 to use tsm_resolve_service_port()"

# Module Path Format
"Modify TETRA_SRC/bash/tdash/tdash_repl.sh render functions"
```

## Testing Integration

### Test Request Patterns
```bash
# Specific
"Run tests/test_tsm_service_management_comprehensive.sh after TSM changes"

# Comprehensive
"Execute run_all_comprehensive_tests.sh to validate system state"

# Development
"Create test cases for new tmod dependency resolution"
```

## Documentation Updates

### Change Documentation
```bash
# Required Pattern
"Update docs/changes.md with completed TSM port scanning implementation"

# Roadmap Updates
"Move completed tasks from docs/next.md to docs/changes.md"
```

## Common Anti-Patterns

### Avoid These Request Styles
- **Vague scope**: "Improve the system" → "Add port conflict detection to TSM"
- **Missing context**: "Fix this" → "Based on test failure in line 45..."
- **Wrong terminology**: "The app" → "The service managed by TSM"
- **No file reference**: "Update it" → "Edit tsm_core.sh:service_start()"

### Better Request Examples
```bash
# Instead of: "Make TSM better"
"Implement automatic port allocation in tsm_ports.sh:allocate_port()"

# Instead of: "Fix TDash"
"Add missing ORG:PROD mode rendering in tdash_repl.sh:render_org_prod()"

# Instead of: "Improve modules"
"Add lazy loading validation to tmod_core.sh:tetra_load_module()"
```

---

*See [terminology.md](terminology.md) for complete term reference*
*See [../guide.md](../guide.md) for assistant workflow*