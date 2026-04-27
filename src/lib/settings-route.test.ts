import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET, PUT } from '@/app/api/settings/route'

after(async () => {
    await prisma.$disconnect()
})

describe('GET /api/settings', () => {
    it('returns current settings with kanban', async () => {
        const response = await GET()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok('theme' in body)
        assert.ok('kanban' in body)
    })
})

describe('PUT /api/settings', () => {
    it('updates settings successfully', async () => {
        const response = await PUT(
            new Request('http://localhost/api/settings', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ theme: 'dark' }),
            })
        )
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.equal(body.theme, 'dark')
    })

    it('returns 400 for invalid settings data', async () => {
        const response = await PUT(
            new Request('http://localhost/api/settings', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ editorFontSize: 'not-a-number' }),
            })
        )
        assert.equal(response.status, 400)
    })
})
