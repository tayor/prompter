import assert from 'node:assert/strict'
import test from 'node:test'
import { SignJWT } from 'jose'
import { middleware } from '../../middleware'
import { AUTH_COOKIE_NAME } from '@/lib/auth'

function createRequest(pathname: string, token?: string) {
    return {
        nextUrl: { pathname },
        cookies: {
            get: (name: string) =>
                name === AUTH_COOKIE_NAME && token
                    ? { name: AUTH_COOKIE_NAME, value: token }
                    : undefined,
        },
    }
}

test('middleware bypasses non-api and auth endpoints', async () => {
    const publicResponse = await middleware(createRequest('/login'))
    assert.equal(publicResponse.status, 200)
    assert.equal(publicResponse.headers.get('x-middleware-next'), '1')

    const authResponse = await middleware(createRequest('/api/auth/login'))
    assert.equal(authResponse.status, 200)
    assert.equal(authResponse.headers.get('x-middleware-next'), '1')
})

test('middleware rejects protected routes without a token', async () => {
    const response = await middleware(createRequest('/api/prompts'))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Unauthorized' })
})

test('middleware returns 500 for protected routes when JWT_SECRET is missing', async () => {
    const original = process.env.JWT_SECRET
    const originalConsoleError = console.error
    const capturedErrors: unknown[][] = []
    try {
        delete process.env.JWT_SECRET
        console.error = (...args: unknown[]) => {
            capturedErrors.push(args)
        }

        const response1 = await middleware(createRequest('/api/prompts', 'invalid.token.value'))
        assert.equal(response1.status, 500)
        assert.deepEqual(await response1.json(), { error: 'Server misconfigured' })

        const response2 = await middleware(createRequest('/api/prompts', 'invalid.token.value'))
        assert.equal(response2.status, 500)
        assert.deepEqual(await response2.json(), { error: 'Server misconfigured' })

        assert.equal(capturedErrors.length, 1)
        assert.equal(capturedErrors[0]?.[0], 'API auth guard misconfigured: JWT_SECRET is missing')
    } finally {
        console.error = originalConsoleError
        if (original === undefined) {
            delete process.env.JWT_SECRET
        } else {
            process.env.JWT_SECRET = original
        }
    }
})

test('middleware allows protected routes with a valid token', async () => {
    const original = process.env.JWT_SECRET
    try {
        process.env.JWT_SECRET = 'middleware-test-secret'
        const secret = new TextEncoder().encode(process.env.JWT_SECRET)
        const token = await new SignJWT({ sub: 'admin' })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(secret)

        const response = await middleware(createRequest('/api/prompts', token))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('x-middleware-next'), '1')
    } finally {
        if (original === undefined) {
            delete process.env.JWT_SECRET
        } else {
            process.env.JWT_SECRET = original
        }
    }
})
