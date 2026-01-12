# TDOCS REPL Prompt Design

## Format

```
[(topic1 topic2) x level -> count] state >
```

## Structure Breakdown

### Components

1. **Topics** `(topic1 topic2)`
   - `topic1`: Category filter (all/core/other)
   - `topic2`: Module filter or secondary topic

2. **Level** `level`
   - Completeness level: L0-L4
   - Or "all" for no level filter

3. **Count** `count`
   - Number of matching documents

4. **State** `state`
   - Current operation: browse/search/filter/edit

## Color Scheme (TDS Tokens)

### Structure Elements
- `[` `]` - Gray brackets (`tdocs.prompt.bracket`)
- `(` `)` - Gray parentheses (`tdocs.prompt.paren`)
- `x` - Green separator (`tdocs.prompt.separator`)
- `->` - Gray arrow (`tdocs.prompt.arrow.pipe`)
- `>` - Orange arrow (`tdocs.prompt.arrow`)

### Topic Colors
- **topic1 (category)**:
  - `all` - Green (`tdocs.prompt.filter.all`)
  - `core` - Blue (`tdocs.prompt.filter.core`)
  - `other` - Orange (`tdocs.prompt.filter.other`)
- **topic2** - Orange (`tdocs.prompt.topic2`)

### Level Colors
- `L0` - Red (`tdocs.level.0`) - No documentation
- `L1` - Orange (`tdocs.level.1`) - Minimal
- `L2` - Cyan (`tdocs.level.2`) - Working
- `L3` - Blue (`tdocs.level.3`) - Complete
- `L4` - Green (`tdocs.level.4`) - Exemplar
- `all` - Green (`tdocs.prompt.level`)

### Other Elements
- **count** - Purple (`tdocs.prompt.count`)
- **state** - Purple (`tdocs.prompt.state`)

## Examples

### Default - All documents
```
[(all all) x all -> 34] browse >
```
- All categories
- All modules
- All levels
- 34 documents
- Browse mode

### Core Documents
```
[(core all) x all -> 12] browse >
```
- Core category only
- All modules
- All levels
- 12 documents

### Specific Module + Level
```
[(all tdocs) x L4 -> 5] browse >
```
- All categories
- tdocs module only
- Level 4 (Exemplar) only
- 5 documents

### Searching State
```
[(core rag) x L3 -> 8] search >
```
- Core category
- rag module
- Level 3 (Complete)
- 8 documents
- Search mode active

### Filtering State
```
[(other tubes) x L2 -> 3] filter >
```
- Other category
- tubes module
- Level 2 (Working)
- 3 documents
- Filter mode active

## State Indicators

The `state` field shows the current REPL operation:

- **browse** - Normal browsing mode (default)
- **search** - Actively searching documents
- **filter** - Setting/modifying filters
- **edit** - Editing document metadata

## Future Enhancements

The prompt format is designed to be flexible:

1. **More topics**: Could add third topic (tags, type, etc.)
2. **Custom states**: Could add more operation states
3. **Visual indicators**: Could add symbols for states (🔍 for search, 🔧 for edit)
4. **Compact mode**: Could collapse to `[cat:mod:lvl->cnt] state >` for narrow terminals

## Theme Support

All colors are defined via TDS tokens, so the prompt automatically adapts when switching themes:
- `warm` theme - Warmer tones
- `cool` theme - Cooler blues
- `electric` theme - High contrast neons
- `neutral` theme - Muted grays
