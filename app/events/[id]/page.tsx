'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { adLogoBase64 } from '@/app/utils/logos' // <--- IMPORTAMOS EL LOGO

export default function EventDetails() {
  const [profile, setProfile] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getDetails = async () => {
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

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', params.id)
        .single()
      setEvent(eventData)

      const { data: enrollData } = await supabase
        .from('enrollments')
        .select(`
          id,
          attended,
          grade,
          certified,
          user_id,
          profiles:user_id ( full_name, email, phone, address, birth_date, baptism_date, holy_spirit_date, previous_church )
        `)
        .eq('event_id', params.id)
      
      setEnrollments(enrollData || [])
      setLoading(false)
    }
    getDetails()
  }, [params.id, router, supabase])

  // --- LÓGICA DE PDF ---
  const generatePDF = (studentProfile: any, courseName: string, eventDate: string) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // --- 1. ENCABEZADO ---
    // LOGO REAL (Reemplaza al recuadro anterior)
    // x=10, y=10, ancho=35, alto=40 (ajustado para que no se deforme mucho)
    doc.addImage(adLogoBase64, 'PNG', 10, 12, 35, 35); 

    // Textos del Centro
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text("TEMPLO EL SEMBRADOR", 105, 20, { align: "center" })
    
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Pastores: Javier e Ignacia Gonzalez", 105, 28, { align: "center" })
    doc.text("Cd. Juarez, Chihuahua, Mexico", 105, 34, { align: "center" })
    
    doc.setFont("helvetica", "bold")
    doc.text("Escuela Dominical", 105, 42, { align: "center" })
    doc.text("Departamento Post-bautismal", 105, 50, { align: "center" })

    // Cuadro para FOTO (Derecha)
    doc.rect(160, 10, 40, 40)
    doc.text("FOTO", 180, 30, { align: "center" })

    // --- 2. CAMPOS DE INFORMACIÓN ---
    let y = 65;
    const lineHeight = 12;
    const lineStart = 10;
    const lineEnd = 200;
    const valueX = 60;

    const drawField = (label: string, value: string | null) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(label, lineStart, y)
      
      doc.setFont("helvetica", "normal")
      if (value) doc.text(String(value), valueX, y)
      
      doc.setLineWidth(0.2)
      doc.line(valueX - 2, y + 1, lineEnd, y + 1)
      
      y += lineHeight
    }

    // Fecha
    doc.text("Fecha:", 80, 60)
    doc.text(new Date().toLocaleDateString(), 100, 60)
    doc.line(95, 61, 150, 61)

    y = 75 // Reiniciar Y
    
    drawField("Nombre del Alumno:", studentProfile.full_name)
    drawField("Fecha de Nacimiento:", studentProfile.birth_date || "")
    drawField("Direccion:", studentProfile.address || "")
    drawField("Iglesia de Procedencia:", studentProfile.previous_church || "")
    drawField("Fecha de Bautismos:", studentProfile.baptism_date || "")
    drawField("Fecha de Bautismo en el Espiritu Santo:", studentProfile.holy_spirit_date || "")
    drawField("Telefono:", studentProfile.phone || "")

    // --- 3. PIE DE PÁGINA ---
    y += 20
    
    // Línea de Firma
    doc.line(70, y, 140, y)
    doc.setFont("helvetica", "bold")
    doc.text("Firma.", 105, y + 5, { align: "center" })

    y += 20
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("El Señor le bendiga y gracias por la informacion.", lineStart, y)
    
    y += 10
    doc.text("Esperemos que nos acompañe todos los domingos para aprender mas de la palabra del Señor.", lineStart, y)

    // Descargar
    doc.save(`Ficha_${studentProfile.full_name}.pdf`)
  }

  // --- ACTIONS ---
  const toggleAttendance = async (enrollmentId: string, currentStatus: boolean) => {
    if (profile?.role !== 'admin') return
    const { error } = await supabase.from('enrollments').update({ attended: !currentStatus }).eq('id', enrollmentId)
    if (!error) setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, attended: !currentStatus } : e))
  }

  const updateGrade = async (enrollmentId: string, newGrade: string) => {
    if (profile?.role !== 'admin') return
    const gradeInt = parseInt(newGrade) || 0
    const { error } = await supabase.from('enrollments').update({ grade: gradeInt }).eq('id', enrollmentId)
    if (!error) setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, grade: gradeInt } : e))
  }

  const toggleCertify = async (enrollmentId: string, currentStatus: boolean) => {
    if (profile?.role !== 'admin') return
    const { error } = await supabase.from('enrollments').update({ certified: !currentStatus }).eq('id', enrollmentId)
    if (!error) setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, certified: !currentStatus } : e))
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>
  if (!event) return <div className="p-10 text-center">Evento no encontrado</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:underline mb-4 inline-block font-medium">← Volver al Dashboard</Link>

        {/* HEADER SIMPLE */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-gray-500">Panel de Gestión y Documentación</p>
        </div>

        {/* TABLA */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Alumno</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Asistencia</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Nota</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((enrollment) => {
                const userProfile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
                const userName = userProfile?.full_name || "Sin nombre";
                const userEmail = userProfile?.email || "";

                return (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-bold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">{userEmail}</p>
                    </td>

                    <td className="p-4 text-center">
                      {profile?.role === 'admin' ? (
                        <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                          checked={enrollment.attended} onChange={() => toggleAttendance(enrollment.id, enrollment.attended)} />
                      ) : (
                        <span>{enrollment.attended ? '✅' : '❌'}</span>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      {profile?.role === 'admin' ? (
                        <input type="number" className="w-16 border rounded p-1 text-center"
                          defaultValue={enrollment.grade} onBlur={(e) => updateGrade(enrollment.id, e.target.value)} />
                      ) : (
                        <span className="font-bold">{enrollment.grade}/100</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 items-center">
                         {profile?.role === 'admin' && (
                            <button 
                              onClick={() => toggleCertify(enrollment.id, enrollment.certified)}
                              className={`text-xs font-bold px-3 py-1 rounded transition ${enrollment.certified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                            >
                              {enrollment.certified ? 'Aprobado' : 'Aprobar'}
                            </button>
                         )}

                         {(enrollment.certified || profile?.role === 'admin') && (
                            <button 
                              onClick={() => generatePDF(userProfile, event.title, event.event_date)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded flex items-center gap-2"
                            >
                              📄 Descargar Ficha
                            </button>
                         )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}