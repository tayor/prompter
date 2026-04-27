import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// POST /api/auth/logout - Logout
export async function POST() {
    try {
        const cookieStore = await cookies()
        cookieStore.delete('auth-token')

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Logout failed:', error)
        return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
    }
}
