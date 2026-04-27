import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    createPromptWithVersion,
    listPrompts,
    getPromptDetails,
    updatePromptWithVersion,
    deletePromptById,
    incrementPromptUsage,
    restorePromptVersion,
    listPromptVersions,
    parsePromptListQuery,
    buildPromptWhere,
    getPromptListOrderBy,
} from '@/lib/services/prompts-service'

let promptId: string

before(async () => {
    // Clean up prompts leftover from previous test runs
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

describe('parsePromptListQuery', () => {
    it('returns defaults for empty search params', () => {
        const query = parsePromptListQuery(new URLSearchParams())
        assert.equal(query.page, 1)
        assert.equal(query.limit, 20)
        assert.equal(query.sort, 'updated')
        assert.equal(query.order, 'desc')
    })

    it('parses page and limit from search params', () => {
        const query = parsePromptListQuery(new URLSearchParams({ page: '3', limit: '10' }))
        assert.equal(query.page, 3)
        assert.equal(query.limit, 10)
    })
})

describe('buildPromptWhere', () => {
    it('returns empty where for no filters', () => {
        const where = buildPromptWhere({ page: 1, limit: 20, sort: 'updated', order: 'desc' })
        assert.equal(where.isArchived, false)
    })

    it('includes text search when q is provided', () => {
        const where = buildPromptWhere({ page: 1, limit: 20, sort: 'updated', order: 'desc', q: 'hello' })
        assert.ok(where.OR)
    })
})

describe('getPromptListOrderBy', () => {
    it('returns updatedAt desc by default', () => {
        const orderBy = getPromptListOrderBy('updated', 'desc')
        assert.deepEqual(orderBy, { updatedAt: 'desc' })
    })

    it('returns title asc', () => {
        const orderBy = getPromptListOrderBy('title', 'asc')
        assert.deepEqual(orderBy, { title: 'asc' })
    })
})

describe('createPromptWithVersion', () => {
    it('creates a prompt with a version 1 record', async () => {
        const result = await createPromptWithVersion({
            title: 'Test Prompt',
            content: 'Hello {{name}}',
            description: 'A test prompt',
            category: 'user',
        })
        promptId = result.id
        assert.ok(result.id)
        assert.equal(result.title, 'Test Prompt')
        assert.equal(result.content, 'Hello {{name}}')
    })
})

describe('listPrompts', () => {
    it('lists prompts with pagination', async () => {
        const result = await listPrompts({ page: 1, limit: 20, sort: 'updated', order: 'desc' })
        assert.ok(result.prompts.length >= 1)
        assert.ok(result.pagination)
        assert.equal(result.pagination.page, 1)
    })
})

describe('getPromptDetails', () => {
    it('returns prompt with tags, folder, and versions', async () => {
        const details = await getPromptDetails(promptId)
        assert.ok(details)
        assert.equal(details!.id, promptId)
        assert.ok(Array.isArray(details!.tags))
        assert.ok(Array.isArray(details!.versions))
    })

    it('returns null for non-existent prompt', async () => {
        const details = await getPromptDetails('nonexistent-id')
        assert.equal(details, null)
    })
})

describe('updatePromptWithVersion', () => {
    it('creates a new version when content changes', async () => {
        await updatePromptWithVersion(promptId, { content: 'Updated content' }, { changeNote: 'v2' })
        const versions = await listPromptVersions(promptId)
        assert.ok(versions.length >= 2)
    })

    it('does not create a new version for metadata-only changes', async () => {
        const versionsBefore = await listPromptVersions(promptId)
        await updatePromptWithVersion(promptId, { description: 'New desc' })
        const versionsAfter = await listPromptVersions(promptId)
        assert.equal(versionsAfter.length, versionsBefore.length)
    })
})

describe('incrementPromptUsage', () => {
    it('increments usage count', async () => {
        const before = await prisma.prompt.findUnique({ where: { id: promptId } })
        await incrementPromptUsage(promptId)
        const after = await prisma.prompt.findUnique({ where: { id: promptId } })
        assert.equal(after!.usageCount, before!.usageCount + 1)
    })
})

describe('restorePromptVersion', () => {
    it('restores content from a previous version', async () => {
        const versions = await listPromptVersions(promptId)
        const v1 = versions.find(v => v.version === 1)
        assert.ok(v1)
        await restorePromptVersion(promptId, v1!.id)
        const prompt = await prisma.prompt.findUnique({ where: { id: promptId } })
        assert.equal(prompt!.content, 'Hello {{name}}')
    })
})

describe('deletePromptById', () => {
    it('deletes prompt and returns true', async () => {
        const result = await deletePromptById(promptId)
        assert.equal(result, true)
    })

    it('returns false for non-existent prompt', async () => {
        const result = await deletePromptById('nonexistent-id')
        assert.equal(result, false)
    })
})
