# RAG Work-in-Progress Cleanup Topics

**Date:** 2025-10-17
**Status:** Planning

---

## Completed Work

### QA Integration ✓
- [x] Created `qa.conf` agent profile
- [x] Implemented `qa_submit.sh` module
- [x] Added `rag submit @qa` CLI command
- [x] Added `/flow submit @qa` REPL command
- [x] Documentation: `QA_INTEGRATION_SUMMARY.md`

---

## Immediate Todos

### 1. Testing & Validation
- [ ] **Test QA integration end-to-end**
  - Verify `tmod load qa` works
  - Test flow: create → add evidence → assemble → submit @qa
  - Verify answer storage in both flow dir and QA db
  - Check event logging in `events.ndjson`
  - Validate error handling when QA module not loaded

### 2. TCS 3.0 Compliance

#### QA Module
- [ ] **Add type contracts with `::`**
  ```bash
  qa.query :: (question:string) → @qa:timestamp.answer
    where Effect[api_call, log, cache]
  ```
- [ ] **Implement required path functions**
  - `qa_get_db_dir()`
  - `qa_generate_timestamp()`
  - `qa_get_db_path(timestamp, extension)`
- [ ] **Add unified logging with `tetra_log()`**
  ```bash
  tetra_log qa query "question text" try '{}'
  tetra_log qa query "question text" success '{"chars":1024,"cost":0.015}'
  ```

#### RAG Module
- [ ] **Add type contract for submit**
  ```bash
  rag.submit :: (@qa, flow_id:string) → @qa:timestamp.answer
    where Effect[read, api_call, db, log]
  ```
- [ ] **Add logging to submit flow**
  ```bash
  tetra_log rag submit "@qa" try '{}'
  tetra_log rag submit "@qa" success '{"qa_timestamp":"..."}'
  ```

### 3. Documentation Cleanup

#### RAG Docs Directory
Current state:
```
bash/rag/docs/
├── QA_INTEGRATION_SUMMARY.md      # New - keep
├── COLORS.md                       # Review - still relevant?
├── CONTEXT_DESIGN.md               # Review - update or archive?
├── EVIDENCE_QUICK_REFERENCE.md     # Keep
├── FLOW_QUICK_REFERENCE.md         # Keep
├── FLOW_WALKTHROUGH.md             # Keep
├── HELP_REFACTOR_SUMMARY.md        # Archive to reference/
├── HISTORY_COMPLETION_GUIDE.md     # Keep
├── QUICK_REFERENCE.md              # Keep
├── QUICK_START.md                  # Keep (main entry)
├── QUICK_START_HISTORY_COMPLETION.md  # Consolidate?
├── REPL_FEATURES.md                # Keep
├── REPL_FIXES_20251016.md          # Archive to reference/
└── REPL_REWRITE_*.md               # Archive to reference/
```

**Actions:**
- [ ] Archive implementation notes to `docs/reference/`
- [ ] Consolidate duplicate quick starts
- [ ] Update QUICK_START.md with QA integration
- [ ] Create `docs/README.md` as index

#### Help System in REPL
Current topics:
```
/help usecase   - How RAG Actually Works
/help models    - AI Model Selection
/help symbols   - Status line symbols
/help stages    - Flow stages explained
/help cdp       - Browser automation
/help flow      - Complete flow guide
/help evidence  - Evidence management
/help cli       - Prompt modes
```

**Review:**
- [ ] Does `/help usecase` need QA integration example?
- [ ] Update `/help models` - QA agent is now an option
- [ ] Verify `/help flow` shows submit stage
- [ ] Consider adding `/help qa` topic

---

## Design Questions to Resolve

### 1. RAG Module Identity
**Question:** What is RAG's core purpose now?

**Current state:**
- Context assembly (evidence → prompt.mdctx)
- MULTICAT tools (mc, ms, mi)
- Flow management
- Agent integration (@qa)

**Options:**
A. **Context Orchestrator** - Focus on evidence selection & assembly
B. **Agent Hub** - Portal to multiple AI agents (QA, CDP, LLM)
C. **Workflow Engine** - Full AI-assisted development flows

**Recommendation:** Start with A, evolve toward C

### 2. Agent Routing Architecture
**Question:** Should we expand `@target` syntax now or later?

**Current:** Only `@qa` supported
**Future vision:**
```bash
rag submit @qa.openai.gpt-4o
rag submit @claude.sonnet-4.5
rag submit @llm.local.llama-3
```

**Options:**
A. Keep simple `@qa` for now, plan architecture
B. Build full routing system immediately
C. Add profile selection: `rag submit @qa --profile=openai-gpt-4`

**Recommendation:** A - document the design but don't implement yet

### 3. Flow Stages Clarity
**Question:** What are the actual stages and their purposes?

**Current stages:**
```
NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → DONE/FAIL
```

**Questions:**
- Is SUBMIT always to an agent? Or can it be manual copy/paste?
- Does APPLY mean "apply AI suggestions" or "apply multicat patches"?
- Should we support flows without agents (manual workflows)?

**Needs:** Clear documentation of each stage with examples

### 4. Evidence Types
**Question:** Should evidence have explicit types?

**Current:** All evidence is files with optional line ranges
**Potential types:**
- Code (`.evidence.md`)
- Screenshots (`.screenshot.png`)
- API responses (`.api.json`)
- Query results (`.query.txt`)

**Benefit:** Better organization, type-specific handling
**Cost:** More complexity

### 5. Action Integration (TUI)
**Question:** Should RAG have `bash/rag/actions.sh` for demo 014 integration?

**Currently:** RAG is CLI-only, no TUI actions

**Potential actions:**
```bash
declare_action "create_flow" \
    "verb=create" "noun=flow" \
    "contexts=Local" \
    "tes_operation=local"

declare_action "submit_qa" \
    "verb=submit" "noun=qa" \
    "contexts=Local" \
    "tes_operation=local"
```

**Benefit:** RAG appears in TUI navigation grid
**Question:** Is this wanted?

---

## Technical Debt

### 1. REPL Architecture
**Issues:**
- Complex prompt system (3 modes)
- History system separate from bash history
- Color system tightly coupled
- Completion system incomplete

**Options:**
A. Keep as-is, document thoroughly
B. Simplify to single prompt mode
C. Extract to reusable REPL library

### 2. Evidence Manager Complexity
**Issues:**
- Multiple evidence types (files, selections, external, pinned)
- Toggle system for enable/disable
- Variable system ($e1, $e2, etc.)
- Status meters in prompt

**Questions:**
- Is all this complexity necessary?
- Can we simplify the mental model?
- Should pinned/external be first-class?

### 3. MULTICAT Tools
**Status:** Working but standalone
**Questions:**
- Should MULTICAT be its own module?
- How does it relate to RAG flows?
- Is the format stable enough?

### 4. Flow State Management
**Current:** `state.json` with fields:
```json
{
  "flow_id": "...",
  "description": "...",
  "stage": "NEW",
  "iteration": 1,
  "agent": "base",
  "ctx_digest": null,
  "last_checkpoint": "...",
  "last_error": null
}
```

**Questions:**
- Should we track more state?
- Do we need iteration history?
- Should flow be resumable after failure?

---

## Future Enhancements

### Short Term (Next Release)
1. **QA Integration Polish**
   - Better error messages
   - Status indicators
   - Cost tracking

2. **Documentation**
   - Clean up docs directory
   - Create comprehensive guide
   - Add more examples

3. **Testing**
   - Unit tests for core functions
   - Integration tests for flows
   - REPL interaction tests

### Medium Term
1. **Multiple Agents**
   - Anthropic Claude integration
   - Local LLM support
   - Agent comparison

2. **Flow Templates**
   - Pre-configured flows for common tasks
   - Template library
   - Custom templates

3. **Evidence Intelligence**
   - Smart evidence suggestion
   - Auto-ranking by relevance
   - Duplicate detection

### Long Term
1. **Full TUI Integration**
   - RAG actions in demo 014
   - Visual flow designer
   - Interactive evidence browser

2. **Collaboration**
   - Shared flows
   - Team evidence pools
   - Flow import/export

3. **Analytics**
   - Flow success metrics
   - Cost tracking
   - Quality scoring

---

## Questions for Discussion

1. **Scope:** Is RAG trying to do too much? Should we split into smaller modules?
2. **Users:** Who is the primary user? Developers? DevOps? QA teams?
3. **Workflow:** What's the most common use case we should optimize for?
4. **Integration:** Should RAG integrate with other Tetra modules (VOX, deploy, etc.)?
5. **Stability:** Is the current architecture stable enough for wider use?

---

## Next Steps

### This Week
1. Test QA integration thoroughly
2. Add TCS 3.0 compliance (logging, contracts)
3. Clean up documentation directory
4. Write comprehensive RAG guide

### This Month
1. Resolve design questions (agent routing, flow stages)
2. Implement missing features (better error handling)
3. Create flow templates library
4. Add unit tests

### This Quarter
1. Multi-agent support
2. TUI integration (if wanted)
3. Evidence intelligence features
4. Team collaboration features

---

## Notes

- Focus on stability and simplicity first
- Don't over-engineer the agent routing until we have real use cases
- Documentation is critical - RAG has a learning curve
- The REPL is powerful but may be too complex for casual users
- Consider a simpler "RAG lite" for basic Q&A workflows
