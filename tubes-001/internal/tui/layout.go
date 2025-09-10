package tui

type Layout struct {
	HeaderH int
	FooterH int
	CliH    int
	StatusH int
	LeftW   int
	RightW  int
	ColsH   int
}

func (m *Model) computeLayoutLegacy() Layout {
	totalW, totalH := m.width, m.height
	if totalW < 10 {
		totalW = 10
	}
	minBands := m.headerH + m.cliH + m.statusH + m.footerH
	colsH := totalH - minBands
	if colsH < 3 {
		colsH = 3
	}
	leftW := int(float64(totalW) * m.col1Ratio)
	if leftW < 10 {
		leftW = 10
	}
	if leftW > totalW-10 {
		leftW = totalW - 10
	}
	return Layout{
		HeaderH: m.headerH,
		FooterH: m.footerH,
		CliH:    m.cliH,
		StatusH: m.statusH,
		LeftW:   leftW,
		RightW:  totalW - leftW,
		ColsH:   colsH,
	}
}

