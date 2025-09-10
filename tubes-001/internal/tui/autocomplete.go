package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// AutoComplete handles real-time command suggestions and feedback
type AutoComplete struct {
	suggestions    []string
	currentInput   string
	feedback       string
	lastUpdate     time.Time
	commands       map[string]Command
}

// NewAutoComplete creates a new autocomplete system
func NewAutoComplete(commands map[string]Command) *AutoComplete {
	return &AutoComplete{
		commands:   commands,
		suggestions: []string{},
		lastUpdate: time.Now(),
	}
}

// UpdateInput processes input changes and provides instant feedback
func (ac *AutoComplete) UpdateInput(input string) ([]string, string) {
	ac.currentInput = input
	ac.lastUpdate = time.Now()

	// Clear suggestions if not typing a command
	if !strings.HasPrefix(input, "/") {
		ac.suggestions = []string{}
		ac.feedback = "Type / for commands"
		return ac.suggestions, ac.feedback
	}

	// Get command suggestions
	ac.suggestions = ac.getCommandSuggestions(input)
	ac.feedback = ac.generateFeedback(input)

	return ac.suggestions, ac.feedback
}

// getCommandSuggestions returns matching commands
func (ac *AutoComplete) getCommandSuggestions(input string) []string {
	if strings.Contains(input, " ") {
		// If there's a space, they're typing arguments - show argument help
		parts := strings.Fields(input)
		if len(parts) > 0 {
			cmdName := parts[0]
			if _, exists := ac.commands[cmdName]; exists {
				return ac.getArgumentSuggestions(cmdName, parts[1:])
			}
		}
		return []string{}
	}

	// Match command names
	var matches []string
	for cmdName := range ac.commands {
		if strings.HasPrefix(cmdName, input) {
			matches = append(matches, cmdName)
		}
	}

	// Limit to top 5 suggestions
	if len(matches) > 5 {
		matches = matches[:5]
	}

	return matches
}

// getArgumentSuggestions provides context-specific argument hints
func (ac *AutoComplete) getArgumentSuggestions(cmdName string, args []string) []string {
	switch cmdName {
	case "/ui":
		if len(args) == 0 {
			return []string{"split", "input", "feedback", "inspect"}
		} else if args[0] == "split" && len(args) == 1 {
			return []string{"0.2", "0.3", "0.4", "0.5", "0.6", "0.7"}
		} else if args[0] == "input" && len(args) == 1 {
			return []string{"1", "2", "3", "4", "5"}
		} else if args[0] == "feedback" && len(args) == 1 {
			return []string{"1", "2", "3"}
		}
	case "/mode":
		if len(args) == 0 {
			return []string{"self", "tasks"}
		}
	case "/open":
		if len(args) == 0 {
			return []string{"internal/tui/", "README.md", "go.mod"}
		}
	case "/run":
		if len(args) == 0 {
			return []string{"compile", "test"}
		}
	}
	return []string{}
}

// generateFeedback creates contextual feedback for the current input
func (ac *AutoComplete) generateFeedback(input string) string {
	if input == "/" {
		return "Available commands: help, mode, open, ui, run, clear, api, quit"
	}

	parts := strings.Fields(input)
	if len(parts) == 0 {
		return "Type / for commands"
	}

	cmdName := parts[0]
	cmd, exists := ac.commands[cmdName]
	if !exists {
		return "Unknown command - try /help"
	}

	// Provide command-specific guidance
	switch cmdName {
	case "/ui":
		if len(parts) == 1 {
			return "UI controls: split <ratio> | input <height> | feedback <height> | inspect"
		} else if len(parts) == 2 {
			subCmd := parts[1]
			switch subCmd {
			case "split":
				return "Set left/right split ratio (0.1 to 0.9)"
			case "input":
				return "Set input area height (1-5 lines)"
			case "feedback":
				return "Set feedback area height (1-3 lines)"
			case "inspect":
				return "Show current UI settings"
			}
		}
	case "/mode":
		if len(parts) == 1 {
			return "Switch mode: self (learn Tubes) | tasks (work mode)"
		}
	case "/open":
		if len(parts) == 1 {
			return "Open file or directory - try tab completion"
		}
	case "/help":
		return "Show all commands with examples"
	case "/quit", "/exit", "/q":
		return "Exit Tubes application"
	}

	return cmd.Description
}

// GetBestMatch returns the best autocomplete suggestion
func (ac *AutoComplete) GetBestMatch() string {
	if len(ac.suggestions) > 0 {
		return ac.suggestions[0]
	}
	return ""
}

// CompleteInput fills in the best match
func (ac *AutoComplete) CompleteInput() string {
	best := ac.GetBestMatch()
	if best == "" {
		return ac.currentInput
	}

	// If we're completing a command name, add a space
	if !strings.Contains(ac.currentInput, " ") {
		return best + " "
	}

	// For arguments, complete the current part
	parts := strings.Fields(ac.currentInput)
	if len(parts) > 0 {
		parts[len(parts)-1] = best
		return strings.Join(parts, " ")
	}

	return best
}

// ShouldShowSuggestions determines if suggestions should be displayed
func (ac *AutoComplete) ShouldShowSuggestions() bool {
	return len(ac.suggestions) > 0 && strings.HasPrefix(ac.currentInput, "/")
}

// autoCompleteCmd creates a command for periodic autocomplete updates
func autoCompleteCmd() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return autoCompleteMsg{time: t}
	})
}

type autoCompleteMsg struct {
	time time.Time
}