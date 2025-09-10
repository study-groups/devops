package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"tubes/internal/theme"

	tea "github.com/charmbracelet/bubbletea"
)

// registerCommands sets up all available commands
func (m *Model) registerCommands() {
	m.Commands = map[string]Command{
		"help": {
			Name:        "help",
			Description: "Show available commands",
			Execute:     m.cmdHelp,
		},
		"mode": {
			Name:        "mode",
			Description: "Switch mode (self|tasks)",
			Execute:     m.cmdMode,
		},
		"theme": {
			Name:        "theme",
			Description: "Theme management (list|use|preview)",
			Execute:     m.cmdTheme,
		},
		"open": {
			Name:        "open",
			Description: "Open file in main panel",
			Execute:     m.cmdOpen,
		},
		"clear": {
			Name:        "clear",
			Description: "Clear and reload panels",
			Execute:     m.cmdClear,
		},
		"quit": {
			Name:        "quit",
			Description: "Exit application",
			Execute:     m.cmdQuit,
		},
	}
}

// Command implementations

func (m *Model) cmdHelp(args []string) tea.Cmd {
	var lines []string
	lines = append(lines, "Available commands:")
	lines = append(lines, "")
	
	for name, cmd := range m.Commands {
		lines = append(lines, fmt.Sprintf("/%s - %s", name, cmd.Description))
	}
	
	lines = append(lines, "")
	lines = append(lines, "Keyboard shortcuts:")
	lines = append(lines, "  Tab    - Switch between modes")
	lines = append(lines, "  Ctrl+C - Quit")
	lines = append(lines, "  Esc    - Quit")
	
	content := strings.Join(lines, "\n")
	m.Main.SetContent(content)
	
	return func() tea.Msg {
		return statusMsg("Help displayed")
	}
}

func (m *Model) cmdMode(args []string) tea.Cmd {
	if len(args) == 0 {
		return func() tea.Msg {
			return statusMsg(fmt.Sprintf("Current mode: %s (use /mode self|tasks)", m.Mode))
		}
	}
	
	switch args[0] {
	case "self", "tasks":
		m.Mode = args[0]
		return tea.Batch(
			m.refreshSidebar(),
			func() tea.Msg {
				return statusMsg(fmt.Sprintf("Switched to %s mode", m.Mode))
			},
		)
	default:
		return func() tea.Msg {
			return errorMsg("Invalid mode. Use 'self' or 'tasks'")
		}
	}
}

func (m *Model) cmdTheme(args []string) tea.Cmd {
	if len(args) == 0 {
		return func() tea.Msg {
			return statusMsg("Usage: /theme list|use NAME|preview")
		}
	}
	
	switch args[0] {
	case "list":
		return m.cmdThemeList()
		
	case "use":
		if len(args) < 2 {
			return func() tea.Msg {
				return errorMsg("Usage: /theme use NAME")
			}
		}
		return m.cmdThemeUse(args[1])
		
	case "preview":
		return m.cmdThemePreview()
		
	default:
		return func() tea.Msg {
			return errorMsg("Unknown theme command. Use list|use|preview")
		}
	}
}

func (m *Model) cmdThemeList() tea.Cmd {
	return func() tea.Msg {
		names, err := theme.List()
		if err != nil {
			return errorMsg(fmt.Sprintf("Failed to list themes: %v", err))
		}
		
		var lines []string
		lines = append(lines, "Available themes:")
		lines = append(lines, "")
		
		current, _ := theme.GetCurrent()
		for _, name := range names {
			marker := "  "
			if name == current {
				marker = "→ "
			}
			lines = append(lines, marker+name)
		}
		
		content := strings.Join(lines, "\n")
		return sidebarContentMsg(content)
	}
}

func (m *Model) cmdThemeUse(name string) tea.Cmd {
	return func() tea.Msg {
		// Load the theme
		t, err := theme.Load(name)
		if err != nil {
			return errorMsg(fmt.Sprintf("Failed to load theme %q: %v", name, err))
		}
		
		// Compile styles
		styles, err := theme.Compile(t)
		if err != nil {
			return errorMsg(fmt.Sprintf("Failed to compile theme %q: %v", name, err))
		}
		
		// Update model
		m.Theme = t
		m.Styles = styles
		
		// Set as current
		_ = theme.SetCurrent(name)
		
		return statusMsg(fmt.Sprintf("Switched to theme: %s", name))
	}
}

func (m *Model) cmdThemePreview() tea.Cmd {
	return func() tea.Msg {
		if m.Styles == nil {
			return errorMsg("No theme loaded")
		}
		
		preview := theme.DetailedPreview(m.Styles)
		return sidebarContentMsg(preview)
	}
}

func (m *Model) cmdOpen(args []string) tea.Cmd {
	if len(args) == 0 {
		return func() tea.Msg {
			return errorMsg("Usage: /open <file>")
		}
	}
	
	filename := args[0]
	return func() tea.Msg {
		content, err := os.ReadFile(filename)
		if err != nil {
			return errorMsg(fmt.Sprintf("Failed to read %q: %v", filename, err))
		}
		
		m.CurrentFile = filename
		m.Main.SetContent(string(content))
		
		return statusMsg(fmt.Sprintf("Opened: %s", filename))
	}
}

func (m *Model) cmdClear(args []string) tea.Cmd {
	return tea.Batch(
		m.refreshSidebar(),
		func() tea.Msg {
			m.Main.SetContent("")
			m.Status.SetContent("")
			return statusMsg("Cleared")
		},
	)
}

func (m *Model) cmdQuit(args []string) tea.Cmd {
	return tea.Quit
}

// generateSidebarContent creates content based on current mode
func (m *Model) generateSidebarContent() string {
	switch m.Mode {
	case "self":
		return m.generateProjectTree()
	case "tasks":
		return m.generateTaskList()
	default:
		return "Unknown mode: " + m.Mode
	}
}

func (m *Model) generateProjectTree() string {
	var lines []string
	lines = append(lines, "Project Files:")
	lines = append(lines, "")
	
	// Walk current directory
	root, _ := os.Getwd()
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // Skip errors
		}
		
		// Skip hidden files and directories
		if strings.HasPrefix(d.Name(), ".") {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		
		// Skip common build/cache directories
		skipDirs := []string{"node_modules", "target", "build", "dist", ".git"}
		for _, skip := range skipDirs {
			if d.IsDir() && d.Name() == skip {
				return filepath.SkipDir
			}
		}
		
		// Calculate relative path
		relPath, _ := filepath.Rel(root, path)
		if relPath == "." {
			return nil
		}
		
		// Create tree structure
		depth := strings.Count(relPath, string(filepath.Separator))
		indent := strings.Repeat("  ", depth)
		
		if d.IsDir() {
			lines = append(lines, indent+"📁 "+d.Name()+"/")
		} else {
			lines = append(lines, indent+"📄 "+d.Name())
		}
		
		return nil
	})
	
	if err != nil {
		lines = append(lines, "Error reading directory: "+err.Error())
	}
	
	return strings.Join(lines, "\n")
}

func (m *Model) generateTaskList() string {
	var lines []string
	lines = append(lines, "Task Management:")
	lines = append(lines, "")
	lines = append(lines, "📋 Active Tasks")
	lines = append(lines, "  • No tasks yet")
	lines = append(lines, "")
	lines = append(lines, "🔧 Available Actions")
	lines = append(lines, "  • /task new")
	lines = append(lines, "  • /task list")
	lines = append(lines, "  • /task switch")
	lines = append(lines, "")
	lines = append(lines, "💡 Quick Start")
	lines = append(lines, "  Use /help for commands")
	
	return strings.Join(lines, "\n")
}

// Handle sidebar content updates
func (m *Model) handleSidebarContent(msg sidebarContentMsg) {
	m.Sidebar.SetContent(string(msg))
}