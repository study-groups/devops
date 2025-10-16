# RAG Module TCS Integration

RAG module now follows TCS 3.0 with action-based API and bash completion.

## What Changed

### New Files
- **actions.sh** - TCS-compliant action declarations (6 actions)
- **rag_completion.sh** - Bash completion for `rag` and `mc` commands
- **includes.sh** - Module loader for TCS integration

### Modified Files
- **core/multicat/multicat.sh** - Added `mc --agent` listing (no args)

## Usage

### 1. Multicat with Agents

```bash
# List available agents
mc --agent

# Use specific agent
mc --agent claude-code -r .

# Generate example for agent
mc --example openai
```

### 2. RAG Actions (for TUI integration)

```bash
# Query ULM (semantic code search)
rag query ulm "authentication logic" ./src

# Query QA (LLM API)
rag query qa "How does auth work?"

# List recent queries
rag list queries

# List available agents
rag list agents

# Set default agent
rag set agent claude-code

# Generate context with ULM + agent
rag generate context "login flow" claude-code ./src
```

### 3. Bash Completion

After sourcing `rag_completion.sh`:

```bash
rag <TAB><TAB>          # Shows: query list set generate
rag query <TAB><TAB>    # Shows: ulm qa
rag set agent <TAB><TAB> # Shows: base openai claude-code
```

## TCS Compliance

All actions follow **Tetra Core Specification 3.0**:

```bash
# Action pattern: verb:noun
query:ulm       # Search with ULM
query:qa        # Ask LLM
list:queries    # Show history
set:agent       # Configure agent
generate:context # Build MULTICAT
list:agents     # Show available agents
```

## Integration with Demo 013

RAG module auto-discovers in TUI (demo/basic/013) via:

1. **Module Discovery**: TUI scans `bash/*/actions.sh`
2. **Action Registration**: Calls `rag_register_actions()`
3. **Execution**: Routes to `rag_execute_action(action, args...)`
4. **Filtering**: Actions only appear in `Local` context

## Type Contracts

```bash
query:ulm :: (query_text:string, [path:string]) → @tui[content]
  where Effect[read]

query:qa :: (question:string) → @tui[content]
  where Effect[api_call, cache, @rag[db/timestamp.answer]]

list:queries :: () → @tui[content]
  where Effect[read]

set:agent :: (agent_name:string) → @tui[status]
  where Effect[@rag[config/agent]]

generate:context :: (ulm_query:string, [agent:string], [path:string]) → @app[stdout]
  where Effect[read, @rag[cache/context.mc]]

list:agents :: () → @tui[content]
  where Effect[read]
```

## Local Only

Current implementation is **LOCAL execution only**:
- No remote (Dev/Staging/Prod) support yet
- No SSH/TES resolution
- Reads from local filesystem and APIs only

Future: Add remote ULM queries and distributed RAG operations.

## Testing

```bash
# Source the module
source ~/tetra/tetra.sh  # Ensures TETRA_SRC is set
source bash/rag/includes.sh

# Test action registration
type rag_register_actions  # Should show function

# Test agent listing
mc --agent

# Test completion (requires bash-completion package)
source bash/rag/rag_completion.sh
rag <TAB><TAB>
```

## Next Steps

1. **Create chatgpt.conf** - Agent profile for ChatGPT web
2. **Create openai-api.conf** - Direct API agent profile
3. **Create claude.conf** - Claude.ai web interface profile
4. **TUI Integration** - Test in demo/basic/013
5. **Remote Actions** - Add Dev/Staging RAG queries via TES
