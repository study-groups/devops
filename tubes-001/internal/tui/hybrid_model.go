package tui

import (
	"fmt"
	"strings"
	
	"github.com/rivo/tview"
	"github.com/gdamore/tcell/v2"
	tea "github.com/charmbracelet/bubbletea"
)

// HybridModel combines Bubbletea state management with tview layout
type HybridModel struct {
	// Tea state (keep existing state management)
	commands      map[string]Command
	currentFeedback string
	scrollingOutput []string
	currentInputMode inputMode
	width, height   int
	
	// tview components  
	app       *tview.Application
	flex      *tview.Flex
	output    *tview.TextView
	input     *tview.InputField
	status    *tview.TextView
	
	// Hybrid coordination
	teaProgram *tea.Program
	shouldQuit bool
	
	// Compatibility fields for commands.go
	curMode      mode
	selectedPath string
	projectRoot  string
	tubesDir     string
	program      *tea.Program
	col1Ratio    float64
	lastCompile  string
	headerH      int
	cliH         int
	statusH      int
	footerH      int
	repl         *mockTextInput
	suggestions  []string
	leftContent  []string
	leftVP       *mockViewport
}

// NewHybridModel creates a hybrid Tea+tview model
func NewHybridModel(port string) *HybridModel {
	m := &HybridModel{
		commands:         make(map[string]Command),
		scrollingOutput:  make([]string, 0),
		currentInputMode: viewMode,
		curMode:          modeSelf,
		col1Ratio:        0.3,
		headerH:          1,
		cliH:             1,
		statusH:          1,
		footerH:          1,
		repl:             &mockTextInput{},
		suggestions:      []string{},
		leftContent:      []string{},
		leftVP:           &mockViewport{},
	}
	
	// Initialize tview components
	m.initTviewComponents()
	
	// Commands are handled directly in executeCommand method
	
	return m
}

// initTviewComponents sets up the tview UI structure
func (m *HybridModel) initTviewComponents() {
	m.app = tview.NewApplication()
	
	// Output area - scrollable text view
	m.output = tview.NewTextView().
		SetDynamicColors(true).
		SetRegions(true).
		SetWordWrap(true).
		SetScrollable(true)
	m.output.SetBorder(true).
		SetTitle("Output").
		SetTitleAlign(tview.AlignLeft)
	
	// Input field with border
	m.input = tview.NewInputField().
		SetLabel("▶ ").
		SetPlaceholder("Press ESC to toggle modes, /help for commands")
	m.input.SetBorder(true).
		SetTitle("Input").
		SetTitleAlign(tview.AlignLeft)
	
	// Status bar
	m.status = tview.NewTextView().
		SetDynamicColors(true).
		SetTextAlign(tview.AlignLeft)
	m.status.SetBorder(false)
	
	// Main flex layout: output (flexible) + input (fixed) + status (fixed)
	m.flex = tview.NewFlex().
		SetDirection(tview.FlexRow).
		AddItem(m.output, 0, 1, false).     // Output takes remaining space
		AddItem(m.input, 3, 0, true).       // Input is 3 lines high, focused
		AddItem(m.status, 1, 0, false)      // Status is 1 line
	
	// Set up input handling
	m.setupInputHandling()
	
	// Set up key bindings
	m.setupKeyBindings()
}

// setupInputHandling configures input field behavior
func (m *HybridModel) setupInputHandling() {
	m.input.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			m.handleCommand(m.input.GetText())
			m.input.SetText("")
		}
	})
}

// setupKeyBindings configures global key bindings
func (m *HybridModel) setupKeyBindings() {
	m.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEsc:
			m.toggleInputMode()
			return nil // Consume the event
		case tcell.KeyCtrlC:
			m.shouldQuit = true
			m.app.Stop()
			return nil
		}
		
		// In view mode, handle scrolling
		if m.currentInputMode == viewMode {
			switch event.Key() {
			case tcell.KeyUp:
				row, col := m.output.GetScrollOffset()
				m.output.ScrollTo(row-1, col)
				return nil
			case tcell.KeyDown:
				row, col := m.output.GetScrollOffset()
				m.output.ScrollTo(row+1, col)
				return nil
			}
		}
		
		return event
	})
}

// toggleInputMode switches between view and input modes
func (m *HybridModel) toggleInputMode() {
	if m.currentInputMode == viewMode {
		m.currentInputMode = textMode
		m.app.SetFocus(m.input)
		m.currentFeedback = "INPUT MODE - Type commands or press ESC to return to view mode"
	} else {
		m.currentInputMode = viewMode
		m.app.SetFocus(m.output)
		m.currentFeedback = "VIEW MODE - Press ESC to enter input mode, scroll with arrow keys"
	}
	m.updateStatus()
}

// handleCommand processes user input commands
func (m *HybridModel) handleCommand(input string) {
	input = strings.TrimSpace(input)
	if input == "" {
		return
	}
	
	// Add to output
	m.addOutput(fmt.Sprintf("> %s", input))
	
	// Process command
	if strings.HasPrefix(input, "/") {
		parts := strings.Fields(input)
		cmdName := parts[0]
		args := parts[1:]
		
		result := m.executeCommand(cmdName, args)
		m.addOutput(result)
	} else {
		m.addOutput("Use /help to see available commands")
	}
}

// executeCommand handles built-in commands for hybrid mode
func (m *HybridModel) executeCommand(cmd string, args []string) string {
	switch cmd {
	case "/help":
		return `Available commands:
/help     - Show this help
/clear    - Clear output  
/quit     - Exit application
/mode     - Show current mode
/echo <text> - Echo text back`
	case "/clear":
		m.scrollingOutput = []string{}
		m.output.SetText("")
		return "Output cleared"
	case "/quit":
		m.shouldQuit = true
		m.app.Stop()
		return "Goodbye!"
	case "/mode":
		modeText := "view"
		if m.currentInputMode == textMode {
			modeText = "input"
		}
		return fmt.Sprintf("Current mode: %s", modeText)
	case "/echo":
		if len(args) == 0 {
			return "Usage: /echo <text>"
		}
		return strings.Join(args, " ")
	default:
		return fmt.Sprintf("Unknown command: %s (try /help)", cmd)
	}
}

// addOutput adds text to the output area
func (m *HybridModel) addOutput(text string) {
	m.scrollingOutput = append(m.scrollingOutput, text)
	
	// Keep only last 200 lines
	if len(m.scrollingOutput) > 200 {
		m.scrollingOutput = m.scrollingOutput[len(m.scrollingOutput)-200:]
	}
	
	// Update tview output
	m.output.SetText(strings.Join(m.scrollingOutput, "\n"))
	m.output.ScrollToEnd()
}

// updateStatus updates the status bar with current mode and info
func (m *HybridModel) updateStatus() {
	modeText := "VIEW MODE"
	if m.currentInputMode == textMode {
		modeText = "INPUT MODE"
	}
	
	status := fmt.Sprintf("[white]%s[white] | %s", modeText, m.currentFeedback)
	if m.currentFeedback == "" {
		status = fmt.Sprintf("[white]%s[white] | Press ESC to toggle, /help for commands", modeText)
	}
	
	m.status.SetText(status)
}

// Run starts the hybrid application
func (m *HybridModel) Run() error {
	// Initialize with some welcome text
	m.addOutput("Welcome to Tubes (Hybrid Tea+tview Edition)")
	m.addOutput("Press ESC to toggle between view and input modes")
	m.addOutput("Type /help for available commands")
	m.updateStatus()
	
	// Start in view mode
	m.app.SetFocus(m.output)
	
	return m.app.SetRoot(m.flex, true).Run()
}

// Bubbletea interface methods for compatibility
func (m *HybridModel) Init() tea.Cmd {
	return nil
}

func (m *HybridModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	return m, nil
}

func (m *HybridModel) View() string {
	return "Hybrid Model"
}

// Compatibility methods for commands.go
func (m *HybridModel) reloadLeft() {
	m.addOutput("Left panel reloaded")
}

func (m *HybridModel) renderRight(path string) {
	m.addOutput(fmt.Sprintf("Opening: %s", path))
}

func (m *HybridModel) adjustColRatio(delta float64) {
	m.col1Ratio += delta
	if m.col1Ratio < 0.1 {
		m.col1Ratio = 0.1
	}
	if m.col1Ratio > 0.9 {
		m.col1Ratio = 0.9
	}
}

func (m *HybridModel) adjustBand(which string, delta int) {
	m.addOutput(fmt.Sprintf("Adjusting band %s by %d", which, delta))
}


