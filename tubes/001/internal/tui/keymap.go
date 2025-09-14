package tui

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
)

// KeyAction represents an action that can be triggered by a key
type KeyAction string

const (
	ActionNone           KeyAction = "none"
	ActionQuit           KeyAction = "quit"
	ActionExecuteCommand KeyAction = "execute_command"
	ActionTabComplete    KeyAction = "tab_complete"
	ActionHistoryPrev    KeyAction = "history_prev"
	ActionHistoryNext    KeyAction = "history_next"
	ActionScrollUp       KeyAction = "scroll_up"
	ActionScrollDown     KeyAction = "scroll_down"
	ActionCopyMode       KeyAction = "copy_mode"
	
	// Obsolete actions kept for compatibility
	ActionCyclePanes     KeyAction = "cycle_panes"
	ActionCycleReverse   KeyAction = "cycle_reverse" 
	ActionNavigateUp     KeyAction = "navigate_up"
	ActionNavigateDown   KeyAction = "navigate_down"
	ActionToggleExpand   KeyAction = "toggle_expand"
	ActionSelectItem     KeyAction = "select_item"
	ActionAddToCursor    KeyAction = "add_to_cursor"
	ActionToggleMode     KeyAction = "toggle_mode"
	ActionMoveLeft       KeyAction = "move_left"
	ActionMoveRight      KeyAction = "move_right"
	ActionEnterCursor    KeyAction = "enter_cursor"
	ActionExitCursor     KeyAction = "exit_cursor"
	ActionToggleMulticursor KeyAction = "toggle_multicursor"
	ActionEnter          KeyAction = "enter"
	ActionOpen           KeyAction = "open"
)

// KeyMapping defines the key bindings for minimal interface
type KeyMapping struct {
	Global      map[tea.KeyType]KeyAction
	InputPanel  map[tea.KeyType]KeyAction
}

// NewKeyMapping creates the minimal key mapping configuration
func NewKeyMapping() *KeyMapping {
	return &KeyMapping{
		Global: map[tea.KeyType]KeyAction{
			tea.KeyCtrlC: ActionQuit,
			tea.KeyUp:    ActionScrollUp,   // Scroll output up
			tea.KeyDown:  ActionScrollDown, // Scroll output down
		},
		InputPanel: map[tea.KeyType]KeyAction{
			tea.KeyEnter: ActionExecuteCommand,
			tea.KeyTab:   ActionTabComplete,
			tea.KeyCtrlP: ActionHistoryPrev, // Ctrl+P for history
			tea.KeyCtrlN: ActionHistoryNext, // Ctrl+N for history
			tea.KeyCtrlY: ActionCopyMode,    // Ctrl+Y for copy mode info
		},
	}
}

// GetActionForMode determines what action should be taken for a key in minimal interface
func (km *KeyMapping) GetActionForMode(keyMsg tea.KeyMsg, currentPane pane, mode inputMode) KeyAction {
	// Global keys first
	if action, exists := km.Global[keyMsg.Type]; exists {
		return action
	}
	
	// Input panel keys
	if action, exists := km.InputPanel[keyMsg.Type]; exists {
		return action
	}
	
	return ActionNone
}

// GetAction - compatibility method
func (km *KeyMapping) GetAction(keyMsg tea.KeyMsg, currentPane pane) KeyAction {
	return km.GetActionForMode(keyMsg, currentPane, textMode)
}

// ShouldPreventDefault checks if the key event should prevent default behavior
func (km *KeyMapping) ShouldPreventDefault(keyMsg tea.KeyMsg, currentPane pane) bool {
	action := km.GetAction(keyMsg, currentPane)
	
	// Only prevent defaults for special actions
	preventDefaults := []KeyAction{
		ActionTabComplete,
		ActionScrollUp,
		ActionScrollDown,
	}
	
	for _, preventAction := range preventDefaults {
		if action == preventAction {
			return true
		}
	}
	
	return false
}

// GetKeyHelp returns help text for minimal interface
func (km *KeyMapping) GetKeyHelp(currentPane pane) string {
	return "Tab: complete | Enter: execute | ↑↓: scroll output | Ctrl-C: quit"
}

// UpdateKeyMapping allows runtime modification of key bindings
func (km *KeyMapping) UpdateKeyMapping(context string, key tea.KeyType, action KeyAction) bool {
	var targetMap map[tea.KeyType]KeyAction
	
	switch context {
	case "global":
		targetMap = km.Global
	case "input":
		targetMap = km.InputPanel
	// Legacy compatibility
	case "left", "right":
		return false // No longer supported in minimal interface
	default:
		return false
	}
	
	if action == ActionNone {
		delete(targetMap, key)
	} else {
		targetMap[key] = action
	}
	
	return true
}

// GetAllMappings returns a formatted summary of key mappings for minimal interface
func (km *KeyMapping) GetAllMappings() []string {
	var lines []string
	
	lines = append(lines, "MINIMAL INTERFACE KEY MAPPINGS")
	lines = append(lines, "")
	
	// Global keys
	lines = append(lines, "Global:")
	lines = append(lines, "  ↑: scroll output up")
	lines = append(lines, "  ↓: scroll output down")
	for key, action := range km.Global {
		if key != tea.KeyUp && key != tea.KeyDown {
			lines = append(lines, fmt.Sprintf("  %s: %s", keyTypeToString(key), string(action)))
		}
	}
	lines = append(lines, "")
	
	// Input keys
	lines = append(lines, "Input:")
	for key, action := range km.InputPanel {
		lines = append(lines, fmt.Sprintf("  %s: %s", keyTypeToString(key), string(action)))
	}
	
	return lines
}

// keyTypeToString converts a tea.KeyType to a human-readable string
func keyTypeToString(keyType tea.KeyType) string {
	switch keyType {
	case tea.KeyEnter:
		return "Enter"
	case tea.KeyTab:
		return "Tab"
	case tea.KeyShiftTab:
		return "Shift-Tab"
	case tea.KeySpace:
		return "Space"
	case tea.KeyCtrlC:
		return "Ctrl-C"
	case tea.KeyCtrlP:
		return "Ctrl-P"
	case tea.KeyCtrlN:
		return "Ctrl-N"
	case tea.KeyCtrlY:
		return "Ctrl-Y"
	case tea.KeyEscape:
		return "Esc"
	case tea.KeyUp:
		return "↑"
	case tea.KeyDown:
		return "↓"
	case tea.KeyLeft:
		return "←"
	case tea.KeyRight:
		return "→"
	case tea.KeyRunes:
		return "Letter"
	default:
		return "Unknown"
	}
}

// Obsolete methods kept for compatibility - these are no-ops in minimal interface

func (km *KeyMapping) IsNavigationKey(keyMsg tea.KeyMsg) bool {
	return false // No navigation in minimal interface
}