# QA Integration with RAG

## Summary

QA is now integrated into RAG as an agent. You can use RAG's evidence selection and context assembly, then submit directly to QA for answers.

## What Was Added

### 1. QA Agent Profile
**File:** `bash/rag/agents/qa.conf`

- Optimized for Q&A workflows with OpenAI models
- Emphasis on analysis rather than code generation
- Stores Q&A history in `$QA_DIR/db`

### 2. Submit Module
**File:** `bash/rag/core/qa_submit.sh`

- `submit_to_qa()` - Sends assembled context to QA
- Reads `build/prompt.mdctx`
- Stores answer in `build/answer.md`
- Logs submission events

### 3. Command Line Interface
**Updated:** `bash/rag/rag.sh`

```bash
rag submit @qa  # Submit to QA with current defaults
```

### 4. REPL Integration
**Updated:** `bash/rag/bash/rag_repl.sh`

```bash
/flow submit @qa    # Submit from REPL
/f submit @qa       # Alias
```

## Workflow Example

```bash
# 1. Start RAG REPL
rag repl

# 2. Create a flow
/flow create "analyze authentication timeout"

# 3. Add evidence files
/e add src/auth/middleware.js
/e add src/auth/tokens.js
/e add config/auth.config.js

# 4. Assemble context
/flow assemble

# 5. Submit to QA
/flow submit @qa

# 6. View answer
cat $FLOW_DIR/build/answer.md

# Or view in QA history
a 0  # Most recent answer
```

## Command Line Workflow

```bash
# From command line
rag flow start "fix auth timeout bug"
rag evidence add src/auth/*.js
rag assemble
rag submit @qa

# View result
cat ~/.tetra/rag/flows/<flow-id>/build/answer.md
```

## How It Works

1. **RAG assembles** the context from your evidence files into `prompt.mdctx`
2. **QA submit** reads the assembled context
3. **QA query** sends it to the configured OpenAI model (uses `$QA_ENGINE`)
4. **Answer** is saved in flow directory AND QA database
5. **Events** are logged to `events.ndjson`

## Configuration

QA uses its existing configuration:
- `$QA_DIR/config/engine` - Current engine (default: openai)
- `$QA_DIR/config/openai.default` - Model name
- `$OPENAI_API_FILE` - API key location

## Future Enhancements

The `@qa` syntax is designed to be extensible:

```bash
# Future possibilities
rag submit @qa.openai.gpt-4o          # Specific model
rag submit @qa.claude.sonnet-4.5      # Different engine
rag submit @ulm.local                 # Local model
```

Currently only `@qa` (using defaults) is supported.

## Files Modified

1. `bash/rag/agents/qa.conf` - New agent profile
2. `bash/rag/core/qa_submit.sh` - New submit module
3. `bash/rag/rag.sh` - Added submit command
4. `bash/rag/bash/rag_repl.sh` - Added /flow submit

## Testing

To test the integration:

```bash
# 1. Ensure QA module is loaded
tmod load qa

# 2. Check QA status
qa status

# 3. Try the workflow
rag repl
/flow create "test qa integration"
/e add bash/rag/rag.sh::1,50
/flow assemble
/flow submit @qa
cat $FLOW_DIR/build/answer.md
```

## Design Principles

1. **Minimal changes** - QA module unchanged, just integrated
2. **Simple syntax** - `@qa` follows defaults
3. **Logging** - Events tracked in flow directory
4. **Storage** - Results stored in both RAG flow and QA database
5. **Extensible** - `@target` syntax ready for future expansion
