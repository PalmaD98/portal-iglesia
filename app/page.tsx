'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [myEnrollments, setMyEnrollments] = useState<Set<string>>(new Set()) 
  
  // --- NUEVO ESTADO PARA CERTIFICADOS ---
  const [certificatesCount, setCertificatesCount] = useState(0) 

  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', location: '' })

  const router = useRouter()
  const supabase = createClientComponentClient()

  // --- CARGA INICIAL ---
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(profileData)

      fetchEvents()
      fetchMyData(session.user.id) // Cambié el nombre para que tenga sentido que trae todo
      
      setLoading(false)
    }
    init()
  }, [router, supabase])

  // --- FUNCIONES ---

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, enrollments(count)') 
      .order('event_date', { ascending: true })
      
    if (error) {
      console.log('Error cargando eventos:', error)
    } else {
      setEvents(data)
    }
  }

  // ESTA FUNCIÓN AHORA CALCULA INSCRIPCIONES Y CERTIFICADOS
  const fetchMyData = async (userId: string) => {
    const { data } = await supabase
      .from('enrollments')
      .select('*') // Traemos TODO para ver si está certificado
      .eq('user_id', userId)
    
    if (data) {
      // 1. Lógica de Inscripciones (para saber en qué eventos estoy)
      const enrolledEventIds = new Set(data.map((item: any) => item.event_id))
      setMyEnrollments(enrolledEventIds)

      // 2. Lógica de Certificados (Contamos cuántos true hay)
      const certs = data.filter((item: any) => item.certified === true).length
      setCertificatesCount(certs)
    }
  }

  const handleSubscribe = async (eventId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase
      .from('enrollments')
      .insert([{ user_id: session.user.id, event_id: eventId }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Recargar datos para actualizar contadores
      fetchMyData(session.user.id)
      fetchEvents() 
      alert('¡Inscripción exitosa!')
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('events').insert([
      {
        title: newEvent.title,
        description: newEvent.description,
        event_date: newEvent.date,
        location: newEvent.location
      }
    ])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('¡Evento creado exitosamente!')
      setIsCreating(false)
      setNewEvent({ title: '', description: '', date: '', location: '' })
      fetchEvents() 
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando tu portal...</div>

  // --- RENDERIZADO ---
  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-indigo-600">Portal Iglesia</h1>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-700">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 uppercase">{profile?.role === 'admin' ? 'Coordinador' : 'Alumno'}</p>
              </div>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1 rounded border border-red-200">
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Eventos Activos</p>
                <h3 className="text-2xl font-bold text-gray-800">{events.length}</h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">📅</div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
             <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Mis Inscripciones</p>
                <h3 className="text-2xl font-bold text-gray-800">{myEnrollments.size}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600">✅</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
             <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Certificados</p>
                {/* AQUI MOSTRAMOS EL NUEVO CONTADOR */}
                <h3 className="text-2xl font-bold text-gray-800">{certificatesCount}</h3>
              </div>
              <div className="p-3 bg-yellow-50 rounded-full text-yellow-600">🎓</div>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE EVENTOS */}
        <div className="border-t pt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Próximos Eventos y Seminarios</h2>
            
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setIsCreating(!isCreating)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition shadow-sm text-sm font-medium"
              >
                {isCreating ? 'Cancelar' : '+ Crear Evento'}
              </button>
            )}
          </div>

          {isCreating && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200 animate-fade-in-down">
              <h3 className="text-lg font-bold mb-4 text-gray-700">Nuevo Evento</h3>
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" placeholder="Título (Ej. Culto Dominical)" required
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                />
                <input 
                  type="text" placeholder="Ubicación (Ej. Auditorio)" required
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                />
                <input 
                  type="datetime-local" required
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                />
                <input 
                  type="text" placeholder="Descripción breve..."
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                />
                <button type="submit" className="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700 md:col-span-2 transition">
                  Guardar Evento
                </button>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.length === 0 ? (
              <p className="text-gray-500 col-span-3 text-center py-10 bg-white rounded-lg border border-dashed">
                No hay eventos programados aún.
              </p>
            ) : (
              events.map((event) => {
                const isRegistered = myEnrollments.has(event.id);
                // Extraer conteo seguro
                const enrollmentCount = event.enrollments && event.enrollments[0] ? event.enrollments[0].count : 0;

                return (
                  <div key={event.id} className="bg-white rounded-xl shadow-sm border hover:shadow-lg transition overflow-hidden flex flex-col group">
                    <div className={`h-1 transition-colors ${isRegistered ? 'bg-green-500' : 'bg-gray-200 group-hover:bg-indigo-500'}`}></div>
                    <div className="p-5 flex-1">
                      
                      <div className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wide flex items-center gap-1">
                         📅 {new Date(event.event_date).toLocaleDateString()} 
                         <span className="text-gray-300">|</span> 
                         ⏰ {new Date(event.event_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>

                      {/* Solo Admin ve el total de inscritos */}
                      {profile?.role === 'admin' && (
                        <div className="mb-3">
                            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-full border border-blue-100 flex w-fit items-center gap-1">
                              👥 {enrollmentCount} Inscritos
                            </span>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{event.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description || 'Sin descripción'}</p>
                      <div className="flex items-center text-gray-500 text-xs bg-gray-100 p-2 rounded w-fit">
                        📍 {event.location}
                      </div>
                    </div>

                    {/* PIE DE TARJETA CON LÓGICA DE BOTONES */}
                    <div className="bg-gray-50 p-3 border-t text-center">
                      {isRegistered ? (
                         // Si ya está inscrito, link al ticket/detalle
                         <Link href={`/events/${event.id}`} className="block w-full text-green-600 font-bold text-sm py-2 hover:bg-green-50 rounded transition">
                           ✅ Ya estás inscrito (Ver detalle)
                         </Link>
                      ) : (
                         // Si NO está inscrito, botón de acción
                         <button 
                           onClick={() => handleSubscribe(event.id)}
                           className="bg-indigo-600 text-white font-medium py-2 px-4 rounded text-sm hover:bg-indigo-700 w-full transition shadow-sm"
                         >
                           Inscribirme ahora
                         </button>
                      )}

                      {/* Botón extra para Admin que no se ha inscrito pero quiere gestionar */}
                      {!isRegistered && profile?.role === 'admin' && (
                         <Link href={`/events/${event.id}`} className="block mt-2 text-xs text-gray-500 hover:text-indigo-600 underline">
                           Administrar evento
                         </Link>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </main>
    </div>
  )
}