# RAG - Next Steps

**Last Updated:** 2025-11-23
**Status:** Post Enhanced Flow Inspection & QA Integration

---

## What Just Happened (Latest)

Implemented comprehensive improvements to flow inspection and QA integration:

✅ **Enhanced Flow Inspection**
- `flow inspect` - Detailed flow status with token counts
- Token estimation using word count (wc -w / 0.75)
- Evidence count, QA ID linking, and summaries
- Automatic summary display when answer exists

✅ **First-Class QA Integration**
- `/a [n]` - Quick access to QA answers in RAG REPL
- Direct QA module integration (no need for `qq` alias anymore)
- QA commands work seamlessly in REPL

✅ **Global Flows Support**
- Local flows: `.rag/flows/` (project-specific)
- Global flows: `$TETRA_DIR/rag/flows/` (cross-project)
- `flow list --all` - Show both local and global
- `flow list --global` - Show only global flows

✅ **Improved Flow Management**
- Better flow listing with descriptions and stages
- Easy resume by index: `/flow resume 3`
- Token count and summary previews in inspect mode

**Impact:** Dramatically improved flow inspection and made QA/MULTICAT first-class citizens

---

## Previous Updates (2025-11-22)

✅ **No-Flow Commands Added**
- `rag quick` - Quick Q&A without flow overhead
- `rag bundle` - Bundle files into MULTICAT
- `rag compare` - Compare files for LLM review

✅ **Better Error Messages**
- Helpful hints with ✗ symbol
- Suggestions for next steps
- Multiple solution paths

✅ **Documentation Updated**
- QUICK_START.md features no-flow prominently
- Help text reorganized
- Historical docs archived

✅ **REPL Integration**
- All commands work in REPL (`/quick`, `/bundle`, `/compare`)
- Short aliases (`/q` for quick)

**Impact:** Reduced entry barrier by ~80% for simple use cases

---

## Immediate (This Week)

### 1. Test New Commands ⚠️ CRITICAL

**Manual Testing Checklist:**

```bash
# Test 1: Basic quick command
cd /Users/mricos/src/devops/tetra/bash/rag
source rag.sh
rag quick "what do these files do" rag.sh core/flow_manager_ttm.sh

# Test 2: Quick with save
rag quick "explain evidence system" core/evidence_manager.sh --save /tmp/test-context.md
cat /tmp/test-context.md  # Verify output

# Test 3: Bundle command
rag bundle core/*.sh --output /tmp/test-bundle.mc
grep -c "^#MULTICAT_START" /tmp/test-bundle.mc  # Should show file count

# Test 4: Compare command
rag compare rag.sh rag.sh "are these the same"  # Should work with same file
cat /tmp/rag-compare-*.md  # Verify output

# Test 5: Error messages
rag assemble  # Should show helpful error with no flow

# Test 6: REPL integration
rag repl
> /quick "test" rag.sh
> /bundle core/*.sh --output /tmp/repl-test.mc
> /compare rag.sh rag.sh
> /help  # Should show no-flow commands first
> exit

# Test 7: Help text
rag  # No args - should show no-flow first
rag help  # Full help
```

**Expected Results:**
- All commands execute without errors
- Output files created where expected
- Error messages show helpful hints
- REPL commands work
- Help shows no-flow commands prominently

### 2. Fix Any Issues Found

Based on testing, address:
- [ ] Syntax errors or edge cases
- [ ] Missing mc/ms/mi commands (if not in PATH)
- [ ] Permission issues with temp files
- [ ] REPL command registration issues

### 3. User Feedback

Get feedback on:
- Is `rag quick` intuitive?
- Are error messages helpful?
- Is help text clear?

---

## Short Term (Next 2 Weeks)

### 1. Evidence System Simplification

**Goal:** Reduce complexity of evidence types

**Current State:**
- 4 evidence types: pinned, regular, selection, external
- Complex prompt symbols: ■●◆▲
- Type-specific handling

**Proposed:**
```bash
# Replace types with priority + tags
evidence_add <file>                    # Regular (priority=5)
evidence_add <file> --priority=10      # High priority (was "pinned")
evidence_add <file> --tag=external     # Tagged (was type)
evidence_add <file::100,200>           # Range (preserved)
```

**Benefits:**
- Simpler mental model
- More flexible categorization
- Easier to explain
- ~200 LOC reduction

**Files to modify:**
- `core/evidence_manager.sh`
- `bash/rag_prompts.sh` (prompt symbols)
- `docs/EVIDENCE_QUICK_REFERENCE.md`

### 2. Documentation Consolidation

**Goal:** Organize docs into clear structure

```
docs/
├── README.md                    # Main entry (keep)
├── QUICK_START.md              # Best starting point (keep)
├── guides/                     # NEW - Walkthroughs
│   ├── FLOW_WALKTHROUGH.md
│   ├── HISTORY_COMPLETION_GUIDE.md
│   └── CDP_INTEGRATION.md
├── reference/                  # NEW - Quick refs
│   ├── QUICK_REFERENCE.md
│   ├── FLOW_QUICK_REFERENCE.md
│   └── EVIDENCE_QUICK_REFERENCE.md
├── architecture/               # NEW - Deep dives
│   ├── CONTEXT_DESIGN.md
│   └── REPL_FEATURES.md
└── archive/                    # Historical (done)
```

**Action Items:**
- [ ] Create subdirectories
- [ ] Move files to appropriate locations
- [ ] Update internal links
- [ ] Create docs/README.md as index

### 3. Add Lazy Flow Creation

**Goal:** Auto-create flow when adding first evidence

```bash
# Current (verbose)
rag flow start "question"
rag evidence add file.sh

# Proposed (auto-create)
rag evidence add file.sh --query "question"
# Auto-creates flow if none active
```

**Implementation:** Modify `evidence_add()` in `core/evidence_manager.sh`

---

## Medium Term (Next Month)

### 1. Extract MULTICAT Module

**Goal:** Make MULTICAT standalone

**Current:** MULTICAT tools embedded in RAG
**Proposed:** Separate `bash/multicat/` module

```
bash/multicat/
├── multicat.sh      # mc command
├── multisplit.sh    # ms command
├── mcinfo.sh        # mi command
├── multifind.sh     # mf command
├── README.md        # Format spec
└── examples/
```

**Benefits:**
- MULTICAT usable without RAG
- Clearer separation of concerns
- Other modules can use it
- Easier to document

**Migration:**
- Move core/multicat/* → bash/multicat/
- Update RAG to source from new location
- Create aliases in rag.sh
- Update docs

### 2. Enhanced QA Integration

**Goal:** Better QA agent integration

**Features:**
- [ ] Async submission with progress
- [ ] Cost tracking and budgets
- [ ] Multiple agent support (Claude, GPT-4, etc.)
- [ ] Response streaming
- [ ] Answer quality scoring

**Files:**
- `core/qa_submit.sh`
- New: `core/qa_agents/`

### 3. Flow Templates

**Goal:** Pre-configured flows for common tasks

```bash
# Create from template
rag flow create --template=debug "Debug auth timeout"
rag flow create --template=refactor "Improve parser"

# Templates auto-configure:
# - Evidence patterns to look for
# - Suggested files to add
# - Workflow guidance
```

**Templates:**
- `debug` - Bug investigation
- `refactor` - Code improvement
- `review` - Code review
- `learn` - Understanding codebase
- `document` - Documentation

---

## Long Term (Next Quarter)

### 1. Evidence Intelligence

**Auto-suggest evidence files:**

```bash
rag flow start "Fix login timeout"
# RAG suggests:
#   - src/auth/login.js (referenced in query)
#   - src/auth/session.js (related)
#   - tests/auth_test.js (testing)
#   - logs/auth_errors.log (debugging)
```

**Features:**
- ULM-based relevance ranking
- Dependency detection
- Pattern matching
- Learning from past flows

### 2. Multi-Agent Support

**Route to different agents:**

```bash
rag submit @claude.sonnet-4
rag submit @openai.gpt-4o
rag submit @local.llama-3
```

**Agent profiles:**
- Different instruction templates
- Token budget management
- Cost tracking per agent
- Quality comparison

### 3. Team Collaboration

**Share flows and knowledge:**

```bash
# Export flow
rag flow export flow-id > shared-flow.json

# Import flow
rag flow import shared-flow.json

# Share evidence pool
rag kb export --tag=auth > auth-knowledge.mc
rag kb import auth-knowledge.mc
```

---

## Open Questions

### Design Decisions Needed

1. **Agent Routing Architecture**
   - Current: Only `@qa` supported
   - Future: Full routing to multiple agents?
   - Decision: Build now or wait for use cases?

2. **Flow vs No-Flow Balance**
   - How to guide users to right choice?
   - Should flows be more like "sessions"?
   - Can we auto-promote quick → flow?

3. **Evidence Management Philosophy**
   - Keep complex type system or simplify?
   - Priority levels vs categories?
   - How much automation vs manual control?

4. **TUI Integration**
   - Should RAG integrate with demo 014?
   - Visual flow designer?
   - Interactive evidence browser?

### Performance Considerations

1. **Large Evidence Sets**
   - How to handle 100+ evidence files?
   - Pagination in listings?
   - Performance optimization needed?

2. **Context Size Limits**
   - Better token budget enforcement?
   - Auto-toggle low-priority evidence?
   - Smart chunking strategies?

---

## Success Metrics

### Track These

1. **Usage Patterns**
   - No-flow vs flow usage ratio
   - Most used commands
   - Average evidence count per flow
   - Error frequency

2. **Performance**
   - Flow creation time
   - Context assembly time
   - QA submission latency

3. **Quality**
   - Error rate
   - User satisfaction
   - Documentation clarity

---

## Dependencies

### Blocked By

- None currently

### Blocking

- Other modules waiting for MULTICAT extraction
- TUI integration waiting for actions.sh

---

## Resources

### Documentation Created

- ✅ `RAG_REVIEW_2025.md` - Comprehensive review
- ✅ `IMPLEMENTATION_SUMMARY.md` - Implementation details
- ✅ `NEXT.md` - This file

### Need to Create

- [ ] `docs/guides/NO_FLOW_GUIDE.md` - Dedicated no-flow tutorial
- [ ] `docs/architecture/EVIDENCE_SYSTEM.md` - Evidence deep-dive
- [ ] `docs/reference/COMMAND_REFERENCE.md` - All commands

---

## Notes

- Focus on **stability and usability** before new features
- **Test thoroughly** before wider adoption
- **Document as you go** - don't accumulate debt
- **Gather feedback** early and often
- Keep **no-flow simplicity** as core value

---

## Quick Win Opportunities

Things that are easy and high-impact:

1. ✅ **Add no-flow commands** - DONE
2. **Better error messages** - DONE
3. **Consolidate docs** - Easy, high value
4. **Add flow templates** - Medium effort, high value
5. **Extract MULTICAT** - Medium effort, unlocks other modules

---

*Next Steps document - Updated as priorities evolve*
