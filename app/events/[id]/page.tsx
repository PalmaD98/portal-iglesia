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
  
  // --- ESTADO PARA EL MODAL MAESTRO (NOTAS + ASISTENCIA) ---
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false)
  const [currentGrading, setCurrentGrading] = useState<any>(null)
  
  // Notas
  const [tempScores, setTempScores] = useState({
    themes: [0,0,0,0,0], 
    exams: [0,0,0,0,0,0,0] 
  })
  
  // Asistencias (5 Temas)
  const [tempAttendance, setTempAttendance] = useState<boolean[]>([false, false, false, false, false])
  
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

  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from('enrollments')
      .select(`
        id, attended, grade, certified, grades_data, attendance_data, user_id,
        profiles:user_id ( id, full_name, email, phone, address, avatar_url )
      `)
      .eq('event_id', params.id)
    setEnrollments(data || [])
  }

  // --- ABRIR MODAL MAESTRO ---
  const openGradeModal = (enrollment: any) => {
    setCurrentGrading(enrollment)
    
    // 1. Cargar Notas
    const savedGrades = enrollment.grades_data || {}
    const themesData = (savedGrades.themes && savedGrades.themes.length === 5) ? savedGrades.themes : [0,0,0,0,0]
    const examsData = (savedGrades.exams && savedGrades.exams.length === 7) ? savedGrades.exams : [0,0,0,0,0,0,0]
    setTempScores({ themes: themesData, exams: examsData })

    // 2. Cargar Asistencias
    const savedAttendance = enrollment.attendance_data?.topics || [false, false, false, false, false]
    setTempAttendance(savedAttendance)

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
    // @ts-ignore
    newScores[type][index] = val > 100 ? 100 : val
    setTempScores(newScores)
  }

  const toggleTempAttendance = (index: number) => {
    const newAtt = [...tempAttendance]
    newAtt[index] = !newAtt[index]
    setTempAttendance(newAtt)
  }

  // --- GUARDAR TODO (NOTAS + ASISTENCIA) ---
  const saveAllData = async () => {
    if (!currentGrading) return

    // Limpieza de notas
    const cleanThemes = tempScores.themes.map(n => Number(n) || 0)
    const cleanExams = tempScores.exams.map(n => Number(n) || 0)
    const sumThemes = cleanThemes.reduce((a, b) => a + b, 0)
    const sumExams = cleanExams.reduce((a, b) => a + b, 0)
    const finalAverage = Math.round((sumThemes + sumExams) / 12)

    // Guardado en Supabase
    const { error } = await supabase
        .from('enrollments')
        .update({
            grade: finalAverage,
            grades_data: { themes: cleanThemes, exams: cleanExams },
            attendance_data: { topics: tempAttendance },
            attended: tempAttendance.some(t => t === true) // Marca "Presente" general si fue al menos a una
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
    
    doc.setDrawColor(0); doc.rect(160, 10, 40, 40);
    if (user.avatar_url) {
        const photo = await getImageData(user.avatar_url)
        if (photo) doc.addImage(photo, 'JPEG', 160, 10, 40, 40)
        else doc.text("FOTO", 180, 30, { align: "center" })
    } else doc.text("FOTO", 180, 30, { align: "center" })

    let y = 70; const xVal = 60;
    const field = (l: string, v: string) => {
        doc.setFont("helvetica", "bold"); doc.text(l, 10, y);
        doc.setFont("helvetica", "normal"); doc.text(v || '', xVal, y);
        doc.line(xVal - 2, y + 1, 200, y + 1); y += 12;
    }
    field("Nombre:", user.full_name);
    field("Dirección:", user.address);
    field("Teléfono:", user.phone);
    y+=20; doc.line(70, y, 140, y); doc.text("Firma", 105, y+5, {align:"center"});
    doc.save(`Ficha_${user.full_name}.pdf`)
  }

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:underline mb-4 inline-block font-bold">← Volver</Link>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event?.title}</h1>
          <p className="text-gray-500">Seminario de 1.5 Años • 5 Temas • 7 Exámenes</p>
        </div>

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

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-xs font-bold uppercase text-gray-500">Alumno</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-center">Asist. / Eval.</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-center">Promedio</th>
                <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((enr) => {
                const user = Array.isArray(enr.profiles) ? enr.profiles[0] : enr.profiles;
                const attendanceCount = enr.attendance_data?.topics?.filter((t:boolean) => t).length || 0;

                return (
                  <tr key={enr.id} className="hover:bg-gray-50">
                    <td className="p-4 font-bold text-gray-800">{user?.full_name}</td>
                    
                    {/* BOTÓN UNIFICADO: MUESTRA RESUMEN Y ABRE MODAL */}
                    <td className="p-4 text-center">
                        {profile?.role === 'admin' ? (
                            <button 
                                onClick={() => openGradeModal(enr)}
                                className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded border border-indigo-200 hover:bg-indigo-100 font-bold text-sm flex items-center justify-center gap-2 mx-auto"
                            >
                                📝 Evaluar 
                                <span className="text-xs bg-white px-2 py-0.5 rounded border border-indigo-100 text-gray-500">
                                    Asist: {attendanceCount}/5
                                </span>
                            </button>
                        ) : (
                            <span className="text-gray-500 text-sm">
                                Asist: {attendanceCount}/5
                            </span>
                        )}
                    </td>

                    <td className="p-4 text-center">
                        <span className={`font-bold text-lg ${enr.grade >= 70 ? 'text-green-600' : 'text-gray-400'}`}>
                            {enr.grade ? enr.grade : '--'}
                        </span>
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

      {/* --- MODAL MAESTRO (NOTAS + ASISTENCIA) --- */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Evaluación: {Array.isArray(currentGrading?.profiles) ? currentGrading.profiles[0]?.full_name : currentGrading?.profiles?.full_name}</h3>
                    <button onClick={() => setIsGradeModalOpen(false)} className="text-white hover:bg-indigo-700 px-3 rounded">✕</button>
                </div>
                
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    
                    {/* SECCIÓN 1: TEMAS Y ASISTENCIA */}
                    <div className="mb-8">
                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex justify-between">
                            <span>5 Temas del Seminario</span>
                            <span className="text-xs text-gray-500 font-normal">Marca la casilla si asistió</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {tempScores.themes.map((score: number, i: number) => (
                                <div key={`theme-${i}`} className="flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                                    <label className="text-xs font-bold text-indigo-900 text-center">Tema {i + 1}</label>
                                    
                                    {/* Input de Nota */}
                                    <input 
                                        type="number" min="0" max="100" placeholder="Nota"
                                        className="w-full border p-1 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                                        value={score} 
                                        onChange={(e) => handleScoreChange('themes', i, e.target.value)} 
                                    />

                                    {/* Checkbox de Asistencia */}
                                    <label className={`flex items-center justify-center gap-1 cursor-pointer select-none text-xs py-1 rounded transition
                                        ${tempAttendance[i] ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-gray-300 text-gray-400 hover:bg-gray-100'}
                                    `}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={tempAttendance[i]} 
                                            onChange={() => toggleTempAttendance(i)}
                                        />
                                        {tempAttendance[i] ? '✓ Asistió' : 'Falta'}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN 2: EXÁMENES */}
                    <div className="mb-6">
                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">7 Exámenes Parciales</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {tempScores.exams.map((score: number, i: number) => (
                                <div key={`exam-${i}`}>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Examen {i + 1}</label>
                                    <input 
                                        type="number" min="0" max="100"
                                        className="w-full border p-2 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={score} 
                                        onChange={(e) => handleScoreChange('exams', i, e.target.value)} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RESUMEN */}
                    <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center border border-indigo-100">
                        <div>
                            <p className="text-sm font-bold text-indigo-900">Resumen de Evaluación</p>
                            <p className="text-xs text-indigo-600">Asistencia: {tempAttendance.filter(Boolean).length}/5</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-xs uppercase font-bold text-indigo-400">Promedio Final</span>
                            <span className="text-4xl font-bold text-indigo-700">
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
                    <button onClick={saveAllData} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-lg">
                        💾 Guardar Todo
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}