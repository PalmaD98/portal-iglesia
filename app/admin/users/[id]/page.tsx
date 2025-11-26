'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'

export default function AdminEditUser() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState<any>({})
  
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getData = async () => {
      // 1. Verificar Admin
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      
      if (myProfile?.role !== 'admin') {
        alert('Acceso denegado')
        return router.push('/')
      }

      // 2. Cargar alumno
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single()

      if (userProfile) {
        setFormData(userProfile)
      }
      setLoading(false)
    }
    getData()
  }, [params.id, router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // --- SUBIR FOTO (Como Admin para el alumno) ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return

      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setFormData({ ...formData, avatar_url: publicUrl })

    } catch (error: any) {
      alert('Error al subir imagen: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

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
        avatar_url: formData.avatar_url
      })
      .eq('id', params.id)

    if (error) alert('Error: ' + error.message)
    else {
        alert('¡Perfil del alumno actualizado!')
        router.back() // Volver a la lista
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 text-center">Cargando datos...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
        
        <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Editar Perfil de Alumno</h1>
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-medium">
                Cancelar y Volver
            </button>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
             
             {/* SECCIÓN 1: FOTO */}
             <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="relative w-24 h-24">
                    {formData.avatar_url ? (
                        <img src={formData.avatar_url} className="w-24 h-24 rounded-full object-cover border-2 border-indigo-200" />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-2xl">👤</div>
                    )}
                    <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-indigo-700 shadow">
                        <span className="text-xs">📷</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                    </label>
                </div>
                <div>
                    <h3 className="font-bold text-gray-700">Foto de Perfil</h3>
                    <p className="text-xs text-gray-500">Sube una foto clara del alumno para su ficha.</p>
                    {uploading && <span className="text-xs text-indigo-600 font-bold animate-pulse">Subiendo...</span>}
                </div>
             </div>

             {/* SECCIÓN 2: DATOS PERSONALES */}
             <div>
                 <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-4 border-b border-indigo-100 pb-1">
                    Información Personal
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                        <input name="full_name" value={formData.full_name || ''} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Solo lectura)</label>
                        <input value={formData.email || ''} disabled className="w-full border p-2 rounded bg-gray-100 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                        <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                        <input name="address" value={formData.address || ''} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Nacimiento</label>
                        <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                 </div>
             </div>

             {/* SECCIÓN 3: DATOS ECLESIÁSTICOS */}
             <div>
                 <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-4 border-b border-indigo-100 pb-1">
                    Información Eclesiástica
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Iglesia de Procedencia</label>
                        <input name="previous_church" value={formData.previous_church || ''} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Bautismo (Agua)</label>
                        <input type="date" name="baptism_date" value={formData.baptism_date || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bautismo Espíritu Santo</label>
                        <input type="date" name="holy_spirit_date" value={formData.holy_spirit_date || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                 </div>
             </div>
             
             <div className="pt-6 border-t">
                <button type="submit" disabled={saving || uploading} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition shadow-lg disabled:opacity-50">
                    {saving ? 'Guardando...' : '💾 Guardar Cambios del Alumno'}
                </button>
             </div>
        </form>
      </div>
    </div>
  )
}