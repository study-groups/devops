# TUT - Tutorial Generator System

**Data-driven terminal tutorial generator for tetra**

TUT converts JSON tutorial definitions into beautiful, interactive HTML tutorials with dual-pane layouts (narrative + terminal simulation).

## Features

- 📝 **Data-driven**: Write tutorials as JSON, generate HTML automatically
- 🎨 **Themeable**: Custom colors, fonts, and styles via JSON
- 🔍 **"Under the Hood" details**: Expandable deep-dive sections for curious learners
- 📹 **Recording mode**: Capture real terminal sessions with `script` command
- ⏱️ **Timeline support**: For recorded sessions with scrubbing
- 🎯 **Validated**: JSON schema validation against specification
- 🚀 **Zero dependencies**: Pure bash generator (requires `jq` for JSON)

## Quick Start

```bash
# 1. Load TUT module
source "$TETRA_SRC/bash/tut/includes.sh"

# 2. Generate tutorial from JSON
tut generate tsm-tutorial.json

# 3. Preview in browser
tut serve tsm-tutorial.html
```

## Tutorial JSON Format

See `tutorial-schema.json` for the complete specification.

### Minimal Example

```json
{
  "metadata": {
    "title": "My Tutorial",
    "description": "Learn something awesome",
    "version": "1.0.0"
  },
  "steps": [
    {
      "id": "welcome",
      "title": "Welcome",
      "content": [
        {
          "type": "paragraph",
          "text": "Welcome to the tutorial!"
        }
      ],
      "terminal": [
        { "type": "comment", "content": "# This is the terminal output" },
        { "type": "prompt", "content": "$ ", "inline": true },
        { "type": "command", "content": "echo 'Hello, World!'" }
      ]
    }
  ]
}
```

### Advanced Features

#### 1. Content Blocks

```json
{
  "type": "paragraph",
  "text": "Plain text paragraph"
}
```

```json
{
  "type": "list",
  "title": "Key Points",
  "items": ["First item", "Second item"],
  "ordered": false
}
```

```json
{
  "type": "you-try",
  "title": "Try It Yourself",
  "content": [
    {
      "type": "paragraph",
      "text": "Run this command:"
    },
    {
      "type": "command-block",
      "commands": ["tsm start myservice"]
    }
  ]
}
```

```json
{
  "type": "learn-box",
  "title": "What You'll Learn",
  "content": [...]
}
```

```json
{
  "type": "code-block",
  "language": "bash",
  "code": "#!/usr/bin/env bash\\necho 'hello'",
  "caption": "Example script"
}
```

#### 2. Terminal Output

```json
{
  "terminal": [
    { "type": "prompt", "content": "$ ", "inline": true },
    { "type": "command", "content": "ls -la" },
    { "type": "output", "content": "total 42" },
    { "type": "output-success", "content": "✓ Success!" },
    { "type": "output-warning", "content": "⚠ Warning" },
    { "type": "output-error", "content": "✗ Error" },
    { "type": "comment", "content": "# This is a comment" },
    { "type": "blank", "content": "" }
  ]
}
```

#### 3. "Under the Hood" Details

```json
{
  "details": {
    "enabled": true,
    "title": "Under the Hood",
    "icon": "🔍",
    "displayMode": "margin-note",
    "collapsed": true,
    "sections": [
      {
        "type": "explanation",
        "title": "How it works",
        "content": "Detailed explanation...",
        "level": "intermediate"
      },
      {
        "type": "code-dive",
        "title": "Source code",
        "file": "bash/tsm/core/start.sh",
        "lines": [45, 60],
        "explanation": "This function does..."
      },
      {
        "type": "gotcha",
        "title": "Common Mistake",
        "content": "Don't do this...",
        "severity": "warning",
        "example": {
          "wrong": "export VAR=$VALUE",
          "right": ": \"${VAR:=$VALUE}\"",
          "explanation": "Use parameter expansion"
        }
      },
      {
        "type": "architecture",
        "title": "System Design",
        "content": "Architecture overview...",
        "diagram": "ASCII art or URL"
      },
      {
        "type": "performance",
        "title": "Performance Notes",
        "content": "Overhead is minimal...",
        "metrics": {
          "complexity": "O(1)",
          "memory": "2MB per process"
        }
      },
      {
        "type": "further-reading",
        "title": "Related Topics",
        "links": [
          { "text": "Concept docs", "conceptId": "strong_globals" },
          { "text": "External", "url": "https://example.com" }
        ]
      }
    ]
  }
}
```

#### 4. Theme Customization

```json
{
  "theme": {
    "colors": {
      "accentPrimary": "#667eea",
      "accentSecondary": "#764ba2"
    },
    "fonts": {
      "heading": "'SF Mono', monospace",
      "body": "-apple-system, sans-serif",
      "code": "'Courier New', monospace"
    }
  }
}
```

#### 5. Timeline (for recordings)

```json
{
  "timeline": {
    "duration": 1800,
    "markers": [
      { "time": 0, "label": "Start", "stepId": "welcome" },
      { "time": 300, "label": "Setup", "stepId": "setup" }
    ],
    "chapters": [
      {
        "title": "Getting Started",
        "startTime": 0,
        "endTime": 600,
        "stepIds": ["welcome", "setup"]
      }
    ]
  }
}
```

## Recording Terminal Sessions

### Basic Recording

```bash
# Start recording
tut record my-demo

# Type your commands...
# Add annotations: #TUT: This shows how to start a service

# Exit to stop
exit

# Extract annotations
tut extract-annotations my-demo

# Playback
tut play my-demo
```

### Converting Recordings to Tutorials

After recording, you can manually create a JSON tutorial using the recording as reference, or programmatically parse the typescript file and timing data.

## Commands

### Generate

```bash
tut generate <json_file> [output_file]
```

Converts JSON tutorial to HTML.

**Example:**
```bash
tut generate tsm-tutorial.json
tut generate my-tutorial.json /path/to/output.html
```

### Record

```bash
tut record <name>
```

Start recording a terminal session using the `script` command.

**Features:**
- Captures all terminal output with timing
- Add annotations with `#TUT: <text>` comments
- Metadata tracking

### Play

```bash
tut play <name>
```

Replay a recorded session (requires `scriptreplay`).

### Serve

```bash
tut serve <html_file>
```

Preview tutorial in browser. Opens file and optionally starts HTTP server.

### Validate

```bash
tut validate <json_file>
```

Validate JSON against schema and check required fields.

### List

```bash
tut list
```

Show all generated tutorials and recordings.

## Directory Structure

```
$TUT_SRC/                    # Source code (in git)
  includes.sh                # Module entry point
  tut.sh                     # Main command interface
  tut_generator.sh           # HTML generator
  tut_recorder.sh            # Recording tools
  templates/
    base-styles.css          # Default CSS
    base-script.js           # Default JavaScript

$TUT_DIR/                    # Runtime data (ephemeral)
  generated/                 # Generated HTML files
  recordings/                # Terminal recordings
    <name>/
      typescript.txt         # Recording data
      timing.txt            # Timing data
      metadata.json         # Recording metadata
      annotations.json      # Extracted annotations
```

## Example: TSM Tutorial

A complete TSM (Tetra Service Manager) tutorial is available:

```bash
# Location
$TETRA_SRC/bash/melvin/tsm-tutorial.json

# Generate
tut generate bash/melvin/tsm-tutorial.json

# Preview
tut serve tsm-tutorial.html
```

**Features demonstrated:**
- 10-step progressive tutorial
- "Under the Hood" details in every step
- Terminal simulations
- Code examples
- Learn boxes and "You Try" sections
- Timeline markers
- Glossary terms

## Schema Validation

The tutorial schema (`tutorial-schema.json`) defines:

- Required metadata fields
- Step structure
- Content block types
- Terminal output format
- Details section types
- Theme customization
- Timeline format
- Glossary structure

Validate with:
```bash
tut validate my-tutorial.json
```

Or use `ajv` for JSON Schema validation:
```bash
npm install -g ajv-cli
ajv validate -s tutorial-schema.json -d my-tutorial.json
```

## Best Practices

### 1. Tutorial Structure

- **Start simple**: Begin with concepts, not commands
- **Progressive disclosure**: Build complexity gradually
- **One concept per step**: Don't overload steps
- **Use "You Try" sections**: Make it hands-on
- **Show, don't tell**: Terminal output > long explanations

### 2. Details Sections

- **Not required**: Only add when there's genuine depth
- **Collapsed by default**: Don't interrupt flow
- **Targeted levels**: Mark beginner/intermediate/advanced
- **Practical gotchas**: Focus on real mistakes
- **Link related concepts**: Help navigation

### 3. Terminal Output

- **Realistic**: Match actual command output
- **Highlight important lines**: Use `highlight: true`
- **Use colors**: success/warning/error appropriately
- **Comment liberally**: Explain what's happening
- **Show commands and output**: Both prompt and result

### 4. Content Blocks

- **Learn boxes**: Key concepts and summaries
- **You Try**: Hands-on exercises
- **Warning boxes**: Important caveats
- **Code blocks**: For multi-line examples
- **Command hints**: For copy-paste commands

## Limitations

- **No interactive validation**: Can't check if user actually ran commands
- **Static HTML**: No backend, all client-side JavaScript
- **Recording requires `script`**: Not available on all platforms
- **Timeline scrubber**: Planned, not yet implemented

## Future Enhancements

- [ ] Interactive validation (check user environment)
- [ ] Timeline scrubber UI for recordings
- [ ] Auto-generate JSON from recordings
- [ ] Quiz/exercise support
- [ ] Progress persistence (localStorage)
- [ ] Export to PDF/Markdown
- [ ] Tutorial marketplace/sharing

## Dependencies

**Required:**
- `bash` 5.2+
- `jq` (for JSON parsing)

**Optional:**
- `script` / `scriptreplay` (for recording/playback)
- `ajv-cli` (for schema validation)
- `python3` (for HTTP server preview)

## Contributing

Tutorial JSON files and improvements welcome!

1. Follow the schema
2. Test with `tut validate`
3. Generate and preview
4. Submit PR

## License

Part of the Tetra project.

---

**TUT**: **T**erminal **U**ser **T**utorials - Teaching the tetra way 📚
