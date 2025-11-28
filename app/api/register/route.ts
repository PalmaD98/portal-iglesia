import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 1. Conectar con permisos de Super Admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 2. Crear el Usuario en el sistema de Autenticación
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Lo confirmamos automáticamente
      user_metadata: { full_name: body.full_name }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (authData.user) {
      // 3. Rellenar la Ficha Completa en la tabla de perfiles
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          phone: body.phone,
          address: body.address,
          birth_date: body.birth_date || null,
          previous_church: body.previous_church,
          baptism_date: body.baptism_date || null,
          holy_spirit_date: body.holy_spirit_date || null,
          approved: true, // Ya entra APROBADO porque lo creó el admin
          role: 'student' // Por defecto alumno
        })
        .eq('id', authData.user.id)

      if (profileError) {
        return NextResponse.json({ error: 'Usuario creado pero falló el perfil: ' + profileError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ message: 'Usuario registrado exitosamente' })

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 })
  }
}