import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { NextRequest } from 'next/server'

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
    const req = new NextRequest(new URL(url), { headers })
    return req
}

describe('ensureLocalhostRequest', () => {
    it('allows localhost requests', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start')
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })

    it('allows 127.0.0.1 requests', () => {
        const req = makeRequest('http://127.0.0.1:3000/api/execution/start')
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })

    it('allows ::1 IPv6 loopback', () => {
        const req = makeRequest('http://[::1]:3000/api/execution/start')
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })

    it('rejects non-localhost hostname', () => {
        const req = makeRequest('http://evil.com:3000/api/execution/start')
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('rejects non-loopback IP', () => {
        const req = makeRequest('http://192.168.1.1:3000/api/execution/start')
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('rejects when host header is non-localhost', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            host: 'evil.com:3000',
        })
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('rejects when x-forwarded-host is non-localhost', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-host': 'evil.com',
        })
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('rejects when x-forwarded-for is non-loopback', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-for': '10.0.0.1',
        })
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('allows x-forwarded-for with 127.0.0.1', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-for': '127.0.0.1',
        })
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })

    it('allows x-forwarded-for with ::1', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-for': '::1',
        })
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })

    it('rejects when any x-forwarded-for entry is non-local', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-for': '127.0.0.1, 8.8.8.8',
        })
        const result = ensureLocalhostRequest(req)
        assert.notEqual(result, null)
        assert.equal(result!.status, 403)
    })

    it('allows multiple x-forwarded-host entries all localhost', () => {
        const req = makeRequest('http://localhost:3000/api/execution/start', {
            'x-forwarded-host': 'localhost, 127.0.0.1',
        })
        const result = ensureLocalhostRequest(req)
        assert.equal(result, null)
    })
})
