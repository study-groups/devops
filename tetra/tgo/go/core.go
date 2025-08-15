package main

import (
	"fmt"
	"log"
	"os"
	"sync"
)

// FileEntry represents a single item in the file tree.
type FileEntry struct {
	Name  string
	Path  string
	IsDir bool
}

// Core holds the application's state and business logic.
type Core struct {
	mu        sync.Mutex
	pwd       string
	listeners []func()

	// State fields are grouped to emphasize they are protected by the mutex.
	state struct {
		selectedPath  string
		editorContent string
		isDirty       bool
	}
}

// NewCore creates a new instance of the core service.
func NewCore(pwd string) *Core {
	c := &Core{
		pwd:       pwd,
		listeners: make([]func(), 0),
	}
	c.state.editorContent = "// Select a file to begin\n"
	return c
}

// --- Public Methods (API) ---

// Subscribe allows a component to be notified of state changes.
func (c *Core) Subscribe(listener func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.listeners = append(c.listeners, listener)
}

// ListFiles provides directory contents for the TUI file tree.
// This is a read-only OS operation and doesn't touch core state, so no lock is needed.
func (c *Core) ListFiles(path string) ([]FileEntry, error) {
	if path == "" {
		path = c.pwd
	}
	ents, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var entries []FileEntry
	for _, e := range ents {
		entries = append(entries, FileEntry{
			Name:  e.Name(),
			Path:  fmt.Sprintf("%s/%s", path, e.Name()),
			IsDir: e.IsDir(),
		})
	}
	return entries, nil
}

// SelectPath updates the state to reflect the currently selected path (file or dir).
func (c *Core) SelectPath(path string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state.selectedPath = path
}

// LoadFile reads a file's content, updates state, and notifies listeners.
func (c *Core) LoadFile(path string) {
	st, err := os.Stat(path)
	if err != nil || st.IsDir() {
		return
	}
	data, err := os.ReadFile(path)

	c.mu.Lock()
	if err != nil {
		c.state.editorContent = fmt.Sprintf("// open error: %v\n", err)
	} else {
		c.state.editorContent = string(data)
	}
	c.state.selectedPath = path
	c.state.isDirty = false
	c.mu.Unlock()

	c.notify()
}

// SaveFile writes the editor content and notifies listeners.
func (c *Core) SaveFile() {
	c.mu.Lock()
	path := c.state.selectedPath
	content := c.state.editorContent
	c.mu.Unlock()

	if path == "" {
		return
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		log.Printf("Error saving file %s: %v", path, err)
		return
	}

	c.mu.Lock()
	c.state.isDirty = false
	c.mu.Unlock()

	c.notify()
}

// SetEditorContent is called frequently by the TUI on text changes.
func (c *Core) SetEditorContent(text string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state.editorContent = text
	if !c.state.isDirty {
		c.state.isDirty = true
	}
}

// --- State Accessors ---

// CurrentState returns a snapshot of the core state for the UI to render.
func (c *Core) CurrentState() (path, content string, isDirty bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.state.selectedPath, c.state.editorContent, c.state.isDirty
}

// --- Internal Methods ---

// notify safely calls all registered listeners.
func (c *Core) notify() {
	c.mu.Lock()
	listenersCopy := make([]func(), len(c.listeners))
	copy(listenersCopy, c.listeners)
	c.mu.Unlock()

	for _, listener := range listenersCopy {
		listener()
	}
}

