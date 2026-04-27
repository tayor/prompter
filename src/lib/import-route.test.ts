import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '@/app/api/import/route'
import { prisma } from '@/lib/prisma'

function createImportRequest(payload: unknown) {
    return new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    })
}

test('import route rejects invalid payloads with 400', async () => {
    const response = await POST(
        createImportRequest({
            prompts: [{ title: 'Missing content field' }],
        })
    )

    assert.equal(response.status, 400)
    const body = (await response.json()) as { error?: string }
    assert.equal(body.error, 'Invalid import payload')
})

test('import route accepts empty payload and reports zero operations', async () => {
    const response = await POST(createImportRequest({}))
    assert.equal(response.status, 200)

    const body = (await response.json()) as {
        success: boolean
        results: {
            prompts: { created: number; failed: number; errors: unknown[] }
            workflows: { created: number; failed: number; errors: unknown[] }
            folders: { created: number; failed: number; errors: unknown[] }
            tags: { created: number; failed: number; errors: unknown[] }
        }
    }

    assert.equal(body.success, true)
    assert.equal(body.results.prompts.created, 0)
    assert.equal(body.results.prompts.failed, 0)
    assert.equal(body.results.workflows.created, 0)
    assert.equal(body.results.workflows.failed, 0)
    assert.equal(body.results.folders.created, 0)
    assert.equal(body.results.folders.failed, 0)
    assert.equal(body.results.tags.created, 0)
    assert.equal(body.results.tags.failed, 0)
    assert.deepEqual(body.results.prompts.errors, [])
    assert.deepEqual(body.results.workflows.errors, [])
    assert.deepEqual(body.results.folders.errors, [])
    assert.deepEqual(body.results.tags.errors, [])
})

test.after(async () => {
    await prisma.$disconnect()
})
