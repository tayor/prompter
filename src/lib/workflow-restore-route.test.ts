import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '@/app/api/workflows/[id]/restore/[versionId]/route'
import { prisma } from '@/lib/prisma'

test('workflow restore rejects invalid snapshot JSON', async () => {
    const workflow = await prisma.workflow.create({
        data: { name: `Restore Test ${Date.now()}` },
    })

    const version = await prisma.workflowVersion.create({
        data: {
            workflowId: workflow.id,
            version: 1,
            snapshot: '{invalid-json',
            changeNote: 'Test invalid snapshot',
        },
    })

    try {
        const response = await POST(new Request('http://localhost/api/workflows/restore', { method: 'POST' }) as never, {
            params: Promise.resolve({
                id: workflow.id,
                versionId: version.id,
            }),
        })

        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: 'Invalid workflow snapshot' })
    } finally {
        await prisma.workflow.delete({ where: { id: workflow.id } }).catch(() => undefined)
    }
})

test.after(async () => {
    await prisma.$disconnect()
})
