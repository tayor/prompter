import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { z } from 'zod'
import type { createFolderSchema, updateFolderSchema } from '@/lib/validators'

export type CreateFolderInput = z.infer<typeof createFolderSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>

export type FolderWithCounts = Prisma.FolderGetPayload<{
    include: {
        _count: {
            select: {
                prompts: true
                workflows: true
                children: true
            }
        }
    }
}>

export interface FolderTreeNode extends FolderWithCounts {
    children: FolderTreeNode[]
}

export type MoveFolderResult =
    | { status: 'folder_not_found' }
    | { status: 'parent_not_found' }
    | { status: 'circular_reference' }
    | {
        status: 'moved'
        folder: Prisma.FolderGetPayload<{
            include: {
                parent: true
                children: true
            }
        }>
    }

export async function listFoldersWithTree() {
    const folders = await prisma.folder.findMany({
        include: {
            _count: {
                select: {
                    prompts: true,
                    workflows: true,
                    children: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    })

    const folderMap = new Map<string, FolderTreeNode>(folders.map((folder) => ([
        folder.id,
        {
            ...folder,
            children: [],
        },
    ])))

    const rootFolders: FolderTreeNode[] = []

    folders.forEach((folder) => {
        const folderNode = folderMap.get(folder.id)
        if (!folderNode) {
            return
        }

        if (folder.parentId) {
            const parent = folderMap.get(folder.parentId)
            if (parent) {
                parent.children.push(folderNode)
            } else {
                rootFolders.push(folderNode)
            }
        } else {
            rootFolders.push(folderNode)
        }
    })

    return {
        folders: rootFolders,
        flat: folders,
    }
}

export async function createFolder(data: CreateFolderInput) {
    return prisma.folder.create({
        data,
        include: {
            _count: {
                select: { prompts: true, workflows: true, children: true },
            },
        },
    })
}

export async function findFolderById(id: string) {
    return prisma.folder.findUnique({
        where: { id },
        include: {
            parent: true,
            children: true,
            prompts: { take: 10, orderBy: { updatedAt: 'desc' } },
            workflows: { take: 10, orderBy: { updatedAt: 'desc' } },
            _count: {
                select: { prompts: true, workflows: true, children: true },
            },
        },
    })
}

export async function updateFolder(id: string, data: UpdateFolderInput) {
    return prisma.folder.update({
        where: { id },
        data,
        include: {
            _count: {
                select: { prompts: true, workflows: true, children: true },
            },
        },
    })
}

export async function moveFolder(id: string, parentId: string | null): Promise<MoveFolderResult> {
    const folder = await prisma.folder.findUnique({ where: { id } })
    if (!folder) {
        return { status: 'folder_not_found' }
    }

    if (parentId === id) {
        return { status: 'circular_reference' }
    }

    if (parentId) {
        const parent = await prisma.folder.findUnique({ where: { id: parentId } })
        if (!parent) {
            return { status: 'parent_not_found' }
        }

        const isDescendant = await checkIsDescendant(id, parentId)
        if (isDescendant) {
            return { status: 'circular_reference' }
        }
    }

    const updated = await prisma.folder.update({
        where: { id },
        data: { parentId },
        include: {
            parent: true,
            children: true,
        },
    })

    return {
        status: 'moved',
        folder: updated,
    }
}

export async function deleteFolderAndReassign(id: string): Promise<boolean> {
    const folder = await prisma.folder.findUnique({ where: { id } })
    if (!folder) {
        return false
    }

    await prisma.folder.updateMany({
        where: { parentId: id },
        data: { parentId: folder.parentId },
    })

    await prisma.prompt.updateMany({
        where: { folderId: id },
        data: { folderId: folder.parentId },
    })

    await prisma.workflow.updateMany({
        where: { folderId: id },
        data: { folderId: folder.parentId },
    })

    await prisma.folder.delete({ where: { id } })
    return true
}

async function checkIsDescendant(folderId: string, targetId: string): Promise<boolean> {
    const folder = await prisma.folder.findUnique({
        where: { id: targetId },
        select: { parentId: true },
    })

    if (!folder) {
        return false
    }

    if (folder.parentId === folderId) {
        return true
    }

    if (folder.parentId) {
        return checkIsDescendant(folderId, folder.parentId)
    }

    return false
}
