package tui

import (
	"os"
	"strings"
	"tubes/internal/layout"
	"tubes/internal/theme"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
)

// Model represents the complete application state
type Model struct {
	// Terminal dimensions
	Width, Height int
	
	// Layout system
	Grid  *layout.Grid
	Rects struct {
		Header  layout.Rect
		Sidebar layout.Rect
		Main    layout.Rect
		Input   layout.Rect
		Status  layout.Rect
	}
	
	// Theme system
	Theme  *theme.Theme
	Styles *theme.Styles
	
	// UI Components
	Sidebar viewport.Model
	Main    viewport.Model
	Input   textarea.Model
	Status  viewport.Model
	
	// Application state
	Mode        string // "self" or "tasks"
	CurrentFile string
	Error       string
	Ready       bool
	
	// Command system
	Commands map[string]Command
	History  []string
}

// Command represents a TUI command
type Command struct {
	Name        string
	Description string
	Execute     func(*Model, []string) tea.Cmd
}

// NewModel creates a new TUI model
func NewModel() (*Model, error) {
	m := &Model{
		Mode:     "self",
		Commands: make(map[string]Command),
	}
	
	// Initialize theme
	if err := m.initTheme(); err != nil {
		return nil, err
	}
	
	// Initialize UI components
	m.initComponents()
	
	// Register commands
	m.registerCommands()
	
	m.Ready = true
	return m, nil
}

// Init implements the tea.Model interface
func (m *Model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.refreshSidebar(),
	)
}

// Update implements the tea.Model interface
func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd
	
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		return m.handleResize(msg)
		
	case tea.KeyMsg:
		return m.handleKey(msg)
		
	case errorMsg:
		m.Error = string(msg)
		return m, nil
		
	case statusMsg:
		m.Status.SetContent(string(msg))
		return m, nil
		
	case sidebarContentMsg:
		m.handleSidebarContent(msg)
		return m, nil
	}
	
	// Update UI components
	m.Input, cmd = m.Input.Update(msg)
	cmds = append(cmds, cmd)
	
	m.Sidebar, cmd = m.Sidebar.Update(msg)
	cmds = append(cmds, cmd)
	
	m.Main, cmd = m.Main.Update(msg)
	cmds = append(cmds, cmd)
	
	return m, tea.Batch(cmds...)
}

// View implements the tea.Model interface  
func (m *Model) View() string {
	if !m.Ready || m.Width == 0 || m.Height == 0 {
		return "Loading..."
	}
	
	// Render each panel into its rectangle
	var result string
	
	// Header
	header := layout.RenderContent("Tubes - "+m.Mode+" mode", m.Rects.Header, m.Styles.Header)
	result += header + "\n"
	
	// Body (sidebar + main)
	sidebar := layout.RenderContent(m.Sidebar.View(), m.Rects.Sidebar, m.Styles.Sidebar)
	main := layout.RenderContent(m.Main.View(), m.Rects.Main, m.Styles.Main)
	
	// Combine horizontally
	sidebarLines := strings.Split(sidebar, "\n")
	mainLines := strings.Split(main, "\n")
	maxLines := len(sidebarLines)
	if len(mainLines) > maxLines {
		maxLines = len(mainLines)
	}
	
	for i := 0; i < maxLines; i++ {
		var sLine, mLine string
		if i < len(sidebarLines) {
			sLine = sidebarLines[i]
		} else {
			sLine = strings.Repeat(" ", m.Rects.Sidebar.W)
		}
		if i < len(mainLines) {
			mLine = mainLines[i]
		} else {
			mLine = strings.Repeat(" ", m.Rects.Main.W)
		}
		result += sLine + mLine + "\n"
	}
	
	// Status
	status := layout.RenderContent(m.Status.View(), m.Rects.Status, m.Styles.Info)
	result += status + "\n"
	
	// Input
	input := layout.RenderContent(m.Input.View(), m.Rects.Input, m.Styles.Input)
	result += input
	
	return result
}

// Helper methods

func (m *Model) handleResize(msg tea.WindowSizeMsg) (*Model, tea.Cmd) {
	if msg.Width == m.Width && msg.Height == m.Height {
		return m, nil
	}
	
	m.Width, m.Height = msg.Width, msg.Height
	m.computeLayout()
	m.updateComponents()
	
	return m, nil
}

func (m *Model) handleKey(msg tea.KeyMsg) (*Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "esc":
		return m, tea.Quit
		
	case "enter":
		return m.handleCommand()
		
	case "tab":
		m.switchMode()
		return m, nil
	}
	
	// Let input handle other keys
	var cmd tea.Cmd
	m.Input, cmd = m.Input.Update(msg)
	return m, cmd
}

func (m *Model) handleCommand() (*Model, tea.Cmd) {
	text := strings.TrimSpace(m.Input.Value())
	if text == "" {
		return m, nil
	}
	
	m.Input.Reset()
	m.History = append(m.History, text)
	
	// Parse command
	parts := strings.Fields(text)
	if len(parts) == 0 {
		return m, nil
	}
	
	cmdName := strings.TrimPrefix(parts[0], "/")
	args := parts[1:]
	
	// Execute command
	if cmd, exists := m.Commands[cmdName]; exists {
		return m, cmd.Execute(m, args)
	}
	
	// Unknown command
	m.Status.SetContent("Unknown command: " + cmdName)
	return m, nil
}

func (m *Model) switchMode() {
	if m.Mode == "self" {
		m.Mode = "tasks"
	} else {
		m.Mode = "self"
	}
	m.refreshSidebar()
}

func (m *Model) computeLayout() {
	spec := layout.GridSpec{
		Rows: []layout.Row{
			{Height: layout.Unit{Kind: layout.Px, Val: 1}},  // header
			{Height: layout.Unit{Kind: layout.Fr, Val: 1}},  // body
			{Height: layout.Unit{Kind: layout.Px, Val: 1}},  // status  
			{Height: layout.Unit{Kind: layout.Px, Val: 3}},  // input
		},
		Cols: []layout.Col{
			{Width: layout.Unit{Kind: layout.Px, Val: 30}, Min: 20, Max: 50}, // sidebar
			{Width: layout.Unit{Kind: layout.Fr, Val: 1}},                    // main
		},
		Gaps: struct{ Row, Col int }{Row: 0, Col: 1},
	}
	
	m.Grid = layout.NewGrid(spec)
	m.Grid.Compute(m.Width, m.Height)
	
	// Store rectangles
	m.Rects.Header = m.Grid.SpanRect(0, 0, 1, 2) // spans both columns
	m.Rects.Sidebar = m.Grid.CellRect(1, 0)
	m.Rects.Main = m.Grid.CellRect(1, 1)
	m.Rects.Status = m.Grid.SpanRect(2, 0, 1, 2)  // spans both columns
	m.Rects.Input = m.Grid.SpanRect(3, 0, 1, 2)   // spans both columns
}

func (m *Model) initTheme() error {
	// Load current theme
	themeName := "monochrome"
	if current, err := theme.GetCurrent(); err == nil && current != "" {
		themeName = current
	} else if env := os.Getenv("TUBES_THEME"); env != "" {
		themeName = env
	}
	
	t, err := theme.Load(themeName)
	if err != nil {
		return err
	}
	
	styles, err := theme.Compile(t)
	if err != nil {
		return err
	}
	
	m.Theme = t
	m.Styles = styles
	return nil
}

func (m *Model) initComponents() {
	m.Sidebar = viewport.New(0, 0)
	m.Main = viewport.New(0, 0)
	m.Status = viewport.New(0, 0)
	
	m.Input = textarea.New()
	m.Input.Placeholder = "Enter command (try /help)..."
	m.Input.Focus()
	m.Input.SetHeight(1)
	m.Input.ShowLineNumbers = false
}

func (m *Model) updateComponents() {
	m.Sidebar.Width = m.Rects.Sidebar.W
	m.Sidebar.Height = m.Rects.Sidebar.H
	
	m.Main.Width = m.Rects.Main.W
	m.Main.Height = m.Rects.Main.H
	
	m.Status.Width = m.Rects.Status.W
	m.Status.Height = m.Rects.Status.H
	
	m.Input.SetWidth(m.Rects.Input.W)
	m.Input.SetHeight(m.Rects.Input.H)
}

// Messages
type errorMsg string
type statusMsg string

// Commands
func (m *Model) refreshSidebar() tea.Cmd {
	return func() tea.Msg {
		content := m.generateSidebarContent()
		return sidebarContentMsg(content)
	}
}

type sidebarContentMsg string