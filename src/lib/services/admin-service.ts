import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export async function listAdmins() {
    return prisma.admin.findMany({
        select: {
            id: true,
            username: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
    })
}

export async function upsertAdminCredentials(username: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12)
    const existing = await prisma.admin.findUnique({ where: { username } })

    if (existing) {
        const admin = await prisma.admin.update({
            where: { username },
            data: { passwordHash },
            select: {
                id: true,
                username: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        return {
            created: false,
            admin,
        }
    }

    const admin = await prisma.admin.create({
        data: {
            username,
            passwordHash,
        },
        select: {
            id: true,
            username: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    return {
        created: true,
        admin,
    }
}

export type DeleteAdminResult = 'deleted' | 'not_found' | 'last_admin'

export async function deleteAdminByUsername(username: string): Promise<DeleteAdminResult> {
    const admin = await prisma.admin.findUnique({ where: { username } })
    if (!admin) {
        return 'not_found'
    }

    const totalAdmins = await prisma.admin.count()
    if (totalAdmins <= 1) {
        return 'last_admin'
    }

    await prisma.admin.delete({ where: { username } })
    return 'deleted'
}
