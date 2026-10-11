// Categories are selectable possibilities, not debts or tax assessments.
export const expenseGroups = [
  {title:'Local y servicios',items:['Alquiler','Luz','Agua','Internet','Teléfono','Gastos comunes','Gas','Seguridad','Reparaciones del local']},
  {title:'Funcionamiento',items:['Insumos','Café','Limpieza','Lavandería','Control de plagas','Mantenimiento de equipos','Equipamiento','Material deportivo','Botiquín']},
  {title:'Personal',items:['Sueldos','Aguinaldo','Salario vacacional','Liquidación de egreso','Honorarios profesionales','Capacitación','Uniformes']},
  {title:'Aportes e impuestos',items:['BPS','DGI','Convenio BPS','Convenio DGI','Multas y recargos','Tributos del local']},
  {title:'Seguros y habilitaciones',items:['BSE — accidentes de trabajo','Seguro del local','Responsabilidad civil','Habilitación municipal','Bomberos','Extintores','Derechos de música']},
  {title:'Administración',items:['Contador','Facturación electrónica','Software y suscripciones','Comisiones bancarias','Comisiones de cobro','Publicidad','Otros']},
]
export const expenseCategories=expenseGroups.flatMap(group=>group.items)
export const quickExpenseCategories=['Luz','Agua','Alquiler','BPS','Sueldos','Insumos','Café','Limpieza','DGI']
const aliases:Record<string,string>={'BPS y aportes':'BPS','Café y cafetería':'Café','Limpieza e higiene':'Limpieza','Contador y asesoría':'Contador','Seguridad y alarmas':'Seguridad'}
export const expenseLabel=(value:string)=>aliases[value]??value
export const expenseHelp:Record<string,string>={
  BPS:'Podés guardar solo el monto total o activar el desglose opcional. En ambos casos se registra un único gasto; no vuelvas a cargar sus componentes por separado.',
  DGI:'Registrá el importe de la obligación real. IVA mínimo, IVA, IRAE, Patrimonio u otros conceptos dependen del régimen de la empresa; no son todos obligatorios a la vez. Usá la nota para identificar el impuesto y período. No repitas el IRPF ya incluido en BPS.',
  Sueldos:'Para este control de pagos, registrá el líquido a pagar al personal. Si las retenciones se ingresan dentro de BPS, no sumes además el sueldo nominal como otro pago. El costo laboral contable se determina por separado.',
  Aguinaldo:'Registrá el líquido a pagar de la liquidación correspondiente. No lo dupliques si ya está incluido en otro registro del personal.',
  'Salario vacacional':'Registrá el importe de la liquidación. La remuneración habitual de la licencia no debe duplicarse si ya está incluida en Sueldos.',
  'Liquidación de egreso':'Ingresá el saldo real de la liquidación final. Evitá repetir sueldos, aguinaldo o salario vacacional ya registrados.',
  'Convenio BPS':'Registrá solo la cuota efectivamente facturada del convenio. Si ya está incluida en la factura BPS cargada, no la sumes otra vez.',
  'Convenio DGI':'Registrá la cuota del convenio, identificando el período en la nota. No dupliques importes ya registrados en DGI.',
  'Multas y recargos':'Solo cuando existan y no estén incluidos en otra obligación cargada. Indicá el organismo y período en la nota.',
  'BSE — accidentes de trabajo':'Corresponde al seguro de accidentes de trabajo del personal dependiente. Es distinto de los aportes BPS; registrá el importe de la póliza o cuota real.',
  'Derechos de música':'Si corresponde por la difusión de música en el gimnasio, registrá la licencia o factura aplicable. Una suscripción de música no necesariamente cubre el uso público.',
  'Tributos del local':'Solo los tributos que correspondan al gimnasio según propiedad, contrato y departamento. No se crean cargos automáticamente.',
}
