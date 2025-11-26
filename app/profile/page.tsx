'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Estado para todos los campos del perfil
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    baptism_date: '',
    holy_spirit_date: '',
    previous_church: ''
  })

  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Cargar datos actuales
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '', // El email usualmente no se edita aquí, pero lo mostramos
          phone: data.phone || '',
          address: data.address || '',
          birth_date: data.birth_date || '',
          baptism_date: data.baptism_date || '',
          holy_spirit_date: data.holy_spirit_date || '',
          previous_church: data.previous_church || ''
        })
      }
      setLoading(false)
    }
    getProfile()
  }, [router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Actualizar en Supabase
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        birth_date: formData.birth_date || null, // Enviar null si está vacío para evitar error de fecha
        baptism_date: formData.baptism_date || null,
        holy_spirit_date: formData.holy_spirit_date || null,
        previous_church: formData.previous_church
      })
      .eq('id', session.user.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      alert('¡Perfil actualizado correctamente!')
      router.push('/') // Volver al inicio
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 text-center">Cargando perfil...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
            <h1 className="text-2xl font-bold">Mi Ficha Personal</h1>
            <Link href="/" className="text-indigo-200 hover:text-white text-sm">Cancel y Volver</Link>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            
            {/* Sección Personal */}
            <div>
                <h3 className="text-gray-500 text-sm uppercase tracking-wide font-bold mb-3 border-b pb-1">Datos Generales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                        <input type="text" name="full_name" value={formData.full_name} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="Ej. 656-123-4567"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                        <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Dirección</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="Calle, Número, Colonia"/>
                    </div>
                </div>
            </div>

            {/* Sección Eclesiástica */}
            <div>
                <h3 className="text-gray-500 text-sm uppercase tracking-wide font-bold mb-3 border-b pb-1">Datos Eclesiásticos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Iglesia de Procedencia</label>
                        <input type="text" name="previous_church" value={formData.previous_church} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Fecha Bautismo (Agua)</label>
                        <input type="date" name="baptism_date" value={formData.baptism_date} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Bautismo Espíritu Santo</label>
                        <input type="date" name="holy_spirit_date" value={formData.holy_spirit_date} onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"/>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <button type="submit" disabled={saving}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar Información'}
                </button>
            </div>

        </form>
      </div>
    </div>
  )
}