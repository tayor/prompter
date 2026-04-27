import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'

after(async () => {
    await prisma.$disconnect()
})

describe('GET /api/search', () => {
    it('returns search results with pagination', async () => {
        const request = new NextRequest('http://localhost/api/search?q=test')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok('pagination' in body)
        assert.ok('total' in body)
    })

    it('filters by type prompts', async () => {
        const request = new NextRequest('http://localhost/api/search?type=prompts')
        const response = await GET(request)
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.prompts !== undefined || body.total !== undefined)
    })

    it('handles empty query', async () => {
        const request = new NextRequest('http://localhost/api/search')
        const response = await GET(request)
        assert.equal(response.status, 200)
    })
})
