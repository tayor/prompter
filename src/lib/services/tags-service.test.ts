import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    createTagIfNotExists,
    listTagsWithCounts,
    findTagWithRelations,
    updateTagIfNoDuplicate,
    deleteTag,
    mergeTags,
} from '@/lib/services/tags-service'

before(async () => {
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.tag.deleteMany({})
})

after(async () => {
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.tag.deleteMany({})
    await prisma.$disconnect()
})

describe('createTagIfNotExists', () => {
    it('creates a new tag', async () => {
        const result = await createTagIfNotExists({ name: 'test-tag', color: '#ff0000' })
        assert.equal(result.alreadyExists, false)
        assert.ok(result.tag)
        assert.equal(result.tag!.name, 'test-tag')
    })

    it('returns alreadyExists for duplicate name', async () => {
        const result = await createTagIfNotExists({ name: 'test-tag' })
        assert.equal(result.alreadyExists, true)
        assert.equal(result.tag, null)
    })
})

describe('listTagsWithCounts', () => {
    it('returns tags ordered by name with counts', async () => {
        const tags = await listTagsWithCounts()
        assert.ok(tags.length >= 1)
        assert.ok('_count' in tags[0])
    })
})

describe('findTagWithRelations', () => {
    it('returns tag with prompts and workflows', async () => {
        const tags = await listTagsWithCounts()
        const tag = await findTagWithRelations(tags[0].id)
        assert.ok(tag)
        assert.ok('prompts' in tag)
        assert.ok('workflows' in tag)
    })

    it('returns null for non-existent tag', async () => {
        const tag = await findTagWithRelations('nonexistent-id')
        assert.equal(tag, null)
    })
})

describe('updateTagIfNoDuplicate', () => {
    it('updates tag name successfully', async () => {
        const tags = await listTagsWithCounts()
        const result = await updateTagIfNoDuplicate(tags[0].id, { name: 'renamed-tag' })
        assert.equal(result.status, 'updated')
    })

    it('returns conflict when renaming to existing name', async () => {
        await createTagIfNotExists({ name: 'conflict-tag' })
        const tags = await listTagsWithCounts()
        const otherTag = tags.find(t => t.name !== 'conflict-tag')
        if (otherTag) {
            const result = await updateTagIfNoDuplicate(otherTag.id, { name: 'conflict-tag' })
            assert.equal(result.status, 'conflict')
        }
    })
})

describe('mergeTags', () => {
    it('merges source tags into target', async () => {
        const { tag: target } = await createTagIfNotExists({ name: 'merge-target' })
        const { tag: source } = await createTagIfNotExists({ name: 'merge-source' })
        assert.ok(target && source)

        const result = await mergeTags([source!.id], target!.id)
        assert.equal(result.status, 'merged')
    })

    it('returns target_not_found for missing target', async () => {
        const result = await mergeTags(['some-id'], 'nonexistent-target')
        assert.equal(result.status, 'target_not_found')
    })

    it('returns source_not_found for missing source', async () => {
        const tags = await listTagsWithCounts()
        const result = await mergeTags(['nonexistent-source'], tags[0].id)
        assert.equal(result.status, 'source_not_found')
    })
})

describe('deleteTag', () => {
    it('deletes a tag', async () => {
        const { tag } = await createTagIfNotExists({ name: 'tag-to-delete' })
        assert.ok(tag)
        await deleteTag(tag!.id)
        const found = await findTagWithRelations(tag!.id)
        assert.equal(found, null)
    })
})
