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
groups = [(1,7,'consejos','Alimentación saludable: tips y consejos'),
          (8,17,'desayunos','Desayunos'), (18,27,'almuerzos','Almuerzos'),
          (28,37,'meriendas','Meriendas'), (38,47,'cenas','Cenas'),
          (48,53,'cinco-dias','Cinco días de alimentación'),
          (54,64,'bebidas','Infusiones y aguas con ingredientes'),
          (65,72,'salud-hormonal','Alimentación y salud hormonal'),
          (73,75,'antojos','Antojos y postres')]
sections = [{'id':g[2], 'title':g[3], 'items':[]} for g in groups]
reader = PdfReader(source)
assert len(reader.pages) == 75
with pdfplumber.open(source) as pdf:
    for number, page in enumerate(pdf.pages, 1):
        section = next(s for s,g in zip(sections,groups) if g[0] <= number <= g[1])
        lines = page.crop((0,70,page.width,775)).extract_text_lines()
        title_lines = [line for line in lines if max(c['size'] for c in line['chars']) >= 19]
        title = ' '.join(line['text'] for line in title_lines)
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
assert sum(len(s['items']) for s in sections) == 75
assert all(i['blocks'] or i['images'] for s in sections for i in s['items'])
(root / 'src/admin-alimentacion.json').write_text(json.dumps({'source':{'sha256':digest,'pages':75},'sections':sections},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported 75 pages in 9 categories; PDF remains outside the published app.')
