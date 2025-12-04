# Unicode Math Reference for Chroma LaTeX Renderer

This document catalogs Unicode characters useful for terminal math rendering.
Chroma supports three rendering modes based on context and available space.

## Rendering Modes

| Mode | Height | Use Case | Example |
|------|--------|----------|---------|
| **INLINE** | 1 line | Embedded in text, chat | `x² + y² = z²` |
| **UTF8-MATH** | 1 line | Standalone with math chars | `∑ᵢ₌₁ⁿ xᵢ² = ∫₀^∞ f(x)dx` |
| **UTF8-DRAW** | 3-5 lines | Display equations, full ASCII art | See below |

---

## Horizontal Lines (by vertical position)

Critical for fraction bars, radical tops, and underlines.

| Char | Code | Name | Position | Use |
|------|------|------|----------|-----|
| `▔` | U+2594 | UPPER ONE EIGHTH BLOCK | Top | Overline for vectors |
| `‾` | U+203E | OVERLINE | Top | Alternative overline |
| `⎺` | U+23BA | HORIZONTAL SCAN LINE-1 | Very top | Fine positioning |
| `⎻` | U+23BB | HORIZONTAL SCAN LINE-3 | Upper | Fine positioning |
| `─` | U+2500 | BOX LIGHT HORIZONTAL | Middle | General lines |
| `━` | U+2501 | BOX HEAVY HORIZONTAL | Middle | Fraction bars |
| `═` | U+2550 | BOX DOUBLE HORIZONTAL | Middle | Emphasis |
| `⎼` | U+23BC | HORIZONTAL SCAN LINE-7 | Lower | Fine positioning |
| `⎽` | U+23BD | HORIZONTAL SCAN LINE-9 | Very bottom | Fine positioning |
| `▁` | U+2581 | LOWER ONE EIGHTH BLOCK | Bottom | **Radical top bar** |
| `_` | U+005F | LOW LINE | Bottom | Simple underscore |

### Recommended Usage
- **Fraction bar**: `━` (heavy, prominent)
- **Radical vinculum**: `▁` (sits on top of content below)
- **Overline (vectors)**: `▔` or `‾`

---

## Box Drawing Characters

### Light Box Drawing
| Char | Code | Name |
|------|------|------|
| `─` | U+2500 | LIGHT HORIZONTAL |
| `│` | U+2502 | LIGHT VERTICAL |
| `┌` | U+250C | LIGHT DOWN AND RIGHT |
| `┐` | U+2510 | LIGHT DOWN AND LEFT |
| `└` | U+2514 | LIGHT UP AND RIGHT |
| `┘` | U+2518 | LIGHT UP AND LEFT |
| `├` | U+251C | LIGHT VERTICAL AND RIGHT |
| `┤` | U+2524 | LIGHT VERTICAL AND LEFT |
| `┬` | U+252C | LIGHT DOWN AND HORIZONTAL |
| `┴` | U+2534 | LIGHT UP AND HORIZONTAL |
| `┼` | U+253C | LIGHT VERTICAL AND HORIZONTAL |

### Heavy Box Drawing
| Char | Code | Name |
|------|------|------|
| `━` | U+2501 | HEAVY HORIZONTAL |
| `┃` | U+2503 | HEAVY VERTICAL |
| `┏` | U+250F | HEAVY DOWN AND RIGHT |
| `┓` | U+2513 | HEAVY DOWN AND LEFT |
| `┗` | U+2517 | HEAVY UP AND RIGHT |
| `┛` | U+251B | HEAVY UP AND LEFT |
| `┣` | U+2523 | HEAVY VERTICAL AND RIGHT |
| `┫` | U+252B | HEAVY VERTICAL AND LEFT |
| `┳` | U+2533 | HEAVY DOWN AND HORIZONTAL |
| `┻` | U+253B | HEAVY UP AND HORIZONTAL |
| `╋` | U+254B | HEAVY VERTICAL AND HORIZONTAL |

### Double Box Drawing
| Char | Code | Name |
|------|------|------|
| `═` | U+2550 | DOUBLE HORIZONTAL |
| `║` | U+2551 | DOUBLE VERTICAL |
| `╔` | U+2554 | DOUBLE DOWN AND RIGHT |
| `╗` | U+2557 | DOUBLE DOWN AND LEFT |
| `╚` | U+255A | DOUBLE UP AND RIGHT |
| `╝` | U+255D | DOUBLE UP AND LEFT |
| `╠` | U+2560 | DOUBLE VERTICAL AND RIGHT |
| `╣` | U+2563 | DOUBLE VERTICAL AND LEFT |
| `╦` | U+2566 | DOUBLE DOWN AND HORIZONTAL |
| `╩` | U+2569 | DOUBLE UP AND HORIZONTAL |
| `╬` | U+256C | DOUBLE VERTICAL AND HORIZONTAL |

### Diagonal Lines
| Char | Code | Name | Use |
|------|------|------|-----|
| `╱` | U+2571 | LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT | Radical rising stroke |
| `╲` | U+2572 | LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT | Radical descending |
| `╳` | U+2573 | LIGHT DIAGONAL CROSS | Cancellation |

### Curved/Round Corners
| Char | Code | Name |
|------|------|------|
| `╭` | U+256D | LIGHT ARC DOWN AND RIGHT |
| `╮` | U+256E | LIGHT ARC DOWN AND LEFT |
| `╯` | U+256F | LIGHT ARC UP AND LEFT |
| `╰` | U+2570 | LIGHT ARC UP AND RIGHT |

---

## Superscripts and Subscripts

### Superscript Digits
| Normal | Super | Code |
|--------|-------|------|
| 0 | `⁰` | U+2070 |
| 1 | `¹` | U+00B9 |
| 2 | `²` | U+00B2 |
| 3 | `³` | U+00B3 |
| 4 | `⁴` | U+2074 |
| 5 | `⁵` | U+2075 |
| 6 | `⁶` | U+2076 |
| 7 | `⁷` | U+2077 |
| 8 | `⁸` | U+2078 |
| 9 | `⁹` | U+2079 |

### Superscript Operators
| Normal | Super | Code |
|--------|-------|------|
| + | `⁺` | U+207A |
| - | `⁻` | U+207B |
| = | `⁼` | U+207C |
| ( | `⁽` | U+207D |
| ) | `⁾` | U+207E |

### Superscript Letters
| Letter | Super | Code |
|--------|-------|------|
| a | `ᵃ` | U+1D43 |
| b | `ᵇ` | U+1D47 |
| c | `ᶜ` | U+1D9C |
| d | `ᵈ` | U+1D48 |
| e | `ᵉ` | U+1D49 |
| f | `ᶠ` | U+1DA0 |
| g | `ᵍ` | U+1D4D |
| h | `ʰ` | U+02B0 |
| i | `ⁱ` | U+2071 |
| j | `ʲ` | U+02B2 |
| k | `ᵏ` | U+1D4F |
| l | `ˡ` | U+02E1 |
| m | `ᵐ` | U+1D50 |
| n | `ⁿ` | U+207F |
| o | `ᵒ` | U+1D52 |
| p | `ᵖ` | U+1D56 |
| r | `ʳ` | U+02B3 |
| s | `ˢ` | U+02E2 |
| t | `ᵗ` | U+1D57 |
| u | `ᵘ` | U+1D58 |
| v | `ᵛ` | U+1D5B |
| w | `ʷ` | U+02B7 |
| x | `ˣ` | U+02E3 |
| y | `ʸ` | U+02B8 |
| z | `ᶻ` | U+1DBB |

### Subscript Digits
| Normal | Sub | Code |
|--------|-----|------|
| 0 | `₀` | U+2080 |
| 1 | `₁` | U+2081 |
| 2 | `₂` | U+2082 |
| 3 | `₃` | U+2083 |
| 4 | `₄` | U+2084 |
| 5 | `₅` | U+2085 |
| 6 | `₆` | U+2086 |
| 7 | `₇` | U+2087 |
| 8 | `₈` | U+2088 |
| 9 | `₉` | U+2089 |

### Subscript Operators
| Normal | Sub | Code |
|--------|-----|------|
| + | `₊` | U+208A |
| - | `₋` | U+208B |
| = | `₌` | U+208C |
| ( | `₍` | U+208D |
| ) | `₎` | U+208E |

### Subscript Letters
| Letter | Sub | Code |
|--------|-----|------|
| a | `ₐ` | U+2090 |
| e | `ₑ` | U+2091 |
| h | `ₕ` | U+2095 |
| i | `ᵢ` | U+1D62 |
| j | `ⱼ` | U+2C7C |
| k | `ₖ` | U+2096 |
| l | `ₗ` | U+2097 |
| m | `ₘ` | U+2098 |
| n | `ₙ` | U+2099 |
| o | `ₒ` | U+2092 |
| p | `ₚ` | U+209A |
| r | `ᵣ` | U+1D63 |
| s | `ₛ` | U+209B |
| t | `ₜ` | U+209C |
| u | `ᵤ` | U+1D64 |
| v | `ᵥ` | U+1D65 |
| x | `ₓ` | U+2093 |

---

## Greek Letters

### Lowercase Greek
| Name | Char | Code | LaTeX |
|------|------|------|-------|
| alpha | `α` | U+03B1 | \alpha |
| beta | `β` | U+03B2 | \beta |
| gamma | `γ` | U+03B3 | \gamma |
| delta | `δ` | U+03B4 | \delta |
| epsilon | `ε` | U+03B5 | \epsilon |
| zeta | `ζ` | U+03B6 | \zeta |
| eta | `η` | U+03B7 | \eta |
| theta | `θ` | U+03B8 | \theta |
| iota | `ι` | U+03B9 | \iota |
| kappa | `κ` | U+03BA | \kappa |
| lambda | `λ` | U+03BB | \lambda |
| mu | `μ` | U+03BC | \mu |
| nu | `ν` | U+03BD | \nu |
| xi | `ξ` | U+03BE | \xi |
| omicron | `ο` | U+03BF | \omicron |
| pi | `π` | U+03C0 | \pi |
| rho | `ρ` | U+03C1 | \rho |
| sigma | `σ` | U+03C3 | \sigma |
| tau | `τ` | U+03C4 | \tau |
| upsilon | `υ` | U+03C5 | \upsilon |
| phi | `φ` | U+03C6 | \phi |
| chi | `χ` | U+03C7 | \chi |
| psi | `ψ` | U+03C8 | \psi |
| omega | `ω` | U+03C9 | \omega |

### Uppercase Greek
| Name | Char | Code | LaTeX |
|------|------|------|-------|
| Alpha | `Α` | U+0391 | \Alpha |
| Beta | `Β` | U+0392 | \Beta |
| Gamma | `Γ` | U+0393 | \Gamma |
| Delta | `Δ` | U+0394 | \Delta |
| Epsilon | `Ε` | U+0395 | \Epsilon |
| Zeta | `Ζ` | U+0396 | \Zeta |
| Eta | `Η` | U+0397 | \Eta |
| Theta | `Θ` | U+0398 | \Theta |
| Iota | `Ι` | U+0399 | \Iota |
| Kappa | `Κ` | U+039A | \Kappa |
| Lambda | `Λ` | U+039B | \Lambda |
| Mu | `Μ` | U+039C | \Mu |
| Nu | `Ν` | U+039D | \Nu |
| Xi | `Ξ` | U+039E | \Xi |
| Omicron | `Ο` | U+039F | \Omicron |
| Pi | `Π` | U+03A0 | \Pi |
| Rho | `Ρ` | U+03A1 | \Rho |
| Sigma | `Σ` | U+03A3 | \Sigma |
| Tau | `Τ` | U+03A4 | \Tau |
| Upsilon | `Υ` | U+03A5 | \Upsilon |
| Phi | `Φ` | U+03A6 | \Phi |
| Chi | `Χ` | U+03A7 | \Chi |
| Psi | `Ψ` | U+03A8 | \Psi |
| Omega | `Ω` | U+03A9 | \Omega |

### Variant Greek
| Name | Char | Code | LaTeX |
|------|------|------|-------|
| var epsilon | `ϵ` | U+03F5 | \varepsilon |
| var theta | `ϑ` | U+03D1 | \vartheta |
| var pi | `ϖ` | U+03D6 | \varpi |
| var rho | `ϱ` | U+03F1 | \varrho |
| var sigma | `ς` | U+03C2 | \varsigma |
| var phi | `ϕ` | U+03D5 | \varphi |

---

## Mathematical Operators

### Basic Operators
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `+` | U+002B | PLUS SIGN | + |
| `−` | U+2212 | MINUS SIGN | - |
| `×` | U+00D7 | MULTIPLICATION SIGN | \times |
| `÷` | U+00F7 | DIVISION SIGN | \div |
| `·` | U+00B7 | MIDDLE DOT | \cdot |
| `∗` | U+2217 | ASTERISK OPERATOR | \ast |
| `∘` | U+2218 | RING OPERATOR | \circ |
| `±` | U+00B1 | PLUS-MINUS SIGN | \pm |
| `∓` | U+2213 | MINUS-OR-PLUS SIGN | \mp |

### Comparison
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `=` | U+003D | EQUALS SIGN | = |
| `≠` | U+2260 | NOT EQUAL TO | \neq |
| `<` | U+003C | LESS-THAN SIGN | < |
| `>` | U+003E | GREATER-THAN SIGN | > |
| `≤` | U+2264 | LESS-THAN OR EQUAL TO | \leq |
| `≥` | U+2265 | GREATER-THAN OR EQUAL TO | \geq |
| `≪` | U+226A | MUCH LESS-THAN | \ll |
| `≫` | U+226B | MUCH GREATER-THAN | \gg |
| `≈` | U+2248 | ALMOST EQUAL TO | \approx |
| `≡` | U+2261 | IDENTICAL TO | \equiv |
| `∼` | U+223C | TILDE OPERATOR | \sim |
| `≃` | U+2243 | ASYMPTOTICALLY EQUAL TO | \simeq |
| `∝` | U+221D | PROPORTIONAL TO | \propto |

### Set Theory
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `∈` | U+2208 | ELEMENT OF | \in |
| `∉` | U+2209 | NOT AN ELEMENT OF | \notin |
| `∋` | U+220B | CONTAINS AS MEMBER | \ni |
| `⊂` | U+2282 | SUBSET OF | \subset |
| `⊃` | U+2283 | SUPERSET OF | \supset |
| `⊆` | U+2286 | SUBSET OF OR EQUAL TO | \subseteq |
| `⊇` | U+2287 | SUPERSET OF OR EQUAL TO | \supseteq |
| `∪` | U+222A | UNION | \cup |
| `∩` | U+2229 | INTERSECTION | \cap |
| `∅` | U+2205 | EMPTY SET | \emptyset |
| `∖` | U+2216 | SET MINUS | \setminus |

### Logic
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `∧` | U+2227 | LOGICAL AND | \land |
| `∨` | U+2228 | LOGICAL OR | \lor |
| `¬` | U+00AC | NOT SIGN | \neg |
| `⊥` | U+22A5 | UP TACK (perpendicular) | \perp |
| `⊤` | U+22A4 | DOWN TACK (true) | \top |
| `∀` | U+2200 | FOR ALL | \forall |
| `∃` | U+2203 | THERE EXISTS | \exists |
| `∄` | U+2204 | THERE DOES NOT EXIST | \nexists |
| `⊢` | U+22A2 | RIGHT TACK (proves) | \vdash |
| `⊨` | U+22A8 | TRUE (models) | \models |

### Arrows
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `→` | U+2192 | RIGHTWARDS ARROW | \to, \rightarrow |
| `←` | U+2190 | LEFTWARDS ARROW | \leftarrow |
| `↔` | U+2194 | LEFT RIGHT ARROW | \leftrightarrow |
| `↑` | U+2191 | UPWARDS ARROW | \uparrow |
| `↓` | U+2193 | DOWNWARDS ARROW | \downarrow |
| `↕` | U+2195 | UP DOWN ARROW | \updownarrow |
| `⇒` | U+21D2 | RIGHTWARDS DOUBLE ARROW | \Rightarrow |
| `⇐` | U+21D0 | LEFTWARDS DOUBLE ARROW | \Leftarrow |
| `⇔` | U+21D4 | LEFT RIGHT DOUBLE ARROW | \Leftrightarrow |
| `⇑` | U+21D1 | UPWARDS DOUBLE ARROW | \Uparrow |
| `⇓` | U+21D3 | DOWNWARDS DOUBLE ARROW | \Downarrow |
| `↦` | U+21A6 | RIGHTWARDS ARROW FROM BAR | \mapsto |
| `⟹` | U+27F9 | LONG RIGHTWARDS DOUBLE ARROW | \implies |
| `⟺` | U+27FA | LONG LEFT RIGHT DOUBLE ARROW | \iff |

---

## Big Operators

### Summation & Product
| Char | Code | Name | LaTeX | Notes |
|------|------|------|-------|-------|
| `∑` | U+2211 | N-ARY SUMMATION | \sum | Standard size |
| `Σ` | U+03A3 | GREEK CAPITAL SIGMA | | Alternative |
| `∏` | U+220F | N-ARY PRODUCT | \prod | |
| `∐` | U+2210 | N-ARY COPRODUCT | \coprod | |

### Integrals
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `∫` | U+222B | INTEGRAL | \int |
| `∬` | U+222C | DOUBLE INTEGRAL | \iint |
| `∭` | U+222D | TRIPLE INTEGRAL | \iiint |
| `∮` | U+222E | CONTOUR INTEGRAL | \oint |
| `∯` | U+222F | SURFACE INTEGRAL | |
| `∰` | U+2230 | VOLUME INTEGRAL | |
| `⌠` | U+2320 | TOP HALF INTEGRAL | | For tall integrals |
| `⌡` | U+2321 | BOTTOM HALF INTEGRAL | | For tall integrals |
| `⎮` | U+23AE | INTEGRAL EXTENSION | | Middle piece |

### Unions & Intersections
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `⋃` | U+22C3 | N-ARY UNION | \bigcup |
| `⋂` | U+22C2 | N-ARY INTERSECTION | \bigcap |
| `⨁` | U+2A01 | N-ARY CIRCLED PLUS | \bigoplus |
| `⨂` | U+2A02 | N-ARY CIRCLED TIMES | \bigotimes |
| `⨀` | U+2A00 | N-ARY CIRCLED DOT | \bigodot |

---

## Roots and Radicals

| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `√` | U+221A | SQUARE ROOT | \sqrt |
| `∛` | U+221B | CUBE ROOT | \sqrt[3] |
| `∜` | U+221C | FOURTH ROOT | \sqrt[4] |
| `⎷` | U+23B7 | RADICAL SYMBOL BOTTOM | | For tall radicals |

---

## Delimiters

### Parentheses (scalable)
| Position | Left | Right | Code L | Code R |
|----------|------|-------|--------|--------|
| Upper | `⎛` | `⎞` | U+239B | U+239E |
| Extension | `⎜` | `⎟` | U+239C | U+239F |
| Lower | `⎝` | `⎠` | U+239D | U+23A0 |

### Brackets (scalable)
| Position | Left | Right | Code L | Code R |
|----------|------|-------|--------|--------|
| Upper | `⎡` | `⎤` | U+23A1 | U+23A4 |
| Extension | `⎢` | `⎥` | U+23A2 | U+23A5 |
| Lower | `⎣` | `⎦` | U+23A3 | U+23A6 |

### Braces (scalable)
| Position | Left | Right | Code L | Code R |
|----------|------|-------|--------|--------|
| Upper | `⎧` | `⎫` | U+23A7 | U+23AB |
| Middle | `⎨` | `⎬` | U+23A8 | U+23AC |
| Lower | `⎩` | `⎭` | U+23A9 | U+23AD |
| Extension | `⎪` | `⎪` | U+23AA | U+23AA |

### Angle Brackets
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `⟨` | U+27E8 | MATHEMATICAL LEFT ANGLE BRACKET | \langle |
| `⟩` | U+27E9 | MATHEMATICAL RIGHT ANGLE BRACKET | \rangle |

### Floor/Ceiling
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `⌈` | U+2308 | LEFT CEILING | \lceil |
| `⌉` | U+2309 | RIGHT CEILING | \rceil |
| `⌊` | U+230A | LEFT FLOOR | \lfloor |
| `⌋` | U+230B | RIGHT FLOOR | \rfloor |

---

## Special Symbols

### Calculus & Analysis
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `∂` | U+2202 | PARTIAL DIFFERENTIAL | \partial |
| `∇` | U+2207 | NABLA | \nabla |
| `∞` | U+221E | INFINITY | \infty |
| `′` | U+2032 | PRIME | ' |
| `″` | U+2033 | DOUBLE PRIME | '' |

### Dots
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `…` | U+2026 | HORIZONTAL ELLIPSIS | \ldots |
| `⋯` | U+22EF | MIDLINE HORIZONTAL ELLIPSIS | \cdots |
| `⋮` | U+22EE | VERTICAL ELLIPSIS | \vdots |
| `⋱` | U+22F1 | DOWN RIGHT DIAGONAL ELLIPSIS | \ddots |

### Miscellaneous
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `∴` | U+2234 | THEREFORE | \therefore |
| `∵` | U+2235 | BECAUSE | \because |
| `∠` | U+2220 | ANGLE | \angle |
| `°` | U+00B0 | DEGREE SIGN | ^\circ |
| `ℏ` | U+210F | PLANCK CONSTANT OVER 2 PI | \hbar |
| `ℓ` | U+2113 | SCRIPT SMALL L | \ell |
| `℘` | U+2118 | SCRIPT CAPITAL P | \wp |
| `ℜ` | U+211C | BLACK-LETTER CAPITAL R | \Re |
| `ℑ` | U+2111 | BLACK-LETTER CAPITAL I | \Im |
| `ℵ` | U+2135 | ALEF SYMBOL | \aleph |

### Blackboard Bold (Double-struck)
| Char | Code | Name | LaTeX |
|------|------|------|-------|
| `ℕ` | U+2115 | DOUBLE-STRUCK N | \mathbb{N} |
| `ℤ` | U+2124 | DOUBLE-STRUCK Z | \mathbb{Z} |
| `ℚ` | U+211A | DOUBLE-STRUCK Q | \mathbb{Q} |
| `ℝ` | U+211D | DOUBLE-STRUCK R | \mathbb{R} |
| `ℂ` | U+2102 | DOUBLE-STRUCK C | \mathbb{C} |

---

## Block Elements (for drawing)

Useful for constructing large symbols in UTF8-DRAW mode.

| Char | Code | Name |
|------|------|------|
| `█` | U+2588 | FULL BLOCK |
| `▀` | U+2580 | UPPER HALF BLOCK |
| `▄` | U+2584 | LOWER HALF BLOCK |
| `▌` | U+258C | LEFT HALF BLOCK |
| `▐` | U+2590 | RIGHT HALF BLOCK |
| `▁` | U+2581 | LOWER ONE EIGHTH BLOCK |
| `▂` | U+2582 | LOWER ONE QUARTER BLOCK |
| `▃` | U+2583 | LOWER THREE EIGHTHS BLOCK |
| `▅` | U+2585 | LOWER FIVE EIGHTHS BLOCK |
| `▆` | U+2586 | LOWER THREE QUARTERS BLOCK |
| `▇` | U+2587 | LOWER SEVEN EIGHTHS BLOCK |
| `▔` | U+2594 | UPPER ONE EIGHTH BLOCK |
| `▕` | U+2595 | RIGHT ONE EIGHTH BLOCK |

---

## Example Renderings by Mode

### INLINE Mode (1 line)
```
Pythagorean: x² + y² = z²
Euler: eⁱᵖ + 1 = 0
Sum: ∑ᵢ₌₁ⁿ xᵢ
Integral: ∫₀^∞ e⁻ˣ dx
Fraction: ½, ⅓, ¼, ⅕ (precomposed) or a/b
```

### UTF8-MATH Mode (1 line, math symbols)
```
∑ᵢ₌₁ⁿ xᵢ² = ∫₀^∞ f(x)dx
√(a² + b²)
α + β + γ = δ
```

### UTF8-DRAW Mode (3-5 lines)
```
Fraction:
    a + b
   ━━━━━━━
    c + d

Sum:
      n
     ___
     ╲
      ╲   xᵢ
      ╱
     ╱
     ‾‾‾
    i = 1

Integral:
       ∞
      ⌠
      │  e⁻ˣ² dx
      ⌡
       0

Square Root:
     ▁▁▁▁▁▁▁▁▁
    ╱ a² + b²
   ╲╱
```

---

## Design Principles

1. **INLINE**: Maximum information density, relies on Unicode super/subscripts
2. **UTF8-MATH**: Single line but uses large math operators (∑, ∫, √)
3. **UTF8-DRAW**: Multi-line ASCII art, uses box drawing for clean connections

### Character Selection Priority
1. Use characters that connect cleanly (box drawing over arbitrary lines)
2. Prefer characters with consistent width in monospace fonts
3. Use `▁` (lower block) for lines that should sit on top of content below
4. Use `▔` (upper block) for lines that should sit under content above
5. Heavy (`━`) for emphasis (fraction bars), light (`─`) for structure
