package main

import (
	"fmt"
	"path/filepath"
	"github.com/rivo/tview"
)

type EditorPanel struct {
	*tview.TextArea
	store  *Store
	config PanelConfig
}

func NewEditorPanel(store *Store, config PanelConfig) *EditorPanel {
	p := &EditorPanel{
		TextArea: tview.NewTextArea(),
		store:    store,
		config:   config,
	}
	p.SetBorder(true)
	p.SetChangedFunc(func() {
		store.Dispatch(UpdateEditorContentAction{
			PanelName: p.config.Name,
			Content:   p.GetText(),
		})
	})
	return p
}

// Render syncs the panel's view with the latest state.
func (p *EditorPanel) Render(state State) {
	panelState, ok := state.PanelStates[p.config.Name]
	if !ok {
		return // State not ready yet.
	}

	// Update the text only if it has changed.
	if p.GetText() != panelState.Content {
		p.SetText(panelState.Content, false)
	}

	// Update the title with file and dirty status.
	title := p.config.Name
	if state.CurrentFile != "" {
		title = filepath.Base(state.CurrentFile)
	}
	if panelState.IsDirty {
		title += " *"
	}
	p.SetTitle(fmt.Sprintf(" %s ", title))
}

func (p *EditorPanel) TabLabel(state State) string {
	panelState, ok := state.PanelStates[p.config.Name]
	if !ok {
		return p.config.Name
	}

	if state.CurrentFile == "" {
		return p.config.Name
	}
	label := filepath.Base(state.CurrentFile)
	if panelState.IsDirty {
		label += " *"
	}
	return label
}
