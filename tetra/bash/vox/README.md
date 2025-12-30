# VOX - Voice Annotation & Synthesis System

G2P, phoneme annotation, and audio synthesis pipeline for the tetra framework.

**Version:** 1.1.0

## Quick Start

```bash
source ~/tetra/tetra.sh

# Get IPA for a word
vox word hello                    # Output: həlˈoʊ

# Create annotation from text
echo "Hello, world!" | vox create
vox list                          # Show documents

# Render and synthesize
vox render <doc_id>               # Render to terminal
vox synth <doc_id> en-us          # Generate audio

# Interactive editor
vox tui <doc_id>                  # Edit phonemes
```

## Command Reference

```
+-----------+-------------------+-------------------------------------------+
| Category  | Command           | Description                               |
+-----------+-------------------+-------------------------------------------+
| G2P       | vox g2p <cmd>     | Full subcommand (word|json|text|formants) |
|           | vox word <w>      | Quick: word -> IPA                        |
|           | vox ipa <w>       | Alias for word                            |
+-----------+-------------------+-------------------------------------------+
| Annotate  | vox annotate <c>  | Full subcommand (create|read|update|...)  |
|           | vox create        | Create annotation from stdin              |
|           | vox list          | List all documents                        |
|           | vox read <id> <k> | Read annotation (phonemes|prosody|...)    |
+-----------+-------------------+-------------------------------------------+
| Pipeline  | vox pipeline <c>  | Full subcommand (process|render|synth)    |
|           | vox process       | Full pipeline from stdin                  |
|           | vox render <id>   | Render document to terminal               |
|           | vox synth <id>    | Generate audio                            |
|           | vox stats <id>    | Show phoneme statistics                   |
+-----------+-------------------+-------------------------------------------+
| TUI       | vox tui <id>      | Interactive phoneme editor                |
|           | vox edit <id>     | Alias for tui                             |
|           | vox palette       | Show color system                         |
+-----------+-------------------+-------------------------------------------+
| Info      | vox version       | Show version                              |
|           | vox info          | Show module status                        |
|           | vox help          | Help message                              |
+-----------+-------------------+-------------------------------------------+
```

## Modules

```
bash/vox/
├── includes.sh          # Bootstrap - loads all modules (requires bash 5.2+)
├── vox_g2p.sh           # Grapheme-to-phoneme (espeak)
├── vox_annotate.sh      # Annotation CRUD operations
├── vox_pipeline.sh      # Pipeline orchestrator
├── vox_tui.sh           # Interactive editor + colors
├── index.sh             # Tab completion
└── pipeline/
    ├── parse.sh         # CST parsing, tokenization
    ├── render.sh        # Terminal rendering
    ├── synth.sh         # Audio synthesis
    └── batch.sh         # Batch ops, statistics
```

## G2P (Grapheme-to-Phoneme)

Convert text to IPA phonemes using espeak:

```bash
vox g2p word hello              # həlˈoʊ
vox g2p json hello              # JSON with phonemes + durations
vox g2p text                    # Process text from stdin
vox g2p formants hello          # Include formant mappings
vox g2p langs                   # List available languages
```

## Annotation System

CRUD operations for phoneme annotations stored in `$TETRA_DIR/vox/db/`:

```bash
# Create
echo "Speech synthesis" | vox annotate create
vox annotate create-from-file document.txt

# Read
vox annotate list                           # List all documents
vox annotate read <id> phonemes             # Read phoneme data
vox annotate read <id> source               # Read source text

# Update
vox annotate update-ipa <id> <offset> <ipa>
vox annotate update-duration <id> <word_off> <ph_idx> <dur>

# Export
vox annotate export-ssml <id>               # SSML format
vox annotate export-esto <id>               # esto format
```

**Annotation file format:** `{doc_id}.vox.{kind}.{ext}`
- `source.txt` - Original text
- `phonemes.json` - Word-level IPA + phoneme breakdown
- `prosody.json` - Emphasis, pitch, rate markers
- `meta.json` - Document metadata

## Pipeline

End-to-end document processing:

```bash
# Full pipeline
echo "Hello world" | vox pipeline process
cat document.md | vox pipeline process en-us

# Individual stages
vox pipeline parse                      # Parse to CST
vox pipeline tokenize                   # Tokenize CST
vox pipeline phonemize                  # Add phonemes

# Output
vox pipeline render <id>                # Terminal output
vox pipeline render <id> 1              # With IPA display

# Synthesis
vox pipeline script <id> en-us ssml     # Generate SSML
vox pipeline synth <id> en-us           # Generate audio

# Analysis
vox pipeline stats <id>                 # Phoneme statistics
vox pipeline word-freq <id>             # Word frequency
vox pipeline duration <id>              # Duration analysis
```

## Interactive TUI

Phoneme editor with keyboard navigation:

```bash
vox tui <doc_id>                # Open editor
vox tui list <doc_id>           # Non-interactive list
vox tui edit-word <id> <w> <ipa>  # Edit word IPA
vox tui palette                 # Show color system
```

**TUI Controls:**
| Key | Action |
|-----|--------|
| ↑/↓ | Navigate words |
| ←/→ | Switch word/phoneme mode |
| e | Edit IPA transcription |
| d | Edit phoneme duration |
| +/- | Adjust duration ±10ms |
| r | Regenerate from G2P |
| p | Preview (espeak) |
| s | Save changes |
| q | Quit |

## Data Storage

```
$TETRA_DIR/vox/
├── db/                         # Annotation database
│   ├── {id}.vox.source.txt
│   ├── {id}.vox.phonemes.json
│   ├── {id}.vox.prosody.json
│   └── {id}.vox.meta.json
├── cache/                      # Pipeline cache
└── export/                     # Exported files
```

## Environment Variables

```bash
VOX_SRC         # Source directory (default: $TETRA_SRC/bash/vox)
VOX_DIR         # Data directory (default: $TETRA_DIR/vox)
VOX_G2P_LANG    # Default language (default: en-us)
```

## Dependencies

**Required:**
- bash 5.2+
- jq (JSON processing)
- espeak or espeak-ng (G2P)

**Optional:**
- ffmpeg (audio synthesis)
- bat (syntax highlighting)

## Examples

```bash
# Process a document and view stats
echo "The quick brown fox" | vox create
vox list                        # Get doc_id
vox stats <doc_id>

# Generate audio
vox synth <doc_id> en-us

# Edit phonemes interactively
vox tui <doc_id>

# Export to SSML
vox annotate export-ssml <doc_id> > output.ssml

# Batch process files
vox pipeline batch "docs/*.md" en-us
```

## Tab Completion

Tab completion is automatically loaded via `index.sh`:

```bash
vox <TAB>                       # Show all commands
vox synth <TAB>                 # Show document IDs
vox g2p <TAB>                   # Show g2p subcommands
```

## Subcommand Help

```bash
vox g2p help                    # G2P commands
vox annotate help               # Annotation CRUD
vox pipeline help               # Pipeline stages
vox tui help                    # TUI controls
```
