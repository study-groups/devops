package codeintel

import (
	"fmt"
	"path/filepath"
	"time"
)

// Cursor represents a semantic selection of code (SpaCy-style)
type Cursor struct {
	ID        string                 `json:"id"`
	FilePath  string                 `json:"file_path"`
	DirName   string                 `json:"dir_name"`
	StartLine int                    `json:"start_line"`
	EndLine   int                    `json:"end_line"`
	StartChar int                    `json:"start_char"`
	EndChar   int                    `json:"end_char"`
	Content   string                 `json:"content"`   // cached content snippet
	Metadata  map[string]interface{} `json:"metadata"`  // AST node types, symbols, etc.
	Tags      []string               `json:"tags"`      // user-defined tags
	Prompt    string                 `json:"prompt"`    // default prompt for this cursor
	Created   time.Time              `json:"created"`
	Updated   time.Time              `json:"updated"`
}

// MultiCursor represents a collection of related cursors
type MultiCursor struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Cursors     []Cursor  `json:"cursors"`
	Expanded    bool      `json:"expanded"`
	Tags        []string  `json:"tags"`
	DefaultPrompt string  `json:"default_prompt"`
	Created     time.Time `json:"created"`
	Updated     time.Time `json:"updated"`
}

// CursorDirectory manages collections of multicursors (directory of directories)
type CursorDirectory struct {
	MultiCursors map[string]*MultiCursor `json:"multi_cursors"`
	CurrentMC    string                  `json:"current_mc"`    // currently selected multicursor
	CurrentC     string                  `json:"current_c"`     // currently selected cursor within MC
	NextID       int                     `json:"next_id"`       // for generating unique IDs
}

// NewCursorDirectory creates a new cursor directory
func NewCursorDirectory() *CursorDirectory {
	return &CursorDirectory{
		MultiCursors: make(map[string]*MultiCursor),
		NextID:       1,
	}
}

// NewCursor creates a new cursor with the given parameters
func (cd *CursorDirectory) NewCursor(filePath string, startLine, endLine int, content string) *Cursor {
	id := fmt.Sprintf("cursor_%d", cd.NextID)
	cd.NextID++
	
	return &Cursor{
		ID:        id,
		FilePath:  filePath,
		DirName:   filepath.Dir(filePath),
		StartLine: startLine,
		EndLine:   endLine,
		Content:   content,
		Metadata:  make(map[string]interface{}),
		Tags:      []string{},
		Prompt:    "Analyze this code section:",
		Created:   time.Now(),
		Updated:   time.Now(),
	}
}

// NewMultiCursor creates a new multicursor collection
func (cd *CursorDirectory) NewMultiCursor(title, description string) *MultiCursor {
	id := fmt.Sprintf("mc_%d", cd.NextID)
	cd.NextID++
	
	mc := &MultiCursor{
		ID:            id,
		Title:         title,
		Description:   description,
		Cursors:       []Cursor{},
		Expanded:      false,
		Tags:          []string{},
		DefaultPrompt: "Analyze this code collection:",
		Created:       time.Now(),
		Updated:       time.Now(),
	}
	
	cd.MultiCursors[id] = mc
	return mc
}

// AddCursorToMC adds a cursor to the specified multicursor
func (cd *CursorDirectory) AddCursorToMC(mcID string, cursor *Cursor) error {
	mc, exists := cd.MultiCursors[mcID]
	if !exists {
		return fmt.Errorf("multicursor %s not found", mcID)
	}
	
	mc.Cursors = append(mc.Cursors, *cursor)
	mc.Updated = time.Now()
	return nil
}

// GetCurrentMultiCursor returns the currently selected multicursor
func (cd *CursorDirectory) GetCurrentMultiCursor() *MultiCursor {
	if cd.CurrentMC == "" {
		return nil
	}
	return cd.MultiCursors[cd.CurrentMC]
}

// GetCurrentCursor returns the currently selected cursor
func (cd *CursorDirectory) GetCurrentCursor() *Cursor {
	mc := cd.GetCurrentMultiCursor()
	if mc == nil || cd.CurrentC == "" {
		return nil
	}
	
	for i := range mc.Cursors {
		if mc.Cursors[i].ID == cd.CurrentC {
			return &mc.Cursors[i]
		}
	}
	return nil
}

// SetCurrentSelection updates the current selection
func (cd *CursorDirectory) SetCurrentSelection(mcID, cursorID string) {
	cd.CurrentMC = mcID
	cd.CurrentC = cursorID
}

// ToggleExpanded toggles the expanded state of a multicursor
func (cd *CursorDirectory) ToggleExpanded(mcID string) error {
	mc, exists := cd.MultiCursors[mcID]
	if !exists {
		return fmt.Errorf("multicursor %s not found", mcID)
	}
	
	mc.Expanded = !mc.Expanded
	mc.Updated = time.Now()
	return nil
}

// GetVisibleItems returns a flat list of visible items for navigation
func (cd *CursorDirectory) GetVisibleItems() []NavigationItem {
	var items []NavigationItem
	
	for mcID, mc := range cd.MultiCursors {
		// Add the multicursor header
		items = append(items, NavigationItem{
			Type:     "multicursor",
			ID:       mcID,
			Title:    mc.Title,
			Expanded: mc.Expanded,
			Level:    0,
		})
		
		// Add cursors if expanded
		if mc.Expanded {
			for _, cursor := range mc.Cursors {
				items = append(items, NavigationItem{
					Type:     "cursor",
					ID:       cursor.ID,
					Title:    fmt.Sprintf("%s:%d-%d", filepath.Base(cursor.FilePath), cursor.StartLine, cursor.EndLine),
					Expanded: false,
					Level:    1,
				})
			}
		}
	}
	
	return items
}

// NavigationItem represents an item in the navigation list
type NavigationItem struct {
	Type     string `json:"type"`     // "multicursor" or "cursor"
	ID       string `json:"id"`
	Title    string `json:"title"`
	Expanded bool   `json:"expanded"`
	Level    int    `json:"level"`    // indentation level
}

// BuildLLMContext builds context from the current selection
func (cd *CursorDirectory) BuildLLMContext() string {
	mc := cd.GetCurrentMultiCursor()
	if mc == nil {
		return "No multicursor selected"
	}
	
	context := fmt.Sprintf("# %s\n\n%s\n\n", mc.Title, mc.Description)
	
	for _, cursor := range mc.Cursors {
		context += fmt.Sprintf("## %s (%d-%d)\n\n", 
			filepath.Base(cursor.FilePath), cursor.StartLine, cursor.EndLine)
		context += fmt.Sprintf("```\n%s\n```\n\n", cursor.Content)
	}
	
	return context
}

// GetMetadataDisplay returns formatted metadata for the right pane
func (c *Cursor) GetMetadataDisplay() string {
	display := fmt.Sprintf("File: %s\n", filepath.Base(c.FilePath))
	display += fmt.Sprintf("Path: %s\n", c.DirName)
	display += fmt.Sprintf("Lines: %d-%d\n", c.StartLine, c.EndLine)
	display += fmt.Sprintf("Prompt: %s\n\n", c.Prompt)
	
	if len(c.Tags) > 0 {
		display += "Tags: "
		for i, tag := range c.Tags {
			if i > 0 {
				display += ", "
			}
			display += tag
		}
		display += "\n"
	}
	
	if len(c.Metadata) > 0 {
		display += "\nMetadata:\n"
		for key, value := range c.Metadata {
			display += fmt.Sprintf("  %s: %v\n", key, value)
		}
	}
	
	return display
}