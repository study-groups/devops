package theme

import (
	"github.com/charmbracelet/lipgloss"
	"github.com/gdamore/tcell/v2"
)

// Styles holds all design tokens for the UI
type Styles struct {
	ByName map[string]lipgloss.Style
	
	// Core layout styles
	Header    lipgloss.Style
	Sidebar   lipgloss.Style
	Main      lipgloss.Style
	Input     lipgloss.Style
	
	// State styles
	Ok        lipgloss.Style
	Info      lipgloss.Style
	Warn      lipgloss.Style
	Error     lipgloss.Style
	
	// Interactive styles
	Selected  lipgloss.Style
	Active    lipgloss.Style
	Inactive  lipgloss.Style
	
	// Typography
	Title     lipgloss.Style
	Subtitle  lipgloss.Style
	Body      lipgloss.Style
	Caption   lipgloss.Style
}

// NewDefaultStyles creates the default theme with all design tokens
func NewDefaultStyles() *Styles {
	s := &Styles{
		ByName: make(map[string]lipgloss.Style),
	}
	
	// Define color palette
	background := lipgloss.Color("#000000")  // Black
	foreground := lipgloss.Color("#FFFFFF")  // White
	muted      := lipgloss.Color("#808080")  // Gray
	accent     := lipgloss.Color("#0066CC")  // Blue
	success    := lipgloss.Color("#00AA00")  // Green
	warning    := lipgloss.Color("#FFAA00")  // Orange
	danger     := lipgloss.Color("#CC0000")  // Red
	border     := lipgloss.Color("#444444")  // Dark Gray
	
	// Core layout styles
	s.Header = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Bold(true).
		Padding(0, 1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(border)
	
	s.Sidebar = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Padding(0, 1).
		Width(30)
	
	s.Main = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Padding(1)
	
	s.Input = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(border).
		Padding(0, 1)
	
	// State styles
	s.Ok = lipgloss.NewStyle().
		Background(background).
		Foreground(success).
		Bold(true)
	
	s.Info = lipgloss.NewStyle().
		Background(background).
		Foreground(accent).
		Bold(false)
	
	s.Warn = lipgloss.NewStyle().
		Background(background).
		Foreground(warning).
		Bold(true)
	
	s.Error = lipgloss.NewStyle().
		Background(background).
		Foreground(danger).
		Bold(true)
	
	// Interactive styles
	s.Selected = lipgloss.NewStyle().
		Background(accent).
		Foreground(foreground).
		Bold(true)
	
	s.Active = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Bold(true).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(accent)
	
	s.Inactive = lipgloss.NewStyle().
		Background(background).
		Foreground(muted).
		Bold(false)
	
	// Typography
	s.Title = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Bold(true).
		Underline(true)
	
	s.Subtitle = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Bold(true)
	
	s.Body = lipgloss.NewStyle().
		Background(background).
		Foreground(foreground).
		Bold(false)
	
	s.Caption = lipgloss.NewStyle().
		Background(background).
		Foreground(muted).
		Bold(false).
		Italic(true)
	
	// Populate ByName map
	s.ByName["header"] = s.Header
	s.ByName["sidebar"] = s.Sidebar
	s.ByName["main"] = s.Main
	s.ByName["input"] = s.Input
	s.ByName["ok"] = s.Ok
	s.ByName["info"] = s.Info
	s.ByName["warn"] = s.Warn
	s.ByName["error"] = s.Error
	s.ByName["selected"] = s.Selected
	s.ByName["active"] = s.Active
	s.ByName["inactive"] = s.Inactive
	s.ByName["title"] = s.Title
	s.ByName["subtitle"] = s.Subtitle
	s.ByName["body"] = s.Body
	s.ByName["caption"] = s.Caption
	
	return s
}

// TcellColors returns tcell color equivalents for tview components
type TcellColors struct {
	Background tcell.Color
	Foreground tcell.Color
	Accent     tcell.Color
	Muted      tcell.Color
	Success    tcell.Color
	Warning    tcell.Color
	Danger     tcell.Color
	Border     tcell.Color
}

// GetTcellColors returns tcell colors for tview integration
func GetTcellColors() TcellColors {
	return TcellColors{
		Background: tcell.ColorBlack,
		Foreground: tcell.ColorWhite,
		Accent:     tcell.ColorBlue,
		Muted:      tcell.ColorGray,
		Success:    tcell.ColorGreen,
		Warning:    tcell.ColorOrange,
		Danger:     tcell.ColorRed,
		Border:     tcell.ColorDarkGray,
	}
}