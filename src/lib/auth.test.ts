import assert from 'node:assert/strict'
import test from 'node:test'
import { getJwtSecret } from '@/lib/auth'

test('getJwtSecret throws when JWT_SECRET is missing', () => {
    const original = process.env.JWT_SECRET
    try {
        delete process.env.JWT_SECRET
        assert.throws(() => getJwtSecret(), /JWT_SECRET is required/)
    } finally {
        if (original === undefined) {
            delete process.env.JWT_SECRET
        } else {
            process.env.JWT_SECRET = original
        }
    }
})

test('getJwtSecret returns UTF-8 bytes from JWT_SECRET', () => {
    const original = process.env.JWT_SECRET
    try {
        process.env.JWT_SECRET = 'top-secret'
        const secret = getJwtSecret()
        assert.equal(new TextDecoder().decode(secret), 'top-secret')
    } finally {
        if (original === undefined) {
            delete process.env.JWT_SECRET
        } else {
            process.env.JWT_SECRET = original
        }
    }
})
