import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/prompts/route'
import { NextRequest } from 'next/server'

before(async () => {
    await prisma.promptVersion.deleteMany({})
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.prompt.deleteMany({})
})

after(async () => {
    await prisma.promptVersion.deleteMany({})
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.prompt.deleteMany({})
    await prisma.$disconnect()
})

describe('POST /api/prompts', () => {
    it('creates a prompt and returns 201', async () => {
        const response = await POST(
            new Request('http://localhost/api/prompts', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    title: 'Route Test Prompt',
                    content: 'Hello {{name}}',
                }),
            })
        )
        assert.equal(response.status, 201)
        const body = await response.json()
        assert.equal(body.title, 'Route Test Prompt')
        assert.ok(body.id)
    })

    it('returns 400 for invalid data', async () => {
        const response = await POST(
            new Request('http://localhost/api/prompts', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title: '' }),
            })
        )
        assert.equal(response.status, 400)
    })
})

describe('GET /api/prompts', () => {
    it('lists prompts', async () => {
        const request = new NextRequest('http://localhost/api/prompts')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.prompts)
        assert.ok(body.pagination)
    })

    it('filters by search query', async () => {
        const request = new NextRequest('http://localhost/api/prompts?q=Route+Test')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.prompts.length >= 1)
    })
})
