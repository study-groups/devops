package tui

import (
	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
)

type Theme struct {
	HeaderBg lipgloss.Color
	HeaderFg lipgloss.Color

	PaneBorderActive   lipgloss.Color
	PaneBorderInactive lipgloss.Color

	FooterBg lipgloss.Color
	FooterFg lipgloss.Color
	ComplFg  lipgloss.Color
}

func defaultTheme() Theme {
	return Theme{
		HeaderBg:           lipgloss.Color("#30343F"),
		HeaderFg:           lipgloss.Color("#FFFFFF"),
		PaneBorderActive:   lipgloss.Color("#AD58B4"),
		PaneBorderInactive: lipgloss.Color("#555555"),
		FooterBg:           lipgloss.Color("#22262E"),
		FooterFg:           lipgloss.Color("#DDDDDD"),
		ComplFg:            lipgloss.Color("#00ADD8"),
	}
}

func loadTheme(path string) (Theme, error) {
	env, err := godotenv.Read(path)
	if err != nil {
		return Theme{}, err
	}
	return Theme{
		HeaderBg:           lipgloss.Color(env["HEADER_BG"]),
		HeaderFg:           lipgloss.Color(env["HEADER_FG"]),
		PaneBorderActive:   lipgloss.Color(env["PANE_BORDER_ACTIVE"]),
		PaneBorderInactive: lipgloss.Color(env["PANE_BORDER_INACTIVE"]),
		FooterBg:           lipgloss.Color(env["FOOTER_BG"]),
		FooterFg:           lipgloss.Color(env["FOOTER_FG"]),
		ComplFg:            lipgloss.Color(env["COMPL_FG"]),
	}, nil
}

