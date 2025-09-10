# Tubes v002 Design Document

## Executive Summary

Tubes v002 introduces a lane-based architecture that brings deterministic layout, improved multicursor management, and cursor mode navigation. This design addresses the UI control and styling issues while maintaining the proven Command/Tea/API pattern from v001.

## Core Design Principles

### 1. Lane-Based Layout System
**Lanes are the fundamental UI organizing principle**:
- Lane 0: Multicursor lists and navigation (stacks from bottom, expands upward)
- Lane 1: Content display and cursor mode views
- Lane 2: Input and command interface
- Lanes managed by deterministic grid system with Px/Fr units

### 2. Cursor Mode Architecture
**Two primary interaction modes**:
- **Navigation Mode**: Browse multicursor lists, file trees, command history
- **Cursor Mode**: Enter specific cursors for content viewing/editing

### 3. Bottom-Up Layout
**Lane 0 stacking behavior**:
- Elements appear at bottom of lane
- New elements push existing ones upward
- Mimics terminal/chat interface patterns
- Prevents content jumping during updates

## System Architecture

### Layout Engine (`internal/layout/`)

```go
// Core layout types (existing Grid system)
type LaneSpec struct {
    Width    Unit      // Px or Fr
    Min, Max int       // Bounds
    Anchor   AnchorDir // Top, Bottom, Left, Right
}

type TubesLayout struct {
    Lanes []LaneSpec
    Bands []BandSpec // Header, Status, Input, Footer
    Grid  *Grid      // Deterministic layout calculator
}

// Lane 0 specific bottom-up stacking
type StackingPane struct {
    Items    []StackItem
    MaxItems int
    Anchor   AnchorDir // Bottom for Lane 0
}
```

### Command Handler (`internal/tui/commands.go`)

```go
// Tea-integrated command system
type CommandContext struct {
    Model   *Model
    Args    []string
    Mode    InteractionMode
    Cursor  *Cursor // Current cursor context
}

type Command struct {
    Name        string
    Description string
    Executor    func(ctx CommandContext) tea.Cmd // Returns Tea command
    Validator   func(args []string) error
    Complete    func(prefix string) []string
}

// Async command execution pattern
func (cmd Command) Execute(ctx CommandContext) tea.Cmd {
    return func() tea.Msg {
        result, err := cmd.Executor(ctx)
        return CommandResultMsg{
            Command: cmd.Name,
            Result:  result,
            Error:   err,
        }
    }
}
```

### Multicursor System (`internal/tui/multicursor.go`)

```go
// Enhanced multicursor with lane-based display
type MultiCursorManager struct {
    Lists    map[string]*CursorList // Named cursor lists
    Active   string                 // Current active list
    Selected []string              // Multi-selected cursors
    Display  *StackingPane         // Lane 0 display management
}

type CursorList struct {
    Name     string
    Cursors  []*Cursor
    Filter   string    // Current filter/search
    Sort     SortMode  // Name, Modified, Created
    Expanded bool      // Show/hide in Lane 0
}

// Bottom-up stacking for Lane 0
func (mcm *MultiCursorManager) UpdateDisplay() {
    mcm.Display.Clear()
    
    // Add items from bottom up
    for _, list := range mcm.GetVisibleLists() {
        for i := len(list.Cursors) - 1; i >= 0; i-- {
            mcm.Display.AddItem(CursorDisplayItem{
                Cursor: list.Cursors[i],
                List:   list.Name,
                Index:  i,
            })
        }
    }
}
```

### Tea Integration (`internal/tui/model.go`)

```go
// Main application model with lane-based state
type Model struct {
    // Layout management
    Layout    *TubesLayout
    Lanes     map[int]*LaneState
    Bands     map[string]*BandState
    
    // Core systems
    Commands  *CommandManager
    Cursors   *MultiCursorManager
    API       *api.Server
    
    // Interaction state
    Mode         InteractionMode // Navigation, Cursor, Command
    ActiveLane   int
    ActiveCursor *Cursor
    
    // Tea state
    Program      *tea.Program
    WindowSize   tea.WindowSizeMsg
}

// Tea update method with lane-aware handling
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        return m.handleResize(msg)
    case tea.KeyMsg:
        return m.handleKeypress(msg)
    case CommandResultMsg:
        return m.handleCommandResult(msg)
    case CursorUpdateMsg:
        return m.handleCursorUpdate(msg)
    }
    return m, nil
}

func (m Model) handleKeypress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    switch m.Mode {
    case NavigationMode:
        return m.handleNavigationKeys(msg)
    case CursorMode:
        return m.handleCursorKeys(msg)
    case CommandMode:
        return m.handleCommandKeys(msg)
    }
    return m, nil
}
```

## Lane Specifications

### Lane 0: Multicursor Navigation
- **Width**: 25% of screen (Fr unit with min 20, max 40 characters)
- **Content**: Multicursor lists, file trees, command history
- **Behavior**: Bottom-up stacking, expandable sections
- **Interaction**: Arrow keys, enter to select, tab to toggle

### Lane 1: Content Display
- **Width**: Remaining space after Lane 0
- **Content**: File content, cursor metadata, command output
- **Modes**: 
  - Navigation: Shows cursor metadata/preview
  - Cursor: Shows full file content with syntax highlighting
- **Interaction**: Scroll, search, cursor movement

### Lane 2: Input & Status
- **Height**: 3 lines (input + status + feedback)
- **Content**: Command input, status line, feedback messages
- **Behavior**: Command autocomplete, real-time validation

## Interaction Modes

### Navigation Mode
- **Lane 0**: Active for browsing multicursor lists
- **Lane 1**: Shows previews and metadata
- **Commands**: `/mode`, `/list`, `/filter`, `/sort`
- **Keys**: Arrow keys, Enter (select), Tab (expand/collapse)

### Cursor Mode  
- **Lane 0**: Shows cursor context and related items
- **Lane 1**: Full cursor content (file editing, metadata)
- **Commands**: `/save`, `/edit`, `/tag`, `/note`
- **Keys**: Standard editing keys, Esc (back to navigation)

### Command Mode
- **Focus**: Input line with autocomplete
- **Lane 0**: Shows command history
- **Lane 1**: Shows command documentation
- **Keys**: Tab (complete), Enter (execute), Esc (cancel)

## API Integration

### Unified Command Interface
```go
// HTTP endpoints mirror TUI commands exactly
type APIServer struct {
    Commands *CommandManager // Shared with TUI
    WebSocket *WSHandler     // Real-time updates
}

// WebSocket events for live UI mirroring
type WSEvent struct {
    Type    string      `json:"type"`    // cursor_update, layout_change, command_result
    Data    interface{} `json:"data"`
    Target  string      `json:"target"`  // lane0, lane1, input
}
```

### Streaming Command Results
```go
// Commands can stream results via WebSocket
func (cmd *CompileCommand) Execute(ctx CommandContext) tea.Cmd {
    return func() tea.Msg {
        // Stream compile progress via WebSocket
        for line := range compileOutput {
            ctx.API.Broadcast(WSEvent{
                Type: "command_output",
                Data: map[string]string{"line": line},
                Target: "lane1",
            })
        }
        return CommandCompleteMsg{Command: "compile"}
    }
}
```

## Theme System Integration

### Lane-Aware Theming
```go
type ThemeSpec struct {
    Lanes map[int]LaneTheme `yaml:"lanes"`
    Bands map[string]BandTheme `yaml:"bands"`
}

type LaneTheme struct {
    Background    string `yaml:"bg"`
    Border        string `yaml:"border"`
    ActiveBorder  string `yaml:"active_border"`
    Text          string `yaml:"text"`
    SelectedText  string `yaml:"selected_text"`
}

// Fix for "too yellow" - neutral default theme
var DefaultTheme = ThemeSpec{
    Lanes: map[int]LaneTheme{
        0: {
            Background:   "#1e1e1e",
            Border:       "#444444", 
            ActiveBorder: "#666666",  // Subtle, not yellow
            Text:         "#e0e0e0",
            SelectedText: "#ffffff",
        },
    },
}
```

## File Structure

```
internal/
├── layout/
│   ├── grid.go           # Existing deterministic grid
│   ├── lanes.go          # Lane-specific layout logic
│   └── stacking.go       # Bottom-up stacking for Lane 0
├── tui/
│   ├── model.go          # Main Tea model with lane integration
│   ├── view.go           # Lane-aware rendering
│   ├── commands.go       # Tea-integrated command system
│   ├── multicursor.go    # Enhanced multicursor management
│   ├── navigation.go     # Navigation mode handling
│   ├── cursor_mode.go    # Cursor mode handling
│   └── interactions.go   # Key/mouse handling per mode
├── api/
│   ├── server.go         # HTTP/WebSocket server
│   ├── websocket.go      # Real-time event streaming
│   └── commands.go       # Shared command interface
└── theme/
    ├── theme.go          # Enhanced theme system
    ├── lanes.go          # Lane-specific theming
    └── defaults.go       # Default themes (non-yellow!)
```

## Migration Strategy

### Phase 1: Layout Foundation
1. Implement lane-based layout system
2. Create deterministic grid with Lane 0 bottom-up stacking
3. Update theme system for lane-aware styling

### Phase 2: Command Integration  
1. Enhance command system with Tea integration
2. Implement async command execution pattern
3. Add WebSocket streaming for command results

### Phase 3: Multicursor Enhancement
1. Implement bottom-up stacking display
2. Add multicursor list management
3. Create navigation/cursor mode switching

### Phase 4: Polish & Testing
1. Comprehensive theming system
2. Performance optimization
3. API parity testing

## Benefits of v002 Design

1. **Deterministic Layout**: Grid system eliminates UI jitter and positioning issues
2. **Lane Separation**: Clear visual and logical separation of concerns
3. **Bottom-Up UX**: Lane 0 stacking feels natural and prevents content jumping
4. **Tea Integration**: Proper async command handling keeps UI responsive
5. **API Parity**: WebSocket streaming enables rich external integrations
6. **Theme Control**: Lane-aware theming fixes styling issues
7. **Multicursor Power**: Enhanced cursor management with visual stacking

This design maintains the proven Command/Tea/API architecture while addressing the core UI control and styling issues through lane-based organization and deterministic layout management.