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
  
  // --- ESTADO PARA EL MODAL DE CALIFICACIONES ---
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false)
  const [currentGrading, setCurrentGrading] = useState<any>(null)
  const [tempScores, setTempScores] = useState({
    themes: [0,0,0,0,0], 
    exams: [0,0,0,0,0,0,0] 
  })
  
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
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

  // --- AQUÍ ESTABA EL DETALLE: AGREGAMOS TODOS LOS CAMPOS ---
  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from('enrollments')
      .select(`
        id, attended, grade, certified, grades_data, user_id,
        profiles:user_id ( 
            id, 
            full_name, 
            email, 
            phone, 
            address, 
            birth_date, 
            baptism_date, 
            holy_spirit_date, 
            previous_church, 
            avatar_url 
        )
      `)
      .eq('event_id', params.id)
    setEnrollments(data || [])
  }

  // --- MODAL CALIFICACIONES ---
  const openGradeModal = (enrollment: any) => {
    setCurrentGrading(enrollment)
    const savedData = enrollment.grades_data || {}
    const themesData = (savedData.themes && savedData.themes.length > 0) ? savedData.themes : [0,0,0,0,0]
    const examsData = (savedData.exams && savedData.exams.length > 0) ? savedData.exams : [0,0,0,0,0,0,0]

    setTempScores({ themes: themesData, exams: examsData })
    setIsGradeModalOpen(true)
  }

  const handleScoreChange = (type: 'themes' | 'exams', index: number, value: string) => {
    if (value === '') {
        const newScores = { ...tempScores }
        // @ts-ignore
        newScores[type][index] = '' 
        setTempScores(newScores)
        return
    }
    const val = parseInt(value)
    if (isNaN(val)) return 
    const newScores = { ...tempScores }
    newScores[type][index] = val > 100 ? 100 : val
    setTempScores(newScores)
  }

  const saveGrades = async () => {
    if (!currentGrading) return
    const cleanThemes = tempScores.themes.map(n => Number(n) || 0)
    const cleanExams = tempScores.exams.map(n => Number(n) || 0)
    const sumThemes = cleanThemes.reduce((a, b) => a + b, 0)
    const sumExams = cleanExams.reduce((a, b) => a + b, 0)
    const finalAverage = Math.round((sumThemes + sumExams) / 12)

    const { error } = await supabase
        .from('enrollments')
        .update({
            grade: finalAverage,
            grades_data: { themes: cleanThemes, exams: cleanExams }
        })
        .eq('id', currentGrading.id)

    if (error) alert("Error: " + error.message)
    else { setIsGradeModalOpen(false); fetchEnrollments() }
  }

  // --- ADMIN ACTIONS ---
  const handleAdminEnroll = async () => {
    if (!selectedUserToEnroll) return alert("Selecciona un alumno")
    const { error } = await supabase.from('enrollments').insert([{ event_id: params.id, user_id: selectedUserToEnroll }])
    if (error) alert("Error: " + error.message)
    else { fetchEnrollments(); setSelectedUserToEnroll('') }
  }

  const handleUnsubscribe = async (id: string) => {
    if(!confirm("¿Eliminar alumno del evento?")) return
    await supabase.from('enrollments').delete().eq('id', id)
    fetchEnrollments()
  }

  const toggleAttendance = async (id: string, status: boolean) => {
    if (profile?.role !== 'admin') return
    await supabase.from('enrollments').update({ attended: !status }).eq('id', id)
    fetchEnrollments()
  }

  const toggleCertify = async (id: string, status: boolean) => {
    if (profile?.role !== 'admin') return
    await supabase.from('enrollments').update({ certified: !status }).eq('id', id)
    fetchEnrollments()
  }

  // --- PDF ---
  const getImageData = async (url: string) => {
    try {
      const res = await fetch(url); const blob = await res.blob();
      return new Promise<string>(r => {const fr=new FileReader(); fr.onload=()=>r(fr.result as string); fr.readAsDataURL(blob)})
    } catch { return null }
  }

  const generatePDF = async (user: any) => {
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
    
    // Foto
    doc.setDrawColor(0); doc.rect(160, 10, 40, 40);
    if (user.avatar_url) {
        const photo = await getImageData(user.avatar_url)
        if (photo) doc.addImage(photo, 'JPEG', 160, 10, 40, 40)
        else doc.text("FOTO", 180, 30, { align: "center" })
    } else doc.text("FOTO", 180, 30, { align: "center" })

    // CAMPOS DE DATOS
    let y = 70; const xVal = 60;
    const field = (l: string, v: string) => {
        doc.setFont("helvetica", "bold"); doc.text(l, 10, y);
        doc.setFont("helvetica", "normal"); doc.text(v || '', xVal, y);
        doc.line(xVal - 2, y + 1, 200, y + 1); y += 12;
    }
    
    // Fecha actual
    doc.text("Fecha:", 80, 62); doc.text(new Date().toLocaleDateString(), 100, 62); doc.line(95, 63, 150, 63);

    y = 75; // Reiniciar Y
    field("Nombre del Alumno:", user.full_name);
    field("Fecha de Nacimiento:", user.birth_date);
    field("Dirección:", user.address);
    field("Iglesia de Procedencia:", user.previous_church);
    field("Fecha de Bautismos:", user.baptism_date);
    field("Bautismo Espíritu Santo:", user.holy_spirit_date);
    field("Teléfono:", user.phone);
    
    y+=20; doc.line(70, y, 140, y); doc.text("Firma", 105, y+5, {align:"center"});
    
    y+=20; doc.setFontSize(9);
    doc.text("El Señor le bendiga y gracias por su información.", 10, y);
    doc.save(`Ficha_${user.full_name}.pdf`)
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:underline mb-4 inline-block font-bold">← Volver</Link>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event?.title}</h1>
          <p className="text-gray-500">Gestión de Seminario</p>
        </div>

        {/* ADMIN ENROLL */}
        {profile?.role === 'admin' && (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-bold text-indigo-900 mb-1">Inscribir Alumno:</label>
                    <select className="w-full p-2 border rounded" value={selectedUserToEnroll} onChange={e => setSelectedUserToEnroll(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                </div>
                <button onClick={handleAdminEnroll} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold h-10">+ Inscribir</button>
            </div>
        )}

        {/* TABLA PRINCIPAL */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Alumno</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-center">Asist.</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-center">Promedio</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((enr) => {
                const user = Array.isArray(enr.profiles) ? enr.profiles[0] : enr.profiles;
                return (
                  <tr key={enr.id} className="hover:bg-gray-50">
                    <td className="p-4">
                        <div className="font-bold text-gray-800">{user?.full_name}</div>
                        {profile?.role === 'admin' && (
                            <Link href={`/admin/users/${user?.id}`} className="text-xs text-indigo-500 hover:underline">✏️ Editar Perfil</Link>
                        )}
                    </td>
                    <td className="p-4 text-center">
                        <input type="checkbox" checked={enr.attended} onChange={() => toggleAttendance(enr.id, enr.attended)} 
                            disabled={profile?.role !== 'admin'} className="w-5 h-5" />
                    </td>
                    <td className="p-4 text-center">
                        {profile?.role === 'admin' ? (
                            <button onClick={() => openGradeModal(enr)} className="bg-blue-50 text-blue-700 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 font-bold text-sm">
                                📝 {enr.grade ? `${enr.grade}/100` : 'Evaluar'}
                            </button>
                        ) : (
                            <span className={`font-bold ${enr.grade >= 70 ? 'text-green-600' : 'text-gray-400'}`}>
                                {enr.grade ? `${enr.grade}/100` : '--'}
                            </span>
                        )}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                        {profile?.role === 'admin' && (
                            <>
                                <button onClick={() => toggleCertify(enr.id, enr.certified)} className={`px-2 py-1 rounded text-xs font-bold ${enr.certified ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                    {enr.certified ? 'Aprobado' : 'Aprobar'}
                                </button>
                                <button onClick={() => handleUnsubscribe(enr.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">🗑️</button>
                            </>
                        )}
                        <button onClick={() => generatePDF(user)} className="text-blue-600 hover:bg-blue-50 p-1 rounded font-bold text-xs border border-blue-200">
                            📄 Ficha
                        </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DE CALIFICACIONES --- */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="bg-indigo-600 p-4 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg">Evaluando a: {Array.isArray(currentGrading?.profiles) ? currentGrading.profiles[0]?.full_name : currentGrading?.profiles?.full_name}</h3>
                    <button onClick={() => setIsGradeModalOpen(false)} className="text-white hover:bg-indigo-700 px-3 rounded">✕</button>
                </div>
                
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <div className="mb-6">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-3">5 Temas del Seminario</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {tempScores.themes.map((score: number, i: number) => (
                                <div key={`theme-${i}`}>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tema {i + 1}</label>
                                    <input type="number" min="0" max="100" className="w-full border p-2 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={score} onChange={(e) => handleScoreChange('themes', i, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mb-6">
                        <h4 className="font-bold text-gray-700 border-b pb-2 mb-3">7 Exámenes Parciales</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {tempScores.exams.map((score: number, i: number) => (
                                <div key={`exam-${i}`}>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Examen {i + 1}</label>
                                    <input type="number" min="0" max="100" className="w-full border p-2 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={score} onChange={(e) => handleScoreChange('exams', i, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-gray-200">
                        <div className="text-sm text-gray-500">Promedio calculado (sobre 12 notas).</div>
                        <div className="text-right">
                            <span className="block text-xs uppercase font-bold text-gray-400">Promedio</span>
                            <span className="text-3xl font-bold text-indigo-600">
                                {Math.round((
                                    tempScores.themes.reduce((a: any, b: any) => (Number(a)||0) + (Number(b)||0), 0) + 
                                    tempScores.exams.reduce((a: any, b: any) => (Number(a)||0) + (Number(b)||0), 0)
                                ) / 12)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
                    <button onClick={() => setIsGradeModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>
                    <button onClick={saveGrades} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow">💾 Guardar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}