package main

import "github.com/rivo/tview"

type TextViewPanel struct {
	*tview.TextView
	store  *Store
	config PanelConfig
}

func NewTextViewPanel(store *Store, config PanelConfig) *TextViewPanel {
	p := &TextViewPanel{
		TextView: tview.NewTextView().SetDynamicColors(true).SetScrollable(true),
		store:    store,
		config:   config,
	}
	p.SetBorder(true).SetTitle(" " + config.Name + " ")
	return p
}

// Render syncs the panel's view with the latest state.
func (p *TextViewPanel) Render(state State) {
	panelState, ok := state.PanelStates[p.config.Name]
	if !ok {
		return // State not ready yet.
	}

	// Re-run the command only when the focused file changes.
	// We check if the content is already what we expect.
	// This is a simple way to avoid re-running commands on every refresh.
	activePanel, activeOK := state.ActivePanels[state.ActiveDock]
	isFocused := activeOK && activePanel == p.config.Name

	if isFocused && !panelState.IsContentUpToDate {
		p.SetText("Executing command...")
		p.store.Dispatch(ExecuteCommandAction{
			PanelName: p.config.Name,
			Command:   p.config.Command,
		})
	}

	if p.GetText(false) != panelState.Content {
		p.SetText(panelState.Content)
		p.ScrollToBeginning()
	}
}

func (p *TextViewPanel) TabLabel(state State) string { return p.config.Name }
