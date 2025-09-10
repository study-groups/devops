package tui

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// CursorSpan represents a selected range of text with optional metadata
type CursorSpan struct {
	StartLine int    `json:"startLine"`
	StartChar int    `json:"startChar"`
	EndLine   int    `json:"endLine"`
	EndChar   int    `json:"endChar"`
	Tag       string `json:"tag,omitempty"`       // Optional tag for categorization
	Note      string `json:"note,omitempty"`      // Optional note/description
}

// FileSnapshot represents all cursor selections in a single file
type FileSnapshot struct {
	Path     string       `json:"path"`
	Ranges   []CursorSpan `json:"ranges"`
	Modified time.Time    `json:"modified"`
}

// MultiCursor manages multiple cursor positions across files
type MultiCursor struct {
	Snapshots map[string]FileSnapshot `json:"snapshots"`
	Active    []string                `json:"active"`    // Currently active snapshot names
	Current   string                  `json:"current"`   // Currently selected snapshot
}

// NewMultiCursor creates a new multi-cursor system
func NewMultiCursor() *MultiCursor {
	return &MultiCursor{
		Snapshots: make(map[string]FileSnapshot),
		Active:    []string{},
		Current:   "",
	}
}

// AddSnapshot creates or updates a snapshot with the given name
func (mc *MultiCursor) AddSnapshot(name, filePath string, ranges []CursorSpan) {
	snapshot := FileSnapshot{
		Path:     filePath,
		Ranges:   ranges,
		Modified: time.Now(),
	}
	
	mc.Snapshots[name] = snapshot
	
	// Add to active list if not already present
	if !mc.contains(mc.Active, name) {
		mc.Active = append(mc.Active, name)
	}
	
	mc.Current = name
}

// GetSnapshot retrieves a snapshot by name
func (mc *MultiCursor) GetSnapshot(name string) (FileSnapshot, bool) {
	snapshot, exists := mc.Snapshots[name]
	return snapshot, exists
}

// GetCurrentSnapshot returns the currently active snapshot
func (mc *MultiCursor) GetCurrentSnapshot() (FileSnapshot, bool) {
	if mc.Current == "" {
		return FileSnapshot{}, false
	}
	return mc.GetSnapshot(mc.Current)
}

// RemoveSnapshot removes a snapshot by name
func (mc *MultiCursor) RemoveSnapshot(name string) bool {
	if _, exists := mc.Snapshots[name]; !exists {
		return false
	}
	
	delete(mc.Snapshots, name)
	
	// Remove from active list
	mc.Active = mc.removeFromSlice(mc.Active, name)
	
	// Update current if it was the removed snapshot
	if mc.Current == name {
		if len(mc.Active) > 0 {
			mc.Current = mc.Active[0]
		} else {
			mc.Current = ""
		}
	}
	
	return true
}

// ListSnapshots returns all available snapshot names
func (mc *MultiCursor) ListSnapshots() []string {
	names := make([]string, 0, len(mc.Snapshots))
	for name := range mc.Snapshots {
		names = append(names, name)
	}
	return names
}

// SetActive sets the currently active snapshot
func (mc *MultiCursor) SetActive(name string) bool {
	if _, exists := mc.Snapshots[name]; !exists {
		return false
	}
	
	mc.Current = name
	
	// Ensure it's in the active list
	if !mc.contains(mc.Active, name) {
		mc.Active = append(mc.Active, name)
	}
	
	return true
}

// SaveToFile persists the multi-cursor state to a JSON file
func (mc *MultiCursor) SaveToFile(filePath string) error {
	data, err := json.MarshalIndent(mc, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal multi-cursor data: %w", err)
	}
	
	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}
	
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", filePath, err)
	}
	
	return nil
}

// LoadFromFile loads multi-cursor state from a JSON file
func (mc *MultiCursor) LoadFromFile(filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, start with empty state
			return nil
		}
		return fmt.Errorf("failed to read file %s: %w", filePath, err)
	}
	
	var loaded MultiCursor
	if err := json.Unmarshal(data, &loaded); err != nil {
		return fmt.Errorf("failed to unmarshal multi-cursor data: %w", err)
	}
	
	// Copy loaded data to current instance
	mc.Snapshots = loaded.Snapshots
	mc.Active = loaded.Active
	mc.Current = loaded.Current
	
	// Initialize maps if nil
	if mc.Snapshots == nil {
		mc.Snapshots = make(map[string]FileSnapshot)
	}
	if mc.Active == nil {
		mc.Active = []string{}
	}
	
	return nil
}

// AddRange adds a cursor range to the current snapshot
func (mc *MultiCursor) AddRange(startLine, startChar, endLine, endChar int, tag, note string) error {
	if mc.Current == "" {
		return fmt.Errorf("no active snapshot")
	}
	
	snapshot, exists := mc.Snapshots[mc.Current]
	if !exists {
		return fmt.Errorf("snapshot %s not found", mc.Current)
	}
	
	newRange := CursorSpan{
		StartLine: startLine,
		StartChar: startChar,
		EndLine:   endLine,
		EndChar:   endChar,
		Tag:       tag,
		Note:      note,
	}
	
	snapshot.Ranges = append(snapshot.Ranges, newRange)
	snapshot.Modified = time.Now()
	mc.Snapshots[mc.Current] = snapshot
	
	return nil
}

// RemoveRange removes a cursor range by index from the current snapshot
func (mc *MultiCursor) RemoveRange(index int) error {
	if mc.Current == "" {
		return fmt.Errorf("no active snapshot")
	}
	
	snapshot, exists := mc.Snapshots[mc.Current]
	if !exists {
		return fmt.Errorf("snapshot %s not found", mc.Current)
	}
	
	if index < 0 || index >= len(snapshot.Ranges) {
		return fmt.Errorf("range index %d out of bounds", index)
	}
	
	// Remove range at index
	snapshot.Ranges = append(snapshot.Ranges[:index], snapshot.Ranges[index+1:]...)
	snapshot.Modified = time.Now()
	mc.Snapshots[mc.Current] = snapshot
	
	return nil
}

// GetRangesForFile returns all cursor ranges for a specific file path
func (mc *MultiCursor) GetRangesForFile(filePath string) []CursorSpan {
	var ranges []CursorSpan
	
	for _, snapshot := range mc.Snapshots {
		if snapshot.Path == filePath {
			ranges = append(ranges, snapshot.Ranges...)
		}
	}
	
	return ranges
}

// GetStatus returns a status summary of the multi-cursor system
func (mc *MultiCursor) GetStatus() string {
	if len(mc.Snapshots) == 0 {
		return "No snapshots"
	}
	
	totalRanges := 0
	for _, snapshot := range mc.Snapshots {
		totalRanges += len(snapshot.Ranges)
	}
	
	status := fmt.Sprintf("%d snapshots, %d total ranges", len(mc.Snapshots), totalRanges)
	
	if mc.Current != "" {
		if snapshot, exists := mc.Snapshots[mc.Current]; exists {
			status += fmt.Sprintf(" | Current: %s (%d ranges)", mc.Current, len(snapshot.Ranges))
		}
	}
	
	return status
}

// FormatSnapshotSummary returns a formatted summary of all snapshots
func (mc *MultiCursor) FormatSnapshotSummary() []string {
	var lines []string
	
	if len(mc.Snapshots) == 0 {
		return []string{"No snapshots available"}
	}
	
	lines = append(lines, "MULTI-CURSOR SNAPSHOTS")
	lines = append(lines, "")
	
	for name, snapshot := range mc.Snapshots {
		indicator := "  "
		if name == mc.Current {
			indicator = "> "
		}
		
		line := fmt.Sprintf("%s%s (%s) - %d ranges", 
			indicator, name, filepath.Base(snapshot.Path), len(snapshot.Ranges))
		lines = append(lines, line)
		
		// Show first few ranges as preview
		for i, r := range snapshot.Ranges {
			if i >= 3 { // Limit preview to first 3 ranges
				if len(snapshot.Ranges) > 3 {
					lines = append(lines, fmt.Sprintf("    ... and %d more", len(snapshot.Ranges)-3))
				}
				break
			}
			
			rangeStr := fmt.Sprintf("    %d:%d-%d:%d", r.StartLine, r.StartChar, r.EndLine, r.EndChar)
			if r.Tag != "" {
				rangeStr += fmt.Sprintf(" [%s]", r.Tag)
			}
			if r.Note != "" {
				rangeStr += fmt.Sprintf(" \"%s\"", r.Note)
			}
			lines = append(lines, rangeStr)
		}
		lines = append(lines, "")
	}
	
	return lines
}

// Utility functions

func (mc *MultiCursor) contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func (mc *MultiCursor) removeFromSlice(slice []string, item string) []string {
	var result []string
	for _, s := range slice {
		if s != item {
			result = append(result, s)
		}
	}
	return result
}