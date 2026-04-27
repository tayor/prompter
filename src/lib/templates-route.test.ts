import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/templates/route'

before(async () => {
    // Create a template for testing
    await prisma.workflow.create({
        data: {
            name: 'Route Template',
            isTemplate: true,
            steps: {
                create: [
                    { name: 'Step 1', order: 0, outputVariable: 'out1' },
                ],
            },
        },
    })
})

after(async () => {
    await prisma.workflowStep.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.workflowStepRun.deleteMany({})
    await prisma.workflowRun.deleteMany({})
    await prisma.workflowVersion.deleteMany({})
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Route Template' } } })
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Copy' } } })
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Custom Name' } } })
    await prisma.$disconnect()
})

describe('GET /api/templates', () => {
    it('returns templates list', async () => {
        const response = await GET()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.ok(body.templates)
        assert.ok(body.templates.length >= 1)
    })
})

describe('POST /api/templates', () => {
    it('creates workflow from template', async () => {
        const templates = await prisma.workflow.findMany({ where: { isTemplate: true } })
        const template = templates[0]
        assert.ok(template)

        const response = await POST(
            new Request('http://localhost/api/templates', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ templateId: template.id, name: 'Custom Name' }),
            })
        )
        assert.equal(response.status, 201)
        const body = await response.json()
        assert.equal(body.name, 'Custom Name')
    })

    it('returns 400 without templateId', async () => {
        const response = await POST(
            new Request('http://localhost/api/templates', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({}),
            })
        )
        assert.equal(response.status, 400)
    })

    it('returns 404 for non-existent template', async () => {
        const response = await POST(
            new Request('http://localhost/api/templates', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ templateId: 'nonexistent' }),
            })
        )
        assert.equal(response.status, 404)
    })
})
