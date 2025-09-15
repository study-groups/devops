package main

import (
	"image"
	"log"
	"os"

	"gioui.org/app"
	"gioui.org/font/gofont"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/text"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
)

type Model struct {
	LeftText   string
	RightText  string
	Split      float32 // 0..1, fraction for left pane width
	dragging   bool
	dragStartX float32
}

func main() {
	go func() {
		w := new(app.Window)
		w.Option(app.Title("fzgrep-viewer"), app.Size(unit.Dp(1400), unit.Dp(800)))
		if err := loop(w); err != nil {
			log.Fatal(err)
		}
		os.Exit(0)
	}()
	app.Main()
}

func loop(w *app.Window) error {
	th := material.NewTheme()
	th.Shaper = text.NewShaper(text.NoSystemFonts(), text.WithCollection(gofont.Collection()))

	var ops op.Ops
	m := &Model{
		LeftText:  "left pane\n…fzgrep results here…",
		RightText: "right pane\n…file preview content…",
		Split:     0.38,
	}
	var leftList, rightList widget.List
	leftList.Axis = layout.Vertical
	rightList.Axis = layout.Vertical

	for {
		switch e := w.Event().(type) {
		case app.DestroyEvent:
			return e.Err
		case app.FrameEvent:
			gtx := app.NewContext(&ops, e)
			layout.Flex{Axis: layout.Horizontal}.Layout(gtx,
				layout.Rigid(func(gtx layout.Context) layout.Dimensions {
					// Left pane width = Split * window width
					w := int(float32(gtx.Constraints.Max.X) * m.Split)
					gtx.Constraints.Max.X = w
					gtx.Constraints.Min.X = w
					return pane(gtx, th, &leftList, m.LeftText, unit.Sp(12)) // small font
				}),
				layout.Rigid(func(gtx layout.Context) layout.Dimensions {
					// Splitter handle (draggable)
					const handle = 6
					gtx.Constraints.Min.X, gtx.Constraints.Max.X = handle, handle
					return layout.Dimensions{Size: image.Pt(handle, gtx.Constraints.Max.Y)}
				}),
				layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
					return pane(gtx, th, &rightList, m.RightText, unit.Sp(16)) // larger font
				}),
			)
			e.Frame(gtx.Ops)
		}
	}
	return nil
}

func pane(gtx layout.Context, th *material.Theme, list *widget.List, text string, size unit.Sp) layout.Dimensions {
	return material.List(th, list).Layout(gtx, 1, func(gtx layout.Context, _ int) layout.Dimensions {
		inset := layout.UniformInset(unit.Dp(8))
		return inset.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			lbl := material.Label(th, size, text)
			lbl.MaxLines = 0
			d := lbl.Layout(gtx)
			// Ensure we always consume space to enable scrolling
			if d.Size.Y < gtx.Constraints.Max.Y {
				d.Size = image.Pt(d.Size.X, gtx.Constraints.Max.Y)
			}
			return d
		})
	})
}
