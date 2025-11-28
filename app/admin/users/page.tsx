'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UsersDirectory() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([]) 
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEvent, setFilterEvent] = useState('') 
  
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '', password: '', full_name: '', phone: '',
    address: '', birth_date: '', previous_church: '',
    baptism_date: '', holy_spirit_date: ''
  })
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // --- CARGA DE DATOS ---
  const loadData = async () => {
    setLoading(true)
    
    // 1. Cargar Eventos
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title')
      .order('title', { ascending: true }) 
    setEvents(eventsData || [])

    // 2. Cargar Usuarios
    const { data: profilesData } = await supabase
      .from('profiles')
      .select(`
        *,
        enrollments (
          grade,
          certified,
          attendance_data,
          event_id,
          events ( title )
        )
      `)
      .order('full_name', { ascending: true })
    
    setUsers(profilesData || [])
    setLoading(false)
  }

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (myProfile?.role !== 'admin') { router.push('/'); return }
      
      await loadData()
    }
    checkSession()
  }, [router, supabase])

  // --- LÓGICA DE FILTRADO ---
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())

    let matchesEvent = true
    if (filterEvent) {
      matchesEvent = user.enrollments?.some((enr: any) => enr.event_id === filterEvent)
    }

    return matchesSearch && matchesEvent
  })

  // --- EXPORTAR EXCEL DINÁMICO ---
  const exportToCSV = () => {
    if (filteredUsers.length === 0) return alert("No hay datos filtrados para exportar")

    // 1. Determinar qué columnas de eventos mostrar
    // Si hay filtro, solo mostramos ESE evento. Si no, mostramos TODOS.
    const eventsToExport = filterEvent 
        ? events.filter(e => e.id === filterEvent) 
        : events;

    // 2. Encabezados Fijos
    let headers = [
      "Nombre Completo", 
      "Email", 
      "Telefono", 
      "Direccion", 
      "Fecha Nacimiento",
      "Iglesia Procedencia", 
      "Bautismo Agua", 
      "Bautismo E.S.",
      "Rol", 
      "Estado"
    ]

    // 3. Encabezados Dinámicos (Solo los eventos seleccionados)
    eventsToExport.forEach(ev => {
        headers.push(`${ev.title} (Nota)`)
        headers.push(`${ev.title} (Asistencia)`)
    })

    // 4. Promedio (Si es reporte de 1 solo evento, es la nota de ese evento. Si es global, es promedio global)
    headers.push(filterEvent ? "NOTA FINAL" : "PROMEDIO GLOBAL")

    // 5. Construir las filas
    const rows = filteredUsers.map(u => {
      // Datos Fijos
      const row = [
        `"${u.full_name || ''}"`, 
        u.email || '', 
        `"${u.phone || ''}"`,
        `"${u.address || ''}"`,
        u.birth_date || '',
        `"${u.previous_church || ''}"`,
        u.baptism_date || '',
        u.holy_spirit_date || '',
        u.role === 'admin' ? 'Coordinador' : 'Alumno',
        u.approved ? 'Activo' : 'Pendiente'
      ]

      let sumGrades = 0
      let countGrades = 0

      // Datos Dinámicos (Solo recorremos los eventos que decidimos exportar)
      eventsToExport.forEach(ev => {
          const enrollment = u.enrollments?.find((e: any) => e.event_id === ev.id)

          if (enrollment) {
              row.push(String(enrollment.grade || 0)) // Nota
              
              const attendanceCount = enrollment.attendance_data?.topics?.filter((t: any) => t === true).length || 0
              row.push(`${attendanceCount} de 5`) // Asistencia

              if (enrollment.grade > 0) {
                  sumGrades += enrollment.grade
                  countGrades++
              }
          } else {
              // Si filtramos por Seminario 2, y el usuario aparece en la lista, TIENE que tener datos.
              // Pero por seguridad dejamos el guión.
              row.push("-")
              row.push("-")
          }
      })

      // Calcular Promedio/Nota Final
      const globalAverage = countGrades > 0 ? Math.round(sumGrades / countGrades) : 0
      row.push(String(globalAverage))

      return row
    })

    // Generar Archivo
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a"); link.href = url; 
    
    // Nombre del archivo limpio
    const eventTitle = filterEvent ? events.find(e => e.id === filterEvent)?.title : "Global";
    const fileName = `Reporte_${eventTitle.replace(/\s+/g, '_')}_${new Date().toLocaleDateString()}.csv`
    
    link.setAttribute("download", fileName);
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // --- ACTIONS ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    })
    const result = await response.json()
    if (!response.ok) alert('Error: ' + result.error)
    else {
      alert('¡Alumno registrado exitosamente!')
      setIsRegisterOpen(false)
      setNewUser({ email: '', password: '', full_name: '', phone: '', address: '', birth_date: '', previous_church: '', baptism_date: '', holy_spirit_date: '' })
      loadData() 
    }
    setCreating(false)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if(!confirm(`¿Eliminar a ${userName}?`)) return
    const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    })
    if(response.ok) { alert("Usuario eliminado."); loadData() } 
    else { alert("Error al eliminar.") }
  }

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: !currentStatus } : u))
    await supabase.from('profiles').update({ approved: !currentStatus }).eq('id', userId)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value })
  }

  if (loading) return <div className="p-10 text-center">Cargando directorio...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-end">
                <div>
                    <Link href="/" className="text-indigo-600 hover:underline text-sm font-bold">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-gray-900 mt-1">Directorio General</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsRegisterOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold text-sm shadow">
                        + Nuevo Alumno
                    </button>
                    <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow flex items-center gap-2">
                        📊 Exportar Reporte {filterEvent ? '(Filtrado)' : 'General'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Buscar Persona</label>
                    <input type="text" placeholder="Nombre o Correo..." className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="w-full md:w-1/3">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Filtrar por Seminario</label>
                    <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
                        <option value="">-- Todos los Alumnos --</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                <span className="font-bold text-gray-500 text-sm">Resultados: {filteredUsers.length}</span>
                {filterEvent && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">Filtro Activo: {events.find(e => e.id === filterEvent)?.title}</span>}
            </div>
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Contacto</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Resumen</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Estado</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se encontraron resultados.</td></tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={user.id} className={`hover:bg-gray-50 ${!user.approved ? 'bg-red-50' : ''}`}>
                                <td className="p-4 flex items-center gap-3">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">
                                            {(user.full_name || '?')[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-gray-900">{user.full_name}</p>
                                        <p className="text-xs text-gray-400 uppercase">{user.role === 'admin' ? 'Coordinador' : 'Alumno'}</p>
                                    </div>
                                </td>
                                <td className="p-4 text-sm"><p>{user.email}</p><p className="text-gray-500">{user.phone || 'Sin teléfono'}</p></td>
                                <td className="p-4 text-sm">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                        {user.enrollments?.length || 0} Cursos
                                    </span>
                                </td>
                                <td className="p-4">
                                    {user.approved ? 
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">Activo</span> : 
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold animate-pulse">Pendiente</span>
                                    }
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2 items-center">
                                    {user.role !== 'admin' && (
                                        <>
                                            <button onClick={() => toggleStatus(user.id, user.approved)} className={`text-xs font-bold px-3 py-2 rounded ${user.approved ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>{user.approved ? 'Bloq' : 'Aprobar'}</button>
                                            <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Eliminar">🗑️</button>
                                        </>
                                    )}
                                    <Link href={`/admin/users/${user.id}`} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded font-bold text-sm hover:bg-indigo-100">
                                        ✏️ Editar
                                    </Link>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

      {/* MODAL REGISTRO */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="font-bold text-lg">Registrar Nuevo Alumno</h2>
                    <button onClick={() => setIsRegisterOpen(false)}>✕</button>
                </div>
                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div><label className="text-xs font-bold text-gray-500">Email *</label><input name="email" type="email" required value={newUser.email} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500">Contraseña *</label><input name="password" type="password" required value={newUser.password} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500">Nombre Completo *</label><input name="full_name" type="text" required value={newUser.full_name} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-gray-500">Teléfono</label><input name="phone" type="text" value={newUser.phone} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500">Fecha Nacimiento</label><input name="birth_date" type="date" value={newUser.birth_date} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500">Dirección Completa</label><input name="address" type="text" value={newUser.address} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Calle, Número, Colonia"/></div>
                    <div><label className="text-xs font-bold text-gray-500">Iglesia Procedencia</label><input name="previous_church" type="text" value={newUser.previous_church} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold">Fecha Bautismo (Agua)</label><input name="baptism_date" type="date" value={newUser.baptism_date} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold">Bautismo E.S.</label><input name="holy_spirit_date" type="date" value={newUser.holy_spirit_date} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>
                    <button type="submit" disabled={creating} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 disabled:opacity-50">{creating ? 'Creando...' : 'Registrar Alumno'}</button>
                </form>
            </div>
        </div>
      )}
      </div>
    </div>
  )
}