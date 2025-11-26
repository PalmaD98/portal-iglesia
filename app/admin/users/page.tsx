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

  useEffect(() => {
    const getData = async () => {
      // 1. Verificar Seguridad (Solo Admin)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      
      if (myProfile?.role !== 'admin') {
        alert('Acceso restringido')
        router.push('/')
        return
      }

      // 2. Cargar TODOS los perfiles
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true })

      if (error) alert('Error cargando directorio')
      else setUsers(allProfiles || [])
      
      setLoading(false)
    }
    getData()
  }, [router, supabase])

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(user => 
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando directorio...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center justify-between mb-6">
            <div>
                <Link href="/" className="text-indigo-600 hover:underline text-sm font-bold">← Volver al Dashboard</Link>
                <h1 className="text-3xl font-bold text-gray-900 mt-1">Directorio de Personas</h1>
                <p className="text-gray-500 text-sm">Total registrados: {users.length}</p>
            </div>
            
            {/* BARRA DE BÚSQUEDA */}
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="🔍 Buscar por nombre..." 
                    className="pl-4 pr-10 py-2 border rounded-full w-64 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Usuario</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Contacto</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Rol</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-400">No se encontraron personas con ese nombre.</td>
                        </tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                                {(user.full_name || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-gray-900">{user.full_name || 'Sin Nombre'}</p>
                                            <p className="text-xs text-gray-400">Registrado: {new Date(user.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">
                                        <p className="text-gray-900">📧 {user.email}</p>
                                        <p className="text-gray-500">📞 {user.phone || 'N/A'}</p>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {user.role === 'admin' ? (
                                        <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded-full border border-purple-200">
                                            Coordinador
                                        </span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full border border-gray-200">
                                            Alumno
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    <Link 
                                        href={`/admin/users/${user.id}`}
                                        className="text-indigo-600 hover:text-indigo-900 text-sm font-bold hover:underline bg-indigo-50 px-3 py-2 rounded hover:bg-indigo-100 transition"
                                    >
                                        ✏️ Editar Ficha
                                    </Link>
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