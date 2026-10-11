export type BpsDetail={period:string;reference:string;lines:{label:string;amount_cents:number}[]}
export const bpsGroups=[
 {title:'Titular de la empresa',items:['Jubilatorio del titular','Fonasa del titular','FRL del titular']},
 {title:'Personal · retenciones al empleado',items:['Jubilatorio personal','Fonasa personal','FRL personal','IRPF retenido']},
 {title:'Empresa · aportes patronales',items:['Jubilatorio patronal','Fonasa patronal','Complemento de cuota mutual','FRL patronal','Fondo de garantía de créditos laborales']},
 {title:'Ajustes de la factura',items:['Multas','Recargos','Cuota de convenio incluida','Otras deudas / reintegros','Otros conceptos','Créditos / bonificaciones']},
]
export const emptyBps=(period:string):BpsDetail=>({period,reference:'',lines:[]})
export const bpsTotal=(detail:BpsDetail)=>detail.lines.reduce((n,l)=>n+l.amount_cents,0)
