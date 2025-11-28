'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('sign-in') // 'sign-in' o 'sign-up'
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Estado para el formulario de Login (Solo email/pass)
  const [loginData, setLoginData] = useState({ email: '', password: '' })

  // Estado para el formulario de Registro (Ficha completa)
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    address_street: '', // Calle y número
    address_colonia: '', // Colonia
    birth_date: '',
    previous_church: '',
    baptism_date: '',
    holy_spirit_date: ''
  })

  // Manejar cambios en el Login
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value })
  }

  // Manejar cambios en el Registro
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData({ ...registerData, [e.target.name]: e.target.value })
  }

  // --- LÓGICA DE INICIO DE SESIÓN ---
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  // --- LÓGICA DE REGISTRO (FICHA COMPLETA) ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Crear el usuario en Autenticación
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerData.email,
      password: registerData.password,
      options: {
        data: {
          full_name: registerData.full_name, // Esto activa el trigger básico
        },
      },
    })

    if (authError) {
      alert('Error al registrarse: ' + authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      // 2. Guardar la Ficha Completa en la base de datos (Tabla profiles)
      // Unimos calle y colonia en el campo 'address'
      const fullAddress = `${registerData.address_street}, Col. ${registerData.address_colonia}`

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: registerData.phone,
          address: fullAddress,
          birth_date: registerData.birth_date || null,
          previous_church: registerData.previous_church,
          baptism_date: registerData.baptism_date || null,
          holy_spirit_date: registerData.holy_spirit_date || null
        })
        .eq('id', authData.user.id)

      if (profileError) {
        console.error('Error guardando perfil:', profileError)
        // No bloqueamos el flujo, pero avisamos en consola
      }

      alert('¡Registro exitoso! Bienvenido al Portal.')
      // Iniciar sesión automáticamente o redirigir
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Encabezado */}
        <div className="bg-indigo-600 p-6 text-center">
          <h2 className="text-3xl font-bold text-white">Portal Iglesia</h2>
          <p className="text-indigo-200 mt-2">
            {view === 'sign-in' ? 'Bienvenido, inicia sesión' : 'Ficha de Registro de Alumno'}
          </p>
        </div>

        <div className="p-8">
          
          {/* --- VISTA DE LOGIN --- */}
          {view === 'sign-in' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <input name="email" type="email" required value={loginData.email} onChange={handleLoginChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <input name="password" type="password" required value={loginData.password} onChange={handleLoginChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Entrando...' : 'Ingresar'}
              </button>
              
              <div className="mt-4 text-center">
                <p className="text-gray-600 text-sm">¿Eres nuevo?</p>
                <button type="button" onClick={() => setView('sign-up')} className="text-indigo-600 font-bold hover:underline">
                  Llenar Ficha de Registro
                </button>
              </div>
            </form>
          ) : (
            
            /* --- VISTA DE REGISTRO (FICHA COMPLETA) --- */
            <form onSubmit={handleSignUp} className="space-y-4">
              
              {/* Sección 1: Cuenta */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Datos de Acceso</h3>
                <div className="grid grid-cols-2 gap-3">
                    <input name="email" type="email" placeholder="Correo" required value={registerData.email} onChange={handleRegisterChange}
                      className="border p-2 rounded w-full text-sm" />
                    <input name="password" type="password" placeholder="Contraseña" required value={registerData.password} onChange={handleRegisterChange}
                      className="border p-2 rounded w-full text-sm" />
                </div>
              </div>

              {/* Sección 2: Datos Personales */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Nombre Completo del Alumno</label>
                <input name="full_name" type="text" required value={registerData.full_name} onChange={handleRegisterChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="Ej. Jesus Manuel Garcia" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Fecha Nacimiento</label>
                    <input name="birth_date" type="date" required value={registerData.birth_date} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Teléfono</label>
                    <input name="phone" type="text" required value={registerData.phone} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="656-..." />
                </div>
              </div>

              {/* Dirección Desglosada */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase">Dirección (Calle y #)</label>
                    <input name="address_street" type="text" required value={registerData.address_street} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="De los palacios 9012" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase">Colonia</label>
                    <input name="address_colonia" type="text" required value={registerData.address_colonia} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="Colonial del Sur" />
                </div>
              </div>

              {/* Sección 3: Datos Eclesiásticos */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Iglesia de Procedencia</label>
                <input name="previous_church" type="text" value={registerData.previous_church} onChange={handleRegisterChange}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2" placeholder="Ej. Bethel Metodista" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Fecha Bautismo</label>
                    <input name="baptism_date" type="date" value={registerData.baptism_date} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase">Bautismo E.S.</label>
                    <input name="holy_spirit_date" type="date" value={registerData.holy_spirit_date} onChange={handleRegisterChange}
                    className="mt-1 w-full border border-gray-300 rounded-md p-2" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition mt-6 disabled:opacity-50">
                {loading ? 'Registrando...' : 'Guardar Ficha y Registrarse'}
              </button>

              <div className="mt-2 text-center">
                <button type="button" onClick={() => setView('sign-in')} className="text-gray-500 text-sm hover:text-gray-800">
                  ← Volver al Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}