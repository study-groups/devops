package main

import (
	"fmt"
	"path/filepath"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type VimPanel struct {
	*tview.TextArea
	store  *Store
	config PanelConfig
	mode   string // "normal" or "insert"
}

func NewVimPanel(store *Store, config PanelConfig) *VimPanel {
	p := &VimPanel{
		TextArea: tview.NewTextArea(),
		store:    store,
		config:   config,
		mode:     "normal",
	}
	p.SetBorder(true)
	p.SetInputCapture(p.handleInput)
	p.SetChangedFunc(func() {
		store.Dispatch(UpdateEditorContentAction{
			PanelName: p.config.Name,
			Content:   p.GetText(),
		})
	})
	return p
}

func (p *VimPanel) handleInput(event *tcell.EventKey) *tcell.EventKey {
	if p.mode == "normal" {
		if event.Rune() == 'i' {
			p.mode = "insert"
			p.store.Dispatch(nil) // Trigger a rerender for the title change
			return nil
		}
		// In normal mode, we don't pass most keys to the textarea.
		// A real implementation would handle vim commands here.
		return nil
	}

	// In insert mode
	if event.Key() == tcell.KeyEsc {
		p.mode = "normal"
		p.store.Dispatch(nil) // Trigger a rerender for the title change
		return nil
	}

	return event // Pass the event to the textarea's default handler
}

func (p *VimPanel) Render(state State) {
	panelState, ok := state.PanelStates[p.config.Name]
	if !ok {
		return
	}

	if p.GetText() != panelState.Content {
		p.SetText(panelState.Content, false)
	}

	modeStr := "[N]"
	if p.mode == "insert" {
		modeStr = "[I]"
	}
	title := p.config.Name
	if state.CurrentFile != "" {
		title = filepath.Base(state.CurrentFile)
	}
	if panelState.IsDirty {
		title += " *"
	}
	p.SetTitle(fmt.Sprintf(" %s %s ", title, modeStr))
}

func (p *VimPanel) TabLabel(state State) string {
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
