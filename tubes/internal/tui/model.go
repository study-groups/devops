package tui

import (
	"fmt"
	"os"
	"strings"
	"tubes/internal/layout"
	"tubes/internal/theme"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
)

// Model represents the complete application state
type Model struct {
	// Terminal dimensions
	Width, Height int
	
	// Layout system
	Grid     *layout.Grid
	Watchdog *layout.UIWatchdog
	Rects    struct {
		TopStatus    layout.Rect // muted status bar at top
		Sidebar      layout.Rect
		Main         layout.Rect
		BottomStatus layout.Rect // blue status bar
		Input        layout.Rect
		Feedback     layout.Rect // help/coaching area
	}
	
	// Theme system
	Theme  *theme.Theme
	Styles *theme.Styles
	
	// UI Components
	Sidebar      viewport.Model
	Main         viewport.Model
	Input        textarea.Model
	BottomStatus viewport.Model
	Feedback     viewport.Model
	
	// Application state
	Mode        string // "self" or "tasks"
	CurrentFile string
	Error       string
	Ready       bool
	
	// Command system
	Commands     map[string]Command
	AutoComplete *AutoComplete
	History      []string
	
	// Completion state
	CompletionIndex int
	LastInput       string
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
		Width:    80,  // default dimensions
		Height:   24,
	}
	
	// Initialize watchdog with default dimensions
	m.Watchdog = layout.NewUIWatchdog(m.Width, m.Height)
	
	// Initialize theme
	if err := m.initTheme(); err != nil {
		return nil, err
	}
	
	// Initialize UI components
	m.initComponents()
	
	// Register commands
	m.registerCommands()
	
	// Initialize autocompletion
	m.AutoComplete = NewAutoComplete(m.Commands)
	m.CompletionIndex = -1
	
	m.Ready = true
	return m, nil
}

// Init implements the tea.Model interface
func (m *Model) Init() tea.Cmd {
	return m.refreshSidebar()
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
		m.BottomStatus.SetContent(string(msg))
		return m, nil
		
	case sidebarContentMsg:
		m.handleSidebarContent(msg)
		return m, nil
		
	case themeChangeMsg:
		m.Theme = msg.Theme
		m.Styles = msg.Styles
		return m, func() tea.Msg {
			return statusMsg(fmt.Sprintf("Switched to theme: %s", msg.Name))
		}
		
	case previewThemeMsg:
		if m.Styles != nil {
			preview := theme.DetailedPreview(m.Styles)
			m.Sidebar.SetContent(preview)
		}
		return m, nil
		
	case openFileMsg:
		m.CurrentFile = msg.Filename
		m.Main.SetContent(msg.Content)
		return m, func() tea.Msg {
			return statusMsg(fmt.Sprintf("Opened: %s", msg.Filename))
		}
		
	case clearMsg:
		m.Main.SetContent("")
		m.BottomStatus.SetContent("")
		m.Feedback.SetContent("")
		return m, tea.Batch(
			m.refreshSidebar(),
			func() tea.Msg {
				return statusMsg("Cleared")
			},
		)
	}
	
	// Update UI components
	m.Input, cmd = m.Input.Update(msg)
	cmds = append(cmds, cmd)
	
	m.Sidebar, cmd = m.Sidebar.Update(msg)
	cmds = append(cmds, cmd)
	
	m.Main, cmd = m.Main.Update(msg)
	cmds = append(cmds, cmd)
	
	m.BottomStatus, cmd = m.BottomStatus.Update(msg)
	cmds = append(cmds, cmd)
	
	m.Feedback, cmd = m.Feedback.Update(msg)
	cmds = append(cmds, cmd)
	
	return m, tea.Batch(cmds...)
}

// View implements the tea.Model interface  
func (m *Model) View() string {
	if !m.Ready || m.Width == 0 || m.Height == 0 || m.Watchdog == nil {
		return "Loading..."
	}
	
	var result strings.Builder
	
	// Top Status Bar (muted)
	topStatus := fmt.Sprintf("Tubes - %s mode", m.Mode)
	topStyle := m.getStyle("top_status", lipgloss.NewStyle().Foreground(lipgloss.Color("#a0a0a0")).Background(lipgloss.Color("#1e1e1e")).Faint(true))
	topStatusStyled := m.Watchdog.SafeRenderContent("top_status", topStatus, m.Rects.TopStatus, topStyle)
	result.WriteString(topStatusStyled)
	result.WriteString("\n")
	
	// Body (sidebar + main) - render side by side
	sidebarStyle := m.getStyle("sidebar", m.Styles.Sidebar)
	mainStyle := m.getStyle("main", m.Styles.Main)
	
	sidebar := m.Watchdog.SafeRenderContent("sidebar", m.Sidebar.View(), m.Rects.Sidebar, sidebarStyle)
	main := m.Watchdog.SafeRenderContent("main", m.Main.View(), m.Rects.Main, mainStyle)
	
	sidebarLines := strings.Split(sidebar, "\n")
	mainLines := strings.Split(main, "\n")
	maxLines := m.Rects.Sidebar.H
	
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
		result.WriteString(sLine + mLine)
		if i < maxLines-1 {
			result.WriteString("\n")
		}
	}
	result.WriteString("\n")
	
	// Bottom Status Bar (blue)
	bottomStatus := m.Watchdog.SafeRenderContent("bottom_status", m.BottomStatus.View(), m.Rects.BottomStatus, m.Styles.Info)
	result.WriteString(bottomStatus)
	result.WriteString("\n")
	
	// Input (borderless to prevent cut-off)
	inputStyle := m.getStyle("input_noborder", lipgloss.NewStyle().Foreground(lipgloss.Color("#e0e0e0")).Background(lipgloss.Color("#1e1e1e")))
	input := m.Watchdog.SafeRenderContent("input", m.Input.View(), m.Rects.Input, inputStyle)
	result.WriteString(input)
	result.WriteString("\n")
	
	// Feedback
	feedbackStyle := m.getStyle("feedback", lipgloss.NewStyle().Foreground(lipgloss.Color("#a0a0a0")).Background(lipgloss.Color("#1e1e1e")).Faint(true))
	feedback := m.Watchdog.SafeRenderContent("feedback", m.Feedback.View(), m.Rects.Feedback, feedbackStyle)
	result.WriteString(feedback)
	
	return result.String()
}

// Helper method to get style with fallback
func (m *Model) getStyle(name string, fallback lipgloss.Style) lipgloss.Style {
	if style, exists := m.Styles.ByName[name]; exists {
		return style
	}
	return fallback
}

// Helper methods

func (m *Model) handleResize(msg tea.WindowSizeMsg) (*Model, tea.Cmd) {
	if msg.Width == m.Width && msg.Height == m.Height {
		return m, nil
	}
	
	m.Width, m.Height = msg.Width, msg.Height
	m.Watchdog = layout.NewUIWatchdog(m.Width, m.Height)
	m.computeLayout()
	m.updateComponents()
	
	return m, nil
}

func (m *Model) handleKey(msg tea.KeyMsg) (*Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c":
		return m, tea.Quit
		
	case "esc":
		m.switchMode()
		return m, nil
		
	case "enter":
		return m.handleCommand()
		
	case "tab":
		return m.handleTabCompletion()
		
	case "shift+tab":
		return m.handleShiftTabCompletion()
		
	default:
		// Reset completion on any other key
		m.CompletionIndex = -1
		m.LastInput = ""
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
	m.BottomStatus.SetContent("Unknown command: " + cmdName)
	return m, nil
}

func (m *Model) handleTabCompletion() (*Model, tea.Cmd) {
	currentInput := strings.TrimSpace(m.Input.Value())
	
	// If input hasn't changed, cycle to next completion
	if currentInput == m.LastInput && m.CompletionIndex >= 0 {
		completion, index := m.AutoComplete.GetNextCompletion(currentInput, m.CompletionIndex)
		m.Input.SetValue(completion)
		m.CompletionIndex = index
	} else {
		// New input, start fresh completion
		completion, index := m.AutoComplete.GetNextCompletion(currentInput, -1)
		if index >= 0 {
			m.Input.SetValue(completion)
			m.CompletionIndex = index
			m.LastInput = currentInput
		}
	}
	
	// Update feedback with completion help
	help := m.AutoComplete.GetCompletionHelp(currentInput)
	m.Feedback.SetContent(help)
	
	return m, nil
}

func (m *Model) handleShiftTabCompletion() (*Model, tea.Cmd) {
	currentInput := strings.TrimSpace(m.Input.Value())
	
	if currentInput == m.LastInput && m.CompletionIndex >= 0 {
		completion, index := m.AutoComplete.GetPrevCompletion(currentInput, m.CompletionIndex)
		m.Input.SetValue(completion)
		m.CompletionIndex = index
	}
	
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
			{Height: layout.Unit{Kind: layout.Px, Val: 1}},  // top status (muted)
			{Height: layout.Unit{Kind: layout.Fr, Val: 1}},  // body
			{Height: layout.Unit{Kind: layout.Px, Val: 1}},  // bottom status (blue)
			{Height: layout.Unit{Kind: layout.Px, Val: 1}},  // input
			{Height: layout.Unit{Kind: layout.Px, Val: 2}},  // feedback
		},
		Cols: []layout.Col{
			{Width: layout.Unit{Kind: layout.Px, Val: 30}, Min: 20, Max: 50}, // sidebar
			{Width: layout.Unit{Kind: layout.Fr, Val: 1}},                    // main
		},
		Gaps: struct{ Row, Col int }{Row: 0, Col: 0}, // no gaps
	}
	
	m.Grid = layout.NewGrid(spec)
	m.Grid.Compute(m.Width, m.Height)
	
	// Store rectangles
	m.Rects.TopStatus = m.Grid.SpanRect(0, 0, 1, 2)    // spans both columns
	m.Rects.Sidebar = m.Grid.CellRect(1, 0)
	m.Rects.Main = m.Grid.CellRect(1, 1)
	m.Rects.BottomStatus = m.Grid.SpanRect(2, 0, 1, 2) // spans both columns
	m.Rects.Input = m.Grid.SpanRect(3, 0, 1, 2)        // spans both columns
	m.Rects.Feedback = m.Grid.SpanRect(4, 0, 1, 2)     // spans both columns
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
	m.BottomStatus = viewport.New(0, 0)
	m.Feedback = viewport.New(0, 0)
	
	m.Input = textarea.New()
	m.Input.Placeholder = "Enter command (try /help)..."
	m.Input.Focus()
	m.Input.SetHeight(1)
	m.Input.ShowLineNumbers = false
	m.Input.BlurredStyle.CursorLine = lipgloss.NewStyle() // Remove cursor line highlighting
	m.Input.FocusedStyle.CursorLine = lipgloss.NewStyle() // Remove cursor line highlighting
}

func (m *Model) updateComponents() {
	m.Sidebar.Width = m.Rects.Sidebar.W
	m.Sidebar.Height = m.Rects.Sidebar.H
	
	m.Main.Width = m.Rects.Main.W
	m.Main.Height = m.Rects.Main.H
	
	m.BottomStatus.Width = m.Rects.BottomStatus.W
	m.BottomStatus.Height = m.Rects.BottomStatus.H
	
	m.Feedback.Width = m.Rects.Feedback.W
	m.Feedback.Height = m.Rects.Feedback.H
	
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