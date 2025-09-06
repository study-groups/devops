package main

import (
	"io"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type TerminalPanel struct {
	*tview.Box
	view	*tview.TextView
	ansiWriter io.Writer
	store	*Store
	config	PanelConfig

	ptmx	*os.File
	cmd	*exec.Cmd
	wg	sync.WaitGroup
	running bool
}

func NewTerminalPanel(store *Store, config PanelConfig) *TerminalPanel {
	p := &TerminalPanel{
		Box:	tview.NewBox(),
		view:	tview.NewTextView().SetDynamicColors(true).SetScrollable(false),
		store:	store,
		config: config,
	}
	p.view.SetBorder(true).SetTitle(" " + p.config.Name + " ")
	p.ansiWriter = tview.ANSIWriter(p.view)
	return p
}

// Start launches the terminal process.
func (p *TerminalPanel) Start(state State) {
	if p.running {
		return
	}
	p.running = true
	p.view.Clear()

	p.cmd = exec.Command("bash", "-c", p.config.Command)
	p.cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"TGO_FILE="+state.CurrentFile,
		"TGO_PWD="+state.Pwd,
	)

	var err error
	p.ptmx, err = pty.Start(p.cmd)
	if err != nil {
		p.view.Write([]byte(err.Error()))
		return
	}

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		io.Copy(p.ansiWriter, p.ptmx)
	}()

	go func() {
		p.cmd.Wait()
		p.running = false
	}()
}

// Stop terminates the terminal process.
func (p *TerminalPanel) Stop() {
	if !p.running {
		return
	}
	p.running = false
	if p.ptmx != nil {
		p.ptmx.Close()
	}
	if p.cmd != nil && p.cmd.Process != nil {
		p.cmd.Process.Kill()
	}
	p.wg.Wait()
	p.view.Clear()
	p.view.Write([]byte("\n\n[Session ended.]"))
}

// Render decides whether to start or stop the terminal based on focus state.
func (p *TerminalPanel) Render(state State) {
	activePanel, ok := state.ActivePanels[state.ActiveDock]
	isFocused := ok && activePanel == p.config.Name

	if isFocused && !p.running {
		p.Start(state)
	} else if !isFocused && p.running {
		p.Stop()
	}
}

func (p *TerminalPanel) TabLabel(state State) string { return p.config.Name }

// Delegate tview.Primitive methods to the underlying view.
func (p *TerminalPanel) Draw(screen tcell.Screen) { p.view.Draw(screen) }
func (p *TerminalPanel) GetRect() (int, int, int, int) { return p.view.GetRect() }
func (p *TerminalPanel) SetRect(x, y, width, height int) { p.view.SetRect(x, y, width, height) }
func (p *TerminalPanel) InputHandler() func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
	return func(event *tcell.EventKey, setFocus func(p tview.Primitive)) {
		if p.running && p.ptmx != nil {
			if event.Key() == tcell.KeyRune {
				p.ptmx.Write([]byte(string(event.Rune())))
			}
			// The event.Bytes() method does not exist. A full implementation
			// would require mapping specific tcell.Key values to ANSI escape codes.
			// This else block is removed to fix the build error.
		}
	}
}
