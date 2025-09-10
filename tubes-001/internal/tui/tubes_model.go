package tui

import (
	"fmt"
	"strings"
	
	"tubes/internal/layout"
	"tubes/internal/codeintel"
	"tubes/internal/theme"
	"tubes/internal/api"
	
	tea "github.com/charmbracelet/bubbletea"
	"github.com/rivo/tview"
	"github.com/gdamore/tcell/v2"
)

// TubesModel represents the new architecture with deterministic layout
type TubesModel struct {
	// Layout management
	app       *tview.Application
	grid      *layout.Grid
	width     int
	height    int
	rects     struct {
		CursorPane   layout.Rect  // Left pane: cursor directory
		ContentPane  layout.Rect  // Right pane: metadata or file content  
		Input        layout.Rect  // Input field
		Feedback     layout.Rect  // Feedback area (2 lines)
		Status       layout.Rect  // Status line (1 line)
	}
	
	// UI Components
	cursorPane    *tview.TextView
	contentPane   *tview.TextView  
	inputField    *tview.InputField
	feedbackArea  *tview.TextView
	statusLine    *tview.TextView
	flex          *tview.Flex
	
	// Data layer
	cursors       *codeintel.CursorDirectory
	styles        *theme.Styles
	apiServer     *api.Server
	
	// Navigation state
	activePane    string // "input" or "cursors"
	navIndex      int    // current navigation position in cursor pane
	visibleItems  []codeintel.NavigationItem
	inCursorMode  bool   // true when "entered" into a cursor (showing file content)
	
	// Commands (bridge to legacy command system)
	commands      map[string]Command
	commandHandlers map[string]CommandHandler
	
	// Legacy compatibility fields
	curMode       mode
	selectedPath  string
	projectRoot   string
	tubesDir      string
	col1Ratio     float64
	lastCompile   string
	headerH       int
	cliH          int
	statusH       int
	footerH       int
	repl          *mockTextInput
	suggestions   []string
	program       interface{}
	leftContent   []string
	leftVP        *mockViewport
	httpServer    interface{}
	apiPort       string
	currentTheme  *mockTheme
}

// CommandHandler defines the interface for command execution
type CommandHandler func(model *TubesModel, args []string) (string, error)

// NewTubesModel creates a new Tubes model with the improved architecture
func NewTubesModel(port string) *TubesModel {
	cursors := codeintel.NewCursorDirectory()
	styles := theme.NewDefaultStyles()
	apiServer := api.NewServer(port, cursors)
	
	model := &TubesModel{
		cursors:      cursors,
		styles:       styles,
		apiServer:    apiServer,
		activePane:   "input",
		navIndex:     0,
		inCursorMode: false,
		commandHandlers: make(map[string]CommandHandler),
		commands:        make(map[string]Command),
		curMode:         modeSelf,
		col1Ratio:       0.3,
		headerH:         1,
		cliH:            1,
		statusH:         1,
		footerH:         1,
		repl:            &mockTextInput{},
		suggestions:     []string{},
		leftContent:     []string{},
		leftVP:          &mockViewport{},
		httpServer:      &mockHTTPServer{},
		currentTheme:    &mockTheme{
			HeaderBg:           "#000000",
			HeaderFg:           "#ffffff", 
			PaneBorderInactive: "#444444",
			PaneBorderActive:   "#00ff00",
			FooterBg:           "#000000",
			FooterFg:           "#ffffff",
			ComplFg:            "#00ff00",
		},
	}
	
	model.initComponents()
	model.setupCommands()
	model.loadSampleData()
	
	return model
}

// initComponents initializes tview components
func (m *TubesModel) initComponents() {
	m.app = tview.NewApplication()
	
	// Cursor pane (left) - clean style, no border, consistent background
	m.cursorPane = tview.NewTextView().
		SetDynamicColors(true).
		SetRegions(true)
	m.cursorPane.SetBackgroundColor(tcell.ColorBlack)
	
	// Content pane (right) - clean style, no border, consistent background  
	m.contentPane = tview.NewTextView().
		SetDynamicColors(true).
		SetWordWrap(true)
	m.contentPane.SetBackgroundColor(tcell.ColorBlack)
	
	// Input field with thin single border
	m.inputField = tview.NewInputField().
		SetLabel("▶ ").
		SetPlaceholder("Type commands here...")
	m.inputField.SetBorder(true).
		SetBorderColor(tcell.ColorDarkGray)
	m.inputField.SetBackgroundColor(tcell.ColorBlack)
	
	// Feedback area (blue text, no border, consistent background)
	m.feedbackArea = tview.NewTextView().
		SetDynamicColors(true)
	m.feedbackArea.SetBackgroundColor(tcell.ColorBlack)
	
	// Status line (grey text, no border, consistent background)
	m.statusLine = tview.NewTextView().
		SetDynamicColors(true)
	m.statusLine.SetBackgroundColor(tcell.ColorBlack)
	
	m.setupLayout()
	m.setupEventHandlers()
}

// setupLayout creates the deterministic grid layout
func (m *TubesModel) setupLayout() {
	// Create main flex container
	m.flex = tview.NewFlex()
	
	// Set up mouse and key handling
	m.app.SetMouseCapture(m.handleMouse)
	m.inputField.SetDoneFunc(m.handleInputDone)
}

// computeLayout calculates the layout using our deterministic grid system
func (m *TubesModel) computeLayout() {
	if m.width <= 0 || m.height <= 0 {
		return
	}
	
	// Define grid specification
	spec := layout.GridSpec{
		Rows: []layout.Row{
			{Height: layout.Unit{Kind: layout.Fr, Val: 1}}, // Main content area
			{Height: layout.Unit{Kind: layout.Px, Val: 3}}, // Input (3 lines with border)
			{Height: layout.Unit{Kind: layout.Px, Val: 2}}, // Feedback (2 lines)
			{Height: layout.Unit{Kind: layout.Px, Val: 1}}, // Status (1 line)
		},
		Cols: []layout.Col{
			{Width: layout.Unit{Kind: layout.Px, Val: 30}, Min: 25, Max: 50}, // Cursor pane
			{Width: layout.Unit{Kind: layout.Fr, Val: 1}},                    // Content pane
		},
		Padding: struct{ T, R, B, L int }{0, 0, 0, 0},
	}
	
	m.grid = layout.NewGrid(spec)
	m.grid.Compute(m.width, m.height)
	
	// Calculate rectangles for each component
	m.rects.CursorPane = m.grid.CellRect(0, 0)
	m.rects.ContentPane = m.grid.CellRect(0, 1)
	m.rects.Input = m.grid.SpanRect(1, 0, 1, 1)    // Span both columns
	m.rects.Feedback = m.grid.SpanRect(2, 0, 2, 1) // Span both columns
	m.rects.Status = m.grid.SpanRect(3, 0, 3, 1)   // Span both columns
	
	m.updateLayout()
}

// updateLayout applies the computed rectangles to tview components
func (m *TubesModel) updateLayout() {
	// Clear and rebuild flex
	m.flex.Clear()
	
	// Top row: cursor pane and content pane
	topRow := tview.NewFlex().
		AddItem(m.cursorPane, m.rects.CursorPane.W, 0, false).
		AddItem(m.contentPane, m.rects.ContentPane.W, 0, false)
	
	// Build vertical layout
	m.flex.SetDirection(tview.FlexRow).
		AddItem(topRow, m.rects.CursorPane.H, 0, false).
		AddItem(m.inputField, m.rects.Input.H, 0, m.activePane == "input").
		AddItem(m.feedbackArea, m.rects.Feedback.H, 0, false).
		AddItem(m.statusLine, m.rects.Status.H, 0, false)
	
	m.app.SetRoot(m.flex, true)
	
	// Update content
	m.updateCursorPane()
	m.updateContentPane()
	m.updateStatus()
}

// setupEventHandlers configures event handling
func (m *TubesModel) setupEventHandlers() {
	m.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEsc:
			m.toggleActivePane()
			return nil
		case tcell.KeyCtrlC:
			m.app.Stop()
			return nil
		}
		
		// Handle navigation in cursor pane when it's active
		if m.activePane == "cursors" {
			switch event.Rune() {
			case 'w', 'W':
				m.navigateUp()
				return nil
			case 's', 'S':
				m.navigateDown()
				return nil
			case 'a', 'A':
				m.exitCursor()
				return nil
			case 'd', 'D':
				m.enterCursor()
				return nil
			case 'e', 'E':
				m.toggleExpanded()
				return nil
			}
			
			switch event.Key() {
			case tcell.KeyTab:
				// Future: switch between cursor pane lanes
				return nil
			}
		}
		
		return event
	})
}

// handleMouse handles mouse clicks for pane selection
func (m *TubesModel) handleMouse(event *tcell.EventMouse, action tview.MouseAction) (*tcell.EventMouse, tview.MouseAction) {
	if action == tview.MouseLeftClick {
		x, y := event.Position()
		
		// Determine which pane was clicked
		if m.isInRect(x, y, m.rects.Input) {
			m.setActivePane("input")
		} else if m.isInRect(x, y, m.rects.CursorPane) {
			m.setActivePane("cursors")
		}
	}
	
	return event, action
}

// isInRect checks if coordinates are within a rectangle
func (m *TubesModel) isInRect(x, y int, rect layout.Rect) bool {
	return x >= rect.X && x < rect.X+rect.W && y >= rect.Y && y < rect.Y+rect.H
}

// toggleActivePane switches between input and cursor pane
func (m *TubesModel) toggleActivePane() {
	if m.activePane == "input" {
		m.setActivePane("cursors")
	} else {
		m.setActivePane("input")
	}
}

// setActivePane sets the active pane and updates focus
func (m *TubesModel) setActivePane(pane string) {
	m.activePane = pane
	
	switch pane {
	case "input":
		m.app.SetFocus(m.inputField)
		m.feedbackArea.SetText("[blue]INPUT MODE - Type commands or press ESC for cursor navigation[-]")
	case "cursors":
		m.app.SetFocus(m.cursorPane)
		m.feedbackArea.SetText("[blue]CURSOR MODE - Use WASD to navigate, E to expand, D to enter, A to exit[-]")
	}
	
	m.updateStatus()
	m.updateLayout()
}

// Navigation methods
func (m *TubesModel) navigateUp() {
	if m.navIndex > 0 {
		m.navIndex--
		m.updateCursorPane()
		m.updateContentPane()
	}
}

func (m *TubesModel) navigateDown() {
	if m.navIndex < len(m.visibleItems)-1 {
		m.navIndex++
		m.updateCursorPane()
		m.updateContentPane()
	}
}

func (m *TubesModel) toggleExpanded() {
	if len(m.visibleItems) == 0 || m.navIndex >= len(m.visibleItems) {
		return
	}
	
	item := m.visibleItems[m.navIndex]
	if item.Type == "multicursor" {
		m.cursors.ToggleExpanded(item.ID)
		m.refreshNavigation()
		m.updateCursorPane()
	}
}

func (m *TubesModel) enterCursor() {
	if len(m.visibleItems) == 0 || m.navIndex >= len(m.visibleItems) {
		return
	}
	
	item := m.visibleItems[m.navIndex]
	if item.Type == "cursor" {
		m.inCursorMode = true
		m.cursors.SetCurrentSelection(m.getCurrentMCID(), item.ID)
		m.updateContentPane()
		m.feedbackArea.SetText("[blue]ENTERED CURSOR - Viewing file content, press A to exit[-]")
	}
}

func (m *TubesModel) exitCursor() {
	if m.inCursorMode {
		m.inCursorMode = false
		m.updateContentPane()
		m.feedbackArea.SetText("[blue]CURSOR MODE - Use WASD to navigate, E to expand, D to enter[-]")
	}
}

func (m *TubesModel) getCurrentMCID() string {
	// Find the multicursor that contains the current cursor
	for i := m.navIndex; i >= 0; i-- {
		if m.visibleItems[i].Type == "multicursor" {
			return m.visibleItems[i].ID
		}
	}
	return ""
}

// Update methods
func (m *TubesModel) refreshNavigation() {
	m.visibleItems = m.cursors.GetVisibleItems()
	if m.navIndex >= len(m.visibleItems) {
		m.navIndex = len(m.visibleItems) - 1
	}
	if m.navIndex < 0 {
		m.navIndex = 0
	}
}

func (m *TubesModel) updateCursorPane() {
	m.refreshNavigation()
	
	var lines []string
	for i, item := range m.visibleItems {
		indent := strings.Repeat("  ", item.Level)
		prefix := ""
		
		if item.Type == "multicursor" {
			if item.Expanded {
				prefix = "📂 "
			} else {
				prefix = "📁 "
			}
		} else {
			prefix = "📄 "
		}
		
		line := indent + prefix + item.Title
		
		// Highlight current selection with white on dark blue (no yellow)
		if i == m.navIndex {
			line = fmt.Sprintf("[white:darkblue]%s[white:black]", line)
		}
		
		lines = append(lines, line)
	}
	
	m.cursorPane.SetText(strings.Join(lines, "\n"))
}

func (m *TubesModel) updateContentPane() {
	if m.inCursorMode {
		// Show file content
		cursor := m.cursors.GetCurrentCursor()
		if cursor != nil {
			content := fmt.Sprintf("# %s\n\n```\n%s\n```", 
				cursor.FilePath, cursor.Content)
			m.contentPane.SetText(content)
		}
	} else {
		// Show metadata
		if len(m.visibleItems) > 0 && m.navIndex < len(m.visibleItems) {
			item := m.visibleItems[m.navIndex]
			
			if item.Type == "cursor" {
				// Find and show cursor metadata
				mcID := m.getCurrentMCID()
				m.cursors.SetCurrentSelection(mcID, item.ID)
				cursor := m.cursors.GetCurrentCursor()
				if cursor != nil {
					m.contentPane.SetText(cursor.GetMetadataDisplay())
				}
			} else {
				// Show multicursor info
				mc := m.cursors.MultiCursors[item.ID]
				if mc != nil {
					content := fmt.Sprintf("# %s\n\n%s\n\nCursors: %d\nTags: %s\nDefault Prompt: %s",
						mc.Title, mc.Description, len(mc.Cursors), 
						strings.Join(mc.Tags, ", "), mc.DefaultPrompt)
					m.contentPane.SetText(content)
				}
			}
		} else {
			m.contentPane.SetText("No cursor selected")
		}
	}
}

func (m *TubesModel) updateStatus() {
	mode := "INPUT"
	if m.activePane == "cursors" {
		mode = "CURSOR"
	}
	
	// Use color tags for grey text on black background
	status := fmt.Sprintf("[gray]%s MODE | Items: %d | Index: %d[-]", 
		mode, len(m.visibleItems), m.navIndex+1)
	m.statusLine.SetText(status)
}

// handleInputDone processes input commands
func (m *TubesModel) handleInputDone(key tcell.Key) {
	if key == tcell.KeyEnter {
		input := strings.TrimSpace(m.inputField.GetText())
		m.inputField.SetText("")
		
		if input != "" {
			result := m.executeCommand(input)
			// Use blue color tag for feedback
			m.feedbackArea.SetText(fmt.Sprintf("[blue]%s[-]", result))
		}
	}
}

// executeCommand handles command execution
func (m *TubesModel) executeCommand(input string) string {
	if strings.HasPrefix(input, "/") {
		parts := strings.Fields(input)
		cmdName := parts[0]
		args := parts[1:]
		
		if handler, exists := m.commands[cmdName]; exists {
			result, err := handler(m, args)
			if err != nil {
				return fmt.Sprintf("Error: %s", err)
			}
			return result
		}
		return fmt.Sprintf("Unknown command: %s (try /help)", cmdName)
	}
	
	return "Use /help to see available commands"
}

// Resize handles window resize events
func (m *TubesModel) Resize(width, height int) {
	if width != m.width || height != m.height {
		m.width, m.height = width, height
		m.computeLayout()
	}
}

// setupCommands registers available commands
func (m *TubesModel) setupCommands() {
	m.commands["/help"] = func(model *TubesModel, args []string) (string, error) {
		return `Available commands:
/help                    - Show this help
/mc new <title>          - Create new multicursor
/mc list                 - List all multicursors  
/cursor add <file:line>  - Add cursor to current multicursor
/cursor list             - List cursors in current multicursor
/ui tokens               - Show UI design tokens
/ui preview              - Show theme preview
/ui palette              - Show color palette
/server start            - Start HTTP API server
/server stop             - Stop HTTP API server
/server status           - Show server status
/clear                   - Clear feedback area
/quit                    - Exit application`, nil
	}
	
	m.commands["/mc"] = func(model *TubesModel, args []string) (string, error) {
		if len(args) == 0 {
			return "Usage: /mc new <title> | /mc list", nil
		}
		
		switch args[0] {
		case "new":
			if len(args) < 2 {
				return "Usage: /mc new <title>", nil
			}
			title := strings.Join(args[1:], " ")
			mc := model.cursors.NewMultiCursor(title, "New multicursor collection")
			model.refreshNavigation()
			model.updateCursorPane()
			return fmt.Sprintf("Created multicursor: %s", mc.ID), nil
			
		case "list":
			var items []string
			for id, mc := range model.cursors.MultiCursors {
				items = append(items, fmt.Sprintf("%s: %s (%d cursors)", 
					id, mc.Title, len(mc.Cursors)))
			}
			if len(items) == 0 {
				return "No multicursors found", nil
			}
			return strings.Join(items, "\n"), nil
		default:
			return "Usage: /mc new <title> | /mc list", nil
		}
	}
	
	m.commands["/cursor"] = func(model *TubesModel, args []string) (string, error) {
		if len(args) == 0 {
			return "Usage: /cursor add <file:line> | /cursor list", nil
		}
		
		switch args[0] {
		case "add":
			if len(args) < 2 {
				return "Usage: /cursor add <file:line>", nil
			}
			// Simple parsing for demo - in real implementation would parse file:line format
			cursor := model.cursors.NewCursor("example.go", 1, 10, "sample content")
			
			// Add to first available multicursor for demo
			for mcID := range model.cursors.MultiCursors {
				model.cursors.AddCursorToMC(mcID, cursor)
				model.refreshNavigation()
				model.updateCursorPane()
				return fmt.Sprintf("Added cursor %s to multicursor %s", cursor.ID, mcID), nil
			}
			return "No multicursor available - create one first with /mc new", nil
			
		case "list":
			mc := model.cursors.GetCurrentMultiCursor()
			if mc == nil {
				return "No multicursor selected", nil
			}
			var items []string
			for _, cursor := range mc.Cursors {
				items = append(items, fmt.Sprintf("%s: %s (%d-%d)", 
					cursor.ID, cursor.FilePath, cursor.StartLine, cursor.EndLine))
			}
			if len(items) == 0 {
				return "No cursors in current multicursor", nil
			}
			return strings.Join(items, "\n"), nil
		default:
			return "Usage: /cursor add <file:line> | /cursor list", nil
		}
	}
	
	m.commands["/clear"] = func(model *TubesModel, args []string) (string, error) {
		model.feedbackArea.SetText("")
		return "Feedback cleared", nil
	}
	
	m.commands["/ui"] = func(model *TubesModel, args []string) (string, error) {
		if len(args) == 0 {
			return theme.PreviewOneLine(model.styles), nil
		}
		
		switch args[0] {
		case "tokens":
			return theme.GetDesignTokens(model.styles), nil
		case "preview":
			return theme.Preview(model.styles), nil
		case "palette":
			return theme.GetColorPalette(), nil
		default:
			return "Usage: /ui [tokens|preview|palette]", nil
		}
	}
	
	m.commands["/server"] = func(model *TubesModel, args []string) (string, error) {
		if len(args) == 0 {
			return "Usage: /server start | /server stop | /server status", nil
		}
		
		switch args[0] {
		case "start":
			go func() {
				if err := model.apiServer.Start(); err != nil {
					// Server stopped or error
				}
			}()
			return fmt.Sprintf("API server starting on port %s", model.apiServer.GetPort()), nil
			
		case "stop":
			if err := model.apiServer.Stop(); err != nil {
				return fmt.Sprintf("Error stopping server: %s", err), err
			}
			return "API server stopped", nil
			
		case "status":
			return fmt.Sprintf("API server on port %s", model.apiServer.GetPort()), nil
			
		default:
			return "Usage: /server start | /server stop | /server status", nil
		}
	}
	
	m.commands["/quit"] = func(model *TubesModel, args []string) (string, error) {
		// Stop server if running
		model.apiServer.Stop()
		model.app.Stop()
		return "Goodbye!", nil
	}
}

// loadSampleData creates some sample multicursors and cursors for testing
func (m *TubesModel) loadSampleData() {
	// Create sample multicursor
	mc1 := m.cursors.NewMultiCursor("Authentication", "User authentication system")
	mc1.Tags = []string{"auth", "security", "user"}
	mc1.DefaultPrompt = "Analyze the authentication system:"
	
	// Add sample cursors
	cursor1 := m.cursors.NewCursor("internal/auth/login.go", 15, 45, 
		`func Login(username, password string) (*User, error) {
	if username == "" || password == "" {
		return nil, errors.New("username and password required")
	}
	
	user, err := db.GetUser(username)
	if err != nil {
		return nil, err
	}
	
	if !bcrypt.CheckPasswordHash(user.Password, password) {
		return nil, errors.New("invalid credentials")
	}
	
	return user, nil
}`)
	cursor1.Tags = []string{"login", "validation"}
	cursor1.Prompt = "Explain this login function:"
	
	cursor2 := m.cursors.NewCursor("internal/auth/jwt.go", 8, 25,
		`func GenerateJWT(userID string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})
	
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}`)
	cursor2.Tags = []string{"jwt", "token", "security"}
	cursor2.Prompt = "Review this JWT generation:"
	
	m.cursors.AddCursorToMC(mc1.ID, cursor1)
	m.cursors.AddCursorToMC(mc1.ID, cursor2)
	
	// Create another sample multicursor
	mc2 := m.cursors.NewMultiCursor("Database", "Database operations and models")
	mc2.Tags = []string{"db", "models", "persistence"}
	
	cursor3 := m.cursors.NewCursor("internal/db/user.go", 12, 28,
		`type User struct {
	ID       string    ` + "`json:\"id\" db:\"id\"`" + `
	Username string    ` + "`json:\"username\" db:\"username\"`" + `
	Email    string    ` + "`json:\"email\" db:\"email\"`" + `
	Password string    ` + "`json:\"-\" db:\"password\"`" + `
	Created  time.Time ` + "`json:\"created\" db:\"created\"`" + `
}

func (u *User) Validate() error {
	if u.Username == "" {
		return errors.New("username required")
	}
	if u.Email == "" {
		return errors.New("email required")
	}
	return nil
}`)
	cursor3.Tags = []string{"model", "struct", "validation"}
	cursor3.Prompt = "Analyze this user model:"
	
	m.cursors.AddCursorToMC(mc2.ID, cursor3)
}

// Run starts the application
func (m *TubesModel) Run() error {
	m.width, m.height = 80, 24 // Default size
	m.computeLayout()
	m.setActivePane("input")
	
	// Load legacy commands for compatibility
	m.loadCommands()
	
	return m.app.Run()
}

// Legacy compatibility methods for commands.go
func (m *TubesModel) reloadLeft() {
	// Refresh cursor pane content
	m.refreshCursorPane()
}

func (m *TubesModel) renderRight(path string) {
	// Update content pane with path content
	m.contentPane.SetText(fmt.Sprintf("Content for: %s", path))
}

func (m *TubesModel) adjustColRatio(delta float64) {
	m.col1Ratio += delta
	if m.col1Ratio < 0.1 {
		m.col1Ratio = 0.1
	}
	if m.col1Ratio > 0.9 {
		m.col1Ratio = 0.9
	}
	m.computeLayout()
}

func (m *TubesModel) adjustBand(which string, delta int) {
	// Placeholder for band adjustment
}

// Bubbletea Model interface methods
func (m *TubesModel) Init() tea.Cmd {
	return nil
}

func (m *TubesModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	return m, nil
}

func (m *TubesModel) View() string {
	return "TubesModel View"
}

func (m *TubesModel) enqueueLog(target logTarget, msg string) {
	// Placeholder for log enqueueing
}

