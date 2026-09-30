from pathlib import Path
import json, html, shutil
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]
guide = json.loads((root/'src/nutritionGuide.json').read_text(encoding='utf-8-sig'))
out = root.parent/'output/pdf/guia-alimentacion-gns.pdf'
out.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Body', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
W,H=595.28,841.89
c=canvas.Canvas(str(out),pagesize=(W,H)); c.setTitle(guide['title']+' | GNS FITNESS');c.setAuthor('GNS FITNESS')
ink='#25372d'; gold='#ac813b'
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=12.5,leading=19,textColor=HexColor(ink)),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8,leading=11,textColor=HexColor('#5b645d')),
 'title':ParagraphStyle('title',fontName='Bold',fontSize=24,leading=28,textColor=HexColor(ink)),
 'lead':ParagraphStyle('lead',fontName='Body',fontSize=12,leading=17,textColor=HexColor(ink))}
def text(t,y,style='body',x=46,width=W-92):
 p=Paragraph(t,styles[style]);_,h=p.wrap(width,H);p.drawOn(c,x,y-h);return y-h-10
def page(num,tag):
 c.setFillColor(HexColor('#fcfaf5'));c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(HexColor(ink));c.rect(0,H-62,W,62,fill=1,stroke=0)
 c.setFont('Bold',12);c.setFillColor(HexColor('#e0be7c'));c.drawString(46,H-38,'GNS FITNESS')
 c.setFont('Body',9);c.drawRightString(W-46,H-38,tag)
 c.setStrokeColor(HexColor('#d9d2c4'));c.line(46,42,W-46,42)
 c.setFont('Body',8);c.setFillColor(HexColor(ink));c.drawString(46,28,'Alimentación y entrenamiento | Septiembre 2026');c.drawRightString(W-46,28,str(num))
def photo(name,y,height):
 image=ImageReader(str(root/'public/nutricion'/name));iw,ih=image.getSize();width=height*iw/ih
 c.drawImage(image,(W-width)/2,y-height,width,height,mask='auto');return y-height-12
def diagram(y):
 cx,cy,r=150,y-82,76
 for start,extent,color in [(90,180,'#6b895d'),(0,90,'#dcb772'),(270,90,'#ae7159')]:
  c.setFillColor(HexColor(color));c.wedge(cx-r,cy-r,cx+r,cy+r,start,extent,fill=1,stroke=0)
 text('<b>1/2</b> verduras y frutas',y-24,x=260,width=280)
 text('<b>1/4</b> proteínas',y-65,x=260,width=280)
 text('<b>1/4</b> cereales u otra fuente de energía',y-105,x=260,width=280)
 return y-177
page(1,'GUÍA PRÁCTICA')
y=text('Aprendé a<br/>alimentarte',H-95,'title');y=text(guide['subtitle'],y,'lead')
y=photo('plato-equilibrado.png',y-4,270)
y=text(guide['intro'],y-2,'lead')
y=text('Plato equilibrado · Pre y postentreno · Diez ideas de desayuno<br/>Compras · Organización · Hábitos sostenibles',y)
y=text(guide['scope'],y-4,'small')
y=text('Imágenes ilustrativas creadas con IA y diagramas originales. Las porciones de las imágenes no indican cantidades personalizadas.',y,'small')
c.showPage()
for index,sec in enumerate(guide['sections'],2):
 page(index,'APRENDER + PRACTICAR')
 y=text(html.escape(sec['title']),H-90,'title');y=text(html.escape(sec['lead']),y,'lead')
 if sec['visual']=='plate': y=diagram(y)
 if sec['visual'] in ['timing','recovery']: y=photo('colaciones.png',y,135)
 for item in sec['items']: y=text('• '+html.escape(item),y)
 y=text('<b>Para poner en práctica</b><br/>'+html.escape(sec['practice']),y-2)
 refs=[]
 for sid in sec['sources']:
  source=next(s for s in guide['sources'] if s['id']==sid)
  refs.append('<a href="'+source['url']+'" color="#826327">'+html.escape(source['name'])+'</a>')
 y=text('Fuentes: '+' · '.join(refs),y,'small')
 if y<52: raise RuntimeError('Content overflow: '+sec['id']+' y='+str(y))
 c.showPage()
page(12,'FUENTES Y ALCANCE')
y=text('Para seguir aprendiendo',H-90,'title')
y=text('Fuentes consultadas el 30/09/2026. Tocá los títulos para abrirlas. Las referencias de Instagram aportan ideas temáticas; no sustituyen fuentes sanitarias ni implican aval de sus autores.',y)
for source in guide['sources']:
 y=text('<a href="'+source['url']+'" color="#826327">'+html.escape(source['name'])+'</a>',y)
y=text('Los ejemplos de comidas y ejercicios de organización fueron redactados para esta guía. No se reprodujeron recetas completas, capturas ni imágenes de terceros. No se realizó una revisión exhaustiva de todas las publicaciones del perfil de Instagram.',y)
y=text(guide['scope'],y,'small')
if y<52: raise RuntimeError('Sources overflow')
c.save()
shutil.copyfile(out,root/'public/nutricion/guia-alimentacion-gns.pdf')
print(str(out))
