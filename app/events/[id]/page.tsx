'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { adLogoBase64 } from '@/app/utils/logos'

export default function EventDetails() {
  const [profile, setProfile] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [selectedUserToEnroll, setSelectedUserToEnroll] = useState('')
  const [loading, setLoading] = useState(true)
  
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const getDetails = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(profileData)

      const { data: eventData } = await supabase.from('events').select('*').eq('id', params.id).single()
      setEvent(eventData)

      fetchEnrollments()

      if (profileData.role === 'admin') {
        const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'student')
        setAllUsers(allProfiles || [])
      }
      
      setLoading(false)
    }
    getDetails()
  }, [])

  const fetchEnrollments = async () => {
    const { data: enrollData } = await supabase
      .from('enrollments')
      .select(`
        id, attended, grade, certified, user_id,
        profiles:user_id ( id, full_name, email, phone, address, birth_date, baptism_date, holy_spirit_date, previous_church, avatar_url )
      `)
      .eq('event_id', params.id)
    setEnrollments(enrollData || [])
  }

  // --- ADMIN: INSCRIBIR ALUMNO ---
  const handleAdminEnroll = async () => {
    if (!selectedUserToEnroll) return alert("Selecciona un alumno primero")
    const { error } = await supabase.from('enrollments').insert([
        { event_id: params.id, user_id: selectedUserToEnroll }
    ])
    if (error) alert("Error: " + error.message)
    else {
        alert("Alumno inscrito correctamente")
        fetchEnrollments()
        setSelectedUserToEnroll('')
    }
  }

  // --- ADMIN: DESINSCRIBIR (ELIMINAR) ALUMNO ---
  const handleUnsubscribe = async (enrollmentId: string) => {
    const confirmDelete = window.confirm("¿Estás seguro de querer quitar a este alumno del evento? Se borrarán sus notas y asistencia.")
    if (!confirmDelete) return

    const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId)

    if (error) {
        alert("Error al eliminar: " + error.message)
    } else {
        // Actualizamos la lista localmente quitando al alumno borrado
        setEnrollments(prev => prev.filter(item => item.id !== enrollmentId))
    }
  }

  // --- PDF ---
  const getImageData = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) { return null }
  }

  const generatePDF = async (studentProfile: any, courseName: string, eventDate: string) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    
    doc.addImage(adLogoBase64, 'JPEG', 10, 12, 35, 35); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("TEMPLO EL SEMBRADOR", 105, 20, { align: "center" })
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Pastores: Javier e Ignacia Gonzalez", 105, 28, { align: "center" })
    doc.text("Cd. Juarez, Chihuahua, Mexico", 105, 34, { align: "center" })
    doc.setFont("helvetica", "bold");
    doc.text("Escuela Dominical", 105, 42, { align: "center" })
    doc.text("Departamento Post-bautismal", 105, 50, { align: "center" })

    doc.setDrawColor(0); doc.rect(160, 10, 40, 40);
    if (studentProfile.avatar_url) {
        try {
            const studentPhoto = await getImageData(studentProfile.avatar_url)
            if (studentPhoto) doc.addImage(studentPhoto, 'JPEG', 160, 10, 40, 40)
            else doc.text("FOTO", 180, 30, { align: "center" })
        } catch (e) { doc.text("FOTO", 180, 30, { align: "center" }) }
    } else { doc.text("FOTO", 180, 30, { align: "center" }) }

    let y = 65; const lineHeight = 12; const valueX = 60;
    const drawField = (label: string, value: string | null) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(label, 10, y);
      doc.setFont("helvetica", "normal");
      if (value) doc.text(String(value), valueX, y);
      doc.setLineWidth(0.2); doc.line(valueX - 2, y + 1, 200, y + 1);
      y += lineHeight;
    }
    doc.text("Fecha:", 80, 60); doc.text(new Date().toLocaleDateString(), 100, 60); doc.line(95, 61, 150, 61);
    y = 75;
    drawField("Nombre del Alumno:", studentProfile.full_name);
    drawField("Fecha de Nacimiento:", studentProfile.birth_date || "");
    drawField("Direccion:", studentProfile.address || "");
    drawField("Iglesia de Procedencia:", studentProfile.previous_church || "");
    drawField("Fecha de Bautismos:", studentProfile.baptism_date || "");
    drawField("Fecha de Bautismo en el Espiritu Santo:", studentProfile.holy_spirit_date || "");
    drawField("Telefono:", studentProfile.phone || "");

    y += 20; doc.line(70, y, 140, y);
    doc.setFont("helvetica", "bold"); doc.text("Firma.", 105, y + 5, { align: "center" });
    y += 20; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("El Señor le bendiga y gracias por la informacion.", 10, y);
    doc.save(`Ficha_${studentProfile.full_name}.pdf`);
  }

  const toggleAttendance = async (id: string, status: boolean) => {
    if (profile?.role !== 'admin') return
    await supabase.from('enrollments').update({ attended: !status }).eq('id', id)
    fetchEnrollments()
  }
  const updateGrade = async (id: string, grade: string) => {
    if (profile?.role !== 'admin') return
    await supabase.from('enrollments').update({ grade: parseInt(grade) || 0 }).eq('id', id)
    fetchEnrollments()
  }
  const toggleCertify = async (id: string, status: boolean) => {
    if (profile?.role !== 'admin') return
    await supabase.from('enrollments').update({ certified: !status }).eq('id', id)
    fetchEnrollments()
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:underline mb-4 inline-block font-medium">← Volver al Dashboard</Link>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event?.title}</h1>
          <p className="text-gray-500">Panel de Gestión</p>
        </div>

        {profile?.role === 'admin' && (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-bold text-indigo-900 mb-1">Inscribir Alumno Nuevo:</label>
                    <select 
                        className="w-full p-2 rounded border border-indigo-200"
                        value={selectedUserToEnroll}
                        onChange={(e) => setSelectedUserToEnroll(e.target.value)}
                    >
                        <option value="">-- Seleccionar Alumno --</option>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                        ))}
                    </select>
                </div>
                <button onClick={handleAdminEnroll} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold hover:bg-indigo-700 h-10">
                    + Inscribir
                </button>
            </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase">Alumno</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Asistencia</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Nota</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((enrollment) => {
                const userProfile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
                const userName = userProfile?.full_name || "Sin nombre";

                return (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {userProfile?.avatar_url ? (
                          <img src={userProfile.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : ( <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">👤</div> )}
                        <div>
                          <p className="font-bold text-gray-900">{userName}</p>
                          {profile?.role === 'admin' && (
                              <Link href={`/admin/users/${userProfile.id}`} className="text-xs text-indigo-500 hover:underline">
                                  ✏️ Editar Perfil
                              </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {profile?.role === 'admin' ? (
                        <input type="checkbox" className="w-5 h-5 cursor-pointer" checked={enrollment.attended} onChange={() => toggleAttendance(enrollment.id, enrollment.attended)} />
                      ) : ( <span>{enrollment.attended ? '✅' : '❌'}</span> )}
                    </td>
                    <td className="p-4 text-center">
                      {profile?.role === 'admin' ? (
                        <input type="number" className="w-16 border rounded text-center" defaultValue={enrollment.grade} onBlur={(e) => updateGrade(enrollment.id, e.target.value)} />
                      ) : ( <span className="font-bold">{enrollment.grade}/100</span> )}
                    </td>
                    <td className="p-4 text-right">
                       <div className="flex justify-end gap-2 items-center">
                         {profile?.role === 'admin' && (
                            <>
                                <button onClick={() => toggleCertify(enrollment.id, enrollment.certified)} className={`text-xs font-bold px-3 py-1 rounded ${enrollment.certified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {enrollment.certified ? 'Aprobado' : 'Aprobar'}
                                </button>
                                
                                {/* BOTÓN DE ELIMINAR (NUEVO) */}
                                <button 
                                    onClick={() => handleUnsubscribe(enrollment.id)}
                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition"
                                    title="Desinscribir Alumno"
                                >
                                    🗑️
                                </button>
                            </>
                         )}
                         {(enrollment.certified || profile?.role === 'admin') && (
                            <button onClick={() => generatePDF(userProfile, event.title, event.event_date)} className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded">
                              📄 Ficha
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