import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const activityQuerySchema = z.object({
    limit: z.coerce.number().int().positive().default(10),
})

// GET /api/analytics/activity - Get recent activity feed
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const parsedQuery = activityQuerySchema.safeParse({
            limit: searchParams.get('limit') ?? undefined,
        })

        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: 'Invalid activity query parameters', details: parsedQuery.error.flatten() },
                { status: 400 }
            )
        }

        const limit = Math.min(parsedQuery.data.limit, 50)

        const activities = await prisma.analytics.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                entityType: true,
                entityId: true,
                action: true,
                metadata: true,
                createdAt: true,
            },
        })

        // Fetch entity details for each activity
        const activitiesWithEntities = await Promise.all(
            activities.map(async (activity) => {
                let entity = null
                try {
                    if (activity.entityType === 'prompt') {
                        entity = await prisma.prompt.findUnique({
                            where: { id: activity.entityId },
                            select: { title: true },
                        })
                    } else if (activity.entityType === 'workflow') {
                        entity = await prisma.workflow.findUnique({
                            where: { id: activity.entityId },
                            select: { name: true },
                        })
                    }
                } catch {
                    // Entity may have been deleted
                }
                return { ...activity, entity }
            })
        )

        return NextResponse.json({ activities: activitiesWithEntities })
    } catch (error) {
        console.error('Failed to fetch activities:', error)
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
    }
}
