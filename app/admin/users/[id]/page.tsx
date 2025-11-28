'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import jsPDF from 'jspdf'
import { adLogoBase64 } from '@/app/utils/logos'

export default function AdminEditUser() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Datos del alumno
  const [formData, setFormData] = useState<any>({})
  
  // Datos del Kárdex del alumno
  const [kardex, setKardex] = useState<any[]>([])
  const [average, setAverage] = useState(0)
  
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

      // 2. Cargar DATOS del alumno
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single()

      if (userProfile) {
        setFormData(userProfile)
      }

      // 3. Cargar KÁRDEX del alumno (Notas > 0)
      const { data: history } = await supabase
        .from('enrollments')
        .select('grade, certified, attendance_data, events(title, event_date)')
        .eq('user_id', params.id) // ID del alumno, no el mío
        .gt('grade', 0)
        .order('created_at', { ascending: false })

      if (history) {
        setKardex(history)
        // Calcular Promedio
        const sum = history.reduce((acc: number, item: any) => acc + (item.grade || 0), 0)
        setAverage(history.length > 0 ? Math.round(sum / history.length) : 0)
      }

      setLoading(false)
    }
    getData()
  }, [params.id, router, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update(formData).eq('id', params.id)
    if (error) alert('Error: ' + error.message)
    else { alert('¡Perfil actualizado!'); router.back() }
    setSaving(false)
  }

  // --- GENERAR PDF KÁRDEX (ADMIN) ---
  const downloadKardex = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.addImage(adLogoBase64, 'JPEG', 10, 10, 30, 30)
    doc.setFont("helvetica", "bold"); doc.setFontSize(18)
    doc.text("HISTORIAL ACADÉMICO / KÁRDEX", 105, 20, { align: "center" })
    doc.setFontSize(12); doc.setFont("helvetica", "normal")
    doc.text("TEMPLO EL SEMBRADOR", 105, 28, { align: "center" })

    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(10, 45, 200, 45)
    doc.setFont("helvetica", "bold"); doc.setFontSize(10)
    doc.text(`Alumno: ${formData.full_name}`, 10, 52)
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 130, 52)
    doc.text(`Promedio General: ${average}/100`, 10, 58)
    doc.line(10, 62, 200, 62)

    let y = 75
    doc.setFillColor(230, 230, 230); doc.rect(10, y-5, 190, 8, 'F')
    doc.setFont("helvetica", "bold"); doc.text("SEMINARIO", 12, y)
    doc.text("ASIST.", 120, y); doc.text("CALIF.", 150, y); doc.text("ESTADO", 175, y)
    y += 10
    doc.setFont("helvetica", "normal")

    kardex.forEach((item) => {
        const title = Array.isArray(item.events) ? item.events[0]?.title : item.events?.title;
        const attendanceCount = item.attendance_data?.topics?.filter((t:any) => t === true).length || 0;
        doc.text(title || "Evento", 12, y)
        doc.text(`${attendanceCount}/5`, 120, y)
        doc.text(String(item.grade), 155, y)
        doc.text(item.certified ? "Certificado" : "Cursado", 175, y)
        doc.line(10, y+2, 200, y+2); y += 10
    })
    y += 20; doc.setFontSize(8)
    doc.text("Documento generado por la administración.", 105, y, {align:"center"})
    doc.save(`Kardex_${formData.full_name}.pdf`)
  }

  if (loading) return <div className="p-10 text-center">Cargando datos...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Administrar Alumno</h1>
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-medium">Volver al Directorio</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMNA IZQUIERDA: EDITOR DE DATOS */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-8 h-fit">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="relative w-24 h-24">
                            {formData.avatar_url ? (
                                <img src={formData.avatar_url} className="w-24 h-24 rounded-full object-cover border-2 border-indigo-200" />
                            ) : ( <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-2xl">👤</div> )}
                            <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-indigo-700 shadow">
                                <span className="text-xs">📷</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                            </label>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-700">Foto de Perfil</h3>
                            <p className="text-xs text-gray-500">Sube una foto clara del alumno.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Nombre Completo</label><input name="full_name" value={formData.full_name || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Teléfono</label><input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Fecha Nacimiento</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Dirección</label><input name="address" value={formData.address || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        
                        <div className="col-span-2 pt-2 border-t mt-2"><p className="text-xs font-bold text-indigo-900">DATOS ECLESIÁSTICOS</p></div>
                        <div className="col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Iglesia Procedencia</label><input name="previous_church" value={formData.previous_church || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Fecha Bautismo</label><input type="date" name="baptism_date" value={formData.baptism_date || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Bautismo E.S.</label><input type="date" name="holy_spirit_date" value={formData.holy_spirit_date || ''} onChange={handleChange} className="w-full border p-2 rounded" /></div>
                    </div>
                    
                    <button type="submit" disabled={saving || uploading} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition shadow-lg disabled:opacity-50">
                        {saving ? 'Guardando...' : '💾 Guardar Cambios'}
                    </button>
                </form>
            </div>

            {/* COLUMNA DERECHA: KÁRDEX DEL ALUMNO */}
            <div className="bg-white rounded-xl shadow p-6 h-fit sticky top-6">
                <div className="flex justify-between items-center border-b pb-2 mb-4">
                    <h3 className="font-bold text-indigo-900">Historial Académico</h3>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded border border-green-200">GPA: {average}</span>
                </div>

                {kardex.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded border border-dashed border-gray-300">
                        <p className="text-sm text-gray-500">Sin historial académico.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {kardex.map((item, i) => {
                            const title = Array.isArray(item.events) ? item.events[0]?.title : item.events?.title;
                            const attendanceCount = item.attendance_data?.topics?.filter((t:any) => t === true).length || 0;
                            return (
                                <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-3 last:border-0">
                                    <div>
                                        <p className="font-bold text-gray-800 mb-1">{title}</p>
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-xs px-2 py-0.5 rounded w-fit ${item.certified ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {item.certified ? '🏅 Certificado' : '🎓 Cursado'}
                                            </span>
                                            <span className="text-xs text-gray-500">Asist: <b>{attendanceCount}/5</b></span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-indigo-600 text-xl">{item.grade}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {kardex.length > 0 && (
                    <button onClick={downloadKardex} className="w-full mt-6 bg-gray-800 text-white font-bold py-3 rounded flex items-center justify-center gap-2 hover:bg-black transition shadow-lg">
                        📄 Descargar Kárdex PDF
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  )
}