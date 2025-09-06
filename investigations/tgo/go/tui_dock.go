package main

import (
	"fmt"

	"github.com/rivo/tview"
)

type DockView struct {
	*tview.Flex
	store  *Store
	dockID DockID
	tabBar *tview.TextView
	pages  *tview.Pages
	panels map[string]Panel // Map of panel names to panels
}

func NewDockView(store *Store, dockID DockID, configs []PanelConfig) *DockView {
	dv := &DockView{
		Flex:   tview.NewFlex(),
		store:  store,
		dockID: dockID,
		tabBar: tview.NewTextView().SetDynamicColors(true),
		pages:  tview.NewPages(),
		panels: make(map[string]Panel),
	}

	for _, config := range configs {
		var p Panel
		switch config.Kind {
		case "fileTree":
			p = NewFileTreePanel(store, config)
		case "editor":
			p = NewEditorPanel(store, config)
		case "vim":
			p = NewVimPanel(store, config)
		case "textView":
			p = NewTextViewPanel(store, config)
		case "terminal":
			p = NewTerminalPanel(store, config)
		}
		if p != nil {
			dv.panels[config.Name] = p
			dv.pages.AddPage(config.Name, p, true, false)
		}
	}

	dv.SetDirection(tview.FlexRow).
		AddItem(dv.tabBar, 1, 0, false).
		AddItem(dv.pages, 0, 1, true)

	return dv
}

func (d *DockView) Render(state State) {
	activePanelName, ok := state.ActivePanels[d.dockID]
	if !ok {
		return // This dock might not have any panels.
	}

	// Render the tab bar.
	text := ""
	for name, p := range d.panels {
		label := p.TabLabel(state)
		if name == activePanelName {
			text += fmt.Sprintf("[::b][ %s ][::-] ", label)
		} else {
			text += fmt.Sprintf("[#808080::d][ %s ][-:-:-] ", label)
		}
	}
	d.tabBar.SetText(text)

	// Switch to the active page.
	if current, _ := d.pages.GetFrontPage(); current != activePanelName {
		d.pages.SwitchToPage(activePanelName)
	}

	// Render the active panel.
	if activePanel, ok := d.panels[activePanelName]; ok {
		activePanel.Render(state)
	}
}
