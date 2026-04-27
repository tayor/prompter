import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    buildPrompterExportData,
    importPrompterData,
    type ExportOptions,
} from '@/lib/services/import-export-service'

before(async () => {
    await prisma.tag.create({ data: { name: 'export-tag-1' } }).catch(() => { })
    await prisma.folder.create({ data: { name: 'Export Folder' } }).catch(() => { })
})

after(async () => {
    await prisma.promptVersion.deleteMany({})
    await prisma.tagsOnPrompts.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.prompt.deleteMany({ where: { title: { contains: 'Imported' } } })
    await prisma.workflow.deleteMany({ where: { name: { contains: 'Imported' } } })
    await prisma.tag.deleteMany({ where: { name: { contains: 'export-tag' } } })
    await prisma.tag.deleteMany({ where: { name: { contains: 'import-tag' } } })
    await prisma.folder.deleteMany({ where: { name: { contains: 'Export' } } })
    await prisma.folder.deleteMany({ where: { name: { contains: 'Import' } } })
    await prisma.$disconnect()
})

describe('buildPrompterExportData', () => {
    it('returns export data with all sections', async () => {
        const options: ExportOptions = {
            includePrompts: true,
            includeWorkflows: true,
            includeFolders: true,
            includeTags: true,
        }
        const data = await buildPrompterExportData(options)
        assert.ok(data)
        assert.ok('prompts' in data)
        assert.ok('workflows' in data)
        assert.ok('folders' in data)
        assert.ok('tags' in data)
        assert.ok('exportedAt' in data)
    })

    it('excludes sections when disabled', async () => {
        const options: ExportOptions = {
            includePrompts: false,
            includeWorkflows: false,
            includeFolders: true,
            includeTags: true,
        }
        const data = await buildPrompterExportData(options)
        assert.equal(data.prompts, undefined)
        assert.equal(data.workflows, undefined)
    })
})

describe('importPrompterData', () => {
    it('imports prompts successfully', async () => {
        const result = await importPrompterData({
            prompts: [
                { title: 'Imported Prompt 1', content: 'Content 1' },
                { title: 'Imported Prompt 2', content: 'Content 2' },
            ],
        })
        assert.equal(result.results.prompts.created, 2)
        assert.equal(result.results.prompts.failed, 0)
    })

    it('imports tags and folders with ids', async () => {
        const result = await importPrompterData({
            tags: [{ id: 'tag-import-1', name: 'import-tag-1' }],
            folders: [{ id: 'folder-import-1', name: 'Import Folder' }],
        })
        assert.equal(result.results.tags.created, 1)
        assert.equal(result.results.folders.created, 1)
    })

    it('handles empty import gracefully', async () => {
        const result = await importPrompterData({})
        assert.equal(result.results.prompts.created, 0)
        assert.equal(result.results.workflows.created, 0)
        assert.equal(result.results.folders.created, 0)
        assert.equal(result.results.tags.created, 0)
    })
})
