import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    listWorkflowTemplates,
    createWorkflowFromTemplate,
} from '@/lib/services/templates-service'

after(async () => {
    // Clean up templates and copies
    await prisma.workflowStep.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.workflowStepRun.deleteMany({})
    await prisma.workflowRun.deleteMany({})
    await prisma.workflowVersion.deleteMany({})
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Template' } } })
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Copy' } } })
    await prisma.$disconnect()
})

describe('listWorkflowTemplates', () => {
    it('returns only template workflows', async () => {
        // Create a template
        await prisma.workflow.create({
            data: {
                name: 'Test Template',
                isTemplate: true,
            },
        })
        // Create a non-template
        await prisma.workflow.create({
            data: {
                name: 'Not A Template',
                isTemplate: false,
            },
        })

        const templates = await listWorkflowTemplates()
        assert.ok(templates.every(t => t.isTemplate === true))
    })
})

describe('createWorkflowFromTemplate', () => {
    it('creates workflow from template with steps', async () => {
        const template = await prisma.workflow.create({
            data: {
                name: 'Template With Steps',
                description: 'A template',
                isTemplate: true,
                steps: {
                    create: [
                        { name: 'Step A', order: 0, outputVariable: 'a' },
                        { name: 'Step B', order: 1, outputVariable: 'b' },
                    ],
                },
            },
        })

        const result = await createWorkflowFromTemplate(template.id, 'My Copy')
        assert.ok(result)
        assert.equal(result!.name, 'My Copy')
        assert.equal(result!.isTemplate, false)
        assert.ok(result!.steps.length >= 2)
    })

    it('returns null for non-existent template', async () => {
        const result = await createWorkflowFromTemplate('nonexistent')
        assert.equal(result, null)
    })

    it('uses default name when none provided', async () => {
        const template = await prisma.workflow.create({
            data: {
                name: 'Default Name Template',
                isTemplate: true,
            },
        })

        const result = await createWorkflowFromTemplate(template.id)
        assert.ok(result)
        assert.ok(result!.name.includes('(Copy)'))
    })
})
