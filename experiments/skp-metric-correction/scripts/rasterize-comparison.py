#!/usr/bin/env python3
"""Optional CPU SVG -> PNG preview, requiring PyMuPDF; does not use a browser."""
from pathlib import Path
import fitz
base = Path(__file__).resolve().parent.parent / 'evidence'
for name in ('wheels-orthographic', 'whole-orthographic'):
    with fitz.open(stream=(base / (name + '.svg')).read_bytes(), filetype='svg') as document:
        document[0].get_pixmap(alpha=False).save(base / (name + '.png'))
    print(name + '.png')
