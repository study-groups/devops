package layout

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Panel represents a renderable UI panel
type Panel interface {
	Render(rect Rect) string
	HandleInput(key string) bool
	Update(rect Rect)
}

// RenderContent renders content into a rectangle with proper truncation and padding
func RenderContent(content string, rect Rect, style lipgloss.Style) string {
	if rect.W <= 0 || rect.H <= 0 {
		return ""
	}

	lines := strings.Split(content, "\n")
	
	// Truncate to available height
	if len(lines) > rect.H {
		lines = lines[:rect.H]
	}

	// Pad lines to fill height
	for len(lines) < rect.H {
		lines = append(lines, "")
	}

	// Truncate/pad each line to width
	for i, line := range lines {
		// Truncate if too long
		if len(line) > rect.W {
			lines[i] = line[:rect.W]
		} else {
			// Pad if too short
			lines[i] = line + strings.Repeat(" ", rect.W-len(line))
		}
	}

	result := strings.Join(lines, "\n")
	
	// Apply lipgloss style after hard width/height constraints
	result = style.Width(rect.W).Height(rect.H).Render(result)

	return result
}

// Truncate truncates a string to fit within the given width
func Truncate(s string, width int) string {
	if width <= 0 {
		return ""
	}
	
	// Handle wide characters properly
	runes := []rune(s)
	if len(runes) <= width {
		return s
	}
	
	if width <= 3 {
		return strings.Repeat(".", width)
	}
	
	return string(runes[:width-3]) + "..."
}

// WrapText wraps text to fit within the given width
func WrapText(text string, width int) []string {
	if width <= 0 {
		return []string{}
	}

	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{}
	}

	var lines []string
	var currentLine strings.Builder

	for _, word := range words {
		// If adding this word would exceed width, start new line
		if currentLine.Len() > 0 && currentLine.Len()+1+len(word) > width {
			lines = append(lines, currentLine.String())
			currentLine.Reset()
		}

		// Add word to current line
		if currentLine.Len() > 0 {
			currentLine.WriteString(" ")
		}
		currentLine.WriteString(word)
	}

	// Add final line if not empty
	if currentLine.Len() > 0 {
		lines = append(lines, currentLine.String())
	}

	return lines
}

// PadRect adds padding to a rectangle, returning the inner content area
func PadRect(rect Rect, padding [4]int) Rect {
	// padding: [top, right, bottom, left]
	return Rect{
		X: rect.X + padding[3],
		Y: rect.Y + padding[0], 
		W: rect.W - padding[1] - padding[3],
		H: rect.H - padding[0] - padding[2],
	}
}

// Position represents a 2D position
type Position struct {
	X, Y int
}

// PlaceAt returns content positioned at specific coordinates using ANSI escape codes
func PlaceAt(x, y int, content string) string {
	if x < 0 || y < 0 {
		return content
	}
	
	lines := strings.Split(content, "\n")
	var result strings.Builder
	
	for i, line := range lines {
		result.WriteString("\x1b[")
		result.WriteString(string(rune(y + i + 1))) // ANSI uses 1-based indexing
		result.WriteString(";")
		result.WriteString(string(rune(x + 1)))
		result.WriteString("H")
		result.WriteString(line)
		if i < len(lines)-1 {
			result.WriteString("\n")
		}
	}
	
	return result.String()
}