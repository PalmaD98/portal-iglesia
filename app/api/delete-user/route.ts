import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = body.userId

    if (!userId) {
      return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 })
    }

    // 1. Conectar como Super Admin
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

    // 2. Eliminar al usuario de Auth (Esto borrará su perfil en cascada)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Usuario eliminado correctamente' })

  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 })
  }
}