import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth'

// PUT /api/auth/password - Change password
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { payload } = await verifyAuthToken(token)
        const adminId = payload.adminId as string

        const { currentPassword, newPassword } = await request.json()

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current and new password required' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        // Get admin
        const admin = await prisma.admin.findUnique({ where: { id: adminId } })
        if (!admin) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
        }

        // Verify current password
        const valid = await bcrypt.compare(currentPassword, admin.passwordHash)
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
        }

        // Hash new password and update
        const passwordHash = await bcrypt.hash(newPassword, 12)
        await prisma.admin.update({
            where: { id: adminId },
            data: { passwordHash },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof Error && error.message.includes('JWT_SECRET')) {
            console.error('Password change failed: JWT_SECRET is missing')
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }
        console.error('Password change failed:', error)
        return NextResponse.json({ error: 'Password change failed' }, { status: 500 })
    }
}
