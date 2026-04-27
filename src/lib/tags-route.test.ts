import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/tags/route'

before(async () => {
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.tag.deleteMany({})
})

after(async () => {
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.tag.deleteMany({})
    await prisma.$disconnect()
})

describe('POST /api/tags', () => {
    it('creates a tag and returns 201', async () => {
        const response = await POST(
            new Request('http://localhost/api/tags', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'route-tag', color: '#00ff00' }),
            })
        )
        assert.equal(response.status, 201)
        const body = await response.json()
        assert.equal(body.name, 'route-tag')
    })

    it('returns 409 for duplicate tag', async () => {
        const response = await POST(
            new Request('http://localhost/api/tags', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'route-tag' }),
            })
        )
        assert.equal(response.status, 409)
    })

    it('returns 400 for invalid tag data', async () => {
        const response = await POST(
            new Request('http://localhost/api/tags', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: '' }),
            })
        )
        assert.equal(response.status, 400)
    })
})

describe('GET /api/tags', () => {
    it('lists tags with counts', async () => {
        const response = await GET()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.tags)
        assert.ok(body.tags.length >= 1)
    })
})
