'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UsersDirectory() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  const router = useRouter()
  const supabase = createClientComponentClient()

  // --- CARGAR USUARIOS ---
  const loadUsers = async () => {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }) // Los más recientes primero
    setUsers(allProfiles || [])
  }

  useEffect(() => {
    const getData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      
      if (myProfile?.role !== 'admin') {
        alert('Acceso restringido')
        router.push('/')
        return
      }

      await loadUsers()
      setLoading(false)
    }
    getData()
  }, [router, supabase])

  // --- LÓGICA DE EXCEL (CSV) ---
  const exportToCSV = () => {
    if (users.length === 0) return alert("No hay datos para exportar")

    // 1. Encabezados del Excel
    const headers = [
      "Nombre Completo", 
      "Email", 
      "Telefono", 
      "Direccion", 
      "Rol", 
      "Estado", 
      "Fecha Registro"
    ]

    // 2. Filas de datos
    const rows = users.map(u => [
      `"${u.full_name || ''}"`, // Comillas para evitar errores con comas en nombres
      u.email || '',
      `"${u.phone || ''}"`,
      `"${u.address || ''}"`,
      u.role === 'admin' ? 'Coordinador' : 'Alumno',
      u.approved ? 'Activo' : 'Pendiente', // Traducimos el true/false
      new Date(u.created_at).toLocaleDateString()
    ])

    // 3. Unir todo (con un caracter especial al inicio para que Excel lea acentos)
    const csvContent = "\uFEFF" + [
      headers.join(","), 
      ...rows.map(row => row.join(","))
    ].join("\n")

    // 4. Descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Directorio_Iglesia_${new Date().toLocaleDateString()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- LÓGICA DE APROBACIÓN ---
  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    // Optimistic UI update (cambiar visualmente primero para que se sienta rápido)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved: !currentStatus } : u))

    const { error } = await supabase
        .from('profiles')
        .update({ approved: !currentStatus })
        .eq('id', userId)

    if (error) {
        alert("Error al cambiar estado: " + error.message)
        loadUsers() // Revertir si falló
    }
  }

  // Filtro del buscador
  const filteredUsers = users.filter(user => 
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando directorio...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
                <Link href="/" className="text-indigo-600 hover:underline text-sm font-bold">← Volver al Dashboard</Link>
                <h1 className="text-3xl font-bold text-gray-900 mt-1">Directorio General</h1>
                <p className="text-gray-500 text-sm">Gestiona usuarios y descargas.</p>
            </div>
            
            <div className="flex gap-2">
                {/* BOTÓN EXCEL */}
                <button 
                    onClick={exportToCSV}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow flex items-center gap-2"
                >
                    📊 Descargar Excel
                </button>

                <input 
                    type="text" placeholder="🔍 Buscar alumno..." 
                    className="pl-4 pr-4 py-2 border rounded-lg w-64 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* TABLA DE USUARIOS */}
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
                    {filteredUsers.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">No hay resultados.</td></tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={user.id} className={`hover:bg-gray-50 transition ${!user.approved ? 'bg-red-50' : ''}`}>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                                {(user.full_name || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-gray-900">{user.full_name || 'Sin Nombre'}</p>
                                            <p className="text-xs text-gray-400">{user.role === 'admin' ? '👑 Coordinador' : '🎓 Alumno'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">
                                        <p className="text-gray-900">{user.email}</p>
                                        <p className="text-gray-500">{user.phone || ''}</p>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {user.approved ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            ✅ Activo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                                            ⏳ Pendiente
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* Botón Aprobar/Bloquear (Solo si no es admin, para no bloquearte a ti mismo) */}
                                        {user.role !== 'admin' && (
                                            <button 
                                                onClick={() => toggleStatus(user.id, user.approved)}
                                                className={`text-xs font-bold px-3 py-2 rounded transition ${user.approved ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                            >
                                                {user.approved ? 'Bloquear' : 'Aprobar Acceso'}
                                            </button>
                                        )}
                                        
                                        <Link 
                                            href={`/admin/users/${user.id}`}
                                            className="text-indigo-600 hover:text-indigo-900 text-sm font-bold bg-indigo-50 px-3 py-2 rounded hover:bg-indigo-100"
                                        >
                                            ✏️ Editar
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}