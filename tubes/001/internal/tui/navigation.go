package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// NavigationNode represents a node in the collapsible tree structure
type NavigationNode struct {
	Title      string             `json:"title"`
	Type       string             `json:"type"` // "header", "file", "section"
	Level      int                `json:"level"` // 0-2 (3 deep max)
	Path       string             `json:"path,omitempty"`
	Expanded   bool               `json:"expanded"`
	Children   []*NavigationNode  `json:"children,omitempty"`
	Parent     *NavigationNode    `json:"-"` // Don't serialize parent to avoid cycles
}

// NavigationState manages the left panel tree structure
type NavigationState struct {
	Nodes       []*NavigationNode `json:"nodes"`
	Selected    int               `json:"selected"`
	VisibleList []int             `json:"-"` // Flattened view of expanded nodes
}

// NewNavigationState creates a new navigation state
func NewNavigationState() *NavigationState {
	return &NavigationState{
		Nodes:       []*NavigationNode{},
		Selected:    0,
		VisibleList: []int{},
	}
}

// BuildArchitectureTree creates the main architecture navigation tree
func (ns *NavigationState) BuildArchitectureTree(projectRoot, tubesDir, apiPort string) {
	ns.Nodes = []*NavigationNode{
		{
			Title:    "TUBES ARCHITECTURE",
			Type:     "header",
			Level:    0,
			Expanded: true,
			Children: []*NavigationNode{
				{
					Title:    "Redux Pattern",
					Type:     "section",
					Level:    1,
					Expanded: true,
					Children: ns.createDocsNodes(projectRoot, "docs/tea", 2),
				},
				{
					Title:    "HTTP API",
					Type:     "section", 
					Level:    1,
					Expanded: true,
					Children: append(
						ns.createDocsNodes(projectRoot, "docs/api", 2),
						&NavigationNode{
							Title: fmt.Sprintf("localhost:%s/api/list", apiPort),
							Type:  "file",
							Level: 2,
							Path:  fmt.Sprintf("http://localhost:%s/api/list", apiPort),
						},
					),
				},
			},
		},
		{
			Title:    "PROJECT STRUCTURE",
			Type:     "header",
			Level:    0,
			Expanded: true,
			Children: []*NavigationNode{
				{
					Title:    "Source Code",
					Type:     "section",
					Level:    1,
					Expanded: false,
					Children: ns.createSourceNodes(projectRoot, 2),
				},
				{
					Title:    "Documentation",
					Type:     "section",
					Level:    1,
					Expanded: false,
					Children: ns.createAllDocsNodes(projectRoot, 2),
				},
			},
		},
		{
			Title:    "COMMANDS",
			Type:     "header",
			Level:    0,
			Expanded: true,
			Children: []*NavigationNode{
				{Title: "/help", Type: "file", Level: 1, Path: "cmd:help"},
				{Title: "/ui split 0.3", Type: "file", Level: 1, Path: "cmd:ui"},
				{Title: "/open <file>", Type: "file", Level: 1, Path: "cmd:open"},
				{Title: "/mode self", Type: "file", Level: 1, Path: "cmd:mode"},
				{Title: "/quit", Type: "file", Level: 1, Path: "cmd:quit"},
			},
		},
	}
	
	// Set parent relationships
	ns.setParentRelationships()
	
	// Build initial visible list
	ns.rebuildVisibleList()
}

// createDocsNodes creates navigation nodes for documentation files
func (ns *NavigationState) createDocsNodes(projectRoot, docsSubdir string, level int) []*NavigationNode {
	var nodes []*NavigationNode
	docsPath := filepath.Join(projectRoot, docsSubdir)
	
	if entries, err := os.ReadDir(docsPath); err == nil {
		for _, entry := range entries {
			if strings.HasSuffix(entry.Name(), ".md") {
				title := strings.TrimSuffix(entry.Name(), ".md")
				nodes = append(nodes, &NavigationNode{
					Title: title,
					Type:  "file",
					Level: level,
					Path:  filepath.Join(docsSubdir, entry.Name()),
				})
			}
		}
	}
	
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Title < nodes[j].Title
	})
	
	return nodes
}

// createSourceNodes creates navigation nodes for source files
func (ns *NavigationState) createSourceNodes(projectRoot string, level int) []*NavigationNode {
	var nodes []*NavigationNode
	sourcePath := filepath.Join(projectRoot, "internal/tui")
	
	if entries, err := os.ReadDir(sourcePath); err == nil {
		for _, entry := range entries {
			if strings.HasSuffix(entry.Name(), ".go") {
				title := entry.Name()
				nodes = append(nodes, &NavigationNode{
					Title: title,
					Type:  "file",
					Level: level,
					Path:  filepath.Join("internal/tui", entry.Name()),
				})
			}
		}
	}
	
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Title < nodes[j].Title
	})
	
	return nodes
}

// createAllDocsNodes creates nodes for all documentation files
func (ns *NavigationState) createAllDocsNodes(projectRoot string, level int) []*NavigationNode {
	var nodes []*NavigationNode
	docsPath := filepath.Join(projectRoot, "docs")
	
	// Walk through all subdirectories in docs
	filepath.Walk(docsPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		
		if strings.HasSuffix(path, ".md") {
			rel, _ := filepath.Rel(projectRoot, path)
			title := filepath.Base(rel)
			nodes = append(nodes, &NavigationNode{
				Title: title,
				Type:  "file",
				Level: level,
				Path:  rel,
			})
		}
		return nil
	})
	
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Title < nodes[j].Title
	})
	
	return nodes
}

// setParentRelationships establishes parent-child relationships
func (ns *NavigationState) setParentRelationships() {
	var setParent func([]*NavigationNode, *NavigationNode)
	setParent = func(nodes []*NavigationNode, parent *NavigationNode) {
		for _, node := range nodes {
			node.Parent = parent
			if len(node.Children) > 0 {
				setParent(node.Children, node)
			}
		}
	}
	setParent(ns.Nodes, nil)
}

// rebuildVisibleList creates a flattened view of visible (expanded) nodes
func (ns *NavigationState) rebuildVisibleList() {
	ns.VisibleList = []int{}
	
	var addVisible func([]*NavigationNode)
	addVisible = func(nodes []*NavigationNode) {
		for _, node := range nodes {
			// Add node index to visible list
			nodeIndex := ns.getNodeGlobalIndex(node)
			if nodeIndex >= 0 {
				ns.VisibleList = append(ns.VisibleList, nodeIndex)
			}
			
			// If expanded, add children
			if node.Expanded && len(node.Children) > 0 {
				addVisible(node.Children)
			}
		}
	}
	
	addVisible(ns.Nodes)
}

// getNodeGlobalIndex finds the global index of a node in the tree
func (ns *NavigationState) getNodeGlobalIndex(target *NavigationNode) int {
	index := 0
	
	var findNode func([]*NavigationNode) bool
	findNode = func(nodes []*NavigationNode) bool {
		for _, node := range nodes {
			if node == target {
				return true
			}
			index++
			
			if len(node.Children) > 0 {
				if findNode(node.Children) {
					return true
				}
			}
		}
		return false
	}
	
	if findNode(ns.Nodes) {
		return index
	}
	return -1
}

// GetSelectedNode returns the currently selected node
func (ns *NavigationState) GetSelectedNode() *NavigationNode {
	if len(ns.VisibleList) == 0 || ns.Selected < 0 || ns.Selected >= len(ns.VisibleList) {
		return nil
	}
	
	return ns.getNodeByIndex(ns.VisibleList[ns.Selected])
}

// getNodeByIndex returns a node by its global index
func (ns *NavigationState) getNodeByIndex(index int) *NavigationNode {
	current := 0
	
	var findByIndex func([]*NavigationNode) *NavigationNode
	findByIndex = func(nodes []*NavigationNode) *NavigationNode {
		for _, node := range nodes {
			if current == index {
				return node
			}
			current++
			
			if len(node.Children) > 0 {
				if result := findByIndex(node.Children); result != nil {
					return result
				}
			}
		}
		return nil
	}
	
	return findByIndex(ns.Nodes)
}

// MoveUp moves selection up in the visible list
func (ns *NavigationState) MoveUp() {
	if ns.Selected > 0 {
		ns.Selected--
	}
}

// MoveDown moves selection down in the visible list  
func (ns *NavigationState) MoveDown() {
	if ns.Selected < len(ns.VisibleList)-1 {
		ns.Selected++
	}
}

// ToggleExpand toggles the expansion state of the selected node
func (ns *NavigationState) ToggleExpand() *NavigationNode {
	node := ns.GetSelectedNode()
	if node != nil && (node.Type == "header" || node.Type == "section") {
		node.Expanded = !node.Expanded
		ns.rebuildVisibleList()
		
		// Adjust selection if it's now out of bounds
		if ns.Selected >= len(ns.VisibleList) {
			ns.Selected = len(ns.VisibleList) - 1
		}
		if ns.Selected < 0 {
			ns.Selected = 0
		}
	}
	return node
}

// RenderLines returns the lines to display in the left panel
func (ns *NavigationState) RenderLines(maxWidth int) []string {
	var lines []string
	
	for selectionIndex, nodeIndex := range ns.VisibleList {
		node := ns.getNodeByIndex(nodeIndex)
		if node == nil {
			continue
		}
		
		// Create indentation
		indent := strings.Repeat("  ", node.Level)
		
		// Clean prefix - no symbols
		prefix := ""
		
		// Format the line
		line := indent + prefix + node.Title
		
		// Add selection indicator with prominent cursor
		if selectionIndex == ns.Selected {
			line = "→ " + line // More prominent arrow
		} else {
			line = "  " + line
		}
		
		// Truncate if too long
		if len(line) > maxWidth-1 {
			line = line[:maxWidth-2] + "…"
		}
		
		lines = append(lines, line)
	}
	
	return lines
}

// GetSelectedPath returns the path of the currently selected item
func (ns *NavigationState) GetSelectedPath() string {
	node := ns.GetSelectedNode()
	if node != nil {
		return node.Path
	}
	return ""
}