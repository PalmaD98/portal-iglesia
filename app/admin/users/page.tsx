'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UsersDirectory() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estado para el Modal de Registro
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '', password: '', full_name: '', phone: '',
    address: '', birth_date: '', previous_church: '',
    baptism_date: '', holy_spirit_date: ''
  })
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // --- CARGAR USUARIOS ---
  const loadUsers = async () => {
    const { data: allProfiles } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(allProfiles || [])
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (myProfile?.role !== 'admin') { router.push('/'); return }
      await loadUsers()
      setLoading(false)
    }
    getData()
  }, [router, supabase])

  // --- CREAR NUEVO USUARIO (API) ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    })

    const result = await response.json()

    if (!response.ok) {
      alert('Error: ' + result.error)
    } else {
      alert('¡Alumno registrado exitosamente!')
      setIsRegisterOpen(false)
      // Limpiar formulario
      setNewUser({ 
        email: '', password: '', full_name: '', phone: '', 
        address: '', birth_date: '', previous_church: '', 
        baptism_date: '', holy_spirit_date: '' 
      })
      loadUsers() 
    }
    setCreating(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value })
  }

  // --- EXPORTAR EXCEL ---
  const exportToCSV = () => {
    if (users.length === 0) return alert("No hay datos")
    const headers = ["Nombre", "Email", "Telefono", "Rol", "Estado", "Iglesia", "Bautismo"]
    const rows = users.map(u => [
      `"${u.full_name || ''}"`, u.email, `"${u.phone || ''}"`, u.role, u.approved ? 'Activo' : 'Pendiente', `"${u.previous_church || ''}"`, u.baptism_date
    ])
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", `Directorio.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // --- ELIMINAR USUARIO ---
  const handleDeleteUser = async (userId: string, userName: string) => {
    if(!confirm(`¿Eliminar a ${userName}? Esta acción es permanente.`)) return
    
    const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    })

    if(response.ok) {
        alert("Usuario eliminado.")
        setUsers(prev => prev.filter(u => u.id !== userId))
    } else {
        alert("Error al eliminar.")
    }
  }

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: !currentStatus } : u))
    await supabase.from('profiles').update({ approved: !currentStatus }).eq('id', userId)
  }

  const filteredUsers = users.filter(user => 
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-10 text-center">Cargando directorio...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
                <Link href="/" className="text-indigo-600 hover:underline text-sm font-bold">← Volver al Dashboard</Link>
                <h1 className="text-3xl font-bold text-gray-900 mt-1">Directorio General</h1>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setIsRegisterOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold text-sm shadow">
                    + Nuevo Alumno
                </button>
                <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow">
                    📊 Excel
                </button>
                <input type="text" placeholder="🔍 Buscar..." className="pl-4 pr-4 py-2 border rounded-lg w-64 outline-none shadow-sm"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Contacto</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Estado</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
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
                                    <p className="text-xs text-gray-400 uppercase">{user.role === 'admin' ? '👑 Coordinador' : '🎓 Alumno'}</p>
                                </div>
                            </td>
                            <td className="p-4 text-sm">
                                <p className="text-gray-900">{user.email}</p>
                                <p className="text-gray-500">{user.phone || 'Sin teléfono'}</p>
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
                                        <button onClick={() => toggleStatus(user.id, user.approved)} className={`text-xs font-bold px-3 py-2 rounded ${user.approved ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                            {user.approved ? 'Bloquear' : 'Aprobar'}
                                        </button>
                                        <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Eliminar">🗑️</button>
                                    </>
                                )}
                                <Link href={`/admin/users/${user.id}`} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded font-bold text-sm hover:bg-indigo-100">
                                    ✏️ Editar
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- MODAL DE REGISTRO NUEVO --- */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="font-bold text-lg">Registrar Nuevo Alumno</h2>
                    <button onClick={() => setIsRegisterOpen(false)} className="hover:bg-indigo-700 px-2 rounded">✕</button>
                </div>
                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                    
                    {/* CREDENCIALES */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div><label className="text-xs font-bold text-gray-500">Email *</label><input name="email" type="email" required value={newUser.email} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500">Contraseña *</label><input name="password" type="password" required value={newUser.password} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>

                    {/* PERSONAL */}
                    <div><label className="text-xs font-bold text-gray-500">Nombre Completo *</label><input name="full_name" type="text" required value={newUser.full_name} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-gray-500">Teléfono</label><input name="phone" type="text" value={newUser.phone} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500">Fecha Nacimiento</label><input name="birth_date" type="date" value={newUser.birth_date} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>
                    
                    <div><label className="text-xs font-bold text-gray-500">Dirección Completa</label><input name="address" type="text" value={newUser.address} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Calle, Número, Colonia"/></div>
                    
                    {/* ECLESIASTICO */}
                    <div><label className="text-xs font-bold text-gray-500">Iglesia Procedencia</label><input name="previous_church" type="text" value={newUser.previous_church} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Fecha Bautismo (Agua)</label>
                            <input name="baptism_date" type="date" value={newUser.baptism_date} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Bautismo E.S.</label>
                            <input name="holy_spirit_date" type="date" value={newUser.holy_spirit_date} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    <button type="submit" disabled={creating} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 disabled:opacity-50 shadow-md">
                        {creating ? 'Creando...' : 'Registrar Alumno'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}