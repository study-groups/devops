package main

import (
	"fmt"
	"path/filepath"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// Panel is a generic interface for all our panel types.
type Panel interface {
	tview.Primitive
	Render(state State)
	TabLabel(state State) string
}

type TUI struct {
	app   *tview.Application
	store *Store

	root	*tview.Pages
	status  *tview.TextView
	leftDock  *DockView
	rightDock *DockView
}

func NewTUI(app *tview.Application, store *Store, config *Config) *TUI {
	store.InitializePanelStates(config)

	var leftConfigs, rightConfigs []PanelConfig
	for _, p := range config.Panels {
		if p.Dock == "left" {
			leftConfigs = append(leftConfigs, p)
		} else {
			rightConfigs = append(rightConfigs, p)
		}
	}

	tui := &TUI{
		app:   app,
		store: store,
	}

	tui.status = tview.NewTextView().SetDynamicColors(true)
	tui.leftDock = NewDockView(store, DockLeft, leftConfigs)
	tui.rightDock = NewDockView(store, DockRight, rightConfigs)

	body := tview.NewFlex().
		AddItem(tui.leftDock, 0, 1, true).
		AddItem(tui.rightDock, 0, 1, false)

	mainLayout := tview.NewFlex().SetDirection(tview.FlexRow).
		AddItem(tui.status, 1, 0, false).
		AddItem(body, 0, 1, true)

	tui.root = tview.NewPages().AddPage("main", mainLayout, true, true)
	tui.setKeybinds()
	return tui
}

// Subscribe starts the main render loop.
func (t *TUI) Subscribe() {
	go func() {
		for range t.store.Events() {
			t.app.QueueUpdateDraw(func() {
				t.Render()
			})
		}
	}()
}

// Render is the master render function, called whenever the state changes.
func (t *TUI) Render() {
	state := t.store.GetState()

	// Render each dock, which in turn renders its panels.
	t.leftDock.Render(state)
	t.rightDock.Render(state)

	// Set focus based on the active dock.
	if state.ActiveDock == DockLeft {
		t.app.SetFocus(t.leftDock)
	} else {
		t.app.SetFocus(t.rightDock)
	}

	// Render the status bar.
	fileName := "(none)"
	if state.CurrentFile != "" {
		fileName = filepath.Base(state.CurrentFile)
	}
	statusText := fmt.Sprintf(" ActiveDock: %s | File: %s", state.ActiveDock, fileName)
	t.status.SetText(statusText)
}

func (t *TUI) GetRoot() tview.Primitive {
	return t.root
}

func (t *TUI) setKeybinds() {
	t.app.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		// Global quit.
		if ev.Key() == tcell.KeyCtrlC {
			// Cleanly stop any running terminal panels before quitting.
			for _, p := range t.leftDock.panels {
				if stoppable, ok := p.(interface{ Stop() }); ok {
					stoppable.Stop()
				}
			}
			for _, p := range t.rightDock.panels {
				if stoppable, ok := p.(interface{ Stop() }); ok {
					stoppable.Stop()
				}
			}
			t.app.Stop()
			return nil
		}

		// Dispatch actions based on key press.
		switch ev.Key() {
		// Switch focus between docks.
		case tcell.KeyTab, tcell.KeyEsc:
			t.store.Dispatch(SwitchDockAction{})
			return nil
		// Cycle to the next tab in the current dock.
		case tcell.KeyCtrlN:
			t.store.Dispatch(CycleTabAction{Delta: 1})
			return nil
		// Cycle to the previous tab in the current dock (Shift+Tab).
		case tcell.KeyBacktab, tcell.KeyCtrlP:
			t.store.Dispatch(CycleTabAction{Delta: -1})
			return nil
		// Save the current file.
		case tcell.KeyCtrlS:
			t.store.Dispatch(SaveFileAction{})
			return nil
		}
		return ev
	})
}
