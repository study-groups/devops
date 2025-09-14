package tui

import (
	"encoding/json"
	"time"
)

// Cursor represents a cursor with metadata and content
type Cursor struct {
	ID          string            `json:"id"`
	Filename    string            `json:"filename"`
	Path        string            `json:"path"`
	Prompt      string            `json:"prompt"`
	Tags        []string          `json:"tags"`
	Created     time.Time         `json:"created"`
	Modified    time.Time         `json:"modified"`
	Metadata    map[string]string `json:"metadata"`
	IsDirectory bool              `json:"is_directory"`
	Children    []*Cursor         `json:"children,omitempty"`
}

// CursorManager manages the cursor system
type CursorManager struct {
	Root        *Cursor           `json:"root"`
	Current     *Cursor           `json:"current"`
	Selected    []*Cursor         `json:"selected"` // Multicursor selection
	ViewMode    CursorViewMode    `json:"view_mode"`
	History     []*Cursor         `json:"history"`
}

// CursorViewMode determines what the right panel shows
type CursorViewMode int

const (
	ViewMetadata CursorViewMode = iota // Show cursor metadata
	ViewContent                        // Show file content (entered cursor)
)

// NewCursor creates a new cursor with default values
func NewCursor(filename, path string) *Cursor {
	now := time.Now()
	return &Cursor{
		ID:       generateCursorID(),
		Filename: filename,
		Path:     path,
		Prompt:   "Default prompt for " + filename, // Default prompt based on filename
		Tags:     []string{},
		Created:  now,
		Modified: now,
		Metadata: make(map[string]string),
	}
}

// NewCursorManager creates a new cursor manager
func NewCursorManager() *CursorManager {
	root := &Cursor{
		ID:          "root",
		Filename:    "Tubes.Cursors",
		Path:        "",
		Prompt:      "Root cursor directory",
		Tags:        []string{"root"},
		IsDirectory: true,
		Children:    []*Cursor{},
		Created:     time.Now(),
		Modified:    time.Now(),
		Metadata:    make(map[string]string),
	}

	return &CursorManager{
		Root:     root,
		Current:  root,
		Selected: []*Cursor{},
		ViewMode: ViewMetadata,
		History:  []*Cursor{},
	}
}

// AddCursor adds a cursor to the current directory
func (cm *CursorManager) AddCursor(cursor *Cursor) {
	if cm.Current.IsDirectory {
		cm.Current.Children = append(cm.Current.Children, cursor)
		cm.Current.Modified = time.Now()
	}
}

// EnterCursor enters a cursor (switch to content view)
func (cm *CursorManager) EnterCursor(cursor *Cursor) {
	if cursor != nil {
		cm.History = append(cm.History, cm.Current)
		cm.Current = cursor
		cm.ViewMode = ViewContent
	}
}

// ExitCursor exits current cursor (back to parent/metadata view)
func (cm *CursorManager) ExitCursor() {
	if len(cm.History) > 0 {
		cm.Current = cm.History[len(cm.History)-1]
		cm.History = cm.History[:len(cm.History)-1]
		cm.ViewMode = ViewMetadata
	}
}

// NavigateToCursor navigates to a specific cursor
func (cm *CursorManager) NavigateToCursor(cursor *Cursor) {
	if cursor != nil {
		cm.Current = cursor
		cm.ViewMode = ViewMetadata
	}
}

// ToggleMulticursor toggles a cursor in the multicursor selection
func (cm *CursorManager) ToggleMulticursor(cursor *Cursor) {
	if cursor == nil {
		return
	}

	// Check if cursor is already selected
	for i, selected := range cm.Selected {
		if selected.ID == cursor.ID {
			// Remove from selection
			cm.Selected = append(cm.Selected[:i], cm.Selected[i+1:]...)
			return
		}
	}

	// Add to selection
	cm.Selected = append(cm.Selected, cursor)
}

// GetCurrentCursors returns the cursors in the current directory
func (cm *CursorManager) GetCurrentCursors() []*Cursor {
	if cm.Current.IsDirectory {
		return cm.Current.Children
	}
	return []*Cursor{}
}

// GetMetadataText returns formatted metadata for display
func (c *Cursor) GetMetadataText() string {
	result := ""
	result += "Filename: " + c.Filename + "\n"
	result += "Path: " + c.Path + "\n"
	result += "Prompt: " + c.Prompt + "\n"
	
	if len(c.Tags) > 0 {
		result += "Tags: "
		for i, tag := range c.Tags {
			if i > 0 {
				result += ", "
			}
			result += tag
		}
		result += "\n"
	}
	
	result += "Created: " + c.Created.Format("2006-01-02 15:04:05") + "\n"
	result += "Modified: " + c.Modified.Format("2006-01-02 15:04:05") + "\n"
	
	if len(c.Metadata) > 0 {
		result += "\nAdditional Metadata:\n"
		for key, value := range c.Metadata {
			result += "  " + key + ": " + value + "\n"
		}
	}
	
	return result
}

// SaveToJSON saves cursor manager state to JSON
func (cm *CursorManager) SaveToJSON() ([]byte, error) {
	return json.MarshalIndent(cm, "", "  ")
}

// LoadFromJSON loads cursor manager state from JSON
func (cm *CursorManager) LoadFromJSON(data []byte) error {
	return json.Unmarshal(data, cm)
}

// generateCursorID generates a unique cursor ID
func generateCursorID() string {
	return time.Now().Format("20060102150405") + "_" + randomString(6)
}

// randomString generates a random string of given length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}