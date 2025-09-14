package tui

// Command represents a TUI command with its executor function
type Command struct {
	Name        string
	Description string
	Executor    func(m *Model, args []string) (string, error)
}

// inputMode represents different input modes for the TUI
type inputMode int

const (
	viewMode inputMode = iota
	commandMode
	textMode
)

// pane represents different UI panes
type pane int

const (
	leftPane pane = iota
	rightPane
	inputPane
)

// mode represents different application modes
type mode int

const (
	modeSelf mode = iota
	modeTasks
)

// mockTextInput is a simple mock for compatibility with repl.go
type mockTextInput struct {
	value  string
	cursor int
}

func (m *mockTextInput) Value() string {
	return m.value
}

func (m *mockTextInput) SetValue(value string) {
	m.value = value
}

func (m *mockTextInput) SetCursor(pos int) {
	m.cursor = pos
}

// mockViewport is a simple mock for compatibility with repl.go
type mockViewport struct {
	content []string
}

func (m *mockViewport) SetContent(content string) {
	m.content = []string{content}
}


// mockHTTPServer is a simple mock for compatibility
type mockHTTPServer struct{}

func (m *mockHTTPServer) ListenAndServe() error {
	return nil
}

func (m *mockHTTPServer) Shutdown(ctx interface{}) error {
	return nil
}

// mockTheme is a simple mock for compatibility
type mockTheme struct {
	HeaderBg           string
	HeaderFg           string
	PaneBorderInactive string
	PaneBorderActive   string
	FooterBg           string
	FooterFg           string
	ComplFg            string
}