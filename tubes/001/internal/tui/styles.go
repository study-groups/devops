package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type Styles struct {
	header    lipgloss.Style
	colsWrap  lipgloss.Style
	colBox    lipgloss.Style
	colBoxAct lipgloss.Style
	cli       lipgloss.Style
	status    lipgloss.Style
	footer    lipgloss.Style
	completion lipgloss.Style
}

func buildStyles(m *Model) Styles {
	return Styles{
		header: lipgloss.NewStyle().
			Background(m.currentTheme.HeaderBg).
			Foreground(m.currentTheme.HeaderFg).
			Padding(0, 1),
		colsWrap: lipgloss.NewStyle(),
		colBox: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(m.currentTheme.PaneBorderInactive),
		colBoxAct: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(m.currentTheme.PaneBorderActive),
		cli: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(m.currentTheme.PaneBorderActive),
		status: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(m.currentTheme.PaneBorderInactive),
		footer: lipgloss.NewStyle().
			Background(m.currentTheme.FooterBg).
			Foreground(m.currentTheme.FooterFg).
			Padding(0, 1),
		completion: lipgloss.NewStyle().Foreground(m.currentTheme.ComplFg),
	}
}

func (m *Model) renderFooter(s Styles, width int) string {
	var b strings.Builder
	b.WriteString(m.footerHelp)
	if len(m.suggestions) > 0 && m.activePane == replPane {
		b.WriteString(" | suggest: ")
		b.WriteString(s.completion.Render(strings.Join(m.suggestions, ", ")))
	}
	return s.footer.Width(width).Render(b.String())
}

func textBlink() func() tea.Msg { return textarea.Blink }

