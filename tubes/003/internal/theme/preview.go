package theme

import (
	"fmt"
	"strings"
	
	"github.com/charmbracelet/lipgloss"
)

// Preview renders a one-line preview of all theme styles
func Preview(s *Styles) string {
	// Helper to render a swatch
	row := func(name string, st lipgloss.Style) string {
		return st.Render(fmt.Sprintf(" %s ", name))
	}
	
	names := []string{"header", "sidebar", "main", "input", "ok", "info", "warn", "error"}
	var parts []string
	
	for _, n := range names {
		if style, ok := s.ByName[n]; ok {
			parts = append(parts, row(n, style))
		}
	}
	
	return strings.Join(parts, " ")
}

// DetailedPreview renders a multi-line preview with more context
func DetailedPreview(s *Styles) string {
	var lines []string
	
	// Header section
	lines = append(lines, s.Header.Render("═══ Tubes Theme Preview ═══"))
	lines = append(lines, "")
	
	// Sidebar example
	sidebar := []string{
		"Files:",
		"├── cmd/",
		"│   └── tubes/",
		"│       └── main.go",
		"├── internal/",
		"│   ├── theme/",
		"│   └── layout/",
		"└── go.mod",
	}
	sidebarBox := s.Sidebar.Render(strings.Join(sidebar, "\n"))
	
	// Main content example
	main := []string{
		"package main",
		"",
		"import (",
		"    \"fmt\"",
		"    \"os\"",
		")",
		"",
		"func main() {",
		"    fmt.Println(\"Hello, Tubes!\")",
		"}",
	}
	mainBox := s.Main.Render(strings.Join(main, "\n"))
	
	// Status examples
	lines = append(lines, sidebarBox+"  "+mainBox)
	lines = append(lines, "")
	lines = append(lines, s.Ok.Render(" ✓ Build successful ")+"  "+
		s.Info.Render(" ℹ Info message ")+"  "+
		s.Warn.Render(" ⚠ Warning ")+"  "+
		s.Error.Render(" ✗ Error "))
	lines = append(lines, "")
	
	// Input example
	lines = append(lines, s.Input.Render("/theme preview"))
	
	return strings.Join(lines, "\n")
}