// main.go
package main

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
)

type command struct {
	Name        string
	Args        string
	Description string
}

var registry = []command{
	{Name: "/help", Args: "[cmd]", Description: "Show help for all commands or a specific command"},
	{Name: "/open", Args: "<path|url>", Description: "Open a file or URL"},
	{Name: "/new", Args: "[name]", Description: "Create a new buffer or resource"},
	{Name: "/close", Args: "[name]", Description: "Close current or named buffer"},
	{Name: "/quit", Args: "", Description: "Exit the program"},
}

type model struct {
	ta           textarea.Model
	width        int
	height       int
	suggestions  []command
	selIdx       int
	showSuggest  bool
	status       string
}

func initialModel() model {
	ta := textarea.New()
	ta.Placeholder = "Type '/' for commands. Enter to submit."
	ta.Focus()
	ta.ShowLineNumbers = false
	ta.SetWidth(80)
	ta.SetHeight(1)
	ta.CharLimit = 0
	ta.Prompt = "› "
	ta.Cursor.Style = ta.Cursor.Style.Bold(true)
	return model{ta: ta}
}

func (m model) Init() tea.Cmd { return textarea.Blink }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ta.SetWidth(max(10, m.width-2)) // minor padding
		// place input on the second-last line; suggestions on the last line (i.e., below input)
		m.ta.SetHeight(1)
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "up":
			if m.showSuggest && len(m.suggestions) > 0 {
				m.selIdx = (m.selIdx - 1 + len(m.suggestions)) % len(m.suggestions)
				return m, nil
			}
		case "down":
			if m.showSuggest && len(m.suggestions) > 0 {
				m.selIdx = (m.selIdx + 1) % len(m.suggestions)
				return m, nil
			}
		case "tab", "right":
			// accept completion
			if m.showSuggest && len(m.suggestions) > 0 {
				m.acceptCompletion()
				return m, nil
			}
		case "enter":
			line := strings.TrimSpace(m.currentLine())
			if strings.HasPrefix(line, "/") {
				m.status = m.execCommand(line)
			} else if line != "" {
				m.status = fmt.Sprintf("echo: %s", line)
			} else {
				m.status = ""
			}
			m.ta.Reset()
			m.showSuggest = false
			m.suggestions = nil
			m.selIdx = 0
			return m, nil
		}
	}

	// let textarea handle input/editing
	var cmd tea.Cmd
	m.ta, cmd = m.ta.Update(msg)
	cmds = append(cmds, cmd)

	// update suggestions if the line starts with '/'
	line := m.currentLine()
	if strings.HasPrefix(line, "/") {
		m.suggestions = filterCommands(registry, line)
		m.showSuggest = len(m.suggestions) > 0
		if m.selIdx >= len(m.suggestions) {
			m.selIdx = 0
		}
	} else {
		m.showSuggest = false
		m.suggestions = nil
		m.selIdx = 0
	}

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	// Layout: everything blank, input on row H-1, suggestions on row H (below input).
	// Compose footer (suggestions + input) and pad the top with newlines.
	linesAbove := max(0, m.height-2) // leave two rows
	var b strings.Builder
	if linesAbove > 0 {
		b.WriteString(strings.Repeat("\n", linesAbove))
	}

	// input row (second-last line)
	b.WriteString(m.ta.View())
	b.WriteRune('\n')

	// suggestions row (last line, below input)
	if m.showSuggest && len(m.suggestions) > 0 {
		b.WriteString(renderSuggestions(m.suggestions, m.selIdx, m.width))
	} else {
		// show status/help hint if no suggestions
		if m.status != "" {
			b.WriteString(truncate(m.status, m.width))
		} else {
			b.WriteString(truncate("Type '/' to see commands. Use ↑/↓ to navigate, Tab to complete, Enter to run.", m.width))
		}
	}
	return b.String()
}

func (m *model) acceptCompletion() {
	if !m.showSuggest || len(m.suggestions) == 0 {
		return
	}
	cur := m.currentLine()
	cmd := m.suggestions[m.selIdx]
	// Replace the leading token with the selected command name and a trailing space.
	// Keep any args typed after the first space.
	after := ""
	if i := strings.IndexAny(cur, " \t"); i >= 0 {
		after = strings.TrimLeft(cur[i:], " \t")
	}
	replacement := cmd.Name
	if cmd.Args != "" {
		// helpful scaffold: insert a space and keep existing suffix
		replacement += " "
	} else if after != "" {
		replacement += " "
	}
	if after != "" {
		replacement += after
	}
	m.ta.SetValue(replacement)
	m.ta.CursorEnd()
}

func (m model) currentLine() string {
	// Single-line textarea; value == line
	return m.ta.Value()
}

func filterCommands(cmds []command, line string) []command {
	// match prefix on the first token
	token := line
	if i := strings.IndexAny(line, " \t"); i >= 0 {
		token = line[:i]
	}
	token = strings.ToLower(token)
	var out []command
	for _, c := range cmds {
		name := strings.ToLower(c.Name)
		if strings.HasPrefix(name, token) {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func renderSuggestions(sug []command, sel, width int) string {
	if len(sug) == 0 {
		return ""
	}
	// Render as a single line with the selected item bracketed.
	// Example: [/help] /new /open /quit
	var parts []string
	for i, c := range sug {
		label := c.Name
		if c.Args != "" {
			label += " " + c.Args
		}
		if i == sel {
			label = "[" + label + "]"
		}
		parts = append(parts, label)
	}
	line := strings.Join(parts, "  ")
	// If too long, append a short help for selected item on overflow line.
	if len(line) > width {
		lead := truncate(line, width)
		desc := " — " + sug[sel].Description
		return truncate(lead, width) + "\n" + truncate(desc, width)
	}
	// Fit description inline if possible.
	desc := " — " + sug[sel].Description
	combined := line + desc
	return truncate(combined, width)
}

func (m *model) execCommand(line string) string {
	fields := splitArgs(line)
	if len(fields) == 0 {
		return ""
	}
	switch fields[0] {
	case "/help":
		if len(fields) == 1 {
			var names []string
			for _, c := range registry {
				names = append(names, c.Name)
			}
			return "commands: " + strings.Join(names, ", ")
		}
		query := strings.ToLower(fields[1])
		for _, c := range registry {
			if strings.ToLower(c.Name) == query {
				args := ""
				if c.Args != "" {
					args = " " + c.Args
				}
				return c.Name + args + " — " + c.Description
			}
		}
		return "unknown command: " + fields[1]

	case "/quit":
		// queue quit command
		go func() { // run asynchronously so we can set status first
			_ = tea.Quit()
		}()
		return "quitting..."

	default:
		// skeleton handler
		return "exec: " + strings.Join(fields, " ")
	}
}


func splitArgs(s string) []string {
	// simple split; no quoting
	fs := strings.Fields(s)
	return fs
}

func truncate(s string, width int) string {
	if width <= 0 {
		return ""
	}
	if len(s) <= width {
		return s + strings.Repeat(" ", max(0, width-len(s)))
	}
	if width <= 1 {
		return s[:width]
	}
	return s[:width-1] + "…"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func main() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
}
