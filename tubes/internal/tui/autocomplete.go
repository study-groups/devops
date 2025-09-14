package tui

import (
	"sort"
	"strings"
)

// AutoComplete provides command completion functionality
type AutoComplete struct {
	commands []string
}

// NewAutoComplete creates a new autocomplete instance
func NewAutoComplete(commands map[string]Command) *AutoComplete {
	var cmdList []string
	for name := range commands {
		cmdList = append(cmdList, "/"+name)
	}
	sort.Strings(cmdList)
	
	return &AutoComplete{
		commands: cmdList,
	}
}

// Complete returns completion suggestions for the given input
func (ac *AutoComplete) Complete(input string) []string {
	input = strings.TrimSpace(input)
	if input == "" {
		return ac.commands
	}
	
	var matches []string
	for _, cmd := range ac.commands {
		if strings.HasPrefix(cmd, input) {
			matches = append(matches, cmd)
		}
	}
	
	return matches
}

// GetNextCompletion cycles through completions for the given input
func (ac *AutoComplete) GetNextCompletion(input string, currentIndex int) (string, int) {
	matches := ac.Complete(input)
	if len(matches) == 0 {
		return input, -1
	}
	
	nextIndex := (currentIndex + 1) % len(matches)
	return matches[nextIndex], nextIndex
}

// GetPrevCompletion cycles backwards through completions
func (ac *AutoComplete) GetPrevCompletion(input string, currentIndex int) (string, int) {
	matches := ac.Complete(input)
	if len(matches) == 0 {
		return input, -1
	}
	
	prevIndex := currentIndex - 1
	if prevIndex < 0 {
		prevIndex = len(matches) - 1
	}
	return matches[prevIndex], prevIndex
}

// GetCompletionHelp returns help text for available completions
func (ac *AutoComplete) GetCompletionHelp(input string) string {
	matches := ac.Complete(input)
	if len(matches) == 0 {
		return "No completions available"
	}
	
	if len(matches) == 1 {
		return "Press Tab to complete: " + matches[0]
	}
	
	return "Available completions: " + strings.Join(matches, ", ")
}