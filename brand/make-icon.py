"""Draws the Sudoku Solver mark (brand/icon.svg, brand/icon-maskable.svg, public/icon.svg). Run: python3 brand/make-icon.py"""
cell, gap, x0, y0 = 78, 10, 129, 88

def digit(d, cx, cy, col, w=10):
    s = 0.82
    paths = {
        1: f"M {cx-7*s} {cy-19*s} L {cx+3*s} {cy-26*s} L {cx+3*s} {cy+26*s}",
        4: f"M {cx+8*s} {cy+26*s} L {cx+8*s} {cy-26*s} L {cx-17*s} {cy+9*s} L {cx+17*s} {cy+9*s}",
        7: f"M {cx-16*s} {cy-25*s} L {cx+16*s} {cy-25*s} L {cx-4*s} {cy+26*s}",
        2: f"M {cx-15*s} {cy-13*s} Q {cx-13*s} {cy-26*s} {cx} {cy-26*s} Q {cx+15*s} {cy-26*s} {cx+15*s} {cy-12*s} Q {cx+15*s} {cy-1*s} {cx-15*s} {cy+26*s} L {cx+16*s} {cy+26*s}",
    }
    return f'<path d="{paths[d]}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'

digits = {(0, 0): 1, (0, 2): 4, (1, 1): 7, (2, 2): 2}
notes = {(1, 0): [1, 5, 9], (2, 0): [3, 6], (1, 2): [2, 8], (2, 1): [9]}
parts = []
for r in range(3):
    for c in range(3):
        x, y = x0 + c * (cell + gap), y0 + r * (cell + gap)
        lit = (r, c) == (1, 1)
        parts.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" rx="14" fill="{"url(#lit)" if lit else "#f6f2e9"}"/>')
        if not lit:
            parts.append(f'<rect x="{x}" y="{y+cell-8}" width="{cell}" height="8" rx="4" fill="#000" opacity=".06"/>')
        if (r, c) in digits:
            parts.append(digit(digits[(r, c)], x + cell / 2, y + cell / 2, "#ffffff" if lit else "#2a2520"))
        for n in notes.get((r, c), []):
            parts.append(f'<circle cx="{x + 16 + ((n-1) % 3) * 23}" cy="{y + 16 + ((n-1) // 3) * 23}" r="5" fill="#b5651d" opacity=".6"/>')
grid = "\n".join(parts)

def svg(maskable=False):
    rx = 0 if maskable else 112
    scale = ' transform="translate(256 256) scale(0.8) translate(-256 -256)"' if maskable else ''
    edge = '' if maskable else '<rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="4"/>\n'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<!-- Sudoku Solver mark: one 3x3 box of matte tiles with digits and pencil marks, the solved square lit in amber, and the suite's solve arrow. Original artwork. -->
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2924"/><stop offset="1" stop-color="#15130f"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c25f12"/><stop offset="1" stop-color="#f2a04a"/></linearGradient>
  <linearGradient id="lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a04a"/><stop offset="1" stop-color="#c25f12"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#f2a04a" stop-opacity=".22"/><stop offset="1" stop-color="#f2a04a" stop-opacity="0"/></radialGradient>
</defs>
<rect width="512" height="512" rx="{rx}" fill="url(#bg)"/>
{edge}<rect width="512" height="512" rx="{rx}" fill="url(#glow)"/>
<g{scale}>
<rect x="{x0-12}" y="{y0-12}" width="{3*cell+2*gap+24}" height="{3*cell+2*gap+24}" rx="24" fill="#121110"/>
{grid}
<path d="M 96 372 A 190 190 0 0 0 418 362" fill="none" stroke="url(#acc)" stroke-width="22" stroke-linecap="round"/>
<path d="M 446 334 L 426 396 L 382 350 Z" fill="#f2a04a" stroke="#f2a04a" stroke-width="8" stroke-linejoin="round"/>
</g>
</svg>
'''

for path, m in [('brand/icon.svg', False), ('brand/icon-maskable.svg', True), ('public/icon.svg', False)]:
    open(path, 'w').write(svg(m))
