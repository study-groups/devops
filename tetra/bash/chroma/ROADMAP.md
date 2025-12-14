# Chroma Development Roadmap

Build up from simple working version to full-featured renderer.
Each phase adds tests FIRST, then implementation.

## Current: Phase 0 - Foundation ✓
- [x] File input
- [x] Stdin input (piped)
- [x] Margin (-m)
- [x] Width (-w)
- [x] Word-aware wrapping (fold -s)
- [x] Test framework

## Phase 1 - Colors (TDS Integration) ✓
Add semantic colors using TDS tokens.

### Tests:
- [x] Regular text has color
- [x] Color resets at end of line
- [x] --no-color flag

### Implementation:
- `_chroma_color()` - uses TDS if available, fallback ANSI
- `_chroma_reset()` - resets color at end of line
- `--no-color` flag to disable

## Phase 2 - Markdown Rendering
Recognize and style markdown elements.

### Tests to add:
- [ ] Headers (# ## ###) get heading color + bold
- [ ] Lists (- * +) get bullet character
- [ ] Numbered lists preserve numbers
- [ ] Code blocks (```) get code color
- [ ] Inline code (`x`) styled
- [ ] Blockquotes (>) styled
- [ ] Bold (**x**) rendered
- [ ] Horizontal rules (---) rendered

### Implementation:
Pattern match each line type, apply appropriate styling.

## Phase 3 - Format Detection
Auto-detect file format.

### Tests to add:
- [ ] .md -> markdown
- [ ] .json -> json
- [ ] .toml -> toml
- [ ] Content detection for stdin

### Implementation:
```bash
detect_format() {
    local file="$1"
    local ext="${file##*.}"
    case "$ext" in
        md|markdown) echo "markdown" ;;
        json) echo "json" ;;
        toml) echo "toml" ;;
        *) echo "text" ;;
    esac
}
```

## Phase 4 - Multiple Parsers
Plugin system for format renderers.

### Tests to add:
- [ ] JSON pretty-print with colors
- [ ] TOML section highlighting
- [ ] Parser registry works

### Implementation:
```bash
declare -A CHROMA_PARSERS
chroma_register_parser() { ... }
chroma_get_parser() { ... }
```

## Phase 5 - Pager Support
Optional pager for long content.

### Tests to add:
- [ ] -p enables pager
- [ ] -n disables pager
- [ ] Auto-detect when appropriate

### Implementation:
```bash
if (( use_pager )) && [[ -t 1 ]]; then
    render | ${PAGER:-less -R}
else
    render
fi
```

## Phase 6 - Polish
- [ ] Help with colors
- [ ] Status command
- [ ] Doctor command
- [ ] Tab completion
- [ ] Error messages

---

## Running Tests

```bash
./test/run_tests.sh
```

## Development Flow

1. Add test for new feature
2. Run tests (should fail)
3. Implement feature in chroma_simple.sh
4. Run tests (should pass)
5. Refactor if needed
6. Commit
