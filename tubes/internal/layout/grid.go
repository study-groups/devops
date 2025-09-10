package layout

import "math"

// UnitKind defines the type of sizing unit
type UnitKind int

const (
	Px UnitKind = iota // absolute cells
	Fr                 // fractional share of remaining space
)

// Unit represents a sizing unit with its kind and value
type Unit struct {
	Kind UnitKind
	Val  int // Px: cells; Fr: weight
}

// Rect represents a rectangle with position and dimensions
type Rect struct {
	X, Y, W, H int
}

// Row defines a row configuration with height and constraints
type Row struct {
	Height   Unit
	Min, Max int // Min/Max in cells (0 = no bound)
}

// Col defines a column configuration with width and constraints
type Col struct {
	Width    Unit
	Min, Max int // Min/Max in cells (0 = no bound)
}

// GridSpec defines the complete grid specification
type GridSpec struct {
	Rows    []Row
	Cols    []Col
	Gaps    struct{ Row, Col int }      // inter-row/col spacing
	Padding struct{ T, R, B, L int }   // outer padding
}

// Grid holds the computed layout state
type Grid struct {
	spec GridSpec
	rows []int // computed heights
	cols []int // computed widths
}

// NewGrid creates a new grid with the given specification
func NewGrid(spec GridSpec) *Grid {
	return &Grid{spec: spec}
}

// Compute calculates the layout for the given total dimensions
func (g *Grid) Compute(totalW, totalH int) {
	// Calculate inner box after padding
	w := totalW - g.spec.Padding.L - g.spec.Padding.R
	h := totalH - g.spec.Padding.T - g.spec.Padding.B
	if w < 0 {
		w = 0
	}
	if h < 0 {
		h = 0
	}

	// Distribute space
	rowMin, rowMax := g.rowBounds()
	colMin, colMax := g.colBounds()
	g.rows = g.distribute(h, g.spec.Gaps.Row, g.rowUnits(), rowMin, rowMax)
	g.cols = g.distribute(w, g.spec.Gaps.Col, g.colUnits(), colMin, colMax)
}

// CellRect returns the rectangle for the cell at row r, column c
func (g *Grid) CellRect(r, c int) Rect {
	x := g.spec.Padding.L
	y := g.spec.Padding.T

	// Add column widths and gaps to get x position
	for i := 0; i < c; i++ {
		x += g.cols[i]
		if i < len(g.cols)-1 {
			x += g.spec.Gaps.Col
		}
	}

	// Add row heights and gaps to get y position  
	for i := 0; i < r; i++ {
		y += g.rows[i]
		if i < len(g.rows)-1 {
			y += g.spec.Gaps.Row
		}
	}

	// Return rectangle
	w := 0
	h := 0
	if c < len(g.cols) {
		w = g.cols[c]
	}
	if r < len(g.rows) {
		h = g.rows[r]
	}

	return Rect{X: x, Y: y, W: w, H: h}
}

// SpanRect returns a rectangle spanning multiple cells
func (g *Grid) SpanRect(r, c, rowSpan, colSpan int) Rect {
	if rowSpan <= 0 || colSpan <= 0 {
		return Rect{}
	}

	// Get starting position
	startRect := g.CellRect(r, c)
	
	// Calculate spanning width
	w := 0
	for i := c; i < c+colSpan && i < len(g.cols); i++ {
		w += g.cols[i]
		if i < c+colSpan-1 && i < len(g.cols)-1 {
			w += g.spec.Gaps.Col
		}
	}

	// Calculate spanning height
	h := 0
	for i := r; i < r+rowSpan && i < len(g.rows); i++ {
		h += g.rows[i]
		if i < r+rowSpan-1 && i < len(g.rows)-1 {
			h += g.spec.Gaps.Row
		}
	}

	return Rect{X: startRect.X, Y: startRect.Y, W: w, H: h}
}

// Helper methods to extract units and bounds
func (g *Grid) rowUnits() []Unit {
	units := make([]Unit, len(g.spec.Rows))
	for i, r := range g.spec.Rows {
		units[i] = r.Height
	}
	return units
}

func (g *Grid) colUnits() []Unit {
	units := make([]Unit, len(g.spec.Cols))
	for i, c := range g.spec.Cols {
		units[i] = c.Width
	}
	return units
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

// distribute allocates space: absolute Px first, then distribute remaining by Fr weights with bounds
func (g *Grid) distribute(total, gap int, units []Unit, boundsMin, boundsMax []int) []int {
	n := len(units)
	if n == 0 {
		return []int{}
	}

	out := make([]int, n)
	
	// Calculate space taken by gaps
	gapSpace := 0
	if n > 1 {
		gapSpace = gap * (n - 1)
	}
	
	remain := total - gapSpace
	if remain < 0 {
		remain = 0
	}

	// First pass: allocate Px units, respecting bounds
	sumFr := 0
	for i, u := range units {
		if u.Kind == Px {
			v := u.Val
			// Apply min/max constraints
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

	// Second pass: distribute remaining space by Fr weights
	for i, u := range units {
		if u.Kind == Fr {
			v := 0
			if sumFr > 0 {
				v = int(math.Round(float64(u.Val) / float64(sumFr) * float64(remain)))
			}
			
			// Apply min/max constraints
			if boundsMin[i] > 0 && v < boundsMin[i] {
				v = boundsMin[i]
			}
			if boundsMax[i] > 0 && v > boundsMax[i] {
				v = boundsMax[i]
			}
			out[i] = v
		}
	}

	// Third pass: handle rounding drift by adjusting fractional units
	used := 0
	for _, v := range out {
		used += v
	}
	
	drift := (total - gapSpace) - used
	
	// Distribute positive drift
	for i := 0; drift > 0 && i < n; i++ {
		if units[i].Kind == Fr {
			out[i]++
			drift--
		}
	}
	
	// Remove negative drift
	for i := 0; drift < 0 && i < n; i++ {
		if units[i].Kind == Fr && out[i] > 0 {
			out[i]--
			drift++
		}
	}

	return out
}