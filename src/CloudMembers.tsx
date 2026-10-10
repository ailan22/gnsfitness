import './MemberDirectory.css'
import { uruguayToday } from './planReminders'
import DeleteStudentAccount from './DeleteStudentAccount'
import MemberWorkspace from './MemberWorkspace'
import ProgramResults from './ProgramResults'
import MemberHealthSections from './MemberHealthSections'
import StudentAccess from './StudentAccess'
import { readAllPages } from './readAllPages'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import CloudMemberHistory from './CloudMemberHistory'
import { daysUntil } from './membership'
import HealthFormFields from './HealthFormFields'
import { blankHealthDraft, validateHealthDraft, sameHealthContent, type HealthDraft } from './healthRecords'

type CloudMember = {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  birth_date: string | null
  joined_at: string
  status: 'Activo' | 'Inactivo' | 'Pausado' | 'Baja'
  welcome_form: 'Bienvenido' | 'Bienvenida' | 'Te damos la bienvenida'
  emergency_contact_name: string
  emergency_contact_phone: string
  health_provider: string
  goal: string
  limitations: string
  trainer_name: string
}
type MemberForm = Omit<CloudMember, 'id'> & { notes: string }
type MembershipSummary = { id: string; member_id: string; starts_at: string; ends_at: string; price: number; plan_name: string }
type PaymentSummary = { membership_id: string; amount: number }
type PlanFilter = 'Todos' | 'Al día' | 'Por vencer' | 'Vencidos' | 'Sin plan'
type PaymentFilter = 'Todos' | 'Con saldo pendiente' | 'Sin saldo pendiente'

const today = uruguayToday
const blank = (): MemberForm => ({ first_name: '', last_name: '', phone: '', email: '', birth_date: null,
  joined_at: today(), status: 'Activo', welcome_form: 'Te damos la bienvenida', emergency_contact_name: '', emergency_contact_phone: '',
  goal: '', limitations: '', trainer_name: '', notes: '', health_provider: '' })

export default function CloudMembers({ client, onCountChange, initialNew = false, initialMemberId = null, initialFilter = 'all', onDirtyChange }: {
  client: SupabaseClient
  onCountChange: (count: number) => void
  initialNew?: boolean
  initialFilter?: 'all' | 'expired' | 'pending'
  onDirtyChange?: (dirty: boolean) => void
  initialMemberId?: string | null
}) {
  const [members, setMembers] = useState<CloudMember[]>([])
  const [memberships, setMemberships] = useState<MembershipSummary[]>([])
  const [payments, setPayments] = useState<PaymentSummary[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [form, setForm] = useState<MemberForm>(blank)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(initialNew)
  const [intake, setIntake] = useState<HealthDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [healthDirty, setHealthDirty] = useState(false)
  const [resultDirty, setResultDirty] = useState(false)
  const intakeId = useRef(crypto.randomUUID())
  const newMemberId = useRef(crypto.randomUUID())
  const saveBusy = useRef(false)
  const [historyId, setHistoryId] = useState<string | null>(initialMemberId)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [planFilter, setPlanFilter] = useState<PlanFilter>(initialFilter === 'expired' ? 'Vencidos' : 'Todos')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(initialFilter === 'pending' ? 'Con saldo pendiente' : 'Todos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => { onDirtyChange?.(dirty || healthDirty || resultDirty); return () => onDirtyChange?.(false) }, [dirty, healthDirty, resultDirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [memberResult, notesResult, plansResult, paymentsResult] = await Promise.all([
      readAllPages((from, to) => client.from('members').select('id,first_name,last_name,phone,email,birth_date,joined_at,status,welcome_form,emergency_contact_name,emergency_contact_phone,health_provider,goal,limitations,trainer_name', { count: 'exact' }).order('joined_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('member_admin_notes').select('member_id,notes', { count: 'exact' }).order('member_id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('memberships').select('id,member_id,starts_at,ends_at,price,plan_name', { count: 'exact' }).order('starts_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readAllPages((from, to) => client.from('payments').select('membership_id,amount', { count: 'exact' }).order('id', { ascending: true }).range(from, to)),
    ])
    setLoading(false)
    if (memberResult.error || notesResult.error || plansResult.error || paymentsResult.error) {
      setError('No se pudo leer la lista completa de socios, planes y pagos en Supabase.')
      return
    }
    const rows = (memberResult.data || []) as CloudMember[]
    setMembers(rows)
    setMemberships((plansResult.data || []) as MembershipSummary[])
    setPayments((paymentsResult.data || []) as PaymentSummary[])
    setNotes(Object.fromEntries((notesResult.data || []).map(row => [row.member_id, row.notes])))
    onCountChange(rows.length)
    setError('')
  }, [client, onCountChange])

  useEffect(() => {
    const timer = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(timer)
  }, [refresh])

  function edit(member: CloudMember) {
    if ((healthDirty || resultDirty) && !window.confirm('¿Descartar los cambios sin guardar?')) return
    setIntake(null); setDirty(false); intakeId.current = crypto.randomUUID()
    setForm({ ...member, notes: notes[member.id] || '' })
    setSelectedId(member.id)
    setOpen(true)
    setError(''); setMessage('')
  }
  function update<K extends keyof MemberForm>(field: K, value: MemberForm[K]) {
    setDirty(true)
    setForm(previous => ({ ...previous, [field]: value }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveBusy.current) return
    if (!form.first_name.trim() || !form.last_name.trim() || !form.joined_at || form.joined_at > today() ||
      (form.birth_date && (form.birth_date > today() || form.birth_date > form.joined_at))) {
      setError('Revisá el nombre, apellido y las fechas.'); return
    }
    if (intake) { const invalid = validateHealthDraft('training_intake', intake); if (invalid) { setError(invalid); return } }
    saveBusy.current = true
    setSaving(true); setError(''); setMessage('')
    try {
    const id = selectedId || newMemberId.current
    const { notes: administrativeNotes, ...values } = form
    const row: CloudMember = { ...values, id, first_name: values.first_name.trim(), last_name: values.last_name.trim(),
      email: values.email.trim(), birth_date: values.birth_date || null }
    const result = selectedId ? await client.from('members').update(row).eq('id', id).select('id').single() :
      await client.from('members').insert(row).select('id').single()
    if (result.error) {
      // A lost insert response may have saved the person. Never retry with a new ID.
      const existing = !selectedId && await client.from('members').select('id').eq('id', id).maybeSingle()
      if (!existing || existing.error || !existing.data) { setError('No se pudo guardar la ficha. Revisá los datos y reintentá.'); return }
      const retry = await client.from('members').update(row).eq('id', id).select('id').single()
      if (retry.error) { setError('La ficha existe, pero no se pudo confirmar su actualización. Reintentá.'); return }
    }
    setSelectedId(id)
    const notesResult = await client.from('member_admin_notes').upsert({ member_id: id, notes: administrativeNotes })
    if (notesResult.error) {
      setError('El socio se guardó, pero sus observaciones no. Copiá las observaciones antes de salir y volvé a guardar.'); return
    }
    if (intake) {
      const clinicalRow = { id: intakeId.current, member_id: id, kind: 'training_intake', ...intake }
      const health = await client.from('health_records').insert(clinicalRow).select('id').single()
      if (health.error) {
        const existing = await client.from('health_records').select('*').eq('id', intakeId.current).maybeSingle()
        if (existing.error || !existing.data) { setError('La ficha personal quedó guardada, pero la anamnesis no pudo confirmarse. Conservamos lo escrito: reintentá guardar. No se creará otro socio.'); return }
        if (!sameHealthContent(existing.data, clinicalRow)) { setError('La anamnesis del primer intento sí quedó guardada. Los cambios posteriores deben registrarse como rectificación desde su historial. Conservá lo nuevo antes de cancelar.'); return }
      }
    }
    setIntake(null); setDirty(false)
    setOpen(false); setSelectedId(null); setForm(blank())
    setHistoryId(id)
    setMessage('Ficha guardada correctamente.')
    await refresh()
    } catch { setError('No se pudo confirmar el guardado. Conservamos los datos para que puedas reintentar.') }
    finally { setSaving(false); saveBusy.current = false }
  }

  const selected = members.find(member => member.id === historyId)
  const query = search.trim().toLocaleLowerCase('es')
  const currentPlans = new Map<string, MembershipSummary>()
  for (const plan of memberships) if (!currentPlans.has(plan.member_id)) currentPlans.set(plan.member_id, plan)
  const received = new Map<string, number>()
  for (const payment of payments) received.set(payment.membership_id,
    (received.get(payment.membership_id) || 0) + Math.round(Number(payment.amount) * 100))
  const balanceFor = (plan: MembershipSummary | undefined) => plan
    ? Math.max(0, Math.round(Number(plan.price) * 100) - (received.get(plan.id) || 0)) : 0
  const balances = new Map<string, number>()
  for (const plan of memberships) balances.set(plan.member_id, (balances.get(plan.member_id) ?? 0) + balanceFor(plan))
  const visibleMembers = members.filter(member => {
    if (statusFilter !== 'Todos' && member.status !== statusFilter) return false
    if (query && ![member.first_name, member.last_name, member.phone, member.email, member.id]
      .join(' ').toLocaleLowerCase('es').includes(query)) return false
    const plan = currentPlans.get(member.id)
    const days = plan ? daysUntil(plan.ends_at, today()) : null
    if (planFilter === 'Sin plan' && plan) return false
    if (planFilter === 'Vencidos' && !(days !== null && days < 0)) return false
    if (planFilter === 'Por vencer' && !(days !== null && days >= 0 && days <= 10)) return false
    if (planFilter === 'Al día' && !(days !== null && days > 10)) return false
    if (paymentFilter === 'Con saldo pendiente' && (balances.get(member.id) ?? 0) === 0) return false
    if (paymentFilter === 'Sin saldo pendiente' && (balances.get(member.id) ?? 0) > 0) return false
    return true
  })
  const lastPage = Math.max(0, Math.ceil(visibleMembers.length / 50) - 1)
  const currentPage = Math.min(page, lastPage)
  const pageMembers = visibleMembers.slice(currentPage * 50, (currentPage + 1) * 50)

  return <section className={`cloud-members${selected || open ? ' member-record-view' : ''}`} id="socios-supabase" aria-label="Personas y socios">
    {selected || open ? <button type="button" className="back" disabled={saving} onClick={() => { if ((dirty || healthDirty || resultDirty) && !window.confirm('¿Descartar los cambios sin guardar?')) return; setHistoryId(null); setOpen(false); setIntake(null); setDirty(false); setError(''); setMessage('') }}>← Volver a socios</button> : null}
    {message && <p role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!selected && !open && <div className="member-directory">
      <div className="heading member-directory-heading"><div><h2>SOCIOS</h2><p>Toda la información esencial, en un solo lugar.</p></div><button type="button" onClick={()=>{setOpen(true);setSelectedId(null);setForm(blank());setIntake(null);setDirty(false);newMemberId.current=crypto.randomUUID();intakeId.current=crypto.randomUUID();setError('');setMessage('')}}>+ Nuevo socio</button></div>
      <div className="member-directory-toolbar"><label className="member-directory-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg><input aria-label="Buscar socio" type="search" placeholder="Buscar por nombre, correo o celular" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label><nav aria-label="Filtrar socios por plan">{(['Todos','Al día','Por vencer','Vencidos'] as const).map(filter=><button type="button" key={filter} aria-pressed={planFilter===filter} className={planFilter===filter?'active':'secondary'} onClick={()=>{setPlanFilter(filter);setPage(0)}}>{filter}</button>)}</nav></div>
      <details className="member-directory-extra"><summary>Más filtros{statusFilter!=='Todos'||paymentFilter!=='Todos'||planFilter==='Sin plan'?' · Aplicados':''}</summary><div className="cloud-filters"><label>Estado del socio<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(0)}}>{['Todos','Activo','Inactivo','Pausado','Baja'].map(status=><option key={status}>{status}</option>)}</select></label><label>Plan<select value={planFilter} onChange={e=>{setPlanFilter(e.target.value as PlanFilter);setPage(0)}}>{(['Todos','Al día','Por vencer','Vencidos','Sin plan'] as const).map(option=><option key={option}>{option}</option>)}</select></label><label>Pago<select value={paymentFilter} onChange={e=>{setPaymentFilter(e.target.value as PaymentFilter);setPage(0)}}>{(['Todos','Con saldo pendiente','Sin saldo pendiente'] as const).map(option=><option key={option}>{option}</option>)}</select></label><button type="button" className="secondary" disabled={loading} onClick={()=>void refresh()}>Actualizar lista</button></div></details>
      <div className="member-directory-table-frame"><div className="member-directory-scroll"><table className="member-directory-table"><thead><tr><th scope="col">Socio</th><th scope="col">Plan</th><th scope="col">Vencimiento</th><th scope="col">Estado</th><th scope="col"><span className="directory-visually-hidden">Abrir ficha</span></th></tr></thead><tbody>
        {loading?<tr><td colSpan={5} role="status">Cargando socios…</td></tr>:pageMembers.length===0?<tr><td colSpan={5}>{members.length===0?'Todavía no hay socios cargados.':'No hay socios que coincidan con la búsqueda o los filtros.'}</td></tr>:pageMembers.map(member=>{
          const plan=currentPlans.get(member.id),days=plan?daysUntil(plan.ends_at,today()):null
          const label=!plan?'Sin plan':days===null?'Fecha inválida':days<0?'Vencido':days<=10?'Por vencer':'Al día'
          const state=days===null?'neutral':days<0?'expired':days<=10?'expiring':'current'
          const openRecord=()=>{setHistoryId(member.id);setError('');setMessage('');window.scrollTo({top:0,behavior:'instant'})}
          return <tr key={member.id} onClick={openRecord}><td><button className="member-directory-person" type="button" onClick={event=>{event.stopPropagation();openRecord()}}><span className="member-directory-initials" aria-hidden="true">{member.first_name.slice(0,1)}{member.last_name.slice(0,1)}</span><span><strong>{member.first_name} {member.last_name}</strong><small>{member.email||member.phone||'Sin contacto registrado'}</small></span></button></td><td>{plan?.plan_name||'Sin plan'}</td><td>{plan?.ends_at?new Intl.DateTimeFormat('es-UY',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Montevideo'}).format(new Date(`${plan.ends_at}T12:00:00-03:00`)):'—'}</td><td><span className={`directory-plan-status ${state}`}><span aria-hidden="true">{state==='current'?'✓':state==='expired'?'!':state==='expiring'?'◷':'—'}</span>{label}</span></td><td><button type="button" className="member-directory-arrow" aria-label={`Abrir ficha de ${member.first_name} ${member.last_name}`} onClick={event=>{event.stopPropagation();openRecord()}}>›</button></td></tr>
        })}
      </tbody></table></div><footer className="member-directory-footer"><span>{visibleMembers.length} {visibleMembers.length===1?'socio':'socios'}{visibleMembers.length!==members.length?` de ${members.length}`:''}</span><nav aria-label="Páginas de socios"><button className="text-button" type="button" disabled={loading||currentPage===0} onClick={()=>setPage(currentPage-1)}>‹ Anterior</button><span className="directory-page" aria-label={`Página ${currentPage+1} de ${lastPage+1}`}>{currentPage+1}</span><button className="text-button" type="button" disabled={loading||currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>Siguiente ›</button></nav></footer></div>
      <p className="member-directory-hint">Seleccioná un socio para abrir su ficha</p><p className="member-directory-signature">GYM NATURE SOUL</p>
    </div>}
    {selected && !open && <>
      <p className="eyebrow">FICHA PERSONAL · {selected.id.slice(0, 8).toUpperCase()}</p>
      <div className="heading"><h2>{selected.first_name} {selected.last_name}</h2><button type="button" onClick={() => edit(selected)}>Editar datos</button></div>
      <MemberWorkspace key={selected.id} name={`${selected.first_name} ${selected.last_name}`} personal={<>
        <dl className="member-personal-grid">
          <div><dt>Correo</dt><dd>{selected.email || 'Sin registrar'}</dd></div>
          <div><dt>Celular</dt><dd>{selected.phone || 'Sin registrar'}</dd></div>
          <div><dt>Fecha de inicio</dt><dd>{selected.joined_at?.split('-').reverse().join('/') || 'Sin registrar'}</dd></div>
          <div><dt>Contacto de emergencia</dt><dd>{selected.emergency_contact_name || 'Sin registrar'}</dd></div>
          <div><dt>Prestador de salud</dt><dd>{selected.health_provider || 'Sin registrar'}</dd></div>
        </dl>
        <div className="member-personal-actions"><button type="button" className="text-button" onClick={() => edit(selected)}>Editar datos</button>
          <details><summary>Perfil de entrenamiento</summary><p>Objetivo: {selected.goal || 'Sin registrar'}</p><p>Limitaciones o cuidados: {selected.limitations || 'Sin registrar'}</p></details></div>
      </>}>
      <CloudMemberHistory accountActions={<DeleteStudentAccount key={`delete-${selected.id}`} client={client} memberId={selected.id} name={`${selected.first_name} ${selected.last_name}`} onDeleted={() => void refresh()}/>} client={client} memberId={selected.id} memberName={`${selected.first_name} ${selected.last_name}`} assignedTrainer={selected.trainer_name}
        memberOptions={members.map(member => ({ id: member.id, name: `${member.first_name} ${member.last_name}` }))}
        onChanged={() => { onCountChange(members.length); onDirtyChange?.(dirty || healthDirty || resultDirty) }} onClose={() => { if ((healthDirty || resultDirty) && !window.confirm('¿Descartar los cambios sin guardar?')) return; setHistoryId(null); void refresh() }}>
      <div data-member-section="health" tabIndex={-1}><MemberHealthSections key={selected.id} client={client} memberId={selected.id} onDirtyChange={setHealthDirty}/></div>
      <div data-member-section="access" tabIndex={-1}><StudentAccess key={selected.id + selected.email} client={client} member={selected} /></div>
      <div data-member-section="results" tabIndex={-1}><ProgramResults key={selected.id} client={client} memberId={selected.id} admin onDirtyChange={setResultDirty}/></div>

      </CloudMemberHistory>
      </MemberWorkspace>
    </>}
    {open && <><p className="eyebrow">PERSONAS · FICHAS Y ENTRENAMIENTO</p><h2>{selectedId ? 'Editar datos del socio' : 'Nuevo socio'}</h2><form className="card form cloud-member-form" onInvalidCapture={event => { const detail = (event.target as HTMLElement).closest('details'); if (detail) detail.open = true }} onSubmit={event => void save(event)}><fieldset className="plain-fieldset member-form-fields" disabled={saving}>
      <div className="grid">
        <label>Nombre *<input required value={form.first_name} onChange={event => update('first_name', event.target.value)}/></label>
        <label>Apellido *<input required value={form.last_name} onChange={event => update('last_name', event.target.value)}/></label>
        <label>Teléfono<input type="tel" value={form.phone} onChange={event => update('phone', event.target.value)}/></label>
        <label>Correo<input type="email" value={form.email} onChange={event => update('email', event.target.value)}/></label>
        <label>Fecha de inicio *<input type="date" required max={today()} value={form.joined_at} onChange={event => update('joined_at', event.target.value)}/></label>
        <label>Prestador de salud<input maxLength={160} placeholder="Mutualista, ASSE o seguro de salud" value={form.health_provider ?? ''} onChange={event => update('health_provider', event.target.value)}/></label>
        <label>Contacto de emergencia<input value={form.emergency_contact_name} onChange={event => update('emergency_contact_name', event.target.value)}/></label>
      </div>
      <details className="member-compact"><summary>Gestión y preferencias del socio</summary><div className="grid">
        <label>Estado<select value={form.status} onChange={event => update('status', event.target.value as MemberForm['status'])}>
          <option>Activo</option><option>Inactivo</option><option>Pausado</option><option>Baja</option>
        </select></label>
        <label>Saludo para el alumno<select value={form.welcome_form} onChange={event => update('welcome_form', event.target.value as MemberForm['welcome_form'])}>
          <option>Bienvenida</option><option>Bienvenido</option><option>Te damos la bienvenida</option>
        </select></label>
      </div></details>
      <label>Objetivo<input value={form.goal} onChange={event => update('goal', event.target.value)}/></label>
      <label>Limitaciones o cuidados<textarea value={form.limitations} onChange={event => update('limitations', event.target.value)}/></label>
      <details className="intake-accordion"><summary><span><strong>Anamnesis inicial de salud y entrenamiento</strong><small>Opcional al registrar · acceso privado</small></span></summary>
        <p className="muted">Podés completarla ahora o agregarla después desde la ficha. Se guardará como un registro nuevo, sin reemplazar anamnesis anteriores.</p>
        {!intake ? <button type="button" className="secondary" onClick={() => { setIntake(blankHealthDraft()); setDirty(true); intakeId.current = crypto.randomUUID() }}>Completar anamnesis ahora</button> : <>
          <HealthFormFields kind="training_intake" draft={intake} onChange={next => { setIntake(next); setDirty(true) }}/>
          <button type="button" className="text-button" onClick={() => { if (window.confirm('¿Descartar esta anamnesis sin guardar y dejarla para después?')) setIntake(null) }}>Dejar la anamnesis para después</button>
        </>}
      </details>
      <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : intake ? 'Guardar ficha y anamnesis' : 'Guardar ficha'}</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => { if (!dirty || window.confirm('¿Descartar los cambios sin guardar?')) { setOpen(false); setIntake(null); setDirty(false); setError('') } }}>Cancelar</button></div>
    </fieldset></form></>}
  </section>
}


