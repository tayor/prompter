import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/export/route'
import { NextRequest } from 'next/server'

after(async () => {
    await prisma.$disconnect()
})

describe('GET /api/export', () => {
    it('returns JSON export by default', async () => {
        const request = new NextRequest('http://localhost/api/export')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const contentType = response.headers.get('content-type')
        assert.ok(contentType?.includes('application/json'))

        const body = JSON.parse(await response.text())
        assert.ok(body.version)
        assert.ok(body.exportedAt)
    })

    it('returns YAML export when format=yaml', async () => {
        const request = new NextRequest('http://localhost/api/export?format=yaml')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const contentType = response.headers.get('content-type')
        assert.ok(contentType?.includes('text/yaml'))
    })

    it('respects exclusion params', async () => {
        const request = new NextRequest('http://localhost/api/export?prompts=false&workflows=false')
        const response = await GET(request)
        assert.equal(response.status, 200)

        const body = JSON.parse(await response.text())
        assert.equal(body.prompts, undefined)
        assert.equal(body.workflows, undefined)
    })
})
