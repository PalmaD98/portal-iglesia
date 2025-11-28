'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { adLogoBase64 } from '@/app/utils/logos'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Datos del perfil
  const [formData, setFormData] = useState<any>({})
  
  // Datos del Kárdex
  const [kardex, setKardex] = useState<any[]>([])
  const [average, setAverage] = useState(0)

  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    const getData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // 1. Cargar Perfil
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()
      
      if (profile) setFormData(profile)

      // 2. Cargar Kárdex (Cursos finalizados o con nota)
      // AHORA INCLUIMOS 'attendance_data' EN LA CONSULTA
      const { data: history } = await supabase
        .from('enrollments')
        .select('grade, certified, attendance_data, events(title, event_date)')
        .eq('user_id', session.user.id)
        .gt('grade', 0) // Solo traemos los que ya tienen calificación mayor a 0
        .order('created_at', { ascending: false })

      if (history) {
        setKardex(history)
        // Calcular Promedio General
        const sum = history.reduce((acc: number, item: any) => acc + (item.grade || 0), 0)
        setAverage(history.length > 0 ? Math.round(sum / history.length) : 0)
      }

      setLoading(false)
    }
    getData()
  }, [router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
      
      if (file.size > 2 * 1024 * 1024) {
        alert("⚠️ La imagen es muy pesada (Máximo 2MB).")
        setUploading(false); return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setFormData({ ...formData, avatar_url: publicUrl })
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally { setUploading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase.from('profiles').update(formData).eq('id', session.user.id)

    if (error) alert('Error: ' + error.message)
    else { alert('¡Perfil actualizado!'); router.push('/') }
    setSaving(false)
  }

  // --- GENERAR PDF DEL KÁRDEX ---
  const downloadKardex = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Encabezado
    doc.addImage(adLogoBase64, 'JPEG', 10, 10, 30, 30)
    doc.setFont("helvetica", "bold"); doc.setFontSize(18)
    doc.text("HISTORIAL ACADÉMICO / KÁRDEX", 105, 20, { align: "center" })
    doc.setFontSize(12); doc.setFont("helvetica", "normal")
    doc.text("TEMPLO EL SEMBRADOR", 105, 28, { align: "center" })

    // Datos del Alumno
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(10, 45, 200, 45)
    doc.setFont("helvetica", "bold"); doc.setFontSize(10)
    doc.text(`Alumno: ${formData.full_name}`, 10, 52)
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 130, 52)
    doc.text(`Promedio General: ${average}/100`, 10, 58)
    doc.line(10, 62, 200, 62)

    // Tabla de Materias
    let y = 75
    // Cabecera Tabla
    doc.setFillColor(230, 230, 230); doc.rect(10, y-5, 190, 8, 'F')
    doc.setFont("helvetica", "bold"); 
    doc.text("SEMINARIO", 12, y)
    doc.text("ASISTENCIA", 100, y)
    doc.text("CALIF.", 140, y)
    doc.text("ESTADO", 170, y)
    
    y += 10
    doc.setFont("helvetica", "normal")

    kardex.forEach((item) => {
        const title = Array.isArray(item.events) ? item.events[0]?.title : item.events?.title;
        // Calcular asistencia para el PDF
        const attendanceCount = item.attendance_data?.topics?.filter((t:any) => t).length || 0;
        
        doc.text(title || "Evento sin nombre", 12, y)
        doc.text(`${attendanceCount}/5 Temas`, 100, y)
        doc.text(String(item.grade), 145, y)
        doc.text(item.certified ? "Certificado" : "Cursado", 170, y)
        
        doc.line(10, y+2, 200, y+2) // Línea separadora
        y += 10
    })

    // Pie
    y += 20
    doc.setFontSize(8)
    doc.text("Este documento es un comprobante oficial de las materias cursadas en la institución.", 105, y, {align:"center"})

    doc.save(`Kardex_${formData.full_name}.pdf`)
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Mi Perfil y Kárdex</h1>
            <Link href="/" className="text-indigo-600 hover:underline">Volver al Inicio</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMNA IZQUIERDA: FORMULARIO DE DATOS */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
                <h3 className="font-bold text-indigo-900 border-b pb-2 mb-4">Editar Información Personal</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                        {formData.avatar_url ? (
                            <img src={formData.avatar_url} className="w-16 h-16 rounded-full object-cover border" />
                        ) : <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">👤</div>}
                        
                        <label className="bg-gray-100 px-3 py-1 rounded text-sm cursor-pointer hover:bg-gray-200">
                            Cambiar Foto
                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">Nombre Completo</label>
                            <input name="full_name" value={formData.full_name || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Teléfono</label>
                            <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500">Dirección</label>
                            <input name="address" value={formData.address || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        {/* Datos Eclesiásticos */}
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500">Iglesia Procedencia</label>
                            <input name="previous_church" value={formData.previous_church || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Fecha Bautismo</label>
                            <input type="date" name="baptism_date" value={formData.baptism_date || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">Bautismo E.S.</label>
                            <input type="date" name="holy_spirit_date" value={formData.holy_spirit_date || ''} onChange={handleChange} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-bold py-2 rounded hover:bg-indigo-700 mt-4">
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </form>
            </div>

            {/* COLUMNA DERECHA: KÁRDEX */}
            <div className="bg-white rounded-xl shadow p-6 h-fit">
                <div className="flex justify-between items-center border-b pb-2 mb-4">
                    <h3 className="font-bold text-indigo-900">Historial Académico</h3>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
                        Promedio: {average}
                    </span>
                </div>

                {kardex.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Aún no tienes materias evaluadas.</p>
                ) : (
                    <div className="space-y-3">
                        {kardex.map((item, i) => {
                            const title = Array.isArray(item.events) ? item.events[0]?.title : item.events?.title;
                            // Calculamos la asistencia para mostrarla
                            const attendanceCount = item.attendance_data?.topics?.filter((t:any) => t).length || 0;

                            return (
                                <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0">
                                    <div>
                                        <p className="font-bold text-gray-800">{title}</p>
                                        
                                        <div className="flex flex-col gap-1 mt-1">
                                            <span className="text-xs text-gray-500">
                                                {item.certified ? '✅ Certificado' : '🎓 Cursado'}
                                            </span>
                                            {/* NUEVO: INDICADOR DE ASISTENCIA */}
                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">
                                                Asistencia: {attendanceCount}/5
                                            </span>
                                        </div>
                                    </div>
                                    <span className="font-bold text-indigo-600 text-lg">{item.grade}</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {kardex.length > 0 && (
                    <button 
                        onClick={downloadKardex}
                        className="w-full mt-6 bg-gray-800 text-white font-bold py-2 rounded flex items-center justify-center gap-2 hover:bg-black transition"
                    >
                        📄 Descargar Kárdex PDF
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  )
}