import { jwtVerify } from 'jose'

export const AUTH_COOKIE_NAME = 'auth-token'

export function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET is required')
    }
    return new TextEncoder().encode(secret)
}

export async function verifyAuthToken(token: string) {
    return jwtVerify(token, getJwtSecret())
}

