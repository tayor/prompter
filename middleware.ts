import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/auth'

let hasLoggedMissingJwtSecret = false

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Only guard API routes; auth endpoints remain publicly accessible.
    if (!pathname.startsWith('/api') || pathname.startsWith('/api/auth')) {
        return NextResponse.next()
    }

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await verifyAuthToken(token)
        return NextResponse.next()
    } catch (error) {
        if (error instanceof Error && error.message.includes('JWT_SECRET')) {
            if (!hasLoggedMissingJwtSecret) {
                console.error('API auth guard misconfigured: JWT_SECRET is missing')
                hasLoggedMissingJwtSecret = true
            }
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }

        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
}

export const config = {
    matcher: ['/api/:path*'],
}
