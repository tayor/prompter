import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '@/app/api/workflows/[id]/duplicate/route'
import { prisma } from '@/lib/prisma'

test('workflow duplicate preserves branching links with remapped step ids', async () => {
    const workflow = await prisma.workflow.create({
        data: { name: `Duplicate Test ${Date.now()}` },
    })

    const firstStep = await prisma.workflowStep.create({
        data: {
            workflowId: workflow.id,
            name: 'Step One',
            order: 0,
            outputVariable: 'stepOne',
        },
    })

    const secondStep = await prisma.workflowStep.create({
        data: {
            workflowId: workflow.id,
            name: 'Step Two',
            order: 1,
            outputVariable: 'stepTwo',
        },
    })

    await prisma.workflowStep.update({
        where: { id: firstStep.id },
        data: { nextStepOnSuccess: secondStep.id },
    })

    try {
        const response = await POST(
            new Request('http://localhost/api/workflows/duplicate', { method: 'POST' }) as never,
            {
                params: Promise.resolve({ id: workflow.id }),
            },
        )

        assert.equal(response.status, 201)
        const body = await response.json() as {
            steps: Array<{
                id: string
                name: string
                nextStepOnSuccess: string | null
            }>
        }

        const duplicatedFirstStep = body.steps.find((step) => step.name === 'Step One')
        const duplicatedSecondStep = body.steps.find((step) => step.name === 'Step Two')

        assert.ok(duplicatedFirstStep)
        assert.ok(duplicatedSecondStep)
        assert.notEqual(duplicatedFirstStep!.id, firstStep.id)
        assert.notEqual(duplicatedSecondStep!.id, secondStep.id)
        assert.equal(duplicatedFirstStep!.nextStepOnSuccess, duplicatedSecondStep!.id)
    } finally {
        await prisma.workflow.deleteMany({
            where: {
                OR: [
                    { id: workflow.id },
                    { name: `${workflow.name} (Copy)` },
                ],
            },
        }).catch(() => undefined)
    }
})

test.after(async () => {
    await prisma.$disconnect()
})
