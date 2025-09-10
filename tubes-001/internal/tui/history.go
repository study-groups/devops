package tui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// CommandHistoryEntry represents a single command execution record
type CommandHistoryEntry struct {
	ID         int       `json:"id"`
	Command    string    `json:"command"`
	Args       []string  `json:"args,omitempty"`
	PWD        string    `json:"pwd"`
	Timestamp  time.Time `json:"timestamp"`
	Duration   int64     `json:"duration_ms"`
	Success    bool      `json:"success"`
	Output     string    `json:"output,omitempty"`
	Error      string    `json:"error,omitempty"`
	Context    string    `json:"context,omitempty"` // Additional context for LLM
	Mode       string    `json:"mode"`              // self, tasks, etc.
}

// CommandHistory manages the command history with LLM-friendly metadata
type CommandHistory struct {
	Entries    []*CommandHistoryEntry `json:"entries"`
	MaxEntries int                    `json:"max_entries"`
	CurrentIdx int                    `json:"-"` // Current position for navigation
	filePath   string                 // Where to persist history
}

// NewCommandHistory creates a new command history manager
func NewCommandHistory(maxEntries int, filePath string) *CommandHistory {
	ch := &CommandHistory{
		Entries:    make([]*CommandHistoryEntry, 0),
		MaxEntries: maxEntries,
		CurrentIdx: -1,
		filePath:   filePath,
	}
	
	// Try to load existing history
	ch.LoadFromFile()
	return ch
}

// AddEntry adds a new command to the history with comprehensive metadata
func (ch *CommandHistory) AddEntry(command string, args []string, pwd string, mode string, success bool, output string, errorMsg string, duration int64, context string) {
	entry := &CommandHistoryEntry{
		ID:        ch.getNextID(),
		Command:   command,
		Args:      args,
		PWD:       pwd,
		Timestamp: time.Now(),
		Duration:  duration,
		Success:   success,
		Output:    output,
		Error:     errorMsg,
		Context:   context,
		Mode:      mode,
	}
	
	// Add to beginning of slice (most recent first)
	ch.Entries = append([]*CommandHistoryEntry{entry}, ch.Entries...)
	
	// Trim to max entries
	if len(ch.Entries) > ch.MaxEntries {
		ch.Entries = ch.Entries[:ch.MaxEntries]
	}
	
	// Reset navigation index
	ch.CurrentIdx = -1
	
	// Auto-save
	ch.SaveToFile()
}

// GetPrevious returns the previous command in history (up arrow)
func (ch *CommandHistory) GetPrevious() string {
	if len(ch.Entries) == 0 {
		return ""
	}
	
	ch.CurrentIdx++
	if ch.CurrentIdx >= len(ch.Entries) {
		ch.CurrentIdx = len(ch.Entries) - 1
	}
	
	if ch.CurrentIdx >= 0 && ch.CurrentIdx < len(ch.Entries) {
		entry := ch.Entries[ch.CurrentIdx]
		if len(entry.Args) > 0 {
			return entry.Command + " " + fmt.Sprintf("%v", entry.Args)[1:len(fmt.Sprintf("%v", entry.Args))-1]
		}
		return entry.Command
	}
	
	return ""
}

// GetNext returns the next command in history (down arrow)
func (ch *CommandHistory) GetNext() string {
	if len(ch.Entries) == 0 || ch.CurrentIdx < 0 {
		return ""
	}
	
	ch.CurrentIdx--
	if ch.CurrentIdx < -1 {
		ch.CurrentIdx = -1
		return "" // Return to current (empty) input
	}
	
	if ch.CurrentIdx >= 0 && ch.CurrentIdx < len(ch.Entries) {
		entry := ch.Entries[ch.CurrentIdx]
		if len(entry.Args) > 0 {
			return entry.Command + " " + fmt.Sprintf("%v", entry.Args)[1:len(fmt.Sprintf("%v", entry.Args))-1]
		}
		return entry.Command
	}
	
	return ""
}

// ResetNavigation resets the navigation index
func (ch *CommandHistory) ResetNavigation() {
	ch.CurrentIdx = -1
}

// GetRecentEntries returns the N most recent entries
func (ch *CommandHistory) GetRecentEntries(n int) []*CommandHistoryEntry {
	if n <= 0 || len(ch.Entries) == 0 {
		return []*CommandHistoryEntry{}
	}
	
	if n > len(ch.Entries) {
		n = len(ch.Entries)
	}
	
	return ch.Entries[:n]
}

// GetFailedCommands returns commands that failed for debugging
func (ch *CommandHistory) GetFailedCommands() []*CommandHistoryEntry {
	var failed []*CommandHistoryEntry
	for _, entry := range ch.Entries {
		if !entry.Success {
			failed = append(failed, entry)
		}
	}
	return failed
}

// GetCommandsByMode returns commands executed in a specific mode
func (ch *CommandHistory) GetCommandsByMode(mode string) []*CommandHistoryEntry {
	var filtered []*CommandHistoryEntry
	for _, entry := range ch.Entries {
		if entry.Mode == mode {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

// GetLLMContext generates a formatted context string for LLM analysis
func (ch *CommandHistory) GetLLMContext(recentCount int) string {
	entries := ch.GetRecentEntries(recentCount)
	if len(entries) == 0 {
		return "No command history available"
	}
	
	context := "Recent Command History (for LLM analysis):\n"
	context += "==========================================\n\n"
	
	for i, entry := range entries {
		status := "✓ SUCCESS"
		if !entry.Success {
			status = "✗ FAILED"
		}
		
		context += fmt.Sprintf("%d. [%s] %s\n", i+1, status, entry.Command)
		if len(entry.Args) > 0 {
			context += fmt.Sprintf("   Args: %v\n", entry.Args)
		}
		context += fmt.Sprintf("   PWD: %s\n", entry.PWD)
		context += fmt.Sprintf("   Mode: %s\n", entry.Mode)
		context += fmt.Sprintf("   Time: %s\n", entry.Timestamp.Format("15:04:05"))
		context += fmt.Sprintf("   Duration: %dms\n", entry.Duration)
		
		if entry.Output != "" {
			context += fmt.Sprintf("   Output: %s\n", truncateString(entry.Output, 200))
		}
		
		if entry.Error != "" {
			context += fmt.Sprintf("   Error: %s\n", truncateString(entry.Error, 200))
		}
		
		if entry.Context != "" {
			context += fmt.Sprintf("   Context: %s\n", entry.Context)
		}
		
		context += "\n"
	}
	
	return context
}

// SaveToFile persists the history to disk
func (ch *CommandHistory) SaveToFile() error {
	if ch.filePath == "" {
		return nil
	}
	
	// Ensure directory exists
	dir := filepath.Dir(ch.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create history directory: %w", err)
	}
	
	data, err := json.MarshalIndent(ch, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal history: %w", err)
	}
	
	return os.WriteFile(ch.filePath, data, 0644)
}

// LoadFromFile loads history from disk
func (ch *CommandHistory) LoadFromFile() error {
	if ch.filePath == "" {
		return nil
	}
	
	data, err := os.ReadFile(ch.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File doesn't exist yet, that's OK
		}
		return fmt.Errorf("failed to read history file: %w", err)
	}
	
	var loaded CommandHistory
	if err := json.Unmarshal(data, &loaded); err != nil {
		return fmt.Errorf("failed to unmarshal history: %w", err)
	}
	
	ch.Entries = loaded.Entries
	ch.MaxEntries = loaded.MaxEntries
	
	return nil
}

// getNextID generates the next unique ID
func (ch *CommandHistory) getNextID() int {
	maxID := 0
	for _, entry := range ch.Entries {
		if entry.ID > maxID {
			maxID = entry.ID
		}
	}
	return maxID + 1
}

// truncateString truncates a string to maxLen characters
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// GetStats returns statistics about the command history
func (ch *CommandHistory) GetStats() map[string]interface{} {
	totalCommands := len(ch.Entries)
	successCount := 0
	totalDuration := int64(0)
	
	for _, entry := range ch.Entries {
		if entry.Success {
			successCount++
		}
		totalDuration += entry.Duration
	}
	
	successRate := float64(0)
	if totalCommands > 0 {
		successRate = float64(successCount) / float64(totalCommands) * 100
	}
	
	avgDuration := int64(0)
	if totalCommands > 0 {
		avgDuration = totalDuration / int64(totalCommands)
	}
	
	return map[string]interface{}{
		"total_commands": totalCommands,
		"success_count":  successCount,
		"failure_count":  totalCommands - successCount,
		"success_rate":   fmt.Sprintf("%.1f%%", successRate),
		"avg_duration":   fmt.Sprintf("%dms", avgDuration),
		"total_duration": fmt.Sprintf("%dms", totalDuration),
	}
}