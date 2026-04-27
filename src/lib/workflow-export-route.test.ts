import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/workflows/[id]/export/route'
import { prisma } from '@/lib/prisma'

test('workflow export tolerates invalid stored JSON fields', async () => {
    const workflow = await prisma.workflow.create({
        data: {
            name: `Export Test ${Date.now()}`,
            inputSchema: '{invalid-json',
            steps: {
                create: [
                    {
                        name: 'Broken Step',
                        order: 0,
                        outputVariable: 'broken',
                        inputMapping: '{invalid-json',
                        condition: '{invalid-json',
                    },
                ],
            },
        },
    })

    try {
        const response = await GET(
            new NextRequest(`http://localhost/api/workflows/${workflow.id}/export`),
            { params: Promise.resolve({ id: workflow.id }) },
        )

        assert.equal(response.status, 200)
        const body = JSON.parse(await response.text()) as {
            inputSchema: unknown
            steps: Array<{
                inputMapping: unknown
                condition: unknown
            }>
        }

        assert.equal(body.inputSchema, null)
        assert.equal(body.steps[0]?.inputMapping, null)
        assert.equal(body.steps[0]?.condition, null)
    } finally {
        await prisma.workflow.delete({ where: { id: workflow.id } }).catch(() => undefined)
    }
})

test.after(async () => {
    await prisma.$disconnect()
})
