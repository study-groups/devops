package layout

import "math"

type UnitKind int

const (
	Px UnitKind = iota // absolute cells
	Fr                 // fractional share of remaining space
)

type Unit struct {
	Kind UnitKind
	Val  int // Px: cells; Fr: weight
}

type Rect struct {
	X, Y, W, H int
}

type Row struct {
	Height   Unit
	Min, Max int // Min/Max in cells (0 = no bound)
}

type Col struct {
	Width    Unit
	Min, Max int
}

type GridSpec struct {
	Rows    []Row
	Cols    []Col
	Gaps    struct{ Row, Col int }    // inter-row/col spacing
	Padding struct{ T, R, B, L int } // top, right, bottom, left padding
}

type Grid struct {
	spec GridSpec
	rows []int // computed heights
	cols []int // computed widths
}

func NewGrid(spec GridSpec) *Grid {
	return &Grid{spec: spec}
}

func (g *Grid) Compute(totalW, totalH int) {
	// Calculate inner box dimensions
	w := totalW - g.spec.Padding.L - g.spec.Padding.R
	h := totalH - g.spec.Padding.T - g.spec.Padding.B
	if w < 0 {
		w = 0
	}
	if h < 0 {
		h = 0
	}

	rowMin, rowMax := g.rowBounds()
	colMin, colMax := g.colBounds()
	g.rows = distribute(h, g.spec.Gaps.Row, g.rowUnits(), rowMin, rowMax)
	g.cols = distribute(w, g.spec.Gaps.Col, g.colUnits(), colMin, colMax)
}

func (g *Grid) CellRect(r, c int) Rect {
	x := g.spec.Padding.L
	y := g.spec.Padding.T
	for i := 0; i < c; i++ {
		x += g.cols[i] + g.spec.Gaps.Col
	}
	for i := 0; i < r; i++ {
		y += g.rows[i] + g.spec.Gaps.Row
	}
	return Rect{X: x, Y: y, W: g.cols[c], H: g.rows[r]}
}

func (g *Grid) SpanRect(r1, c1, r2, c2 int) Rect {
	topLeft := g.CellRect(r1, c1)
	bottomRight := g.CellRect(r2, c2)
	
	return Rect{
		X: topLeft.X,
		Y: topLeft.Y,
		W: bottomRight.X + bottomRight.W - topLeft.X,
		H: bottomRight.Y + bottomRight.H - topLeft.Y,
	}
}

func (g *Grid) rowUnits() []Unit {
	out := make([]Unit, len(g.spec.Rows))
	for i, r := range g.spec.Rows {
		out[i] = r.Height
	}
	return out
}

func (g *Grid) colUnits() []Unit {
	out := make([]Unit, len(g.spec.Cols))
	for i, c := range g.spec.Cols {
		out[i] = c.Width
	}
	return out
}

func (g *Grid) rowBounds() (min, max []int) {
	n := len(g.spec.Rows)
	min = make([]int, n)
	max = make([]int, n)
	for i, r := range g.spec.Rows {
		min[i], max[i] = r.Min, r.Max
	}
	return
}

func (g *Grid) colBounds() (min, max []int) {
	n := len(g.spec.Cols)
	min = make([]int, n)
	max = make([]int, n)
	for i, c := range g.spec.Cols {
		min[i], max[i] = c.Min, c.Max
	}
	return
}

// Core allocator: absolute Px first, then distribute remaining by Fr weights with bounds.
func distribute(total, gap int, units []Unit, boundsMin, boundsMax []int) []int {
	n := len(units)
	out := make([]int, n)
	spacing := gap * int(math.Max(0, float64(n-1)))
	remain := total - spacing
	if remain < 0 {
		remain = 0
	}

	// allocate Px, clamp to bounds
	sumFr := 0
	for i, u := range units {
		if u.Kind == Px {
			v := u.Val
			if boundsMin[i] > 0 && v < boundsMin[i] {
				v = boundsMin[i]
			}
			if boundsMax[i] > 0 && v > boundsMax[i] {
				v = boundsMax[i]
			}
			out[i] = v
			remain -= v
		} else {
			sumFr += u.Val
		}
	}
	if remain < 0 {
		remain = 0
	}

	// distribute by fraction
	for i, u := range units {
		if u.Kind == Fr {
			v := 0
			if sumFr > 0 {
				v = int((float64(u.Val) / float64(sumFr)) * float64(remain))
			}
			// clamp
			if boundsMin[i] > 0 && v < boundsMin[i] {
				v = boundsMin[i]
			}
			if boundsMax[i] > 0 && v > boundsMax[i] {
				v = boundsMax[i]
			}
			out[i] = v
		}
	}
	
	// adjust rounding drift
	used := 0
	for _, v := range out {
		used += v
	}
	drift := (total - spacing) - used
	for i := 0; drift > 0 && i < n; i++ {
		out[i]++
		drift--
	}
	for i := 0; drift < 0 && i < n; i++ {
		if out[i] > 0 {
			out[i]--
			drift++
		}
	}
	
	return out
}