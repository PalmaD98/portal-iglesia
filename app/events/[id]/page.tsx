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
  
  // --- ESTADOS DE FILTROS ---
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') 

  // --- ESTADOS PARA INSCRIPCIONES ---
  const [selectedBatch, setSelectedBatch] = useState<string[]>([])     
  
  // --- ESTADOS PARA LOS MODALES ---
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  
  const [currentGrading, setCurrentGrading] = useState<any>(null)
  
  // Notas
  const [tempScores, setTempScores] = useState<{
    themes: (number | string)[],
    exams: (number | string)[]
  }>({
    themes: [0,0,0,0,0], 
    exams: [0,0,0,0,0,0,0] 
  })
  
  const [tempAttendance, setTempAttendance] = useState<boolean[]>([false, false, false, false, false])
  
  const params = useParams()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(profileData)

    const { data: eventData } = await supabase.from('events').select('*').eq('id', params.id).single()
    setEvent(eventData)

    fetchEnrollments()

    if (profileData.role === 'admin') {
      const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('full_name')
      setAllUsers(allProfiles || [])
    }
    setLoading(false)
  }

  // --- AQUÍ ESTABA EL DETALLE: AGREGAMOS TODOS LOS CAMPOS FALTANTES ---
  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from('enrollments')
      .select(`
        id, attended, grade, certified, grades_data, attendance_data, user_id,
        profiles:user_id ( 
            id, 
            full_name, 
            email, 
            phone, 
            address, 
            avatar_url,
            birth_date,         
            previous_church,    
            baptism_date,       
            holy_spirit_date    
        )
      `)
      .eq('event_id', params.id)
      .order('created_at', { ascending: false })
    setEnrollments(data || [])
  }

  // --- FILTRADO VISUAL ---
  const filteredEnrollments = enrollments.filter(enr => {
    const user = Array.isArray(enr.profiles) ? enr.profiles[0] : enr.profiles
    const userName = user?.full_name || ''
    const matchesName = userName.toLowerCase().includes(searchTerm.toLowerCase())
    let matchesStatus = true
    if (filterStatus === 'approved') matchesStatus = enr.certified === true
    else if (filterStatus === 'pending') matchesStatus = enr.certified === false
    return matchesName && matchesStatus
  })

  // --- INSCRIPCIONES ---
  const handleIndividualEnroll = async () => {
    if (!selectedUserToEnroll) return alert("Selecciona un alumno.")
    const { error } = await supabase.from('enrollments').insert([{ event_id: params.id, user_id: selectedUserToEnroll }])
    if (error) alert("Error: " + error.message)
    else { alert("Inscrito correctamente."); fetchEnrollments(); setSelectedUserToEnroll('') }
  }

  const handleBulkEnroll = async () => {
    if (selectedBatch.length === 0) return
    const records = selectedBatch.map(userId => ({ event_id: params.id, user_id: userId }))
    const { error } = await supabase.from('enrollments').insert(records)
    if (error) alert("Error: " + error.message)
    else { alert(`¡${selectedBatch.length} inscritos!`); setIsBulkModalOpen(false); setSelectedBatch([]); fetchEnrollments() }
  }

  const toggleUserSelection = (userId: string) => {
    if (selectedBatch.includes(userId)) setSelectedBatch(prev => prev.filter(id => id !== userId))
    else setSelectedBatch(prev => [...prev, userId])
  }

  const toggleSelectAll = (availableUsers: any[]) => {
    if (selectedBatch.length === availableUsers.length) setSelectedBatch([])
    else setSelectedBatch(availableUsers.map(u => u.id))
  }

  // --- EVALUACIÓN ---
  const openGradeModal = (enrollment: any) => {
    setCurrentGrading(enrollment)
    const savedGrades = enrollment.grades_data || {}
    const savedAttendance = enrollment.attendance_data?.topics || [false, false, false, false, false]
    
    const themesData = (savedGrades.themes && savedGrades.themes.length === 5) ? savedGrades.themes : [0,0,0,0,0]
    const examsData = (savedGrades.exams && savedGrades.exams.length === 7) ? savedGrades.exams : [0,0,0,0,0,0,0]

    setTempScores({ themes: themesData, exams: examsData })
    setTempAttendance(savedAttendance)
    setIsGradeModalOpen(true)
  }

  const handleScoreChange = (type: 'themes' | 'exams', index: number, value: string) => {
    if (value === '') {
        const newScores = { ...tempScores }
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

  const toggleTempAttendance = (index: number) => {
    const newAtt = [...tempAttendance]; newAtt[index] = !newAtt[index]; setTempAttendance(newAtt)
  }

  const saveAllData = async () => {
    if (!currentGrading) return
    const cleanThemes = tempScores.themes.map(n => Number(n) || 0)
    const cleanExams = tempScores.exams.map(n => Number(n) || 0)
    const sumThemes = cleanThemes.reduce((a, b) => a + b, 0)
    const sumExams = cleanExams.reduce((a, b) => a + b, 0)
    const finalAverage = Math.round((sumThemes + sumExams) / 12)

    const { error } = await supabase.from('enrollments').update({
        grade: finalAverage,
        grades_data: { themes: cleanThemes, exams: cleanExams },
        attendance_data: { topics: tempAttendance },
        attended: tempAttendance.some(t => t)
    }).eq('id', currentGrading.id)

    if (error) alert("Error: " + error.message)
    else { setIsGradeModalOpen(false); fetchEnrollments() }
  }

  // --- PDF & OTROS ---
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
    
    doc.setDrawColor(0); doc.rect(160, 10, 40, 40);
    if (user.avatar_url) {
        const photo = await getImageData(user.avatar_url)
        if (photo) doc.addImage(photo, 'JPEG', 160, 10, 40, 40)
        else doc.text("FOTO", 180, 30, { align: "center" })
    } else doc.text("FOTO", 180, 30, { align: "center" })

    // CAMPOS DE DATOS (Ahora sí se llenarán)
    let y = 70; const xVal = 60;
    const field = (l: string, v: string) => {
        doc.setFont("helvetica", "bold"); doc.text(l, 10, y);
        doc.setFont("helvetica", "normal"); doc.text(v || '', xVal, y);
        doc.line(xVal - 2, y + 1, 200, y + 1); y += 12;
    }
    
    // Fecha actual en el PDF
    doc.text("Fecha:", 80, 60); doc.text(new Date().toLocaleDateString(), 100, 60); doc.line(95, 61, 150, 61);

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

  const availableUsers = allUsers.filter(user => !enrollments.some(enr => enr.user_id === user.id))

  if (loading) return <div className="p-10 text-center">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:underline mb-4 inline-block font-bold">← Volver al Dashboard</Link>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{event?.title}</h1>
          <p className="text-gray-500">Gestión Académica • Total Inscritos: {enrollments.length}</p>
        </div>

        {profile?.role === 'admin' && (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <select className="p-2 border rounded text-sm w-64" value={selectedUserToEnroll} onChange={(e) => setSelectedUserToEnroll(e.target.value)}>
                        <option value="">-- Inscripción Rápida --</option>
                        {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                    </select>
                    <button onClick={handleIndividualEnroll} className="bg-white text-indigo-600 border border-indigo-200 px-3 py-2 rounded font-bold text-sm shadow-sm">+ Agregar</button>
                </div>
                <button onClick={() => setIsBulkModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold shadow flex items-center gap-2">👥 Inscripción Masiva</button>
            </div>
        )}

        {/* --- BARRA DE FILTROS --- */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-gray-100 p-3 rounded-lg border border-gray-200">
            <div className="flex-1">
                <input type="text" placeholder="🔍 Buscar alumno por nombre..." className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="w-full sm:w-64">
                <select className="w-full border p-2 rounded bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">Todos los Estados</option>
                    <option value="approved">✅ Aprobados</option>
                    <option value="pending">⏳ Pendientes</option>
                </select>
            </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-3 bg-gray-50 border-b text-xs font-bold text-gray-500 flex justify-between">
             <span>Viendo {filteredEnrollments.length} alumnos</span>
             {filterStatus !== 'all' && <span className="bg-blue-100 text-blue-700 px-2 rounded">Filtro Activo</span>}
          </div>
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
              {filteredEnrollments.map((enr) => {
                const user = Array.isArray(enr.profiles) ? enr.profiles[0] : enr.profiles;
                const attendanceCount = enr.attendance_data?.topics?.filter((t:boolean) => t).length || 0;

                return (
                  <tr key={enr.id} className="hover:bg-gray-50">
                    <td className="p-4 font-bold text-gray-800">{user?.full_name}</td>
                    <td className="p-4 text-center">
                        {profile?.role === 'admin' ? (
                            <button onClick={() => openGradeModal(enr)} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded border border-indigo-200 hover:bg-indigo-100 font-bold text-sm flex items-center justify-center gap-2 mx-auto">
                                📝 Evaluar <span className="text-xs bg-white px-2 py-0.5 rounded border border-indigo-100 text-gray-500">Asist: {attendanceCount}/5</span>
                            </button>
                        ) : ( <span className="text-gray-500 text-sm">Asist: {attendanceCount}/5</span> )}
                    </td>
                    <td className="p-4 text-center">
                        <span className={`font-bold text-lg ${enr.grade >= 70 ? 'text-green-600' : 'text-gray-400'}`}>{enr.grade ? enr.grade : '--'}</span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                        {profile?.role === 'admin' && (
                            <>
                                <button onClick={() => toggleCertify(enr.id, enr.certified)} className={`px-2 py-1 rounded text-xs font-bold ${enr.certified ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{enr.certified ? 'Aprobado' : 'Aprobar'}</button>
                                <button onClick={() => handleUnsubscribe(enr.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">🗑️</button>
                            </>
                        )}
                        <button onClick={() => generatePDF(user)} className="text-blue-600 hover:bg-blue-50 p-1 rounded font-bold text-xs border border-blue-200">📄 Ficha</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL MASIVO --- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold text-lg">Inscripción Masiva</h3><button onClick={() => setIsBulkModalOpen(false)}>✕</button></div>
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-600">Disponibles: {availableUsers.length}</span>
                    <button onClick={() => toggleSelectAll(availableUsers)} className="text-xs text-indigo-600 font-bold hover:underline">{selectedBatch.length === availableUsers.length ? 'Desmarcar Todos' : 'Seleccionar Todos'}</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {availableUsers.map(user => (
                        <div key={user.id} onClick={() => toggleUserSelection(user.id)} className={`flex items-center gap-3 p-3 mb-1 rounded cursor-pointer transition select-none ${selectedBatch.includes(user.id) ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedBatch.includes(user.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>{selectedBatch.includes(user.id) && '✓'}</div>
                            <div><p className="font-bold text-gray-800 text-sm">{user.full_name}</p><p className="text-xs text-gray-500">{user.email}</p></div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-white"><button onClick={handleBulkEnroll} disabled={selectedBatch.length === 0} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">Inscribir</button></div>
            </div>
        </div>
      )}

      {/* --- MODAL EVALUACIÓN --- */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Evaluación: {Array.isArray(currentGrading?.profiles) ? currentGrading.profiles[0]?.full_name : currentGrading?.profiles?.full_name}</h3>
                    <button onClick={() => setIsGradeModalOpen(false)} className="text-white hover:bg-indigo-700 px-3 rounded">✕</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <div className="mb-8">
                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex justify-between"><span>5 Temas del Seminario</span><span className="text-xs text-gray-500 font-normal">Marca la casilla si asistió</span></h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {tempScores.themes.map((score: number|string, i: number) => (
                                <div key={`theme-${i}`} className="flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                                    <label className="text-xs font-bold text-indigo-900 text-center">Tema {i + 1}</label>
                                    <input type="number" min="0" max="100" placeholder="Nota" className="w-full border p-1 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                                        value={score} onChange={(e) => handleScoreChange('themes', i, e.target.value)} />
                                    <label className={`flex items-center justify-center gap-1 cursor-pointer select-none text-xs py-1 rounded transition ${tempAttendance[i] ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-gray-300 text-gray-400 hover:bg-gray-100'}`}>
                                        <input type="checkbox" className="hidden" checked={tempAttendance[i]} onChange={() => toggleTempAttendance(i)} />
                                        {tempAttendance[i] ? '✓ Asistió' : 'Falta'}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mb-6">
                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">7 Exámenes Parciales</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {tempScores.exams.map((score: number|string, i: number) => (
                                <div key={`exam-${i}`}><label className="block text-xs font-bold text-gray-500 mb-1">Examen {i + 1}</label><input type="number" min="0" max="100" className="w-full border p-2 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none" value={score} onChange={(e) => handleScoreChange('exams', i, e.target.value)} /></div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center border border-indigo-100">
                        <div><p className="text-sm font-bold text-indigo-900">Resumen</p><p className="text-xs text-indigo-600">Asistencia: {tempAttendance.filter(Boolean).length}/5</p></div>
                        <div className="text-right">
                            <span className="block text-xs uppercase font-bold text-indigo-400">Promedio Final</span>
                            <span className="text-4xl font-bold text-indigo-700">
                                {Math.round((
                                    tempScores.themes.map(n => Number(n)||0).reduce((a, b) => a + b, 0) + 
                                    tempScores.exams.map(n => Number(n)||0).reduce((a, b) => a + b, 0)
                                ) / 12)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
                    <button onClick={() => setIsGradeModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-medium">Cancelar</button>
                    <button onClick={saveAllData} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-lg">💾 Guardar Todo</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}