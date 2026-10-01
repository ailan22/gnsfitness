"""Extract owner-supplied recipes and photographs; keep original PDF bytes."""
import sys, re, json, hashlib
from pathlib import Path
from io import BytesIO
import pdfplumber
from pypdf import PdfReader
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = root / 'public/nutricion'
out.mkdir(parents=True, exist_ok=True)
headings = {'Para qué sirve', 'Una base para disfrutar', 'Un día de ejemplo', 'Porciones y medidas', 'Antes de entrenar', 'Después de entrenar', 'Agua y recuperación', 'Adaptá la comida a tu demanda', 'Lo que una infusión puede acompañar', 'Cúrcuma y jengibre', 'Más combinaciones para disfrutar', 'Sabor que ayuda a sostener los hábitos'}

def blocks(text):
    result = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        if line in headings or re.match(r'^(Ingredientes[.:]?|Cómo se hace[.]?|Un toque más|Qué aporta:|Elegil[ao] cuando:|Cúrcuma:|Jengibre:|Canela:|Comino:|Pimentón:|Orégano:|Romero:|Tomillo:|Perejil:|Albahaca:|Menta:|Ajo:|Nuez moscada:)', line) or not result:
            result.append(line)
        elif result[-1] in headings:
            result.append(line)
        else: result[-1] += ' ' + line
    return result

def clean(page):
    return [line for line in page.extract_text().splitlines() if line not in ['GNS FITNESS', 'ALIMENTACIÓN Y BIENESTAR'] and not line.startswith(('Guía básica para socios', 'Fotografías ilustrativas')) and not re.fullmatch(r'\d{2}', line)]

def photos(page, layout, prefix):
    resources = {Path(im.name).stem: im for im in page.images}
    result = []
    for index, obj in enumerate(sorted(layout.images, key=lambda obj: obj['top'])):
        if obj['top'] < 80: continue
        name = f'{prefix}-{index}.webp'
        Image.open(BytesIO(resources[obj['name']].data)).convert('RGB').save(out / name, 'WEBP', quality=88)
        result.append('/nutricion/' + name)
    return result

sections, sources = [], []
for kind, source, dest in [('alimentacion', Path(sys.argv[1]), 'guia-alimentacion-gns.pdf'), ('postres', Path(sys.argv[2]), 'postres-y-recetas-dulces-gns.pdf')]:
    reader = PdfReader(source)
    assert len(reader.pages) == (29 if kind == 'alimentacion' else 12)
    sources.append({'file': dest, 'pages': len(reader.pages), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    with pdfplumber.open(source) as pdf:
        for number, page in enumerate(reader.pages, 1):
            lines = clean(page)
            images = photos(page, pdf.pages[number-1], f'{kind}-{number:02}')
            if kind == 'alimentacion' and 3 <= number <= 26:
                section_id = ['desayunos', 'almuerzos', 'meriendas', 'cenas'][(number-3)//6]
                if not any(s['id'] == section_id for s in sections):
                    sections.append({'id': section_id, 'title': section_id.capitalize()+' · 12 ideas', 'intro': 'Ingredientes para una persona. Ajustá las porciones a tus necesidades.', 'items': []})
                recipes = re.split(r'(?m)^(\d{2} · .+)$', '\n'.join(lines[3:]))
                assert len(recipes) == 5 and len(images) == 2, (number, recipes)
                for i in range(2):
                    sections[-1]['items'].append({'title': recipes[1+i*2], 'paragraphs': blocks(recipes[2+i*2]), 'images': [images[i]], 'page': number})
            elif kind == 'postres':
                if number == 1:
                    sections.append({'id': 'postres', 'title': 'Postres saludables · 12 recetas', 'intro': 'Dulces simples, ricos y para compartir.', 'items': []})
                    lines = lines[3:]
                else: lines = lines[1:]
                assert len(images) == 1, (number, images)
                sections[-1]['items'].append({'title': lines[0], 'paragraphs': blocks('\n'.join(lines[1:])), 'images': images, 'page': number})
            else:
                titles = {1: ('bases','Alimentación saludable'), 2: ('entrenar','Antes y después de entrenar'), 27: ('bebidas-dia','Bebidas durante el día'), 28: ('bebidas-noche','Infusiones para la tarde y la noche'), 29: ('sabores','Hierbas y especias')}
                section_id, title = titles[number]
                body = lines[3:] if number in (1,29) else lines[2:]
                for line in body:
                    if ' · ' in line: headings.add(line)
                sections.append({'id': section_id, 'title': title, 'intro': '', 'items': [{'title': title, 'paragraphs': blocks('\n'.join(body)), 'images': images, 'page': number}]})
assert sum(len(s['items']) for s in sections if s['id'] in ['desayunos','almuerzos','meriendas','cenas','postres']) == 60
(root / 'src/nutritionGuide.json').write_text(json.dumps({'sources': sources, 'sections': sections}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Imported 60 recipes and 5 educational sections; PDF sources remain outside the app.')
