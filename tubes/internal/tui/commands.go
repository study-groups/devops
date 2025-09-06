package tui

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (m *Model) loadCommands() {
	m.commands = map[string]Command{
		"/help": {
			Name: "/help", Description: "Show commands.",
			Executor: func(mm *Model, _ []string) (string, error) {
				return strings.TrimSpace(`
/help
/mode [self|tasks]
/open <relative-or-absolute-path>
/resize col [+|-]<pct> | band <header|cli|status|footer> [+|-]<n>
/run <llm-ask|llm-apply|compile|test|llm-commit|llm-reset> [args]
/clear
/api
`), nil
			},
		},
		"/mode": {
			Name: "/mode [self|tasks]", Description: "Switch working mode.",
			Executor: func(mm *Model, args []string) (string, error) {
				if len(args) != 1 {
					return "", errors.New("usage: /mode [self|tasks]")
				}
				switch args[0] {
				case "self":
					mm.curMode = modeSelf
				case "tasks":
					mm.curMode = modeTasks
				default:
					return "", fmt.Errorf("unknown mode: %s", args[0])
				}
				mm.selectedPath = ""
				mm.reloadLeft()
				return fmt.Sprintf("Mode set to %s", args[0]), nil
			},
		},
		"/open": {
			Name: "/open <path>", Description: "Open path in right column.",
			Executor: func(mm *Model, args []string) (string, error) {
				if len(args) < 1 {
					return "", errors.New("usage: /open <path>")
				}
				p := strings.Join(args, " ")
				if !filepath.IsAbs(p) {
					if mm.curMode == modeSelf {
						p = filepath.Join(mm.projectRoot, p)
					} else {
						if mm.tubesDir == "" {
							return "", errors.New("TUBES_DIR not set")
						}
						p = filepath.Join(mm.tubesDir, p)
					}
				}
				info, err := os.Stat(p)
				if err != nil {
					return "", err
				}
				if info.IsDir() {
					mm.selectedPath = p
					return "Opened directory (no right view)", nil
				}
				mm.selectedPath = p
				mm.renderRight(p)
				return fmt.Sprintf("Opened %s", p), nil
			},
		},
		"/resize": {
			Name: "/resize ...", Description: "Resize columns or bands.",
			Executor: func(mm *Model, args []string) (string, error) {
				if len(args) < 2 {
					return "", errors.New("usage: /resize col [+|-]pct  |  /resize band <header|cli|status|footer> [+|-]n")
				}
				switch args[0] {
				case "col":
					arg := args[1]
					sign := 1.0
					if strings.HasPrefix(arg, "-") {
						sign = -1.0
						arg = strings.TrimPrefix(arg, "-")
					} else if strings.HasPrefix(arg, "+") {
						arg = strings.TrimPrefix(arg, "+")
					}
					var pct float64
					fmt.Sscanf(arg, "%f", &pct)
					mm.adjustColRatio(sign * (pct / 100.0))
					return fmt.Sprintf("col1 ratio=%.2f", mm.col1Ratio), nil
				case "band":
					if len(args) < 3 {
						return "", errors.New("usage: /resize band <header|cli|status|footer> [+|-]n")
					}
					which := args[1]
					arg := args[2]
					sign := 1
					if strings.HasPrefix(arg, "-") {
						sign = -1
						arg = strings.TrimPrefix(arg, "-")
					} else if strings.HasPrefix(arg, "+") {
						arg = strings.TrimPrefix(arg, "+")
					}
					var n int
					fmt.Sscanf(arg, "%d", &n)
					mm.adjustBand(which, sign*n)
					return fmt.Sprintf("%s height=%d", which, bandValue(mm, which)), nil
				default:
					return "", errors.New("unknown /resize target")
				}
			},
		},
		"/run": {
			Name: "/run <action>", Description: "Run flow-type action (go).",
			Executor: func(mm *Model, args []string) (string, error) {
				if len(args) < 1 {
					return "", errors.New("usage: /run <llm-ask|llm-apply|compile|test|llm-commit|llm-reset> [args]")
				}
				action := args[0]
				switch action {
				case "compile":
					res := mm.compileFromProject()
					mm.lastCompile = res
					return "compile: " + res, nil
				case "test":
					return "test: " + mm.lastCompile, nil
				case "llm-ask":
					return "llm-ask: queued", nil
				case "llm-apply":
					return "llm-apply: applied", nil
				case "llm-commit":
					return "llm-commit: done", nil
				case "llm-reset":
					return "llm-reset: done", nil
				default:
					return "", fmt.Errorf("unknown action: %s", action)
				}
			},
		},
		"/clear": {
			Name: "/clear", Description: "Clear left log (tree reload).",
			Executor: func(mm *Model, _ []string) (string, error) {
				mm.reloadLeft()
				return "cleared", nil
			},
		},
		"/api": {
			Name: "/api", Description: "List HTTP API endpoints.",
			Executor: func(_ *Model, _ []string) (string, error) {
				return "/api/list, /fzf/api, POST /log", nil
			},
		},
	}
}

func bandValue(m *Model, which string) int {
	switch which {
	case "header":
		return m.headerH
	case "cli":
		return m.cliH
	case "status":
		return m.statusH
	case "footer":
		return m.footerH
	}
	return 0
}

func (m *Model) updateSuggestions() {
	input := m.repl.Value()
	m.suggestions = []string{}
	if !strings.HasPrefix(input, "/") || strings.Contains(input, " ") {
		return
	}
	for name := range m.commands {
		if strings.HasPrefix(name, input) {
			m.suggestions = append(m.suggestions, name)
		}
	}
}

func (m *Model) applySuggestion() {
	if len(m.suggestions) > 0 {
		m.repl.SetValue(m.suggestions[0] + " ")
		m.repl.SetCursor(len(m.repl.Value()))
		m.updateSuggestions()
	}
}

func (m *Model) compileFromProject() string {
	cfg := filepath.Join(m.projectRoot, "project.tubes")
	data, err := os.ReadFile(cfg)
	if err != nil {
		return "project.tubes not found"
	}
	// very light parse: look for "compile:" line
	lines := strings.Split(string(data), "\n")
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if strings.HasPrefix(ln, "compile:") {
			cmd := strings.TrimSpace(strings.TrimPrefix(ln, "compile:"))
			return "would run: " + cmd
		}
	}
	return "no compile directive"
}
