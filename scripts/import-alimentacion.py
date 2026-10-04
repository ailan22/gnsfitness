"""Import the supplied guide as classified, readable content without publishing its PDF."""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path
import pdfplumber
from pypdf import PdfReader
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
digest = hashlib.sha256(source.read_bytes()).hexdigest()
out = root / 'public/nutricion/alimentacion'
out.mkdir(parents=True, exist_ok=True)
groups = [(1,1,'plato','Cómo armar un plato saludable'),
          (2,4,'nutrientes','Carbohidratos, proteínas y grasas saludables'),
          (5,9,'combinaciones','Condimentos y combinaciones de alimentos'),
          (10,14,'cinco-dias','Menú de ejemplo para cinco días'),
          (15,24,'desayunos','Desayunos · 10 recetas'),
          (25,34,'almuerzos','Almuerzos · 10 recetas'),
          (35,44,'meriendas','Meriendas · 10 recetas'),
          (45,54,'cenas','Cenas · 10 recetas'),
          (55,59,'infusiones','Infusiones y tés'),
          (60,64,'aguas','Aguas con frutas, semillas y hierbas'),
          (65,66,'salud-hormonal','Alimentación y salud hormonal')]
titles = {1:'Cómo armar un plato saludable', 2:'Carbohidratos', 3:'Proteínas',
          4:'Grasas saludables', 5:'Pollo: tres maneras de condimentarlo',
          6:'Papas: romero, pimentón o ricota', 7:'Pescado, lentejas y tofu: ideas para sazonar',
          8:'Combinaciones con papa, huevo, queso y atún',
          9:'Combinaciones con arroz, garbanzos y avena',
          65:'Alimentación y hormonas en el hombre', 66:'Alimentación y hormonas en la mujer'}
titles.update({10+i:f'Día {i+1} · {day}' for i,day in enumerate(['Lunes','Martes','Miércoles','Jueves','Viernes'])})
sections = [{'id':g[2], 'title':g[3], 'items':[]} for g in groups]
reader = PdfReader(source)
assert len(reader.pages) == 66
with pdfplumber.open(source) as pdf:
    for number, page in enumerate(pdf.pages, 1):
        section = next(s for s,g in zip(sections,groups) if g[0] <= number <= g[1])
        if number == 64:
            section = next(s for s in sections if s['id'] == 'infusiones')
        lines = page.crop((0,70,page.width,min(775,page.height-30))).extract_text_lines()
        title_lines = [line for line in lines if max(c['size'] for c in line['chars']) >= 19]
        title = titles.get(number) or ' '.join(line['text'] for line in title_lines)
        if not title:
            title = f'Lámina de {section["title"].lower()} · {number}'
        blocks = []
        for line in lines:
            if line in title_lines: continue
            heading = max(c['size'] for c in line['chars']) >= 13
            text = line['text']
            if not heading and blocks and not blocks[-1]['heading'] and line['top'] - last_bottom < 9:
                blocks[-1]['text'] += ' ' + text
            else: blocks.append({'heading':heading, 'text':text})
            last_bottom = line['bottom']
        resources = {Path(im.name).stem: im for im in reader.pages[number-1].images}
        images = []
        for index, obj in enumerate(page.images):
            im = Image.open(BytesIO(resources[obj['name']].data)).convert('RGB')
            # Retain the larger resolution for the illustrated text sheets.
            im.thumbnail((1800,2400))
            filename = f'{digest[:10]}-{number:02}-{index}.webp'
            im.save(out / filename, 'WEBP', quality=90)
            images.append('/nutricion/alimentacion/' + filename)
        sections[[s['id'] for s in sections].index(section['id'])]['items'].append({
            'page':number, 'title':title, 'blocks':blocks, 'images':images})
assert sum(len(s['items']) for s in sections) == 66
assert all(i['blocks'] or i['images'] for s in sections for i in s['items'])
(root / 'src/admin-alimentacion.json').write_text(json.dumps({'source':{'sha256':digest,'pages':66},'sections':sections},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported 66 pages in 11 categories; PDF remains outside the published app.')
