# Terminal REPLs: A Technical History and Design Philosophy

## Table of Contents
1. [The Terminal Problem Space](#the-terminal-problem-space)
2. [Why REPLs Are Hard](#why-repls-are-hard)
3. [Coupling API to REPL: The Value Proposition](#coupling-api-to-repl)
4. [Case Study: doctl and the API-REPL Pattern](#case-study-doctl)
5. [Tetra's Approach](#tetras-approach)

---

## The Terminal Problem Space

### Historical Context

The terminal emulator problem is a 50+ year accumulation of compatibility layers, each trying to paper over the limitations of the previous generation.

#### Teletypes (1960s-1970s)
The original "terminal" was a physical teletype machine ([ASR-33](https://en.wikipedia.org/wiki/Teletype_Model_33)). These devices:
- Had no cursor positioning (paper only moves forward)
- Used 7-bit ASCII ([RFC 20](https://www.rfc-editor.org/rfc/rfc20))
- Transmitted at 110 baud (10 characters/second)
- Were literally printers with keyboards

**Key limitation**: No concept of a "screen" - output was write-only, append-only.

#### VT100 and ANSI Escape Sequences (1978)
The [DEC VT100](https://en.wikipedia.org/wiki/VT100) introduced:
- CRT display with addressable cursor
- ANSI escape sequences for cursor control ([ECMA-48](https://www.ecma-international.org/publications-and-standards/standards/ecma-48/), [ISO/IEC 6429](https://www.iso.org/standard/12782.html))
- 24 lines × 80 columns display

**The problem**: ANSI escape codes were never formally standardized for terminals. ECMA-48 defines *control functions* but implementations vary wildly.

Example cursor positioning:
```
ESC [ {row} ; {col} H     # Move cursor (CSI sequence)
```

**Sources**:
- [ANSI escape code - Wikipedia](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [console_codes - Linux man page](https://man7.org/linux/man-pages/man4/console_codes.4.html)
- [DEC VT100 User Guide](https://vt100.net/docs/vt100-ug/)

#### The POSIX Terminal Interface (1988)

POSIX.1 ([IEEE Std 1003.1](https://pubs.opengroup.org/onlinepubs/9699919799/)) standardized terminal I/O through the `termios` interface.

**Key components**:
- `termios` structure: Controls terminal behavior
- `cflag`: Control modes (baud rate, character size)
- `lflag`: Local modes (canonical vs raw input)
- `iflag`: Input modes (CR/LF translation)
- `oflag`: Output modes (post-processing)

**Sources**:
- [termios(3) - Linux man page](https://man7.org/linux/man-pages/man3/termios.3.html)
- [POSIX Terminal Interface - Chapter 11](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap11.html)
- [The TTY demystified](https://www.linusakesson.net/programming/tty/) - Essential deep dive

#### Terminal Multiplexing Problem

Modern terminals face a fundamental architecture issue: the kernel has no concept of "applications" on a terminal, only processes writing to file descriptors.

**The kernel perspective** ([tty driver source](https://github.com/torvalds/linux/blob/master/drivers/tty/tty_io.c)):
```
User process → Line discipline → TTY driver → Terminal emulator
```

**Problems**:
1. **No cursor save/restore**: Multiple programs can't share screen regions
2. **No input routing**: All programs read from same stdin
3. **No synchronized updates**: Screen tears during concurrent writes

**Solutions evolved**:
- `termcap`/`terminfo`: Terminal capability databases ([terminfo(5)](https://man7.org/linux/man-pages/man5/terminfo.5.html))
- `curses`/`ncurses`: Screen management libraries ([ncurses - Wikipedia](https://en.wikipedia.org/wiki/Ncurses))
- `tmux`/`screen`: Terminal multiplexers ([tmux(1)](https://man.openbsd.org/tmux.1))

**Sources**:
- [The TTY demystified](https://www.linusakesson.net/programming/tty/)
- [Linux TTY framework - Kernel documentation](https://www.kernel.org/doc/html/latest/driver-api/tty/index.html)

---

## Why REPLs Are Hard

### The State Management Problem

A REPL (Read-Eval-Print Loop) must maintain several concurrent state machines:

#### 1. Input State
- **Raw mode**: Character-by-character (`stty -icanon`)
- **Canonical mode**: Line-buffered with editing (`stty icanon`)
- **Echo control**: Local echo vs remote echo

**The problem**: Switching between modes loses buffered input.

```bash
# Example: Switching from canonical to raw loses pending input
stty icanon     # User types "hello" but hasn't pressed Enter
stty -icanon    # Buffered "hello" is lost
```

**Sources**:
- [termios(3) - ICANON flag](https://man7.org/linux/man-pages/man3/termios.3.html)
- [GNU Readline - Input interaction](https://tiswww.case.edu/php/chet/readline/rluserman.html)

#### 2. History and Editing State

**GNU Readline** ([readline(3)](https://man7.org/linux/man-pages/man3/readline.3.html)) solved this for line-oriented REPLs:
- History navigation (↑/↓)
- Emacs/Vi keybindings
- Tab completion
- Undo/redo

**But**: Readline assumes:
- Line-oriented input
- Full control of terminal
- No concurrent output during editing

**This breaks for**:
- Real-time updates (logs, metrics)
- Asynchronous events (notifications)
- Multi-region displays (header + content + footer)

**Sources**:
- [GNU Readline Library](https://tiswww.case.edu/php/chet/readline/rltop.html)
- [MDN - Console API](https://developer.mozilla.org/en-US/docs/Web/API/Console) - Browser REPL comparison

#### 3. Display State

**The double-buffering problem**: Terminals don't have native double-buffering.

**Solutions**:
1. **Alternate screen buffer**: `tput smcup` / `tput rmcup`
   - Saves/restores entire screen
   - Used by `vim`, `less`, `tmux`
   - [console_codes(4) - ?1049h](https://man7.org/linux/man-pages/man4/console_codes.4.html)

2. **Differential updates**: Only redraw changed cells
   - Requires tracking previous state
   - Complex cursor positioning
   - Example: [Demo 014 buffer.sh:102-130](/bash/tui/buffer.sh)

3. **Line-oriented updates**: Redraw full lines
   - Simpler but more flicker
   - Used by most REPLs

**Sources**:
- [Alternate screen - VT100.net](https://vt100.net/docs/vt510-rm/DECSET.html)
- [Notcurses - Modern TUI library](https://nick-black.com/dankwiki/index.php/Notcurses)

#### 4. Signal Handling

POSIX signals interact poorly with interactive input:

**Signal problems**:
- `SIGINT` (Ctrl-C): Should cancel current line or entire program?
- `SIGTSTP` (Ctrl-Z): Requires terminal state save/restore
- `SIGWINCH`: Window resize during input line
- `SIGCHLD`: Background job completion during prompt

**The `stty -isig` hack**:
```bash
stty -isig  # Disable signal generation
# Now Ctrl-C produces literal \x03 instead of SIGINT
```

Used in [demo.sh:422](demo.sh#L422) to handle Ctrl-C gracefully in TUI mode.

**Sources**:
- [signal(7) - Linux man page](https://man7.org/linux/man-pages/man7/signal.7.html)
- [stty(1) - isig flag](https://man7.org/linux/man-pages/man1/stty.1.html)

#### 5. Completion State

Tab completion requires:
- Parsing incomplete input
- Querying available completions (potentially slow)
- Displaying completions without disrupting input
- Handling ambiguous completions

**Bash completion** ([bash-completion GitHub](https://github.com/scop/bash-completion)):
- Uses `complete -F` to register completion functions
- Completion functions receive partial command in `COMP_WORDS`
- Return completions via `COMPREPLY` array

**The problem**: Completion functions are synchronous and blocking.

**Modern solution** (used by `fish`, `zsh`):
- Asynchronous completion queries
- Progressive completion display
- Inline completion previews

**Sources**:
- [Bash Programmable Completion](https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion.html)
- [Fish shell - Autosuggestions](https://fishshell.com/docs/current/interactive.html#autosuggestions)

---

## Coupling API to REPL: The Value Proposition

### The Impedance Mismatch Problem

Most CLIs suffer from **help-implementation drift**:

```bash
# Help says:
tool users create --name STRING --email STRING

# Implementation actually accepts:
tool users create --name STRING [--email STRING] [--org STRING] [--role STRING]

# API actually provides:
POST /v1/users
{
  "name": "required",
  "email": "optional",
  "org_id": "optional",
  "role": "optional",
  "metadata": {"arbitrary": "fields"}
}
```

**Why drift happens**:
1. Help is hand-written documentation
2. CLI argument parsing is separate from API client
3. API evolves faster than CLI
4. No shared source of truth

### The Single Source of Truth Pattern

**Modern approach**: Generate CLI from API specification.

**OpenAPI/Swagger** ([OpenAPI Specification](https://spec.openapis.org/oas/latest.html)):
- Machine-readable API contract
- JSON Schema for request/response validation
- Operation IDs map to CLI commands

**Example tools using this pattern**:
- `doctl` (DigitalOcean) - [doctl GitHub](https://github.com/digitalocean/doctl)
- `aws-cli` v2 - [AWS CLI GitHub](https://github.com/aws/aws-cli)
- `gcloud` - [Google Cloud SDK](https://cloud.google.com/sdk/gcloud)
- `stripe` - [Stripe CLI](https://github.com/stripe/stripe-cli)

**Benefits**:
1. **Guaranteed parity**: CLI exactly matches API
2. **Automatic documentation**: Help generated from API docs
3. **Type safety**: Request validation from JSON Schema
4. **Versioning**: CLI version tracks API version

**Sources**:
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [JSON Schema](https://json-schema.org/)
- [Generating SDKs from OpenAPI - Stripe blog](https://stripe.com/blog/openapi-spec)

---

## Case Study: doctl

### Architecture Overview

[doctl](https://github.com/digitalocean/doctl) demonstrates excellent API-CLI coupling:

```
┌─────────────────────────────────────────────┐
│ OpenAPI Spec (DigitalOcean API)            │
│ https://api.digitalocean.com/v2/schema     │
└─────────────┬───────────────────────────────┘
              │
              ├──> Go SDK (godo)
              │    https://github.com/digitalocean/godo
              │
              └──> doctl CLI
                   ├─ Command tree mirrors API resources
                   ├─ Subcommands mirror API operations
                   └─ Flags mirror API parameters
```

### Command Organization

**Resource-oriented hierarchy**:
```bash
doctl compute          # /v2/droplets, /v2/volumes, etc.
  ├── droplet         # /v2/droplets
  │   ├── create      # POST /v2/droplets
  │   ├── list        # GET /v2/droplets
  │   ├── get         # GET /v2/droplets/{id}
  │   └── delete      # DELETE /v2/droplets/{id}
  ├── ssh-key         # /v2/account/keys
  │   ├── create      # POST /v2/account/keys
  │   └── list        # GET /v2/account/keys
  └── load-balancer   # /v2/load_balancers
```

**Key insights**:
1. **Nouns are resources**: `droplet`, `ssh-key`, `load-balancer`
2. **Verbs are operations**: `create`, `list`, `get`, `delete`
3. **Flags are parameters**: Directly map to API JSON fields

### Help Tree Structure

```bash
$ doctl compute droplet create --help

Usage:
  doctl compute droplet create <name>... [flags]

Flags:
  --image string         Image slug or ID (required)
  --size string          Droplet size slug (required)
  --region string        Region slug (required)
  --ssh-keys strings     SSH key IDs or fingerprints
  --enable-ipv6          Enable IPv6
  --enable-monitoring    Enable monitoring

# This EXACTLY mirrors the API:
POST /v2/droplets
{
  "name": "string",
  "image": "string|int",
  "size": "string",
  "region": "string",
  "ssh_keys": ["int|string"],
  "ipv6": "boolean",
  "monitoring": "boolean"
}
```

**Implementation** ([doctl/commands/droplets.go](https://github.com/digitalocean/doctl/blob/main/commands/droplets.go)):
```go
// Flag definitions map directly to API struct fields
func cmdDropletCreate() *Command {
    cmd := &Command{
        Command: &cobra.Command{
            Use:   "create <name>...",
            Short: "Create a new Droplet",
            RunE: func(cmd *cobra.Command, args []string) error {
                // Get flags
                image, _ := cmd.Flags().GetString("image")
                size, _ := cmd.Flags().GetString("size")
                // ...

                // Map directly to API request
                req := &godo.DropletCreateRequest{
                    Name:   args[0],
                    Image:  godo.DropletCreateImage{Slug: image},
                    Size:   size,
                    // ...
                }

                // Call API
                droplet, _, err := client.Droplets.Create(ctx, req)
                return err
            },
        },
    }

    // Flags mirror API fields
    cmd.Flags().String("image", "", "Image slug or ID (required)")
    cmd.Flags().String("size", "", "Droplet size slug (required)")
    // ...

    return cmd
}
```

### REPL Integration

**doctl doesn't have a built-in REPL**, but its structure makes it REPL-ready:

```bash
# Traditional usage:
doctl compute droplet list

# REPL usage (hypothetical):
doctl> compute droplet list
doctl> compute droplet create demo-1 --image ubuntu-20-04 --size s-1vcpu-1gb

# The same command tree works in both modes
```

**Why this works**:
1. Each command is **stateless** (REPL can execute independently)
2. Commands are **pure functions** of arguments (no global state)
3. Output is **structured** (can be JSON, YAML, or table)
4. **Completion is implicit** (command tree = completion tree)

### Sources
- [doctl GitHub repository](https://github.com/digitalocean/doctl)
- [DigitalOcean API v2 Documentation](https://docs.digitalocean.com/reference/api/)
- [Cobra - CLI framework used by doctl](https://github.com/spf13/cobra)

---

## Tetra's Approach

### Design Goals

Based on the doctl pattern, tetra aims for:

1. **API-REPL parity**: Every API operation has a REPL command
2. **Typed actions**: Commands declare inputs/outputs ([demo 014 pattern](README.md))
3. **Context-aware operations**: `@local`, `@dev`, `@staging`, `@prod` ([REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md))
4. **Visual REPL**: TUI shows state, not just text output

### Command Structure

**Tetra verb×noun pattern**:
```bash
# Traditional CLI:
tetra show demo
tetra view toml
tetra fetch config

# REPL mode (inside TUI):
tetra> show×demo      # Execute show:demo action
tetra> view×toml      # Execute view:toml action
tetra> fetch×config   # Execute fetch:config action
```

**Action registry** ([bash/actions/registry.sh](bash/actions/registry.sh)):
```bash
declare_action "show_demo" \
    "verb=show" \
    "noun=demo" \
    "output=@tui[content]" \
    "immediate=true"

# Maps to signature:
show:demo :: () → @tui[content]
```

### Help Tree = Action Tree

**Insight from doctl**: The command tree IS the help tree.

**Tetra implementation**:
```bash
# Context: Local, Mode: Inspect
get_actions "Local" "Inspect"
# Returns: view:toml view:env check:local show:help

# Each action has metadata:
get_action_signature "view:toml"
# Returns: view:toml :: () → @tui[content] [where read @local[tetra.toml]]
```

**Auto-generated help**:
```bash
tetra> help:signatures

Action Signatures (Local:Inspect):

view:toml :: () → @tui[content]
  Reads: @local[tetra.toml]
  Outputs: TUI content region
  Operation: read

view:env :: () → @tui[content]
  Reads: @local[environment]
  Outputs: TUI content region
  Operation: read

check:local :: () → @tui[content]
  Executes: @local[validation]
  Outputs: TUI content region
  Operation: execute
```

### TUI as REPL

**Traditional REPL**:
```
> command
output line 1
output line 2
> next command
```

**Tetra TUI REPL** (inspired by [demo 014](demo.sh)):
```
┌─────────────────────────────────────────────┐
│ Demo 014: Local × Inspect                   │ ← Header (context)
│ Action: [view×toml] ○ idle                  │
├─────────────────────────────────────────────┤
│ Content:                                     │ ← Output region
│   [tetra.toml contents displayed here]      │
│                                              │
├─────────────────────────────────────────────┤
│   e=context  m=mode  a=action  Enter=exec   │ ← Footer (help)
└─────────────────────────────────────────────┘
```

**Key innovation**: The REPL state is VISUAL, not textual.

**Benefits**:
1. **State always visible**: Context, mode, action shown in header
2. **Output region**: Dedicated space, no scroll-back needed
3. **Action state**: Visual indicators (○ idle, ▶ executing, ✓ success, ✗ error)
4. **Flicker-free**: Differential buffer updates ([buffer.sh](bash/tui/buffer.sh))

### Completion from Registry

**The action registry IS the completion database**:

```bash
# Get completions for current context
get_completions() {
    local context="${ENVIRONMENTS[$ENV_INDEX]}"
    local mode="${MODES[$MODE_INDEX]}"
    local partial="$1"

    # Get all actions for this context
    local actions=$(get_actions "$context" "$mode")

    # Filter by partial match
    for action in $actions; do
        [[ "$action" =~ ^"$partial" ]] && echo "$action"
    done
}

# Usage:
get_completions "vie"
# Returns: view:toml view:env
```

**No separate completion script needed** - the action registry contains all metadata.

### Sources
- [Demo 014 README](README.md)
- [Action Registry implementation](bash/actions/registry.sh)
- [TUI Buffer implementation](bash/tui/buffer.sh)

---

## References

### Standards and Specifications
- [RFC 20 - ASCII format for Network Interchange](https://www.rfc-editor.org/rfc/rfc20)
- [ECMA-48 - Control Functions for Coded Character Sets](https://www.ecma-international.org/publications-and-standards/standards/ecma-48/)
- [ISO/IEC 6429 - Control functions for coded character sets](https://www.iso.org/standard/12782.html)
- [POSIX.1-2017 - Chapter 11: General Terminal Interface](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap11.html)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

### Linux Kernel Documentation
- [TTY Driver Documentation](https://www.kernel.org/doc/html/latest/driver-api/tty/index.html)
- [TTY Layer Source Code](https://github.com/torvalds/linux/blob/master/drivers/tty/tty_io.c)

### Man Pages
- [termios(3)](https://man7.org/linux/man-pages/man3/termios.3.html)
- [console_codes(4)](https://man7.org/linux/man-pages/man4/console_codes.4.html)
- [readline(3)](https://man7.org/linux/man-pages/man3/readline.3.html)
- [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html)
- [stty(1)](https://man7.org/linux/man-pages/man1/stty.1.html)

### Wikipedia
- [ANSI escape code](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [VT100](https://en.wikipedia.org/wiki/VT100)
- [Teletype Model 33](https://en.wikipedia.org/wiki/Teletype_Model_33)
- [Ncurses](https://en.wikipedia.org/wiki/Ncurses)

### MDN (Mozilla Developer Network)
- [Console API](https://developer.mozilla.org/en-US/docs/Web/API/Console)

### Deep Dives
- [The TTY demystified - Linus Åkesson](https://www.linusakesson.net/programming/tty/)
- [VT100.net - Terminal Documentation Archive](https://vt100.net/)

### Projects and Tools
- [GNU Readline](https://tiswww.case.edu/php/chet/readline/rltop.html)
- [Bash Completion](https://github.com/scop/bash-completion)
- [Notcurses - Modern TUI library](https://nick-black.com/dankwiki/index.php/Notcurses)
- [doctl - DigitalOcean CLI](https://github.com/digitalocean/doctl)
- [Cobra - CLI framework](https://github.com/spf13/cobra)
- [Fish shell](https://fishshell.com/)

---

## Conclusion

The terminal REPL problem is fundamentally about managing multiple concurrent state machines (input, history, display, signals, completion) over an interface designed for sequential teletype output.

**The doctl pattern solves this by**:
1. **Single source of truth**: API spec generates CLI
2. **Resource-oriented design**: Nouns are resources, verbs are operations
3. **Stateless commands**: Each command is independent
4. **Structured output**: Machine-readable formats enable tooling

**Tetra extends this with**:
1. **Visual state**: TUI makes REPL state visible
2. **Action registry**: Metadata enables smart completion and help
3. **Context awareness**: Operations know their execution context
4. **Type signatures**: Clear input/output contracts

The result: A REPL where help, completion, and execution are all derived from the same declarative action registry, ensuring they never drift out of sync.
