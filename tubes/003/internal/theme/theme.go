package theme

import (
	"errors"
	"fmt"
	"io/fs"
	"math"
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

// Tokens defines semantic color tokens
type Tokens struct {
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

// StyleDef defines a style configuration
type StyleDef struct {
	FG        string `yaml:"fg,omitempty"`
	BG        string `yaml:"bg,omitempty"`
	Bold      bool   `yaml:"bold,omitempty"`
	Faint     bool   `yaml:"faint,omitempty"`
	Italic    bool   `yaml:"italic,omitempty"`
	Underline bool   `yaml:"underline,omitempty"`
	Border    string `yaml:"border,omitempty"`
	Padding   []int  `yaml:"padding,omitempty"` // [t,r,b,l]
	Margin    []int  `yaml:"margin,omitempty"`  // [t,r,b,l]
}

// Theme represents a complete theme configuration
type Theme struct {
	Version int                `yaml:"version"`
	Name    string             `yaml:"name"`
	Updated time.Time          `yaml:"updated"`
	Tokens  Tokens             `yaml:"tokens"`
	Derived map[string]string  `yaml:"derived,omitempty"` // optional precomputed variants
	Styles  map[string]StyleDef `yaml:"styles,omitempty"`  // named UI styles
}

// Styles is the compiled lipgloss styles ready for rendering
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

// Dir returns the theme directory path
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

// PathFor returns the file path for a theme name
func PathFor(name string) (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, sanitize(name)+".yaml"), nil
}

// CurrentPath returns the path to the current theme file
func CurrentPath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, currentFile), nil
}

// List returns all available theme names
func List() ([]string, error) {
	dir, err := Dir()
	if err != nil {
		return nil, err
	}
	var out []string
	err = filepath.WalkDir(dir, func(p string, d fs.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(d.Name(), ".yaml") {
			out = append(out, strings.TrimSuffix(d.Name(), ".yaml"))
		}
		return nil
	})
	return out, err
}

// Load loads a theme by name
func Load(name string) (*Theme, error) {
	p, err := PathFor(name)
	if err != nil {
		return nil, err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var t Theme
	if err := yaml.Unmarshal(b, &t); err != nil {
		return nil, err
	}
	if t.Version != SchemaVersion {
		return nil, fmt.Errorf("theme %q schema mismatch: got %d want %d", name, t.Version, SchemaVersion)
	}
	if t.Name == "" {
		t.Name = name
	}
	return &t, nil
}

// Save saves a theme to disk
func Save(t *Theme) error {
	if t == nil {
		return errors.New("nil theme")
	}
	if t.Version == 0 {
		t.Version = SchemaVersion
	}
	if t.Updated.IsZero() {
		t.Updated = time.Now().UTC()
	}
	p, err := PathFor(t.Name)
	if err != nil {
		return err
	}
	b, err := yaml.Marshal(t)
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0o644)
}

// SetCurrent sets the current theme
func SetCurrent(name string) error {
	p, err := CurrentPath()
	if err != nil {
		return err
	}
	return os.WriteFile(p, []byte(sanitize(name)), 0o644)
}

// GetCurrent gets the current theme name
func GetCurrent() (string, error) {
	p, err := CurrentPath()
	if err != nil {
		return "", err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

// sanitize cleans up a theme name for filesystem use
func sanitize(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "_")
	return s
}

// Compile converts a theme to ready-to-use lipgloss styles
func Compile(t *Theme) (*Styles, error) {
	if t == nil {
		return nil, errors.New("nil theme")
	}
	
	// Derive missing tokens if requested
	derived := ensureDerived(t)
	
	// Build styles
	styles := make(map[string]lipgloss.Style, len(t.Styles)+8)

	// Helper functions
	asColor := func(x string) lipgloss.Color {
		return lipgloss.Color(x) // termenv will downsample if needed
	}
	
	build := func(sd StyleDef) lipgloss.Style {
		st := lipgloss.NewStyle()
		if sd.FG != "" {
			st = st.Foreground(asColor(sd.FG))
		}
		if sd.BG != "" {
			st = st.Background(asColor(sd.BG))
		}
		if sd.Border != "" {
			st = st.BorderForeground(asColor(sd.Border)).BorderStyle(lipgloss.NormalBorder())
		}
		if len(sd.Padding) == 4 {
			st = st.Padding(sd.Padding[0], sd.Padding[1], sd.Padding[2], sd.Padding[3])
		}
		if len(sd.Margin) == 4 {
			st = st.Margin(sd.Margin[0], sd.Margin[1], sd.Margin[2], sd.Margin[3])
		}
		if sd.Bold {
			st = st.Bold(true)
		}
		if sd.Faint {
			st = st.Faint(true)
		}
		if sd.Italic {
			st = st.Italic(true)
		}
		if sd.Underline {
			st = st.Underline(true)
		}
		return st
	}

	// Default styles if not provided
	def := map[string]StyleDef{
		"top_status":   {FG: t.Tokens.TextMute, BG: t.Tokens.Surface, Faint: true},
		"sidebar":      {FG: t.Tokens.TextMute, BG: t.Tokens.Surface},
		"main":         {FG: t.Tokens.Text, BG: t.Tokens.Surface},
		"input":        {FG: t.Tokens.Text, BG: t.Tokens.Surface, Border: derived["border"]},
		"input_noborder": {FG: t.Tokens.Text, BG: t.Tokens.Surface},
		"feedback":     {FG: t.Tokens.TextMute, BG: t.Tokens.Surface, Faint: true},
		"error":        {FG: t.Tokens.Surface, BG: t.Tokens.Error, Bold: true},
		"warn":         {FG: t.Tokens.Surface, BG: t.Tokens.Warn, Bold: true},
		"ok":           {FG: t.Tokens.Surface, BG: t.Tokens.Ok, Bold: true},
		"info":         {FG: t.Tokens.Surface, BG: t.Tokens.Info, Bold: true},
	}

	// Merge user overrides
	for k, v := range t.Styles {
		def[k] = v
	}
	
	// Compile all styles
	for k, v := range def {
		styles[k] = build(v)
	}

	return &Styles{
		ByName:  styles,
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

// ensureDerived creates common variants if missing
func ensureDerived(t *Theme) map[string]string {
	if t.Derived == nil {
		t.Derived = map[string]string{}
	}
	out := t.Derived
	
	if _, ok := out["border"]; !ok {
		out["border"] = adjustLCH(t.Tokens.SurfaceHi, -0.10, 0, 0)
	}
	if _, ok := out["input_bg"]; !ok {
		out["input_bg"] = adjustLCH(t.Tokens.Surface, -0.04, 0, 0)
	}
	
	return out
}

// adjustLCH applies deltas in LAB color space approximation
func adjustLCH(hex string, dL, dC, dH float64) string {
	c, err := colorful.Hex(hex)
	if err != nil {
		return hex
	}
	
	L, a, b := c.Lab()
	
	// Treat dC as scale on chroma via a,b vector
	C := math.Sqrt(a*a + b*b)
	theta := math.Atan2(b, a) + dH
	C = clamp(C*(1+dC), 0, 1.5)
	L = clamp(L+dL, 0, 1)
	a = C * math.Cos(theta)
	b = C * math.Sin(theta)
	
	return colorful.Lab(L, a, b).Clamped().Hex()
}

// clamp restricts a value to a range
func clamp(x, lo, hi float64) float64 {
	if x < lo {
		return lo
	}
	if x > hi {
		return hi
	}
	return x
}