package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type focus int

const (
	focusTree focus = iota
	focusEdit
)

// TUI holds all the UI components and state.
type TUI struct {
	app    *tview.Application
	core   *Core
	root   *tview.Flex
	tree   *tview.TreeView
	editor *tview.TextArea
	status *tview.TextView
	focus  focus
	mode   string // "NAV" or "INS"
}

// NewTUI creates and initializes all UI components.
func NewTUI(app *tview.Application, core *Core) *TUI {
	tui := &TUI{
		app:   app,
		core:  core,
		focus: focusEdit,
		mode:  "NAV",
	}

	// Status Bar
	tui.status = tview.NewTextView().SetDynamicColors(true).SetTextAlign(tview.AlignLeft)
	tui.status.SetBackgroundColor(tview.Styles.PrimitiveBackgroundColor)

	// File Tree
	rootNode := tview.NewTreeNode(filepath.Base(core.pwd)).SetReference(core.pwd)
	tui.tree = tview.NewTreeView().SetRoot(rootNode).SetCurrentNode(rootNode)
	// FIX: The SetGraphics() call must be on the TreeView object, not chained after SetTitle().
	tui.tree.SetBorder(true).SetTitle(" Files ")
	tui.tree.SetGraphics(true)
	tui.populateNode(rootNode)

	tui.tree.SetSelectedFunc(tui.onTreeSelect)

	// Editor
	tui.editor = tview.NewTextArea()
	tui.editor.SetBorder(true).SetTitle(" Editor ")
	tui.editor.SetChangedFunc(func() {
		tui.core.SetEditorContent(tui.editor.GetText())
		tui.UpdateStatus()
	})

	// Layout
	body := tview.NewFlex().AddItem(tui.tree, 30, 0, true).AddItem(tui.editor, 0, 1, false)
	tui.root = tview.NewFlex().SetDirection(tview.FlexRow).AddItem(tui.status, 1, 0, false).AddItem(body, 0, 1, true)

	core.Subscribe(tui.refresh)
	tui.refresh() // Initial render

	return tui
}

// refresh is called when the core state changes.
func (t *TUI) refresh() {
	_, content, _ := t.core.CurrentState()
	if t.editor.GetText() != content {
		t.editor.SetText(content, false)
	}
	t.UpdateStatus()
}

// UpdateStatus redraws the status bar based on the current core state.
func (t *TUI) UpdateStatus() {
	path, _, isDirty := t.core.CurrentState()

	focusStr := map[focus]string{focusTree: "tree", focusEdit: "editor"}[t.focus]
	dirtyStr := ""
	if isDirty {
		dirtyStr = " *"
	}
	if path == "" {
		path = "(none)"
	}
	statusText := fmt.Sprintf(
		" Selected: %s  |  Mode: %s  |  Focus: %s%s  |  (Tab: Switch, Ctrl-S: Save, q: Quit)",
		path, t.mode, focusStr, dirtyStr)
	t.status.SetText(statusText)
}

// onTreeSelect handles user selection in the file tree.
func (t *TUI) onTreeSelect(node *tview.TreeNode) {
	ref, _ := node.GetReference().(string)
	if ref == "" {
		return
	}

	// Always update the core's concept of the selected path.
	t.core.SelectPath(ref)

	st, err := os.Stat(ref)
	if err != nil {
		return
	}

	if st.IsDir() {
		if !node.IsExpanded() && len(node.GetChildren()) == 0 {
			t.populateNode(node)
		}
		node.SetExpanded(!node.IsExpanded())
	} else {
		t.core.LoadFile(ref) // LoadFile also updates the selected path internally.
		t.focus = focusEdit
		t.setFocus()
	}
	t.UpdateStatus() // Update status after any selection.
}

// populateNode asks the core for file entries and adds them to the tree.
func (t *TUI) populateNode(node *tview.TreeNode) {
	ref, _ := node.GetReference().(string)
	entries, err := t.core.ListFiles(ref) // This now calls the correct method.
	if err != nil {
		return
	}
	for _, entry := range entries {
		name := entry.Name
		if entry.IsDir {
			name += "/"
		}
		child := tview.NewTreeNode(name).SetReference(entry.Path)
		node.AddChild(child)
	}
}

func (t *TUI) setFocus() {
	if t.focus == focusTree {
		t.app.SetFocus(t.tree)
	} else {
		t.app.SetFocus(t.editor)
	}
}

func (t *TUI) GetRoot() *tview.Flex {
	return t.root
}

func (t *TUI) SetKeybinds() {
	t.app.SetInputCapture(func(ev *tcell.EventKey) *tcell.EventKey {
		if ev.Key() == tcell.KeyCtrlC || ev.Rune() == 'q' {
			t.app.Stop()
			return nil
		}
		if ev.Key() == tcell.KeyTab {
			if t.focus == focusTree {
				t.focus = focusEdit
			} else {
				t.focus = focusTree
			}
			t.setFocus()
			t.UpdateStatus()
			return nil
		}
		if t.focus == focusEdit {
			switch ev.Key() {
			case tcell.KeyEsc:
				t.mode = "NAV"
				t.UpdateStatus()
				return nil
			case tcell.KeyCtrlS:
				t.core.SaveFile()
				return nil
			}
			if ev.Rune() == 'i' && t.mode == "NAV" {
				t.mode = "INS"
				t.UpdateStatus()
				return nil
			}
			if t.mode == "NAV" {
				return nil
			}
		}
		return ev
	})
}
