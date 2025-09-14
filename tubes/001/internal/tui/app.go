package tui

import tea "github.com/charmbracelet/bubbletea"

type App struct {
	model   *Model
	program *tea.Program
}

func New(port string) *App {
	m := initialModel(port)
	return &App{model: &m}
}

func (a *App) Run() error {
	p := tea.NewProgram(
		a.model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)
	a.program = p
	a.model.program = p
	_, err := p.Run()
	return err
}

