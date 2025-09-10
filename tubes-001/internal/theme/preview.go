package theme

import (
	"fmt"
	"strings"
	
	"github.com/charmbracelet/lipgloss"
)

// Preview generates a visual preview of all theme design tokens
func Preview(s *Styles) string {
	var sections []string
	
	// Core layout preview
	sections = append(sections, renderSection("LAYOUT STYLES", []string{
		"header", "sidebar", "main", "input",
	}, s))
	
	// State styles preview
	sections = append(sections, renderSection("STATE STYLES", []string{
		"ok", "info", "warn", "error",
	}, s))
	
	// Interactive styles preview  
	sections = append(sections, renderSection("INTERACTIVE STYLES", []string{
		"selected", "active", "inactive",
	}, s))
	
	// Typography preview
	sections = append(sections, renderSection("TYPOGRAPHY STYLES", []string{
		"title", "subtitle", "body", "caption",
	}, s))
	
	return strings.Join(sections, "\n\n")
}

// PreviewOneLine generates a compact 1-line swatch for quick verification
func PreviewOneLine(s *Styles) string {
	row := func(name string, st lipgloss.Style) string {
		return st.Render(fmt.Sprintf(" %s ", name))
	}
	
	names := []string{"header", "sidebar", "main", "input", "ok", "info", "warn", "error"}
	var parts []string
	
	for _, n := range names {
		if style, exists := s.ByName[n]; exists {
			parts = append(parts, row(n, style))
		}
	}
	
	return strings.Join(parts, " ")
}

// renderSection renders a section of styles with a title
func renderSection(title string, styleNames []string, s *Styles) string {
	var lines []string
	
	// Section title
	titleStyle := lipgloss.NewStyle().Bold(true).Underline(true)
	lines = append(lines, titleStyle.Render(title))
	
	// Render each style
	for _, name := range styleNames {
		if style, exists := s.ByName[name]; exists {
			// Style name and preview
			preview := style.Render(fmt.Sprintf(" %s sample ", name))
			description := getStyleDescription(name)
			line := fmt.Sprintf("%-12s %s  %s", name+":", preview, description)
			lines = append(lines, line)
		}
	}
	
	return strings.Join(lines, "\n")
}

// getStyleDescription returns a description of what each style is used for
func getStyleDescription(name string) string {
	descriptions := map[string]string{
		"header":    "Top navigation and titles",
		"sidebar":   "Left cursor/navigation pane",
		"main":      "Right content pane",
		"input":     "Command input field",
		"ok":        "Success messages and confirmations",
		"info":      "Information and feedback messages",
		"warn":      "Warning messages",
		"error":     "Error messages and alerts",
		"selected":  "Currently selected/highlighted items",
		"active":    "Active/focused components",
		"inactive":  "Inactive/disabled components",
		"title":     "Section titles and headings",
		"subtitle":  "Subsection headings",
		"body":      "Main body text",
		"caption":   "Small labels and metadata",
	}
	
	if desc, exists := descriptions[name]; exists {
		return desc
	}
	return "Style description not available"
}

// GetColorPalette returns a formatted display of the color palette
func GetColorPalette() string {
	colors := []struct {
		name  string
		hex   string
		usage string
	}{
		{"background", "#000000", "Main background color"},
		{"foreground", "#FFFFFF", "Primary text color"},
		{"muted", "#808080", "Secondary/muted text"},
		{"accent", "#0066CC", "Highlight and accent color"},
		{"success", "#00AA00", "Success states and confirmations"},
		{"warning", "#FFAA00", "Warning states and alerts"},
		{"danger", "#CC0000", "Error states and critical alerts"},
		{"border", "#444444", "Borders and dividers"},
	}
	
	var lines []string
	lines = append(lines, lipgloss.NewStyle().Bold(true).Underline(true).Render("COLOR PALETTE"))
	
	for _, c := range colors {
		// Create a color swatch
		colorStyle := lipgloss.NewStyle().Background(lipgloss.Color(c.hex)).Foreground(lipgloss.Color("#FFFFFF"))
		swatch := colorStyle.Render("  ")
		line := fmt.Sprintf("%-12s %s %s  %s", c.name+":", swatch, c.hex, c.usage)
		lines = append(lines, line)
	}
	
	return strings.Join(lines, "\n")
}

// GetDesignTokens returns a structured view of all design tokens
func GetDesignTokens(s *Styles) string {
	var sections []string
	
	// Color palette
	sections = append(sections, GetColorPalette())
	
	// Typography scale
	sections = append(sections, getTypographyScale())
	
	// Spacing scale
	sections = append(sections, getSpacingScale())
	
	// Border styles
	sections = append(sections, getBorderStyles())
	
	return strings.Join(sections, "\n\n")
}

func getTypographyScale() string {
	var lines []string
	lines = append(lines, lipgloss.NewStyle().Bold(true).Underline(true).Render("TYPOGRAPHY SCALE"))
	
	typography := []struct {
		name string
		desc string
	}{
		{"title", "Large headings (bold, underlined)"},
		{"subtitle", "Section headings (bold)"},
		{"body", "Main content text (normal)"},
		{"caption", "Small labels (italic, muted)"},
	}
	
	for _, t := range typography {
		line := fmt.Sprintf("%-12s %s", t.name+":", t.desc)
		lines = append(lines, line)
	}
	
	return strings.Join(lines, "\n")
}

func getSpacingScale() string {
	var lines []string
	lines = append(lines, lipgloss.NewStyle().Bold(true).Underline(true).Render("SPACING SCALE"))
	
	spacing := []struct {
		name string
		desc string
	}{
		{"none", "0 - No spacing"},
		{"xs", "1 - Extra small spacing"},
		{"sm", "2 - Small spacing"},
		{"md", "4 - Medium spacing (default)"},
		{"lg", "6 - Large spacing"},
		{"xl", "8 - Extra large spacing"},
	}
	
	for _, sp := range spacing {
		line := fmt.Sprintf("%-12s %s", sp.name+":", sp.desc)
		lines = append(lines, line)
	}
	
	return strings.Join(lines, "\n")
}

func getBorderStyles() string {
	var lines []string
	lines = append(lines, lipgloss.NewStyle().Bold(true).Underline(true).Render("BORDER STYLES"))
	
	borders := []struct {
		name string
		desc string
	}{
		{"none", "No border"},
		{"thin", "Single line border"},
		{"thick", "Double line border"},
		{"rounded", "Rounded corner border"},
		{"dashed", "Dashed line border"},
	}
	
	for _, b := range borders {
		line := fmt.Sprintf("%-12s %s", b.name+":", b.desc)
		lines = append(lines, line)
	}
	
	return strings.Join(lines, "\n")
}