Architecture Enhancements

Message Bus Layer

Introduce an internal event/message bus (pub/sub) to decouple modules (navigation, history, HTTP server).

Benefits: extensibility, testing isolation, simpler integration with future AI agents.

Unified Command Context

Wrap command execution in a CommandContext struct containing:

Parsed args

Current model snapshot

I/O handles (UI + API)

Enables identical handling across CLI, TUI, and HTTP.

Persistent State Layer

Add persistence abstraction (StateStore) to support local JSON, BoltDB, or SQLite backends.

Avoid coupling history/LLM context directly to memory.

Background Worker Pool

Commands that require async/long-running tasks (e.g., parsing, code indexing) should run in a worker pool with progress events published to the TUI.

API / LLM Integration

REST + WebSocket API

Current parity is REST-only. Add WebSocket endpoints for:

Real-time UI mirroring

Streamed command outputs

Enables external clients (Claude/ChatGPT clones) to “attach” live.

Structured Command Results

All command responses should emit a standard schema:

{
  "ok": true,
  "stdout": "...",
  "stderr": "...",
  "data": { "files": [...], "metrics": {...} }
}


Allows LLM clients to parse and act predictably.

LLM-Aware Context Hooks

Explicit hooks to expose:

Current navigation state

Last N commands + outputs

System metadata (go version, env vars)

Gives an AI agent a stable, queryable world model.

TUI / UX Improvements

Panel Abstraction Layer

Instead of raw viewport.Model use a higher-level Panel interface:

Render() string

HandleInput(key tea.KeyMsg)

Resize(width, height int)

Simplifies layout management and multi-panel interactions.

Mode Management

Formalize a ModeManager (command, insert, task) instead of boolean flags.

Easier extension for AI-assisted or collaborative modes.

Autocomplete Provider API

Abstract autocomplete into a provider interface:

Suggest(prefix string, ctx CommandContext) []Suggestion

Allows plugging in static commands, file paths, or LLM-based completions.

File/Code Intelligence Layer (Claude Code Target)

Incremental Indexing

Add a background service that incrementally indexes the source directory (TUBES_SRC) using Go AST or Tree-sitter.

Store results in an internal cache for fast lookups.

Semantic Navigation

Commands like /symbol find, /refactor rename can map onto the indexed AST.

This mirrors Claude Code’s semantic search & edit functionality.

LLM-Mediated Actions

Provide APIs for “propose edit” vs “apply edit”.

Example: /llm refactor extract-function returns a diff which the user confirms before applying.

File Structure Refinement

Proposed additions:

internal/
├── core/
│   ├── bus.go            # Event/message bus
│   ├── state.go          # Persistent state layer
│   ├── workers.go        # Worker pool manager
├── api/
│   ├── rest.go           # REST endpoints
│   ├── ws.go             # WebSocket streaming
│   └── schema.go         # Shared JSON schemas
├── codeintel/
│   ├── indexer.go        # AST/Tree-sitter indexing
│   ├── search.go         # Semantic symbol search
│   └── edits.go          # Proposed refactors/diffs
└── tui/
    ├── panels.go         # Panel interface
    ├── modes.go          # Mode management
    └── autocomplete.go   # Pluggable autocomplete

Summary of Gaps vs Goals

Good base: MVC separation, Bubbletea/Lipgloss stack, command registry, markdown rendering.

Missing for Claude Code parity:

Persistent indexed model of the codebase

Bidirectional LLM/agent integration hooks

Live streaming API (WebSocket)

Structured diff/patch workflow

Panel/mode abstraction for complex workflows

Would you like me to sketch out a proposed CommandContext struct and event bus interface in Go as the next step, since those will be the key glue pieces for enabling AI-driven workflows?

You said:
Yes but first suggest alternative TUI helpers currently mine feel off, having a hard time holding the size and position of elements.
ChatGPT said:
Thought for 16s

Below are pragmatic options and layout patterns that remove jitter and make size/positioning deterministic.

Alternative TUI stacks (layout-strong)

tview (on tcell): Flex (rows/cols with ratio), Grid (r,c with min/max), Pages (stacking). Deterministic retained-mode layout, good for panes/dashboards.

gocui (or awesome-gocui fork): Minimal immediate-mode with fixed rect views; simple for tiling UIs where you control exact rectangles.

termdash (on tcell): Grid builder with absolute and proportional sizes; good for dashboards with stable placement.

Bubbletea + tcell backend: Keep Bubbletea, but drive rendering on top of tcell and implement your own rect allocator; reduces lipgloss width/height surprises on resizes.

When Bubbletea is non-negotiable, add a small retained-mode layout manager that computes rectangles once per WindowSizeMsg, then render pure strings into those rects.

Deterministic layout helpers (drop-in for Bubbletea)
package layout

import "math"

type UnitKind int
const (
	Px UnitKind = iota // absolute cells
	Fr                 // fractional share of remaining space
)

type Unit struct{ Kind UnitKind; Val int } // Px: cells; Fr: weight

type Rect struct{ X, Y, W, H int }

type Row struct{ Height Unit; Min, Max int } // Min/Max in cells (0 = no bound)
type Col struct{ Width  Unit; Min, Max int }

type GridSpec struct {
	Rows []Row
	Cols []Col
	Gaps struct{ Row, Col int } // inter-row/col spacing
	Padding struct{ T, R, B, L int }
}

type Grid struct {
	spec GridSpec
	rows []int // computed heights
	cols []int // computed widths
}

func NewGrid(spec GridSpec) *Grid { return &Grid{spec: spec} }

func (g *Grid) Compute(totalW, totalH int) {
	// inner box
	w := totalW - g.spec.Padding.L - g.spec.Padding.R
	h := totalH - g.spec.Padding.T - g.spec.Padding.B
	if w < 0 { w = 0 }; if h < 0 { h = 0 }

	g.rows = distribute(h, g.spec.Gaps.Row, g.rowUnits(), g.rowBounds())
	g.cols = distribute(w, g.spec.Gaps.Col, g.colUnits(), g.colBounds())
}

func (g *Grid) CellRect(r, c int) Rect {
	x := g.spec.Padding.L
	y := g.spec.Padding.T
	for i := 0; i < c; i++ { x += g.cols[i] + g.spec.Gaps.Col }
	for i := 0; i < r; i++ { y += g.rows[i] + g.spec.Gaps.Row }
	return Rect{X: x, Y: y, W: g.cols[c], H: g.rows[r]}
}

func (g *Grid) rowUnits() []Unit {
	out := make([]Unit, len(g.spec.Rows))
	for i, r := range g.spec.Rows { out[i] = r.Height }
	return out
}
func (g *Grid) colUnits() []Unit {
	out := make([]Unit, len(g.spec.Cols))
	for i, c := range g.spec.Cols { out[i] = c.Width }
	return out
}
func (g *Grid) rowBounds() (min, max []int) {
	n := len(g.spec.Rows); min = make([]int, n); max = make([]int, n)
	for i, r := range g.spec.Rows { min[i], max[i] = r.Min, r.Max }
	return
}
func (g *Grid) colBounds() (min, max []int) {
	n := len(g.spec.Cols); min = make([]int, n); max = make([]int, n)
	for i, c := range g.spec.Cols { min[i], max[i] = c.Min, c.Max }
	return
}

// Core allocator: absolute Px first, then distribute remaining by Fr weights with bounds.
func distribute(total, gap, _units []Unit, _boundsMin, _boundsMax []int) []int {
	n := len(_units)
	out := make([]int, n)
	spacing := gap * int(math.Max(0, float64(n-1)))
	remain := total - spacing
	if remain < 0 { remain = 0 }

	// allocate Px, clamp to bounds
	sumFr := 0
	for i, u := range _units {
		if u.Kind == Px {
			v := u.Val
			if _boundsMin[i] > 0 && v < _boundsMin[i] { v = _boundsMin[i] }
			if _boundsMax[i] > 0 && v > _boundsMax[i] { v = _boundsMax[i] }
			out[i] = v
			remain -= v
		} else {
			sumFr += u.Val
		}
	}
	if remain < 0 { remain = 0 }

	// distribute by fraction
	for i, u := range _units {
		if u.Kind == Fr {
			v := 0
			if sumFr > 0 {
				v = int((float64(u.Val) / float64(sumFr)) * float64(remain))
			}
			// clamp
			if _boundsMin[i] > 0 && v < _boundsMin[i] { v = _boundsMin[i] }
			if _boundsMax[i] > 0 && v > _boundsMax[i] { v = _boundsMax[i] }
			out[i] = v
		}
	}
	// adjust rounding drift
	used := 0
	for _, v := range out { used += v }
	drift := (total - spacing) - used
	for i := 0; drift > 0 && i < n; i++ { out[i]++; drift-- }
	for i := 0; drift < 0 && i < n; i++ { if out[i] > 0 { out[i]--; drift++ } }
	return out
}


Description.
A retained-mode grid with Px and Fr units plus min/max clamps. Compute once per resize, then render into stable Rects. Eliminates lipgloss width heuristics from layout math.

Bubbletea integration pattern
// in model.go
type Model struct {
	W, H int
	Grid *layout.Grid
	Rects struct {
		Header, Sidebar, Main, Input layout.Rect
	}
	// ...
}

func (m Model) Init() tea.Cmd { return nil }

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if msg.Width == m.W && msg.Height == m.H { return m, nil }
		m.W, m.H = msg.Width, msg.Height
		spec := layout.GridSpec{
			Rows: []layout.Row{
				{Height: layout.Unit{Kind: layout.Px, Val: 1}}, // header
				{Height: layout.Unit{Kind: layout.Fr, Val: 1}}, // body
				{Height: layout.Unit{Kind: layout.Px, Val: 3}}, // input
			},
			Cols: []layout.Col{
				{Width: layout.Unit{Kind: layout.Px, Val: 24}, Min: 20, Max: 40}, // sidebar
				{Width: layout.Unit{Kind: layout.Fr, Val: 1}},
			},
		}
		g := layout.NewGrid(spec)
		g.Compute(m.W, m.H)
		m.Grid = g
		m.Rects.Header  = g.CellRect(0, 0)                // spans cols: stitch via W sum if needed
		m.Rects.Sidebar = g.CellRect(1, 0)
		m.Rects.Main    = g.CellRect(1, 1)
		m.Rects.Input   = g.CellRect(2, 0) // if spanning, set W = total
		// normalize spans:
		m.Rects.Header.W = m.W
		m.Rects.Input.W  = m.W
	}
	// handle other msgs...
	return m, nil
}

func (m Model) View() string {
	// render strings sized to rects; never recompute layout here.
	// apply lipgloss styles only after hard width/height clamp.
}


Description.
All size changes flow through WindowSizeMsg. Layout is recomputed once and cached; View() becomes pure string assembly using fixed rects, eliminating jitter.

Rendering stability checklist

Use go-runewidth for width calculations on wide/combining characters; call runewidth.StringWidth to pre-truncate lines to rect width before styling.

Apply lipgloss after hard width/height clamps. Styles cannot increase the rect; pad/truncate first.

Debounce resize storms: ignore WindowSizeMsg that do not change (W,H); optionally coalesce via a short timer.

Keep a dedicated LayoutDirty flag; only recompute on actual size change or layout-affecting config updates.

Centralize borders/gaps in the layout spec; do not “+1/-1” inside panel renderers.

Give each panel a Resize(w,h) hook to precompute any wrapped content buffers on size changes.

If switching stacks

tview: Replace your manual layout with Grid and Flex. Keep your command system. Wrap each panel in a tview.Primitive. Use Pages to handle modals/overlays deterministically.

gocui: Precompute rects (as above) and map each to a View. Good when you prefer explicit coordinates and very low overhead.

If you want, I can adapt the layout.Grid helper above to your current internal/tui package and show how to render viewport.Model and textarea.Model into fixed rects without drift.

You said:
suggest a method for stylizing, saving and recalling themed colors
ChatGPT said:
Thought for 30s
// internal/theme/theme.go
package theme

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/lucasb-eyer/go-colorful"
	"gopkg.in/yaml.v3"
)

const (
	SchemaVersion = 1
	DefaultDirEnv = "TUBES_DIR"
	DefaultRelDir = "themes"
	currentFile   = ".current" // stores the active theme name
)

type Tokens struct {
	// Semantic tokens. Hex or ANSI names.
	Primary   string `yaml:"primary"`
	Surface   string `yaml:"surface"`
	SurfaceHi string `yaml:"surface_hi"`
	SurfaceLo string `yaml:"surface_lo"`
	Text      string `yaml:"text"`
	TextMute  string `yaml:"text_mute"`
	Accent    string `yaml:"accent"`
	Info      string `yaml:"info"`
	Warn      string `yaml:"warn"`
	Error     string `yaml:"error"`
	Ok        string `yaml:"ok"`
}

type StyleDef struct {
	FG       string   `yaml:"fg,omitempty"`
	BG       string   `yaml:"bg,omitempty"`
	Bold     bool     `yaml:"bold,omitempty"`
	Faint    bool     `yaml:"faint,omitempty"`
	Italic   bool     `yaml:"italic,omitempty"`
	Underline bool    `yaml:"underline,omitempty"`
	Border   string   `yaml:"border,omitempty"`
	Padding  []int    `yaml:"padding,omitempty"` // [t,r,b,l]
	Margin   []int    `yaml:"margin,omitempty"`  // [t,r,b,l]
}

type Theme struct {
	Version  int                `yaml:"version"`
	Name     string             `yaml:"name"`
	Updated  time.Time          `yaml:"updated"`
	Tokens   Tokens             `yaml:"tokens"`
	Derived  map[string]string  `yaml:"derived,omitempty"` // optional precomputed variants
	Styles   map[string]StyleDef`yaml:"styles,omitempty"`  // named UI styles
}

// Styles is the compiled lipgloss styles ready for rendering.
type Styles struct {
	ByName map[string]lipgloss.Style
	// Common bindings for convenience:
	Header  lipgloss.Style
	Sidebar lipgloss.Style
	Main    lipgloss.Style
	Input   lipgloss.Style
	Error   lipgloss.Style
	Warn    lipgloss.Style
	Ok      lipgloss.Style
	Info    lipgloss.Style
}

// ---------- persistence ----------

func Dir() (string, error) {
	root := os.Getenv(DefaultDirEnv)
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			return "", err
		}
	}
	d := filepath.Join(root, DefaultRelDir)
	if err := os.MkdirAll(d, 0o755); err != nil {
		return "", err
	}
	return d, nil
}

func PathFor(name string) (string, error) {
	dir, err := Dir()
	if err != nil { return "", err }
	return filepath.Join(dir, sanitize(name)+".yaml"), nil
}

func CurrentPath() (string, error) {
	dir, err := Dir()
	if err != nil { return "", err }
	return filepath.Join(dir, currentFile), nil
}

func List() ([]string, error) {
	dir, err := Dir()
	if err != nil { return nil, err }
	var out []string
	err = filepath.WalkDir(dir, func(p string, d fs.DirEntry, e error) error {
		if e != nil { return e }
		if d.IsDir() { return nil }
		if strings.HasSuffix(d.Name(), ".yaml") {
			out = append(out, strings.TrimSuffix(d.Name(), ".yaml"))
		}
		return nil
	})
	return out, err
}

func Load(name string) (*Theme, error) {
	p, err := PathFor(name)
	if err != nil { return nil, err }
	b, err := os.ReadFile(p)
	if err != nil { return nil, err }
	var t Theme
	if err := yaml.Unmarshal(b, &t); err != nil { return nil, err }
	if t.Version != SchemaVersion {
		return nil, fmt.Errorf("theme %q schema mismatch: got %d want %d", name, t.Version, SchemaVersion)
	}
	if t.Name == "" { t.Name = name }
	return &t, nil
}

func Save(t *Theme) error {
	if t == nil { return errors.New("nil theme") }
	if t.Version == 0 { t.Version = SchemaVersion }
	if t.Updated.IsZero() { t.Updated = time.Now().UTC() }
	p, err := PathFor(t.Name)
	if err != nil { return err }
	b, err := yaml.Marshal(t)
	if err != nil { return err }
	return os.WriteFile(p, b, 0o644)
}

func SetCurrent(name string) error {
	p, err := CurrentPath()
	if err != nil { return err }
	return os.WriteFile(p, []byte(sanitize(name)), 0o644)
}

func GetCurrent() (string, error) {
	p, err := CurrentPath()
	if err != nil { return "", err }
	b, err := os.ReadFile(p)
	if err != nil { return "", err }
	return strings.TrimSpace(string(b)), nil
}

func sanitize(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "_")
	return s
}

// ---------- compilation to lipgloss ----------

func Compile(t *Theme) (*Styles, error) {
	if t == nil { return nil, errors.New("nil theme") }
	// derive missing tokens if requested
	derived := ensureDerived(t)
	// build styles
	styles := make(map[string]lipgloss.Style, len(t.Styles)+8)

	// helpers
	asColor := func(x string) lipgloss.Color {
		return lipgloss.Color(x) // termenv will downsample if needed
	}
	build := func(sd StyleDef) lipgloss.Style {
		st := lipgloss.NewStyle()
		if sd.FG != "" { st = st.Foreground(asColor(sd.FG)) }
		if sd.BG != "" { st = st.Background(asColor(sd.BG)) }
		if sd.Border != "" { st = st.BorderForeground(asColor(sd.Border)).BorderStyle(lipgloss.NormalBorder()) }
		if len(sd.Padding) == 4 { st = st.Padding(sd.Padding[0], sd.Padding[1], sd.Padding[2], sd.Padding[3]) }
		if len(sd.Margin) == 4 { st = st.Margin(sd.Margin[0], sd.Margin[1], sd.Margin[2], sd.Margin[3]) }
		if sd.Bold { st = st.Bold(true) }
		if sd.Faint { st = st.Faint(true) }
		if sd.Italic { st = st.Italic(true) }
		if sd.Underline { st = st.Underline(true) }
		return st
	}

	// defaults if not provided
	def := map[string]StyleDef{
		"header":  {FG: t.Tokens.Text, BG: t.Tokens.SurfaceHi, Bold: true},
		"sidebar": {FG: t.Tokens.TextMute, BG: t.Tokens.Surface, Border: derived["border"]},
		"main":    {FG: t.Tokens.Text, BG: t.Tokens.SurfaceLo},
		"input":   {FG: t.Tokens.Text, BG: derived["input_bg"], Border: derived["border"]},
		"error":   {FG: t.Tokens.Surface, BG: t.Tokens.Error, Bold: true},
		"warn":    {FG: t.Tokens.Surface, BG: t.Tokens.Warn, Bold: true},
		"ok":      {FG: t.Tokens.Surface, BG: t.Tokens.Ok, Bold: true},
		"info":    {FG: t.Tokens.Surface, BG: t.Tokens.Info, Bold: true},
	}

	// merge user overrides
	for k, v := range t.Styles {
		def[k] = v
	}
	// compile
	for k, v := range def {
		styles[k] = build(v)
	}

	return &Styles{
		ByName: styles,
		Header:  styles["header"],
		Sidebar: styles["sidebar"],
		Main:    styles["main"],
		Input:   styles["input"],
		Error:   styles["error"],
		Warn:    styles["warn"],
		Ok:      styles["ok"],
		Info:    styles["info"],
	}, nil
}

// ensureDerived creates common variants if missing.
func ensureDerived(t *Theme) map[string]string {
	if t.Derived == nil { t.Derived = map[string]string{} }
	out := t.Derived
	if _, ok := out["border"]; !ok {
		out["border"] = adjustLCH(t.Tokens.SurfaceHi, -0.10, 0, 0)
	}
	if _, ok := out["input_bg"]; !ok {
		out["input_bg"] = adjustLCH(t.Tokens.Surface, -0.04, 0, 0)
	}
	return out
}

// adjustLCH applies deltas in OKHCL-ish space via colorful's Hcl approximation.
func adjustLCH(hex string, dL, dC, dH float64) string {
	c, err := colorful.Hex(hex)
	if err != nil { return hex }
	L, a, b := c.Lab()
	// treat dC as scale on chroma via a,b vector
	C := mathHypot(a, b)
	theta := mathAtan2(b, a) + dH
	C = clamp(C*(1+dC), 0, 1.5)
	L = clamp(L + dL, 0, 1)
	a = C * mathCos(theta)
	b = C * mathSin(theta)
	return colorful.Lab(L, a, b).Clamped().Hex()
}

func clamp(x, lo, hi float64) float64 {
	if x < lo { return lo }
	if x > hi { return hi }
	return x
}

func mathHypot(a, b float64) float64 { return (a*a + b*b) ** 0.5 }
func mathAtan2(y, x float64) float64 { return float64(float32((float64)(atan2(y, x)))) } // minimal dependency-free shim
func mathCos(x float64) float64      { return float64(float32((float64)(cos(x)))) }
func mathSin(x float64) float64      { return float64(float32((float64)(sin(x)))) }

// Use the stdlib math when available; if this file sits in a normal module, replace the above with math.{Hypot,Atan2,Cos,Sin}.

// internal/theme/preview.go
package theme

import (
	"fmt"
	"strings"
)

func Preview(s *Styles) string {
	// 1-line swatches for quick verification
	row := func(name string, st lipgloss.Style) string {
		return st.Render(fmt.Sprintf(" %s ", name))
	}
	names := []string{"header","sidebar","main","input","ok","info","warn","error"}
	var parts []string
	for _, n := range names {
		parts = append(parts, row(n, s.ByName[n]))
	}
	return strings.Join(parts, " ")
}

# themes/monochrome.yaml
version: 1
name: monochrome
updated: 2025-09-09T00:00:00Z
tokens:
  primary:   "#c3e88d"
  surface:   "#1e1e1e"
  surface_hi:"#2a2a2a"
  surface_lo:"#151515"
  text:      "#e0e0e0"
  text_mute: "#a0a0a0"
  accent:    "#82aaff"
  info:      "#82aaff"
  warn:      "#ffcb6b"
  error:     "#f07178"
  ok:        "#c3e88d"
styles:
  header:  { fg: "#111111", bg: "#c3e88d", bold: true }
  sidebar: { fg: "#a0a0a0", bg: "#1e1e1e", border: "#2a2a2a", padding: [0,1,0,1] }
  input:   { fg: "#e0e0e0", bg: "#202020", border: "#2a2a2a" }

// internal/tui/uiconfig.go (integration sketch)
package tui

import (
	"log"

	"nodeholder/com/m/internal/theme"
)

type UIConfig struct {
	ThemeName string
	Styles    *theme.Styles
}

func (m *Model) loadTheme(name string) error {
	t, err := theme.Load(name)
	if err != nil { return err }
	s, err := theme.Compile(t)
	if err != nil { return err }
	m.UI.ThemeName = name
	m.UI.Styles = s
	_ = theme.SetCurrent(name)
	return nil
}

func (m *Model) initTheme() {
	// precedence: /themes/.current -> env TUBES_THEME -> fallback "monochrome"
	var name string
	if cur, err := theme.GetCurrent(); err == nil && cur != "" {
		name = cur
	} else if env := os.Getenv("TUBES_THEME"); env != "" {
		name = env
	} else {
		name = "monochrome"
	}
	if err := m.loadTheme(name); err != nil {
		log.Println("theme load failed:", err)
	}
}

// internal/tui/commands_theme.go (CLI binding)
package tui

import "strings"

func (m *Model) cmdTheme(args []string) (string, error) {
	if len(args) == 0 { return "usage: /theme [list|use NAME|save NAME]", nil }
	switch args[0] {
	case "list":
		names, err := theme.List()
		if err != nil { return "", err }
		return strings.Join(names, "\n"), nil
	case "use":
		if len(args) < 2 { return "usage: /theme use NAME", nil }
		if err := m.loadTheme(args[1]); err != nil { return "", err }
		return "ok", nil
	case "save":
		if len(args) < 2 { return "usage: /theme save NAME", nil }
		// capture current compiled palette back to YAML skeleton if needed
		// or write a copy with overrides; minimal example:
		t := &theme.Theme{
			Name:   args[1],
			Tokens: m.extractTokens(), // implement: read from current theme or UI
		}
		if err := theme.Save(t); err != nil { return "", err }
		return "saved", nil
	}
	return "unknown subcommand", nil
}


Description.

Schema: YAML file per theme under $TUBES_DIR/themes/NAME.yaml; a .current file stores the active theme name.

API: theme.Load/Save/List, theme.SetCurrent/GetCurrent, theme.Compile returns lipgloss styles.

Tokens: semantic colors; Derived holds computed variants; ensureDerived auto-derives border and input backgrounds.

Compilation: user-defined styles override defaults; downsampling handled by lipgloss/termenv.

Integration: /theme list|use|save commands; initTheme() loads precedence: .current → TUBES_THEME → fallback.

Preview: theme.Preview() renders swatches to verify themes.

Extension: add watchers (fsnotify) for hot-reload, and seed-based generation via LCH adjustments for light/dark variants.
