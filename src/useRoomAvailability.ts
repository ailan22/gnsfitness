import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from './readAllPages'
import type { RoomAppointment } from './roomSchedule'
export function useRoomAvailability(client?: SupabaseClient, revision = 0) {
  const [appointments, setAppointments] = useState<RoomAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true, busy = false
    async function load() {
      if (!client || busy) return
      busy = true
      try {
        const result = await readAllPages((a,b) => client!.from('room_appointments').select('id,member_id,membership_id,kind,session_date,starts_at,ends_at,cancelled',{count:'exact'}).eq('cancelled',false).order('starts_at').order('id').range(a,b))
        if (result.error) throw new Error('load')
        if (active) { setAppointments(result.data as RoomAppointment[]); setError('') }
      } catch { if (active) setError('No se pudo consultar la sala. Actualizá antes de elegir un horario.') }
      finally { busy=false; if (active) setLoading(false) }
    }
    const start=setTimeout(()=>void load(),0)
    const refresh=()=> { if(document.visibilityState==='visible') void load() }
    const timer=setInterval(refresh,30_000)
    window.addEventListener('focus',refresh)
    return()=>{active=false;clearTimeout(start);clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[client,revision])
  return {appointments,loading,error}
}
