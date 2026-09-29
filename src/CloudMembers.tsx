import StudentAccess from './StudentAccess'
import { readAllPages } from './readAllPages'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import CloudMemberHistory from './CloudMemberHistory'
import { daysUntil } from './membership'

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
  goal: string
  limitations: string
  trainer_name: string
}
type MemberForm = Omit<CloudMember, 'id'> & { notes: string }
type MembershipSummary = { id: string; member_id: string; starts_at: string; ends_at: string; price: number }
type PaymentSummary = { membership_id: string; amount: number }
type PlanFilter = 'Todos' | 'Al día' | 'Por vencer' | 'Vencidos' | 'Sin plan'
type PaymentFilter = 'Todos' | 'Con saldo pendiente' | 'Sin saldo pendiente'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const blank = (): MemberForm => ({ first_name: '', last_name: '', phone: '', email: '', birth_date: null,
  joined_at: today(), status: 'Activo', welcome_form: 'Te damos la bienvenida', emergency_contact_name: '', emergency_contact_phone: '',
  goal: '', limitations: '', trainer_name: '', notes: '' })

export default function CloudMembers({ client, onCountChange }: {
  client: SupabaseClient
  onCountChange: (count: number) => void
}) {
  const [members, setMembers] = useState<CloudMember[]>([])
  const [memberships, setMemberships] = useState<MembershipSummary[]>([])
  const [payments, setPayments] = useState<PaymentSummary[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [form, setForm] = useState<MemberForm>(blank)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('Todos')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('Todos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [memberResult, notesResult, plansResult, paymentsResult] = await Promise.all([
      readAllPages((from, to) => client.from('members').select('id,first_name,last_name,phone,email,birth_date,joined_at,status,welcome_form,emergency_contact_name,emergency_contact_phone,goal,limitations,trainer_name', { count: 'exact' }).order('joined_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('member_admin_notes').select('member_id,notes', { count: 'exact' }).order('member_id', { ascending: true }).range(from, to)),
      readAllPages((from, to) => client.from('memberships').select('id,member_id,starts_at,ends_at,price', { count: 'exact' }).order('starts_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
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
    setForm({ ...member, notes: notes[member.id] || '' })
    setSelectedId(member.id)
    setOpen(true)
    setError(''); setMessage('')
  }
  function update<K extends keyof MemberForm>(field: K, value: MemberForm[K]) {
    setForm(previous => ({ ...previous, [field]: value }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (!form.first_name.trim() || !form.last_name.trim() || !form.joined_at || form.joined_at > today() ||
      (form.birth_date && (form.birth_date > today() || form.birth_date > form.joined_at))) {
      setError('Revisá el nombre, apellido y las fechas.'); return
    }
    setSaving(true); setError(''); setMessage('')
    const id = selectedId || crypto.randomUUID()
    const { notes: administrativeNotes, ...values } = form
    const row: CloudMember = { ...values, id, first_name: values.first_name.trim(), last_name: values.last_name.trim(),
      email: values.email.trim(), birth_date: values.birth_date || null }
    const result = selectedId ? await client.from('members').update(row).eq('id', id).select('id').single() :
      await client.from('members').insert(row).select('id').single()
    if (result.error) {
      setError('No se pudo guardar el socio en Supabase. Revisá los datos y los permisos.'); setSaving(false); return
    }
    const notesResult = await client.from('member_admin_notes').upsert({ member_id: id, notes: administrativeNotes })
    setSaving(false)
    if (notesResult.error) {
      setError('El socio se guardó, pero sus observaciones no. Copiá las observaciones antes de salir y volvé a guardar.'); return
    }
    setOpen(false); setSelectedId(null); setForm(blank())
    setHistoryId(id)
    setMessage('Ficha guardada en Supabase.')
    await refresh()
  }

  async function changeStatus(member: CloudMember, status: CloudMember['status']) {
    if (statusSaving || status === member.status) return
    setStatusSaving(true); setError(''); setMessage('')
    const { data, error: updateError } = await client.from('members').update({ status }).eq('id', member.id)
      .eq('status', member.status).select('id').maybeSingle()
    setStatusSaving(false)
    if (updateError || !data) { setError('No se pudo actualizar el estado. Puede haber cambiado en otra sesión; actualizá la lista y volvé a intentarlo.'); return }
    setMembers(current => current.map(item => item.id === member.id ? { ...item, status } : item))
    setMessage('Estado del socio guardado en Supabase.')
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
    if (paymentFilter === 'Con saldo pendiente' && balanceFor(plan) === 0) return false
    if (paymentFilter === 'Sin saldo pendiente' && balanceFor(plan) > 0) return false
    return true
  })
  const lastPage = Math.max(0, Math.ceil(visibleMembers.length / 50) - 1)
  const currentPage = Math.min(page, lastPage)
  const pageMembers = visibleMembers.slice(currentPage * 50, (currentPage + 1) * 50)

  return <section className="cloud-members" id="socios-supabase" aria-label="Socios en Supabase">
    {selected || open ? <button type="button" className="back" onClick={() => { setHistoryId(null); setOpen(false); setError(''); setMessage('') }}>← Volver a socios</button> : null}
    {message && <p role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!selected && !open && <>
      <div className="heading"><div><p className="eyebrow">ADMINISTRACIÓN · SUPABASE</p><h2>Socios</h2></div>
        <button type="button" onClick={() => { setOpen(true); setSelectedId(null); setForm(blank()); setError(''); setMessage('') }}>+ Nuevo socio</button></div>
      <p className="muted">Fichas guardadas en Supabase. Los datos antiguos de este navegador se pueden descargar desde «Respaldo de la demostración anterior» al final de la página.</p>
      <div className="cloud-filters"><label>Buscar socio<input type="search" placeholder="Nombre, teléfono, correo o ID" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }}/></label>
        <label>Estado<select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(0) }}>{['Todos', 'Activo', 'Inactivo', 'Pausado', 'Baja'].map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Plan<select value={planFilter} onChange={event => { setPlanFilter(event.target.value as PlanFilter); setPage(0) }}>{(['Todos', 'Al día', 'Por vencer', 'Vencidos', 'Sin plan'] as const).map(option => <option key={option}>{option}</option>)}</select></label>
        <label>Pago<select value={paymentFilter} onChange={event => { setPaymentFilter(event.target.value as PaymentFilter); setPage(0) }}>{(['Todos', 'Con saldo pendiente', 'Sin saldo pendiente'] as const).map(option => <option key={option}>{option}</option>)}</select></label>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={loading}>Actualizar lista</button></div>
      {!loading && <p className="muted results-count">Mostrando {visibleMembers.length} de {members.length} socios</p>}
      {loading ? <p>Cargando socios…</p> : members.length === 0 ? <div className="card empty">Todavía no hay socios cargados.</div> :
        visibleMembers.length === 0 ? <div className="card empty">No hay socios que coincidan con la búsqueda o los filtros.</div> :
        <div className="list">{pageMembers.map(member => {
          const plan = currentPlans.get(member.id)
          const days = plan ? daysUntil(plan.ends_at, today()) : null
          const balance = balanceFor(plan)
          return <button type="button" className="list-item" key={member.id} onClick={() => { setHistoryId(member.id); setError(''); setMessage('') }}>
            <span><strong>{member.first_name} {member.last_name}</strong><small>{member.email || member.phone || 'Sin contacto registrado'}</small>{balance > 0 && <small className="balance-due">Saldo pendiente: {new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(balance / 100)}</small>}</span>
            <span className="status">{member.status}</span><span className={`badge ${days !== null && days < 0 ? 'danger' : days !== null && days <= 10 ? 'warning' : ''}`}>{!plan ? 'Sin plan' : days === null ? 'Fecha inválida' : days < 0 ? 'Vencido' : days <= 10 ? 'Por vencer' : 'Al día'}</span><span aria-hidden="true">→</span>
          </button>
        })}</div>}
      {!loading && visibleMembers.length > 50 && <nav className="actions" aria-label="Páginas de socios">
        <button type="button" className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <span>Página {currentPage + 1} de {lastPage + 1} · Hasta 50 socios por página</span>
        <button type="button" className="secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
      </nav>}
    </>}
    {selected && !open && <>
      <p className="eyebrow">FICHA DEL SOCIO · SUPABASE · {selected.id.slice(0, 8).toUpperCase()}</p>
      <div className="heading"><h2>{selected.first_name} {selected.last_name}</h2><button type="button" onClick={() => edit(selected)}>Editar datos</button></div>
      <div className="grid cloud-profile-grid"><section className="card"><h2>Datos personales</h2><p>Teléfono: {selected.phone || 'Sin registrar'}</p><p>Correo: {selected.email || 'Sin registrar'}</p><p>Nacimiento: {selected.birth_date || 'Sin registrar'}</p><p>Fecha de alta: {selected.joined_at || 'Sin registrar'}</p><p>Saludo en su portal: {selected.welcome_form}</p><p>Contacto de emergencia: {selected.emergency_contact_name || 'Sin registrar'}</p><p>Teléfono de emergencia: {selected.emergency_contact_phone || 'Sin registrar'}</p></section>
        <section className="card"><h2>Estado del socio</h2><label>Estado<select value={selected.status} disabled={statusSaving} onChange={event => void changeStatus(selected, event.target.value as CloudMember['status'])}><option>Activo</option><option>Inactivo</option><option>Pausado</option><option>Baja</option></select></label><p className="muted">El estado del socio es independiente de los pagos y rutinas.</p></section></div>
      <section className="card profile"><h2>Perfil de entrenamiento</h2><p>Objetivo: {selected.goal || 'Sin registrar'}</p><p>Limitaciones o cuidados: {selected.limitations || 'Sin registrar'}</p><p>Entrenador asignado: {selected.trainer_name || 'Sin registrar'}</p><p>Observaciones administrativas: {notes[selected.id] || 'Ninguna'}</p></section>
      <StudentAccess key={selected.id + selected.email} client={client} member={selected} />
      <CloudMemberHistory client={client} memberId={selected.id} memberName={`${selected.first_name} ${selected.last_name}`} assignedTrainer={selected.trainer_name}
        memberOptions={members.map(member => ({ id: member.id, name: `${member.first_name} ${member.last_name}` }))}
        onChanged={() => onCountChange(members.length)} onClose={() => { setHistoryId(null); void refresh() }}/>
    </>}
    {open && <><p className="eyebrow">ADMINISTRACIÓN · SUPABASE</p><h2>{selectedId ? 'Editar datos del socio' : 'Nuevo socio'}</h2><form className="card form cloud-member-form" onSubmit={event => void save(event)}>
      <div className="grid">
        <label>Nombre *<input required value={form.first_name} onChange={event => update('first_name', event.target.value)}/></label>
        <label>Apellido *<input required value={form.last_name} onChange={event => update('last_name', event.target.value)}/></label>
        <label>Teléfono<input type="tel" value={form.phone} onChange={event => update('phone', event.target.value)}/></label>
        <label>Correo<input type="email" value={form.email} onChange={event => update('email', event.target.value)}/></label>
        <label>Nacimiento<input type="date" max={today()} value={form.birth_date || ''} onChange={event => update('birth_date', event.target.value || null)}/></label>
        <label>Alta *<input type="date" required max={today()} value={form.joined_at} onChange={event => update('joined_at', event.target.value)}/></label>
        <label>Estado<select value={form.status} onChange={event => update('status', event.target.value as MemberForm['status'])}>
          <option>Activo</option><option>Inactivo</option><option>Pausado</option><option>Baja</option>
        </select></label>
        <label>Saludo para el alumno<select value={form.welcome_form} onChange={event => update('welcome_form', event.target.value as MemberForm['welcome_form'])}>
          <option>Bienvenida</option><option>Bienvenido</option><option>Te damos la bienvenida</option>
        </select></label>
        <label>Entrenador asignado<input value={form.trainer_name} onChange={event => update('trainer_name', event.target.value)}/></label>
        <label>Contacto de emergencia<input value={form.emergency_contact_name} onChange={event => update('emergency_contact_name', event.target.value)}/></label>
        <label>Teléfono de emergencia<input type="tel" value={form.emergency_contact_phone} onChange={event => update('emergency_contact_phone', event.target.value)}/></label>
      </div>
      <label>Objetivo<input value={form.goal} onChange={event => update('goal', event.target.value)}/></label>
      <label>Limitaciones o cuidados<textarea value={form.limitations} onChange={event => update('limitations', event.target.value)}/></label>
      <label>Observaciones administrativas<textarea value={form.notes} onChange={event => update('notes', event.target.value)}/></label>
      <div className="actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar en Supabase'}</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => { setOpen(false); setError('') }}>Cancelar</button></div>
    </form></>}
  </section>
}
