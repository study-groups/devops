package main

import (
	"os"
	"path/filepath"

	"github.com/rivo/tview"
)

type FileTreePanel struct {
	*tview.TreeView
	store  *Store
	config PanelConfig
}

func NewFileTreePanel(store *Store, config PanelConfig) *FileTreePanel {
	state := store.GetState()
	rootNode := tview.NewTreeNode(filepath.Base(state.Pwd)).SetReference(state.Pwd)

	p := &FileTreePanel{
		TreeView: tview.NewTreeView().SetRoot(rootNode).SetCurrentNode(rootNode),
		store:    store,
		config:   config,
	}

	p.SetBorder(true).SetTitle(" " + p.config.Name + " ")
	p.populateNode(rootNode)

	p.SetSelectedFunc(func(node *tview.TreeNode) {
		ref := node.GetReference().(string)
		fi, err := os.Stat(ref)
		if err != nil {
			return
		}
		if fi.IsDir() {
			if len(node.GetChildren()) == 0 {
				p.populateNode(node)
			}
			node.SetExpanded(!node.IsExpanded())
		} else {
			// Dispatch an action instead of calling a core method.
			store.Dispatch(FileSelectedAction{Path: ref})
		}
	})
	return p
}

func (p *FileTreePanel) populateNode(node *tview.TreeNode) {
	path := node.GetReference().(string)
	entries, _ := os.ReadDir(path)
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() {
			name += "/"
		}
		child := tview.NewTreeNode(name).SetReference(filepath.Join(path, entry.Name()))
		node.AddChild(child)
	}
}

// Render for FileTreePanel is a no-op as its state is managed internally for now.
func (p *FileTreePanel) Render(state State) {}

func (p *FileTreePanel) TabLabel(state State) string { return p.config.Name }
