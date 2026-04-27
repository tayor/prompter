import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/folders/route'

before(async () => {
    await prisma.prompt.updateMany({ data: { folderId: null } })
    await prisma.workflow.updateMany({ data: { folderId: null } })
    await prisma.folder.deleteMany({})
})

after(async () => {
    await prisma.prompt.updateMany({ data: { folderId: null } })
    await prisma.workflow.updateMany({ data: { folderId: null } })
    await prisma.folder.deleteMany({})
    await prisma.$disconnect()
})

describe('POST /api/folders', () => {
    it('creates a folder and returns 201', async () => {
        const response = await POST(
            new Request('http://localhost/api/folders', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Route Test Folder' }),
            })
        )
        assert.equal(response.status, 201)
        const body = await response.json()
        assert.equal(body.name, 'Route Test Folder')
    })

    it('returns 400 for invalid data', async () => {
        const response = await POST(
            new Request('http://localhost/api/folders', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: '' }),
            })
        )
        assert.equal(response.status, 400)
    })
})

describe('GET /api/folders', () => {
    it('returns folder tree', async () => {
        const response = await GET()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.folders)
        assert.ok(body.flat)
    })
})
