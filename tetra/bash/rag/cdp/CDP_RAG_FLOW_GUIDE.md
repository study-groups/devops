# Using CDP Agent in RAG Flows

**Quick Guide for Browser Automation in RAG Context**

---

## Overview

The CDP agent enables browser automation within RAG flows, allowing you to:
- **Capture screenshots** of web pages as visual evidence
- **Extract HTML** for code analysis
- **Extract text** from specific elements
- **Navigate and interact** with web UIs

All CDP artifacts use timestamps and can be added as evidence to your RAG flows.

---

## Quick Start

### Example 1: Analyze a Web Page

```bash
# 1. Create a new flow
rag flow create "Analyze example.com homepage"

# 2. Initialize and connect CDP agent
tetra agent init cdp
tetra agent connect cdp

# 3. Navigate and capture artifacts
cdp_navigate "https://example.com"
screenshot=$(cdp_screenshot)
html=$(cdp_get_html)

# 4. Add artifacts as evidence to flow
select_files_as_evidence "" "$screenshot" "$html"

# 5. Extract specific content
cdp_extract "h1, .main-content" > /tmp/page-content.txt
select_files_as_evidence "" /tmp/page-content.txt

# 6. Assemble context and analyze
rag assemble

# 7. Cleanup
tetra agent disconnect cdp
```

---

## RAG Flow Integration

### Flow Stages with CDP

```
NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → DONE
       ↑
       CDP captures evidence here
```

### CDP in the SELECT Stage

The SELECT stage is where you gather evidence. CDP agent perfect for this:

```bash
# Start a flow
rag flow create "Document UI changes"

# CHECK: You're in NEW stage
rag status

# Connect CDP
tetra agent connect cdp

# Navigate and capture (moves to SELECT stage)
cdp_navigate "https://myapp.com/dashboard"
screenshot1=$(cdp_screenshot)
select_files_as_evidence "" "$screenshot1"

# Make changes (manual or automated)
cdp_click "button#toggle-feature"
sleep 2

# Capture after state
screenshot2=$(cdp_screenshot)
select_files_as_evidence "" "$screenshot2"

# Get HTML for both states
html1=$(cdp_get_html)
html2=$(cdp_get_html)
select_files_as_evidence "" "$html1" "$html2"

# Disconnect
tetra agent disconnect cdp

# Continue flow
rag assemble  # → ASSEMBLE stage
```

---

## Practical Examples

### Example 2: Compare UI Before/After

```bash
#!/usr/bin/env bash
# compare_ui_changes.sh

# Create flow
rag flow create "Compare UI before and after feature toggle"

# Connect to CDP
tetra agent init cdp
tetra agent connect cdp

# Navigate to page
cdp_navigate "https://localhost:3000/dashboard"

# Capture BEFORE state
echo "Capturing BEFORE state..."
before_screenshot=$(cdp_screenshot)
before_html=$(cdp_get_html)

# Toggle feature
echo "Toggling feature..."
cdp_click "button[data-testid='feature-toggle']"
sleep 2  # Wait for UI update

# Capture AFTER state
echo "Capturing AFTER state..."
after_screenshot=$(cdp_screenshot)
after_html=$(cdp_get_html)

# Add all artifacts as evidence
echo "Adding evidence to flow..."
select_files_as_evidence "" \
    "$before_screenshot" \
    "$before_html" \
    "$after_screenshot" \
    "$after_html"

# Extract specific differences
echo "Extracting visible text..."
cdp_extract ".dashboard-content" > /tmp/after-content.txt
select_files_as_evidence "" /tmp/after-content.txt

# Show evidence status
evidence_list

# Disconnect CDP
tetra agent disconnect cdp

# Assemble context for LLM
rag assemble

echo ""
echo "Flow ready! Evidence includes:"
echo "  - 2 screenshots (before/after)"
echo "  - 2 HTML snapshots"
echo "  - Extracted content"
echo ""
echo "Next: rag submit to analyze with LLM"
```

### Example 3: Multi-Page Research Flow

```bash
#!/usr/bin/env bash
# research_workflow.sh

# Create research flow
rag flow create "Research competing products"

tetra agent init cdp
tetra agent connect cdp

# Define URLs to research
urls=(
    "https://competitor1.com/pricing"
    "https://competitor2.com/features"
    "https://competitor3.com/docs"
)

# Iterate through URLs
for url in "${urls[@]}"; do
    echo "Processing: $url"

    # Navigate
    cdp_navigate "$url"
    sleep 3  # Wait for page load

    # Capture screenshot
    screenshot=$(cdp_screenshot)

    # Extract key content
    pricing=$(cdp_extract ".pricing-table")
    features=$(cdp_extract ".features-list")

    # Save extracted content
    timestamp=$(date +%s)
    echo "$pricing" > "/tmp/pricing-${timestamp}.txt"
    echo "$features" > "/tmp/features-${timestamp}.txt"

    # Add as evidence
    select_files_as_evidence "" \
        "$screenshot" \
        "/tmp/pricing-${timestamp}.txt" \
        "/tmp/features-${timestamp}.txt"
done

tetra agent disconnect cdp

# View collected evidence
evidence_list

# Assemble for LLM analysis
rag assemble

echo "Research complete! Use 'rag submit' to analyze."
```

### Example 4: Automated Testing Documentation

```bash
#!/usr/bin/env bash
# document_test_failure.sh

# Create flow for bug documentation
rag flow create "Document login test failure"

tetra agent init cdp
tetra agent connect cdp

# Navigate to app
cdp_navigate "http://localhost:3000/login"

# Attempt login
echo "Attempting login..."
cdp_type "input#username" "testuser"
cdp_type "input#password" "wrongpassword"

# Capture before submit
before=$(cdp_screenshot)
select_files_as_evidence "" "$before"

# Submit form
cdp_click "button[type='submit']"
sleep 2

# Capture error state
after=$(cdp_screenshot)
error_html=$(cdp_get_html)
error_message=$(cdp_extract ".error-message")

# Save error details
echo "$error_message" > /tmp/error-message.txt

# Add all evidence
select_files_as_evidence "" \
    "$after" \
    "$error_html" \
    "/tmp/error-message.txt"

# Get console logs (if enabled in profile)
cdp_execute_js "console.log('Error state captured')"

tetra agent disconnect cdp

# Add manual notes to flow
cat >> "$(get_active_flow_dir)/ctx/020_notes.user.md" <<EOF
# Test Failure Details

## Steps to Reproduce
1. Navigate to /login
2. Enter username: testuser
3. Enter password: wrongpassword
4. Click submit

## Expected
- Show "Invalid credentials" error
- Remain on login page

## Actual
- See screenshots and HTML in evidence

## Browser
- Chrome (CDP agent)
- Timestamp: $(date)
EOF

# Assemble
rag assemble

echo "Bug documentation complete!"
```

---

## Evidence Management with CDP

### Check Your Evidence

```bash
# List all evidence in current flow
evidence_list

# Example output:
# ═══════════ Evidence Files and Spans ═══════════
#
#   ✓ $e1  [100] 1729180425.cdp.screenshot.png (45234 bytes, ~11308 tokens)
#   ✓ $e2  [110] 1729180428.cdp.page.html (89432 bytes, ~22358 tokens)
#   ✓ $e3  [120] content.txt (5234 bytes, ~1308 tokens)
```

### Use Evidence Variables

After listing evidence, you can reference files:

```bash
# View evidence
cat $e1     # Show screenshot (if terminal supports images)
cat $e2     # Show HTML
cat $e3     # Show extracted content

# Compare evidence
diff $e1 $e3

# Search evidence
grep "error" $e2
```

### Toggle Evidence

If context gets too large:

```bash
# Skip large HTML files
evidence_toggle 110 off

# Re-enable later
evidence_toggle 110 on

# Check token budget
evidence_status
```

---

## CDP Agent Profiles for RAG

### Use Different Profiles

```bash
# For quick research (faster, lower quality)
tetra_agent_set_profile cdp headless
tetra agent connect cdp

# For detailed analysis (slower, high quality)
tetra_agent_set_profile cdp debug
tetra agent connect cdp

# Default profile
tetra_agent_set_profile cdp default
tetra agent connect cdp
```

### Create Custom Profile

```bash
# Create user profile
mkdir -p ~/.tetra/cdp/profiles
cat > ~/.tetra/cdp/profiles/research.conf <<'EOF'
AGENT_NAME="cdp"
AGENT_DESCRIPTION="CDP profile optimized for research workflows"
AGENT_VERSION="1.0"
AGENT_CLASS="protocol"

# Connection
CDP_PORT=9222
CDP_HEADLESS=true

# Optimized for text extraction
CDP_WINDOW_WIDTH=1600
CDP_WINDOW_HEIGHT=1200

# High quality screenshots
CDP_SCREENSHOT_FORMAT="png"
CDP_SCREENSHOT_QUALITY=95

# Capabilities needed for research
CDP_CAPABILITIES=(
    "navigate"
    "screenshot"
    "extract"
    "get_html"
)

# Logging
CDP_LOG_LEVEL="info"
EOF

# Use custom profile
tetra_agent_set_profile cdp research
tetra agent connect cdp
```

---

## Advanced Patterns

### Pattern 1: Conditional Evidence

```bash
# Only capture if element exists
if cdp_extract ".error-message" | grep -q "error"; then
    screenshot=$(cdp_screenshot)
    select_files_as_evidence "" "$screenshot"
fi
```

### Pattern 2: Timestamp Correlation

```bash
# Use same timestamp for related artifacts
timestamp=$(cdp_generate_timestamp)

screenshot=$(cdp_screenshot "$timestamp")
html=$(cdp_get_html "$timestamp")

# Both files will have same timestamp:
# 1729180425.cdp.screenshot.png
# 1729180425.cdp.page.html

select_files_as_evidence "" "$screenshot" "$html"
```

### Pattern 3: Evidence from Multiple Sources

```bash
# Combine CDP with file evidence
cdp_navigate "http://localhost:3000"
screenshot=$(cdp_screenshot)

# Add CDP + local files
select_files_as_evidence "" \
    "$screenshot" \
    "./src/components/Dashboard.tsx" \
    "./tests/dashboard.test.ts"
```

### Pattern 4: Interactive Flows

```bash
# Use CDP interactively in REPL
rag repl

> # Inside REPL
> tetra agent connect cdp
> cdp_navigate "https://example.com"
> screenshot=$(cdp_screenshot)
> select_files_as_evidence "" "$screenshot"
> evidence_list
> /assemble
> /submit
```

---

## Troubleshooting

### CDP Not Connecting

```bash
# Check if Chrome is running
curl http://localhost:9222/json/version

# Check agent status
tetra agent status cdp

# Cleanup and reconnect
tetra agent cleanup cdp
tetra agent init cdp
tetra agent connect cdp
```

### Evidence Not Showing

```bash
# Check active flow
rag status

# List evidence explicitly
evidence_list "$(get_active_flow_dir)"

# Check file permissions
ls -la "$(get_active_flow_dir)/ctx/evidence/"
```

### Context Too Large

```bash
# Check token budget
evidence_status

# Skip non-essential evidence
evidence_toggle 200-299 off  # Skip range

# Or remove evidence
evidence_remove 110
```

---

## Complete Workflow Example

```bash
#!/usr/bin/env bash
# Complete CDP + RAG workflow

set -e

echo "=== CDP + RAG Flow Demo ==="
echo ""

# 1. Create flow
echo "1. Creating flow..."
rag flow create "Analyze and improve dashboard performance"

# 2. Initialize CDP
echo "2. Initializing CDP agent..."
tetra agent init cdp
tetra agent connect cdp

# 3. Capture baseline
echo "3. Capturing baseline..."
cdp_navigate "http://localhost:3000/dashboard"
baseline_screenshot=$(cdp_screenshot)
baseline_html=$(cdp_get_html)

# 4. Run performance test
echo "4. Running performance test..."
performance=$(cdp_execute_js "performance.now()")
echo "$performance" > /tmp/baseline-perf.txt

# 5. Add evidence
echo "5. Adding evidence..."
select_files_as_evidence "" \
    "$baseline_screenshot" \
    "$baseline_html" \
    "/tmp/baseline-perf.txt" \
    "./src/Dashboard.tsx" \
    "./tests/dashboard.perf.test.ts"

# 6. View evidence
echo "6. Evidence collected:"
evidence_list

# 7. Assemble context
echo "7. Assembling context..."
rag assemble

# 8. Check context size
echo "8. Context status:"
evidence_status

# 9. Submit to LLM (if configured)
echo "9. Ready to submit to LLM"
echo "   Run: rag submit"

# 10. Cleanup
echo "10. Cleaning up CDP..."
tetra agent disconnect cdp

echo ""
echo "=== Workflow Complete ==="
echo "Flow directory: $(get_active_flow_dir)"
echo ""
echo "Next steps:"
echo "  - Review evidence: evidence_list"
echo "  - Submit to LLM: rag submit"
echo "  - Apply changes: rag apply"
```

---

## Best Practices

### 1. Always Disconnect

```bash
# Good
tetra agent connect cdp
# ... do work ...
tetra agent disconnect cdp

# Better - use trap
trap 'tetra agent disconnect cdp' EXIT
tetra agent connect cdp
# ... do work ...
```

### 2. Use Meaningful Names

```bash
# Bad
select_files_as_evidence "" "$screenshot"

# Good - add context in filename or notes
mv "$screenshot" "/tmp/dashboard-initial.png"
select_files_as_evidence "" "/tmp/dashboard-initial.png"
```

### 3. Manage Context Size

```bash
# Check size before submitting
evidence_status

# If over budget, skip large HTML files
evidence_toggle "*html" off
```

### 4. Document Your Process

```bash
# Add notes to flow
cat >> "$(get_active_flow_dir)/ctx/030_process.user.md" <<EOF
# Browser Testing Process

## Pages Tested
1. /dashboard - Homepage
2. /settings - User settings
3. /profile - User profile

## CDP Agent Profile
- Profile: headless
- Window: 1280x720
- Quality: 80%
EOF
```

---

## Integration with Existing RAG Commands

```bash
# CDP works with all RAG commands

# Select code + CDP artifacts
rag select "Dashboard" && cdp_capture_and_add

# Review evidence
rag review

# Assemble with CDP evidence
rag assemble

# Submit (includes CDP artifacts)
rag submit

# Apply changes
rag apply
```

---

## Summary

**CDP Agent provides:**
- 🖼️ Visual evidence (screenshots)
- 📄 HTML snapshots
- 📝 Text extraction
- 🤖 Automated interactions

**RAG Flow provides:**
- 📂 Evidence management
- 🔄 Workflow stages
- 📊 Token budgeting
- 🤖 LLM integration

**Together:** Powerful browser-driven context for LLMs!

---

## Quick Reference

```bash
# Initialize
tetra agent init cdp
tetra agent connect cdp

# Capture
screenshot=$(cdp_screenshot)
html=$(cdp_get_html)
text=$(cdp_extract "selector")

# Add to flow
select_files_as_evidence "" "$screenshot" "$html"

# Manage evidence
evidence_list
evidence_toggle 100
evidence_status

# Continue flow
rag assemble
rag submit

# Cleanup
tetra agent disconnect cdp
```

---

**Now you're ready to use CDP agent in your RAG flows!** 🚀
