import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    createFolder,
    listFoldersWithTree,
    findFolderById,
    updateFolder,
    moveFolder,
    deleteFolderAndReassign,
} from '@/lib/services/folders-service'

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

let rootFolderId: string
let childFolderId: string

describe('createFolder', () => {
    it('creates a root folder', async () => {
        const folder = await createFolder({ name: 'Root Folder' })
        rootFolderId = folder.id
        assert.ok(folder.id)
        assert.equal(folder.name, 'Root Folder')
        assert.equal(folder.parentId, null)
    })

    it('creates a child folder', async () => {
        const child = await createFolder({ name: 'Child Folder', parentId: rootFolderId })
        childFolderId = child.id
        assert.equal(child.parentId, rootFolderId)
    })
})

describe('listFoldersWithTree', () => {
    it('returns tree structure with root and nested children', async () => {
        const result = await listFoldersWithTree()
        assert.ok(result.folders.length >= 1)
        assert.ok(result.flat.length >= 2)

        const root = result.folders.find(f => f.id === rootFolderId)
        assert.ok(root)
        assert.ok(root!.children.length >= 1)
    })
})

describe('findFolderById', () => {
    it('returns folder with relations', async () => {
        const folder = await findFolderById(rootFolderId)
        assert.ok(folder)
        assert.ok('children' in folder!)
        assert.ok('prompts' in folder!)
    })

    it('returns null for non-existent folder', async () => {
        const folder = await findFolderById('nonexistent')
        assert.equal(folder, null)
    })
})

describe('updateFolder', () => {
    it('updates folder name', async () => {
        const updated = await updateFolder(rootFolderId, { name: 'Updated Root' })
        assert.equal(updated.name, 'Updated Root')
    })
})

describe('moveFolder', () => {
    it('rejects circular reference (self)', async () => {
        const result = await moveFolder(rootFolderId, rootFolderId)
        assert.equal(result.status, 'circular_reference')
    })

    it('rejects non-existent folder', async () => {
        const result = await moveFolder('nonexistent', null)
        assert.equal(result.status, 'folder_not_found')
    })

    it('rejects non-existent parent', async () => {
        const result = await moveFolder(rootFolderId, 'nonexistent-parent')
        assert.equal(result.status, 'parent_not_found')
    })

    it('moves folder to root (null parent)', async () => {
        const result = await moveFolder(childFolderId, null)
        assert.equal(result.status, 'moved')
    })
})

describe('deleteFolderAndReassign', () => {
    it('deletes folder and re-parents children', async () => {
        const parent = await createFolder({ name: 'Delete Parent' })
        const child = await createFolder({ name: 'Delete Child', parentId: parent.id })

        const result = await deleteFolderAndReassign(parent.id)
        assert.equal(result, true)

        const reassigned = await prisma.folder.findUnique({ where: { id: child.id } })
        assert.ok(reassigned)
        assert.equal(reassigned!.parentId, null)

        // Cleanup
        await prisma.folder.delete({ where: { id: child.id } })
    })

    it('returns false for non-existent folder', async () => {
        const result = await deleteFolderAndReassign('nonexistent')
        assert.equal(result, false)
    })
})
