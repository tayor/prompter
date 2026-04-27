import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_NAME, getJwtSecret, verifyAuthToken } from '@/lib/auth'

// POST /api/auth/login - Login
export async function POST(request: Request) {
    try {
        const { username, password } = await request.json()

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
        }

        // Find admin
        let admin = await prisma.admin.findUnique({ where: { username } })

        // Bootstrap initial admin only when explicitly configured.
        if (!admin) {
            const adminCount = await prisma.admin.count()
            const initialUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin'
            const initialPassword = process.env.INITIAL_ADMIN_PASSWORD

            if (
                adminCount === 0 &&
                initialPassword &&
                username === initialUsername &&
                password === initialPassword
            ) {
                const passwordHash = await bcrypt.hash(password, 12)
                admin = await prisma.admin.create({
                    data: { username: initialUsername, passwordHash },
                })
            } else if (adminCount === 0 && !initialPassword) {
                return NextResponse.json(
                    { error: 'Initial admin is not configured' },
                    { status: 503 }
                )
            } else {
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
            }
        }

        // Verify password
        const valid = await bcrypt.compare(password, admin.passwordHash)
        if (!valid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // Create JWT token
        const token = await new SignJWT({ adminId: admin.id, username: admin.username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('7d')
            .sign(getJwtSecret())

        // Set cookie
        const cookieStore = await cookies()
        cookieStore.set(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        })

        return NextResponse.json({ success: true, username: admin.username })
    } catch (error) {
        if (error instanceof Error && error.message.includes('JWT_SECRET')) {
            console.error('Login failed: JWT_SECRET is missing')
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }
        console.error('Login failed:', error)
        return NextResponse.json({ error: 'Login failed' }, { status: 500 })
    }
}

// GET /api/auth/login - Check auth status
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

        if (!token) {
            return NextResponse.json({ authenticated: false })
        }

        const { payload } = await verifyAuthToken(token)

        return NextResponse.json({
            authenticated: true,
            username: payload.username,
        })
    } catch {
        return NextResponse.json({ authenticated: false })
    }
}
