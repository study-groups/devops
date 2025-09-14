package layout

import (
	"fmt"
	"strings"
	
	"github.com/charmbracelet/lipgloss"
)

// UIWatchdog monitors and corrects layout issues
type UIWatchdog struct {
	TerminalWidth  int
	TerminalHeight int
	Rects          map[string]Rect
	Contents       map[string]string
	Issues         []string
}

// NewUIWatchdog creates a new watchdog instance
func NewUIWatchdog(termW, termH int) *UIWatchdog {
	return &UIWatchdog{
		TerminalWidth:  termW,
		TerminalHeight: termH,
		Rects:          make(map[string]Rect),
		Contents:       make(map[string]string),
		Issues:         []string{},
	}
}

// RegisterRect registers a rectangle for monitoring
func (w *UIWatchdog) RegisterRect(name string, rect Rect) {
	w.Rects[name] = rect
}

// RegisterContent registers content for a specific area
func (w *UIWatchdog) RegisterContent(name string, content string) {
	w.Contents[name] = content
}

// CheckLayout validates the current layout and reports issues
func (w *UIWatchdog) CheckLayout() []string {
	w.Issues = []string{}
	
	// Check for overlapping rectangles
	w.checkOverlaps()
	
	// Check for out-of-bounds rectangles
	w.checkBounds()
	
	// Check for content overflow
	w.checkContentOverflow()
	
	return w.Issues
}

// checkOverlaps detects overlapping rectangles
func (w *UIWatchdog) checkOverlaps() {
	rects := w.Rects
	names := make([]string, 0, len(rects))
	for name := range rects {
		names = append(names, name)
	}
	
	for i := 0; i < len(names); i++ {
		for j := i + 1; j < len(names); j++ {
			r1, r2 := rects[names[i]], rects[names[j]]
			if w.rectsOverlap(r1, r2) {
				w.Issues = append(w.Issues, fmt.Sprintf("Overlap detected: %s and %s", names[i], names[j]))
			}
		}
	}
}

// checkBounds ensures rectangles fit within terminal
func (w *UIWatchdog) checkBounds() {
	for name, rect := range w.Rects {
		if rect.X < 0 || rect.Y < 0 {
			w.Issues = append(w.Issues, fmt.Sprintf("Negative position for %s: (%d, %d)", name, rect.X, rect.Y))
		}
		if rect.X+rect.W > w.TerminalWidth {
			w.Issues = append(w.Issues, fmt.Sprintf("Width overflow for %s: %d + %d > %d", name, rect.X, rect.W, w.TerminalWidth))
		}
		if rect.Y+rect.H > w.TerminalHeight {
			w.Issues = append(w.Issues, fmt.Sprintf("Height overflow for %s: %d + %d > %d", name, rect.Y, rect.H, w.TerminalHeight))
		}
	}
}

// checkContentOverflow detects content that exceeds its rectangle
func (w *UIWatchdog) checkContentOverflow() {
	for name, content := range w.Contents {
		rect, exists := w.Rects[name]
		if !exists {
			continue
		}
		
		lines := strings.Split(content, "\n")
		if len(lines) > rect.H {
			w.Issues = append(w.Issues, fmt.Sprintf("Content height overflow for %s: %d lines > %d", name, len(lines), rect.H))
		}
		
		for i, line := range lines {
			if len(line) > rect.W {
				w.Issues = append(w.Issues, fmt.Sprintf("Content width overflow for %s line %d: %d chars > %d", name, i+1, len(line), rect.W))
			}
		}
	}
}

// rectsOverlap checks if two rectangles overlap
func (w *UIWatchdog) rectsOverlap(r1, r2 Rect) bool {
	return !(r1.X+r1.W <= r2.X || r2.X+r2.W <= r1.X || r1.Y+r1.H <= r2.Y || r2.Y+r2.H <= r1.Y)
}

// SafeRenderContent renders content with automatic truncation and bounds checking
func (w *UIWatchdog) SafeRenderContent(name string, content string, rect Rect, style lipgloss.Style) string {
	// Register for monitoring
	w.RegisterRect(name, rect)
	w.RegisterContent(name, content)
	
	// Ensure rectangle is within bounds
	if rect.X+rect.W > w.TerminalWidth {
		rect.W = w.TerminalWidth - rect.X
		if rect.W < 0 {
			rect.W = 0
		}
	}
	if rect.Y+rect.H > w.TerminalHeight {
		rect.H = w.TerminalHeight - rect.Y
		if rect.H < 0 {
			rect.H = 0
		}
	}
	
	// Safety check for zero or negative dimensions
	if rect.W <= 0 || rect.H <= 0 {
		return ""
	}
	
	// Use the existing RenderContent but with safety checks
	return RenderContent(content, rect, style)
}

// CreateBorderlessStyle creates a style without borders to prevent cutoff
func (w *UIWatchdog) CreateBorderlessStyle(baseStyle lipgloss.Style) lipgloss.Style {
	return baseStyle.
		Border(lipgloss.Border{}).
		Padding(0).
		Margin(0)
}

// AdaptiveStyle creates a style that adapts to available space
func (w *UIWatchdog) AdaptiveStyle(rect Rect, baseStyle lipgloss.Style) lipgloss.Style {
	style := baseStyle
	
	// Remove borders if width is too small
	if rect.W < 10 {
		style = style.Border(lipgloss.Border{})
	}
	
	// Remove padding if space is very limited
	if rect.W < 5 || rect.H < 3 {
		style = style.Padding(0).Margin(0)
	}
	
	return style.Width(rect.W).Height(rect.H)
}

// Report generates a diagnostic report
func (w *UIWatchdog) Report() string {
	var report strings.Builder
	
	report.WriteString(fmt.Sprintf("UI Watchdog Report (Terminal: %dx%d)\n", w.TerminalWidth, w.TerminalHeight))
	report.WriteString("=================================\n")
	
	if len(w.Issues) == 0 {
		report.WriteString("✓ No layout issues detected\n")
	} else {
		report.WriteString(fmt.Sprintf("⚠ %d issues detected:\n", len(w.Issues)))
		for i, issue := range w.Issues {
			report.WriteString(fmt.Sprintf("  %d. %s\n", i+1, issue))
		}
	}
	
	report.WriteString("\nRegistered Rectangles:\n")
	for name, rect := range w.Rects {
		report.WriteString(fmt.Sprintf("  %s: (%d,%d) %dx%d\n", name, rect.X, rect.Y, rect.W, rect.H))
	}
	
	return report.String()
}