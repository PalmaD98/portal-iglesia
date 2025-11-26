'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false) // Estado para la subida de imagen
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    baptism_date: '',
    holy_spirit_date: '',
    previous_church: '',
    avatar_url: '' // Nuevo campo para la foto
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

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          birth_date: data.birth_date || '',
          baptism_date: data.baptism_date || '',
          holy_spirit_date: data.holy_spirit_date || '',
          previous_church: data.previous_church || '',
          avatar_url: data.avatar_url || ''
        })
      }
      setLoading(false)
    }
    getProfile()
  }, [router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // --- FUNCIÓN PARA SUBIR FOTO ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('Por favor selecciona una imagen.')
      }

      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}` // Nombre único temporal
      const filePath = `${fileName}`

      // 1. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Obtener la URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Actualizar el estado local para ver la foto al instante
      setFormData({ ...formData, avatar_url: publicUrl })

    } catch (error: any) {
      alert('Error al subir imagen: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        birth_date: formData.birth_date || null,
        baptism_date: formData.baptism_date || null,
        holy_spirit_date: formData.holy_spirit_date || null,
        previous_church: formData.previous_church,
        avatar_url: formData.avatar_url // Guardamos la URL de la foto
      })
      .eq('id', session.user.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      alert('¡Perfil actualizado correctamente!')
      router.push('/')
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 text-center">Cargando perfil...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
            <h1 className="text-2xl font-bold">Mi Ficha Personal</h1>
            <Link href="/" className="text-indigo-200 hover:text-white text-sm">Cancelar y Volver</Link>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
            
            {/* --- SECCIÓN FOTO --- */}
            <div className="flex flex-col items-center justify-center mb-6">
                <div className="relative w-32 h-32 mb-4">
                    {/* Imagen o Placeholder */}
                    {formData.avatar_url ? (
                        <img 
                          src={formData.avatar_url} 
                          alt="Avatar" 
                          className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100 shadow-sm"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border-4 border-indigo-50">
                            <span className="text-4xl">📷</span>
                        </div>
                    )}
                    
                    {/* Input invisible sobre la foto */}
                    <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 shadow-md transition-transform hover:scale-110" title="Cambiar foto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                            disabled={uploading}
                            className="hidden" 
                        />
                    </label>
                </div>
                <p className="text-xs text-gray-500">
                    {uploading ? 'Subiendo...' : 'Toca el ícono de cámara para subir una foto'}
                </p>
            </div>

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
                <button type="submit" disabled={saving || uploading}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar Información'}
                </button>
            </div>

        </form>
      </div>
    </div>
  )
}