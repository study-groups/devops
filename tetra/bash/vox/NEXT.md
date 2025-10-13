vox: Audio-Text Synchronization System - Complete Design Document

  Executive Summary

  vox is a TTS (text-to-speech) system with audio-text synchronization, designed for the tetra
  framework. It converts text with markup (called esto) into audio with precise cursor mapping, enabling
   synchronized playback, scrubbing, and multi-voice narration.

  Key Features:
  - Pipe-first Unix design (cat file | vox generate sally)
  - Hierarchical named span system (addressable text segments)
  - External configuration (non-destructive overrides)
  - Markdown + LaTeX math support (with AI-assisted explanations)
  - Decoupled from QA (works on any text file)
  - Audio-text sync for TUI playback and subtitles

  ---
  1. esto Markup Language

  Purpose

  A lightweight markup format for TTS with prosody control, voice directives, and sync metadata.

  Syntax Philosophy

  - @directive for metadata and commands
  - @begin/@end for hierarchical sections (implicit @end when new @begin)
  - @timestamp for sync points (e.g., @0.0, @2.5)
  - word`ipa` for inline IPA phonetic overrides
  - # comment for annotations
  - No XML/braces - clean, readable, grep-friendly

  Example

  @title "The Hero's Journey - Chapter 1"
  @voice sally
  @sync sentence

  @narrator voice=sally pitch=0%
  @hero voice=marcus pitch=+10%
  @villain voice=onyx pitch=-20% rate=0.8

  @begin chapter name=prologue aliases=intro,ch0 title="The Dark Beginning"

    @begin section name=dark-night aliases=opening title="A Dark and Stormy Night"

      @0.0 name=opening-line
      It was a dark and stormy night in the village of Ald`ɔːlˈdɛn`alden.

      @2.5 name=hero-intro
      The hero stood at the gates, ready for his final battle.

    @end section

    @begin section name=hero-speaks title="The Hero's Declaration"

      @5.0 name=destiny-line
      "I must face my destiny!" he cried.

    @end section

  @end chapter

  Key Directives

  - Metadata: @title, @author, @voice, @sync, @lang
  - Voice definitions: @narrator voice=sally pitch=0%
  - Sections: @begin chapter/section/paragraph, @end
  - Timestamps: @0.0, @2.5 (for sync points)
  - Inline IPA: word`phonetic`
  - Math: Handled via preprocessing (see section 7)

  ---
  2. Hierarchical Span System

  Concept

  Spans are hierarchical, named, offset-based text segments with audio timing. Think DOM tree navigation
   for text+audio.

  Hierarchy

  doc                              (everything except metadata)
  ├── chapter (c)
  │   ├── section (s)             (recursive, depth-tracked)
  │   │   ├── section (s)         (subsections)
  │   │   │   ├── paragraph (p)
  │   │   │   │   ├── sentence (sn)
  │   │   │   │   │   ├── word (w)
  │   │   │   │   │   │   └── phoneme (ph)

  Span Properties

  {
    "span_id": "doc.c[0].s[0].sn[0]",
    "type": "sentence",
    "index": 0,
    "name": "opening-line",
    "aliases": ["first-line", "intro"],
    "title": null,
    "parent": "doc.c[0].s[0]",
    "children": ["doc.c[0].s[0].sn[0].w[0]", "..."],
    "file_path": "/path/to/file.esto",
    "start_offset": 0,
    "end_offset": 45,
    "start_time": 0.0,
    "end_time": 2.3,
    "text": "It was a dark and stormy night.",
    "tags": ["narrator", "intro"],
    "voice": "sally",
    "metadata": {"pitch": "0%", "rate": "1.0"}
  }

  Addressing Syntax

  By index (numeric):
  doc.c[0].s[0].s[1].p[0].sn[2]
  # chapter 0 > section 0 > subsection 1 > paragraph 0 > sentence 2

  By name (exact):
  doc.c[prologue].s[dark-night].sn[opening-line]

  By fuzzy match (substring):
  doc.c[prol].s[dark].sn[open]
  # Matches: prologue > dark-night > opening-line

  Mixed:
  doc.c[0].s[dark-night].p[1].sn[destiny-line]

  Type Abbreviations

  - c = chapter
  - s = section (any depth, recursive)
  - p = paragraph
  - sn = sentence (not s to avoid conflict)
  - w = word
  - ph = phoneme

  ---
  3. File Structure & Naming

  Sidecar Files (Recommended)

  project/
  ├── chapter1.esto                # esto source markup
  ├── chapter1.txt                 # plain text (optional)
  ├── chapter1.vox.sally.mp3       # generated audio
  ├── chapter1.vox.sally.spans     # span data (JSON)
  ├── chapter1.vox.sally.meta      # generation metadata
  ├── chapter1.vox.marcus.mp3      # alternative voice
  ├── chapter1.vox.marcus.spans
  └── .vox/                        # project cache/config
      ├── config.toml              # project configuration
      ├── overrides.toml           # experimental overrides (gitignored)
      ├── math.toml                # extracted LaTeX math
      ├── math-explain.toml        # math explanations
      ├── manifest.json            # generation tracking
      └── cache/

  Span File Format

  {basename}.vox.{voice}.spans (JSON):
  {
    "source_file": "/absolute/path/to/chapter1.esto",
    "source_hash": "sha256:abc123...",
    "audio_file": "/absolute/path/to/chapter1.vox.sally.mp3",
    "voice": "sally",
    "file_size": 1234,
    "audio_duration": 45.3,
    "created": "2025-10-12T10:00:00Z",

    "spans": {
      "doc": { ... },
      "doc.c[0]": { ... },
      "doc.c[0].s[0]": { ... },
      "doc.c[0].s[0].sn[0]": { ... }
    },

    "name_index": {
      "prologue": "doc.c[0]",
      "dark-night": "doc.c[0].s[0]",
      "opening-line": "doc.c[0].s[0].sn[0]"
    },

    "index": {
      "by_type": {
        "chapter": ["doc.c[0]"],
        "section": ["doc.c[0].s[0]", "doc.c[0].s[1]"],
        "sentence": ["doc.c[0].s[0].sn[0]", "..."]
      },
      "by_time": {
        "0.0": ["doc.c[0].s[0].sn[0]"],
        "2.5": ["doc.c[0].s[0].sn[1]"]
      },
      "by_offset": {
        "0": ["doc.c[0].s[0].sn[0]"],
        "46": ["doc.c[0].s[0].sn[1]"]
      }
    }
  }

  ---
  4. Configuration System

  Layered Priority (highest to lowest)

  1. CLI flags - --voice marcus --pitch +10%
  2. Span overrides - .vox/overrides.toml (per-span, experimental)
  3. esto file directives - @voice sally
  4. Project config - .vox/config.toml
  5. User config - ~/.config/vox/config.toml
  6. System defaults - Built-in vox defaults

  Project Config (.vox/config.toml)

  [defaults]
  voice = "sally"
  pitch = "0%"
  rate = 1.0
  sync_mode = "sentence"

  [voices]
  narrator = "sally"
  hero = "marcus"
  villain = "onyx"

  [markdown.titles]
  speak = true
  h1_pause_after = "1.5s"
  h2_pause_after = "1.0s"
  h3_pause_after = "0.5s"

  [markdown.math]
  mode = "short"  # placeholder | short | long | description | skip
  auto_explain = true
  ai_explain_tool = "claude"

  [spans."doc.c[prologue]"]
  voice = "narrator"
  pitch = "+5%"

  [spans."doc.c[prologue].s[dark-night].sn[opening-line]"]
  rate = 1.2
  emphasis = "strong"

  Override File (.vox/overrides.toml)

  # Experimental - not committed to git

  [cast]
  # Recast all characters
  narrator = "nova"    # was sally
  hero = "echo"        # was marcus

  [timing]
  # Global timing adjustments
  offset = "+0.5s"
  rate_multiplier = 1.1

  [spans."doc.c[prologue].s[dark-night]"]
  # Override specific section
  start_time = 1.0
  voice = "fable"
  pitch = "+15%"

  ---
  5. vox CLI - Pipe-First Design

  Core Principle

  vox reads stdin and writes stdout/files. No module dependencies.

  Usage Patterns

  Generate audio:
  # From stdin
  echo "Hello world" | vox generate sally --output hello.mp3

  # From file
  cat chapter1.esto | vox generate sally --output chapter1.mp3 --spans

  # Direct file shortcut
  vox generate sally chapter1.esto --output chapter1.mp3 --spans

  # With esto markup
  cat chapter1.esto | vox generate sally --esto --spans --output chapter1.mp3

  # With config
  cat chapter1.esto | vox generate sally --config .vox/config.toml --overrides .vox/overrides.toml

  Play audio (generate + play):
  # Immediate playback
  echo "Test message" | vox play sally

  # From file
  cat announcement.txt | vox play marcus

  # QA integration (pure composition)
  qa a 1 | vox play sally

  Span operations:
  # List spans
  vox span list chapter1.esto sally

  # Get specific span
  vox span get chapter1.esto sally "doc.c[prologue].s[dark-night].sn[0]"

  # Play span
  vox span play chapter1.esto sally "doc.c[prol].s[dark]"

  # Extract span text
  vox span extract chapter1.esto sally "doc.c[0].s[0].sn[opening-line]"

  # Retime span
  vox span retime chapter1.esto sally "doc.c[0].s[0].sn[1]" --start 3.0 --end 5.5

  # Revoice section
  vox span revoice chapter1.esto "doc.c[prologue]" --voice marcus

  # Show span tree
  vox span tree chapter1.esto sally "doc.c[prologue]"

  Math operations:
  # Extract math from file
  vox math extract paper.esto

  # Generate explanations with AI
  vox math explain paper.esto --ai claude

  # Edit explanations manually
  vox math edit paper.esto

  # Test math pronunciation
  vox math test MATH_0 sally

  REPL:
  vox repl

  ---
  6. vox REPL

  Concept

  Interactive shell with command-first syntax (first token is the command).

  REPL Session Example

  $ vox repl

  vox> generate sally "Hello world"
  Generated: 2.3s, 45KB
  [plays audio]

  vox> play sally < chapter1.esto
  [plays audio from file]

  vox> span list chapter1.esto sally
  doc.c[0]                 prologue         "The Dark Beginning"
  doc.c[0].s[0]            dark-night       "A Dark and Stormy Night"
  doc.c[0].s[0].sn[0]      opening-line     "It was a dark..."

  vox> span play chapter1.esto sally doc.c[prol].s[dark].sn[0]
  [plays specific sentence]

  vox> voice marcus
  Active voice: marcus

  vox> math explain paper.esto
  Extracted 5 math expressions
  Generated explanations with Claude
  Saved to .vox/math-explain.toml

  vox> config show
  voice: sally
  pitch: 0%
  rate: 1.0

  vox> help span
  Span commands:
    span list <file> <voice>
    span get <file> <voice> <path>
    span play <file> <voice> <path>
    ...

  vox> quit

  REPL Commands

  - generate <voice> <text> or generate <voice> < file
  - play <voice> <text> or play <voice> < file
  - span list|get|play|extract|retime|revoice ...
  - math extract|explain|edit|test ...
  - voice <name> - Set active voice
  - config show|set|reload
  - help [topic]
  - quit|exit

  ---
  7. Markdown + Math Handling

  Markdown Processing

  Title/Header Handling:
  # Introduction
  @.title say="Introduction to the paper" pause=1.5s

  Content here.

  ## Background
  @.title skip=true
  # Skip speaking this title, just pause

  More content.

  Config for titles:
  [markdown.titles]
  speak = true
  h1_pause_after = "1.5s"
  h2_pause_after = "1.0s"
  h3_pause_after = "0.5s"

  h1_prepend = "Chapter: "
  h2_prepend = "Section: "

  [markdown.titles.overrides."Introduction"]
  say_as = "Introduction to the paper"
  pause_after = "2.0s"

  Math Processing Pipeline

  1. Extract math:
  vox math extract paper.esto

  Creates .vox/math.toml:
  [inline]
  MATH_0 = "$E = mc^2$"
  MATH_1 = "$\\lambda = h/p$"

  [block]
  MATH_BLOCK_0 = """
  $$
  \\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}
  $$
  """

  2. Generate explanations (AI-assisted):
  vox math explain paper.esto --ai claude

  Creates .vox/math-explain.toml:
  [inline.MATH_0]
  latex = "$E = mc^2$"
  say = "E equals m c squared"
  long_say = "E equals mass times the speed of light squared"
  description = "Einstein's mass-energy equivalence"
  pause_before = "0.2s"
  pause_after = "0.3s"

  [block.MATH_BLOCK_0]
  latex = "$$\n\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}\n$$"
  say = "gamma equals one over the square root of one minus v squared over c squared"
  intro = "The Lorentz factor is given by:"
  outro = "which describes time dilation"
  pause_before = "0.5s"
  pause_after = "1.0s"

  3. Generate TTS with math:
  cat paper.esto | vox generate sally --math-mode long

  Math modes:
  - placeholder - "The equation PLACEHOLDER describes..."
  - short - "The equation, E equals m c squared, describes..."
  - long - "The equation, E equals mass times the speed of light squared, describes..."
  - description - "Einstein's mass-energy equivalence describes..."
  - skip - Omit math entirely

  ---
  8. QA Integration (Adapter Pattern)

  Core Principle

  vox has zero dependency on QA. Integration via pure Unix composition.

  Direct composition:
  qa a 1 | vox play sally
  qa a 1 | vox generate sally --output answer1.mp3

  Optional convenience wrapper (bash/vox/adapters/vox_qa.sh):
  vox-qa() {
      local qa_index="$1"
      local voice="$2"
      qa a "$qa_index" | vox play "$voice"
  }

  # Usage
  vox-qa 1 sally

  ---
  9. Implementation Structure

  Module Files

  bash/vox/
  ├── vox.sh                  # Main CLI (pipe-first)
  ├── vox_core.sh            # TTS generation (OpenAI/Azure/Google)
  ├── vox_span.sh            # Span operations (CRUD, query, play)
  ├── vox_esto.sh            # esto parser → spans generator
  ├── vox_esto_ssml.sh       # esto → SSML converter (Azure/Google)
  ├── vox_markdown.sh        # Markdown title/structure processing
  ├── vox_math.sh            # Math extraction + explanation
  ├── vox_config.sh          # Config loading + layered merging
  ├── vox_voices.sh          # Voice profile management
  ├── vox_repl.sh            # Interactive REPL
  ├── vox_tui.sh             # TUI components (for demo/014)
  ├── vox_state.sh           # State machine (for TES compliance)
  └── adapters/
      └── vox_qa.sh          # QA integration (optional)

  demo/basic/014/             # TUI demo (audio-text sync)
  ├── demo.sh
  ├── tui.conf
  └── [standard demo pattern from 012]

  Core Functions (vox.sh)

  vox()                       # Main entry point
  vox_generate()              # stdin → audio file
  vox_play()                  # stdin → audio → speaker
  vox_span_cmd()              # Span operations dispatcher
  vox_math_cmd()              # Math operations dispatcher
  vox_repl()                  # Start REPL

  Span Operations (vox_span.sh)

  vox_span_create()           # Create span from offsets
  vox_span_list()             # List spans
  vox_span_get()              # Get span by path
  vox_span_resolve()          # Resolve name/fuzzy → span_id
  vox_span_extract()          # Extract text via offsets
  vox_span_play()             # Play audio for span
  vox_span_retime()           # Adjust span timing
  vox_span_revoice()          # Change span voice
  vox_span_tree()             # Show hierarchy

  esto Parser (vox_esto.sh)

  vox_esto_parse()            # Parse esto → spans JSON
  vox_esto_to_ssml()          # esto → SSML (Azure/Google)
  vox_esto_to_text()          # esto → plain text (OpenAI)
  vox_esto_validate()         # Lint esto syntax

  Math Processing (vox_math.sh)

  vox_math_extract()          # Extract LaTeX → .vox/math.toml
  vox_math_explain()          # Generate explanations (AI)
  vox_math_substitute()       # Replace placeholders
  vox_math_test()             # Test pronunciation

  ---
  10. Implementation Roadmap

  Phase 1: Core (MVP)

  1. vox.sh - Pipe-first CLI (generate, play commands)
  2. vox_core.sh - OpenAI TTS integration
  3. vox_span.sh - Basic span CRUD (create, list, get)
  4. vox_esto.sh - Simple esto parser (no sections, just sentences)
  5. Manual testing - echo "test" | vox play sally

  Phase 2: Hierarchical Spans

  6. vox_esto.sh - Full hierarchy parsing (chapter/section/paragraph/sentence)
  7. vox_span.sh - Named + indexed addressing
  8. vox_span.sh - Fuzzy matching + resolution
  9. Span navigation - parent, children, siblings, tree
  10. Testing - Named span addressing

  Phase 3: Configuration

  11. vox_config.sh - Layered config loading
  12. Config merging - CLI > overrides > esto > project > user > defaults
  13. Per-span overrides - Voice, timing, prosody
  14. Cast system - Role-based voice mapping

  Phase 4: Markdown + Math

  15. vox_markdown.sh - Title detection + pause injection
  16. vox_math.sh - LaTeX extraction
  17. AI integration - Claude/GPT for math explanations
  18. Math modes - placeholder, short, long, description

  Phase 5: REPL

  19. vox_repl.sh - Basic REPL shell
  20. Command-first syntax - command args...
  21. File loading - command < file
  22. History + completion - readline integration

  Phase 6: TUI Demo

  23. demo/014/ - Audio-text sync TUI
  24. Go audio player - Position tracking via beep/oto
  25. Synchronized cursor - Text highlight follows audio
  26. Scrubbing - Seek audio by text position

  Phase 7: Advanced

  27. Multiple TTS providers - Azure, Google (SSML)
  28. Word-level sync - Not just sentences
  29. Phoneme-level sync - Ultra-precise
  30. WebVTT export - Subtitles/captions
  31. Batch processing - Process multiple files
  32. CI integration - Auto-generate audio in pipelines

  ---
  11. Testing Strategy

  Unit Tests

  # Span resolution
  test_span_resolve_by_index
  test_span_resolve_by_name
  test_span_resolve_fuzzy
  test_span_resolve_alias

  # Config merging
  test_config_layer_priority
  test_span_override
  test_cast_mapping

  # Math processing
  test_math_extract_inline
  test_math_extract_block
  test_math_placeholder_substitution

  # esto parsing
  test_esto_parse_hierarchy
  test_esto_parse_timestamps
  test_esto_parse_ipa

  Integration Tests

  # End-to-end
  test_pipe_stdin_to_audio
  test_generate_with_esto
  test_span_play
  test_math_ai_explain

  # REPL
  test_repl_command_first
  test_repl_file_input
  test_repl_multi_command

  Manual Test Cases

  # Simple TTS
  echo "Hello world" | vox play sally

  # esto with spans
  cat chapter1.esto | vox generate sally --spans --output ch1.mp3
  vox span list chapter1.esto sally
  vox span play chapter1.esto sally "doc.c[prol].s[dark]"

  # Math paper
  cat paper.esto | vox math extract
  vox math explain paper.esto --ai claude
  cat paper.esto | vox generate sally --math-mode long

  # QA integration
  qa a 1 | vox play sally

  # REPL
  vox repl
  vox> play sally "Test message"
  vox> span list chapter1.esto sally

  ---
  12. Open Questions / Future Considerations

  1. Audio player: Go (beep/oto) vs C (PortAudio) vs bash (ffplay polling)?
  2. Sync generation: How to auto-generate word-level timing without TTS API support?
  3. Voice cloning: Integration with ElevenLabs or custom models?
  4. Real-time streaming: Generate + play audio as text is typed?
  5. Multi-speaker: True multi-track audio (overlapping voices)?
  6. Emotion markup: @emotion sad → prosody adjustments?
  7. SSML fallback: When OpenAI doesn't support, convert esto → respelling heuristics?
  8. Collaborative editing: Multiple people editing .vox/overrides.toml?

  ---
  13. Key Design Decisions

  ✅ Pipe-first: Composable, testable, no coupling
  ✅ File-agnostic: Works on any text, not just QA
  ✅ Named spans: Human-friendly addressing
  ✅ External config: Non-destructive experimentation
  ✅ Offset-based: Stable references, diff-friendly
  ✅ Recursive sections: No arbitrary depth limit
  ✅ Math-aware: Academic paper support
  ✅ REPL-first: Interactive workflow

  ❌ Not tightly coupled to QA: QA is just one use case
  ❌ Not XML-based: esto is clean, readable
  ❌ Not line-based: Offsets are more stable
  ❌ Not limited to OpenAI: Provider-agnostic design

  ---
  14. Example Workflows

  Audiobook Generation

  # Process markdown book
  for chapter in chapters/*.md; do
      base=$(basename "$chapter" .md)
      cat "$chapter" | vox generate sally --output "audio/$base.mp3" --spans
  done

  # Create combined audiobook
  cat audio/*.mp3 > audiobook-full.mp3

  # Generate WebVTT subtitles
  for chapter in chapters/*.md; do
      vox span export "$chapter" sally webvtt > "audio/$(basename "$chapter" .md).vtt"
  done

  Academic Paper

  # Extract math
  vox math extract paper.esto

  # Generate explanations with AI
  vox math explain paper.esto --ai claude

  # Edit explanations
  vox math edit paper.esto

  # Generate audio with math
  cat paper.esto | vox generate sally --math-mode long --output paper.mp3 --spans

  # Listen to specific section
  vox span play paper.esto sally "doc.s[methodology]"

  Podcast Script

  # Multi-voice script
  cat episode-1.esto | vox generate --cast .vox/cast.toml --output ep1.mp3

  # Try different voice casting
  cat episode-1.esto | vox generate --cast .vox/alt-cast.toml --output ep1-alt.mp3

  # Fine-tune timing
  vox span retime episode-1.esto sally "doc.s[intro]" --start 0.5 --end 5.0
  cat episode-1.esto | vox generate --overrides .vox/overrides.toml --output ep1-final.mp3

  ---
  15. Success Criteria

  MVP (Phase 1-2):
  - ✅ echo "test" | vox play sally works
  - ✅ esto files generate audio with hierarchical spans
  - ✅ Named span addressing: doc.c[prologue].s[opening]
  - ✅ Fuzzy matching works

  Beta (Phase 3-4):
  - ✅ External config overrides work
  - ✅ Markdown files process correctly (titles, math)
  - ✅ AI-assisted math explanations
  - ✅ Multi-voice casting from esto

  v1.0 (Phase 5-6):
  - ✅ REPL is usable and responsive
  - ✅ TUI demo shows synchronized playback
  - ✅ QA integration via pure pipes
  - ✅ Documentation complete

  ---
  Copy/Paste Summary for Next Chat

  Context: We designed vox, a TTS system with audio-text synchronization for the tetra framework.

  Key Points:
  - esto markup language: @directive syntax, backtick IPA, hierarchical sections
  - Hierarchical spans: Named + indexed (e.g., doc.c[prologue].s[dark-night].sn[0])
  - Pipe-first CLI: cat file | vox generate sally --output file.mp3 --spans
  - External config: .vox/config.toml + .vox/overrides.toml for non-destructive editing
  - Markdown + math: Auto-process titles, extract LaTeX, AI-assisted explanations
  - Decoupled from QA: Works on any text file, QA via pipes (qa a 1 | vox play sally)
  - REPL: Command-first syntax (vox> span play file sally doc.c[0])

  Implementation: bash modules in bash/vox/, optional Go audio player, demo/014 for TUI sync playback.

  Next Steps: Implement Phase 1 (MVP: pipe-first CLI + basic spans).

