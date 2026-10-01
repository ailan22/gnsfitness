"""Import supplied recipe PDFs as readable app content, without publishing PDFs."""
import hashlib
import json
import re
import sys
from io import BytesIO
from pathlib import Path

import pdfplumber
from PIL import Image
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
out = root / 'public/nutricion'
categories = {'DESAYUNOS': 'Desayunos', 'ALMUERZOS': 'Almuerzos', 'MERIENDAS': 'Meriendas', 'CENAS': 'Cenas', 'POSTRES': 'Postres'}

sources = [('recetas', sys.argv[1], 200)]
if len(sys.argv) > 2:
    sources.append(('dulces', sys.argv[2], 70))
for kind, filename, expected in sources:
    source = Path(filename)
    reader = PdfReader(source)
    assert len(reader.pages) == expected
    sections = {}
    with pdfplumber.open(source) as layout:
        for index, page in enumerate(reader.pages):
            lines = [line.strip() for line in page.extract_text().splitlines() if line.strip()]
            category = lines[2]
            assert category in categories
            meta = next(i for i, line in enumerate(lines) if re.match(r'^\d+ / \d+ · Rinde', line))
            title = lines[meta - 1] if kind == 'dulces' and index == 0 else ' '.join(lines[3:meta])
            ingredients = lines.index('Ingredientes')
            method = lines.index('Cómo se hace')
            nutrition = lines.index('Por porción · valores estimados')
            assert ingredients < method < nutrition
            image_objects = [im for im in layout.pages[index].images if im['top'] > 80 and im['width'] > 100]
            assert len(image_objects) == 1, (index, image_objects)
            resources = {Path(im.name).stem: im for im in page.images}
            photo = Image.open(BytesIO(resources[image_objects[0]['name']].data)).convert('RGB')
            photo.thumbnail((1000, 1000))
            name = f'{kind}-{index + 1:03}.webp'
            photo.save(out / name, 'WEBP', quality=84)
            image_version = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
            item = {'id': f'{kind}-{index + 1:03}', 'title': title, 'details': lines[meta], 'image': '/nutricion/' + name + '?v=' + image_version,
                    'ingredients': ' '.join(lines[ingredients + 1:method]), 'method': ' '.join(lines[method + 1:nutrition]),
                    'nutrition': lines[nutrition + 1:], 'page': index + 1}
            assert all(item[key] for key in ['title', 'ingredients', 'method', 'nutrition'])
            sections.setdefault(category, {'id': category.lower(), 'title': categories[category], 'items': []})['items'].append(item)
    data = {'source': {'file': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'pages': expected}, 'sections': list(sections.values())}
    assert sum(len(s['items']) for s in data['sections']) == expected
    (root / f'src/admin-{kind}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{kind}: {expected} complete recipes, {len(sections)} categories, {expected} photos.')
