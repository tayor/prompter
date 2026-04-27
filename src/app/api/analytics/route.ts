import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const analyticsQuerySchema = z.object({
    days: z.coerce.number().int().positive().default(30),
    limit: z.coerce.number().int().positive().default(10),
})

// GET /api/analytics - Get usage analytics
// Query params:
//   type: dashboard | top-prompts | top-workflows | activity | all (default: all)
//   days: number of days for activity (default: 30)
//   limit: number of items for top lists (default: 10)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'all'
        const parsedQuery = analyticsQuerySchema.safeParse({
            days: searchParams.get('days') ?? undefined,
            limit: searchParams.get('limit') ?? undefined,
        })

        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: 'Invalid analytics query parameters', details: parsedQuery.error.flatten() },
                { status: 400 }
            )
        }

        const { days, limit } = parsedQuery.data

        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        // Dashboard stats
        if (type === 'dashboard' || type === 'all') {
            const [
                totalPrompts,
                totalWorkflows,
                totalFolders,
                totalTags,
                archivedPrompts,
                archivedWorkflows,
                favoritePrompts,
                favoriteWorkflows,
                totalUsage,
                totalRuns,
                recentPrompts,
                recentWorkflows,
            ] = await Promise.all([
                prisma.prompt.count({ where: { isArchived: false } }),
                prisma.workflow.count({ where: { isArchived: false } }),
                prisma.folder.count(),
                prisma.tag.count(),
                prisma.prompt.count({ where: { isArchived: true } }),
                prisma.workflow.count({ where: { isArchived: true } }),
                prisma.prompt.count({ where: { isFavorite: true, isArchived: false } }),
                prisma.workflow.count({ where: { isFavorite: true, isArchived: false } }),
                prisma.prompt.aggregate({ _sum: { usageCount: true } }),
                prisma.workflow.aggregate({ _sum: { runCount: true } }),
                prisma.prompt.count({ where: { createdAt: { gte: startDate } } }),
                prisma.workflow.count({ where: { createdAt: { gte: startDate } } }),
            ])

            if (type === 'dashboard') {
                return NextResponse.json({
                    overview: {
                        totalPrompts,
                        totalWorkflows,
                        totalFolders,
                        totalTags,
                        archivedPrompts,
                        archivedWorkflows,
                        favoritePrompts,
                        favoriteWorkflows,
                        totalUsage: totalUsage._sum.usageCount || 0,
                        totalRuns: totalRuns._sum.runCount || 0,
                    },
                    recent: {
                        prompts: recentPrompts,
                        workflows: recentWorkflows,
                        period: `${days} days`,
                    },
                })
            }
        }

        // Top prompts
        if (type === 'top-prompts' || type === 'all') {
            const topPrompts = await prisma.prompt.findMany({
                where: { isArchived: false },
                orderBy: { usageCount: 'desc' },
                take: limit,
                select: {
                    id: true,
                    title: true,
                    usageCount: true,
                    lastUsedAt: true,
                    aiModel: true,
                    isFavorite: true,
                    folder: { select: { name: true } },
                },
            })

            if (type === 'top-prompts') {
                return NextResponse.json({ topPrompts })
            }
        }

        // Top workflows
        if (type === 'top-workflows' || type === 'all') {
            const topWorkflows = await prisma.workflow.findMany({
                where: { isArchived: false },
                orderBy: { runCount: 'desc' },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    runCount: true,
                    lastRunAt: true,
                    isFavorite: true,
                    _count: { select: { steps: true } },
                    folder: { select: { name: true } },
                },
            })

            if (type === 'top-workflows') {
                return NextResponse.json({
                    topWorkflows: topWorkflows.map((w) => ({
                        id: w.id,
                        name: w.name,
                        runCount: w.runCount,
                        lastRunAt: w.lastRunAt,
                        isFavorite: w.isFavorite,
                        stepsCount: w._count.steps,
                        folder: w.folder?.name,
                    })),
                })
            }
        }

        // Activity timeline
        if (type === 'activity' || type === 'all') {
            const recentActivity = await prisma.analytics.findMany({
                where: { createdAt: { gte: startDate } },
                orderBy: { createdAt: 'desc' },
                take: limit * 5, // More items for activity
            })

            // Group activity by day
            const activityByDay: Record<string, { views: number; copies: number; runs: number; edits: number }> = {}
            for (const activity of recentActivity) {
                const day = activity.createdAt.toISOString().split('T')[0]
                if (!activityByDay[day]) {
                    activityByDay[day] = { views: 0, copies: 0, runs: 0, edits: 0 }
                }
                switch (activity.action) {
                    case 'view':
                        activityByDay[day].views++
                        break
                    case 'copy':
                        activityByDay[day].copies++
                        break
                    case 'run':
                        activityByDay[day].runs++
                        break
                    case 'edit':
                        activityByDay[day].edits++
                        break
                }
            }

            if (type === 'activity') {
                return NextResponse.json({
                    activity: recentActivity,
                    activityByDay,
                    period: `${days} days`,
                })
            }
        }

        // Full analytics (type === 'all')
        const [
            totalPrompts,
            totalWorkflows,
            totalFolders,
            totalTags,
            archivedPrompts,
            archivedWorkflows,
            favoritePrompts,
            favoriteWorkflows,
        ] = await Promise.all([
            prisma.prompt.count({ where: { isArchived: false } }),
            prisma.workflow.count({ where: { isArchived: false } }),
            prisma.folder.count(),
            prisma.tag.count(),
            prisma.prompt.count({ where: { isArchived: true } }),
            prisma.workflow.count({ where: { isArchived: true } }),
            prisma.prompt.count({ where: { isFavorite: true, isArchived: false } }),
            prisma.workflow.count({ where: { isFavorite: true, isArchived: false } }),
        ])

        const topPrompts = await prisma.prompt.findMany({
            where: { isArchived: false },
            orderBy: { usageCount: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                usageCount: true,
                lastUsedAt: true,
                aiModel: true,
            },
        })

        const topWorkflows = await prisma.workflow.findMany({
            where: { isArchived: false },
            orderBy: { runCount: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                runCount: true,
                _count: { select: { steps: true } },
            },
        })

        const recentActivity = await prisma.analytics.findMany({
            where: { createdAt: { gte: startDate } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        const modelUsage = await prisma.prompt.groupBy({
            by: ['aiModel'],
            where: { aiModel: { not: null }, isArchived: false },
            _count: { aiModel: true },
            _sum: { usageCount: true },
        })

        const categoryUsage = await prisma.prompt.groupBy({
            by: ['category'],
            where: { isArchived: false },
            _count: { category: true },
        })

        const tagUsage = await prisma.tag.findMany({
            select: {
                id: true,
                name: true,
                color: true,
                _count: { select: { prompts: true, workflows: true } },
            },
            orderBy: { prompts: { _count: 'desc' } },
            take: limit,
        })

        return NextResponse.json({
            overview: {
                totalPrompts,
                totalWorkflows,
                totalFolders,
                totalTags,
                archivedPrompts,
                archivedWorkflows,
                favoritePrompts,
                favoriteWorkflows,
            },
            topPrompts,
            topWorkflows: topWorkflows.map((w) => ({
                ...w,
                stepsCount: w._count.steps,
            })),
            recentActivity,
            modelUsage: modelUsage.map((m) => ({
                model: m.aiModel,
                count: m._count.aiModel,
                usageCount: m._sum.usageCount,
            })),
            categoryUsage: categoryUsage.map((c) => ({
                category: c.category,
                count: c._count.category,
            })),
            tagUsage: tagUsage.map((t) => ({
                ...t,
                promptCount: t._count.prompts,
                workflowCount: t._count.workflows,
            })),
        })
    } catch (error) {
        console.error('Failed to fetch analytics:', error)
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
}
