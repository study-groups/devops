package tui

import (
	"strings"
)

// handleInput parses the REPL line and executes commands of the form `/cmd args...`.
// Non-command input is appended to the left log without emitting Program.Send.
func (m *Model) handleInput() {
	line := strings.TrimSpace(m.repl.Value())

	// Clear input and suggestions before executing to keep UI responsive.
	m.repl.SetValue("")
	m.repl.SetCursor(0)
	m.updateSuggestions()

	if line == "" {
		return
	}

	// Commands start with "/"
	if !strings.HasPrefix(line, "/") {
		m.leftContent = append(m.leftContent, line)
		m.leftVP.SetContent(strings.Join(m.leftContent, "\n"))
		return
	}

	fields := strings.Fields(line)
	name := fields[0]
	args := []string{}
	if len(fields) > 1 {
		args = fields[1:]
	}
	if cmd, ok := m.commands[name]; ok && cmd.Executor != nil {
		out, err := cmd.Executor(m, args)
		if err != nil {
			m.leftContent = append(m.leftContent, "ERR: "+err.Error())
		} else if out != "" {
			m.leftContent = append(m.leftContent, out)
		}
		m.leftVP.SetContent(strings.Join(m.leftContent, "\n"))
		return
	}

	m.leftContent = append(m.leftContent, "unknown command: "+name)
	m.leftVP.SetContent(strings.Join(m.leftContent, "\n"))
}
