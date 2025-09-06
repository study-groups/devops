package main

import (
	"fmt"
	"os"
	"sync"
)

// ===== State =====

type DockID int

const (
	DockLeft DockID = iota
	DockRight
)

func (d DockID) String() string {
	if d == DockLeft {
		return "Left"
	}
	return "Right"
}

// The single source of truth for the application.
type State struct {
	Pwd	string
	ActiveDock  DockID
	CurrentFile string
	// Map of panel names to their individual states.
	PanelStates map[string]PanelState
	// Map of dock IDs to the name of the active panel in that dock.
	ActivePanels map[DockID]string
	// Ordered lists of panel names for each dock to allow cycling.
	LeftDockPanels  []string
	RightDockPanels []string
}

// PanelState holds the state for a single panel.
type PanelState struct {
	Content	   string
	IsDirty	   bool
	IsContentUpToDate bool // Flag for TextViewPanel to avoid re-running commands
}

// ===== Actions =====
// Describe state changes. They are the only way to mutate state.
type Action interface{}

type SwitchDockAction struct{}
type CycleTabAction struct{ Delta int }
type FileSelectedAction struct{ Path string }
type SaveFileAction struct{}
type UpdateEditorContentAction struct {
	PanelName string
	Content   string
}
type ExecuteCommandAction struct {
	PanelName string
	Command   string
}
type CommandOutputAction struct {
	PanelName string
	Output	string
}

// ===== Reducer =====
// A pure function that returns a new state based on the previous state and an action.
func Reducer(state State, action Action) State {
	newState := state // Start with a copy

	switch a := action.(type) {
	case SwitchDockAction:
		newState.ActiveDock = 1 - state.ActiveDock

	case CycleTabAction:
		var dockPanels []string
		if state.ActiveDock == DockLeft {
			dockPanels = state.LeftDockPanels
		} else {
			dockPanels = state.RightDockPanels
		}

		if len(dockPanels) > 1 {
			currentPanel := state.ActivePanels[state.ActiveDock]
			currentIndex := -1
			for i, name := range dockPanels {
				if name == currentPanel {
					currentIndex = i
					break
				}
			}

			if currentIndex != -1 {
				// Use modulo arithmetic to wrap around the slice.
				// Adding len(dockPanels) handles negative delta correctly.
				newIndex := (currentIndex + a.Delta + len(dockPanels)) % len(dockPanels)
				newState.ActivePanels[state.ActiveDock] = dockPanels[newIndex]
			}
		}

	case FileSelectedAction:
		data, err := os.ReadFile(a.Path)
		if err == nil {
			newState.CurrentFile = a.Path
			// When a new file is selected, all panels need to be updated.
			newState.PanelStates = make(map[string]PanelState) // Reset states
			for name := range state.PanelStates {
				newState.PanelStates[name] = PanelState{
					Content:	   string(data),
					IsDirty:	   false,
					IsContentUpToDate: false, // Mark as needing update
				}
			}
		}

	case UpdateEditorContentAction:
		if ps, ok := newState.PanelStates[a.PanelName]; ok {
			if ps.Content != a.Content {
				ps.Content = a.Content
				ps.IsDirty = true
				newState.PanelStates[a.PanelName] = ps
			}
		}

	case CommandOutputAction:
		if ps, ok := newState.PanelStates[a.PanelName]; ok {
			ps.Content = a.Output
			ps.IsContentUpToDate = true
			newState.PanelStates[a.PanelName] = ps
		}
	}
	return newState
}

// ===== Store =====
// Holds the state, applies the reducer, and notifies subscribers.
type Store struct {
	mu	  sync.Mutex
	state	 State
	reducer	 func(state State, action Action) State
	middlewares []Middleware
	events	  chan struct{}
}

func NewStore(pwd string) *Store {
	return &Store{
		state: State{
			Pwd:	   pwd,
			ActiveDock:  DockLeft,
			PanelStates: make(map[string]PanelState),
			ActivePanels: make(map[DockID]string),
		},
		reducer: Reducer,
		events:  make(chan struct{}, 1),
	}
}

// InitializePanelStates sets up the initial state for all panels from the config.
func (s *Store) InitializePanelStates(config *Config) {
	s.mu.Lock()
	defer s.mu.Unlock()

	activeDocks := make(map[DockID]bool)
	s.state.LeftDockPanels = []string{}
	s.state.RightDockPanels = []string{}

	for _, p := range config.Panels {
		s.state.PanelStates[p.Name] = PanelState{
			Content: fmt.Sprintf("// Welcome to %s", p.Name),
		}

		dockID := DockRight
		if p.Dock == "left" {
			dockID = DockLeft
			s.state.LeftDockPanels = append(s.state.LeftDockPanels, p.Name)
		} else {
			s.state.RightDockPanels = append(s.state.RightDockPanels, p.Name)
		}

		// Set the first panel encountered for each dock as the active one.
		if _, ok := activeDocks[dockID]; !ok {
			s.state.ActivePanels[dockID] = p.Name
			activeDocks[dockID] = true
		}
	}
}

func (s *Store) AddMiddleware(mw Middleware) {
	s.middlewares = append(s.middlewares, mw)
}

func (s *Store) Dispatch(action Action) {
	// Chain the middlewares.
	// The final 'next' function is the core dispatch logic.
	finalDispatch := func(act Action) {
		s.mu.Lock()
		defer s.mu.Unlock()

		if act != nil {
			s.state = s.reducer(s.state, act)
		}

		// Notify subscribers (the UI) that the state has changed.
		select {
		case s.events <- struct{}{}:
		default:
		}
	}

	// Wrap the final dispatch in all the middlewares.
	chainedDispatch := finalDispatch
	for i := len(s.middlewares) - 1; i >= 0; i-- {
		chainedDispatch = s.middlewares[i](s)(chainedDispatch)
	}
	chainedDispatch(action)
}

func (s *Store) GetState() State {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state
}

func (s *Store) Events() <-chan struct{} {
	return s.events
}
