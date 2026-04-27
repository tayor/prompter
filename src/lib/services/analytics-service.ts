import prisma from '@/lib/prisma'

export interface ActivityByDayBucket {
    views: number
    copies: number
    runs: number
    edits: number
}

export interface AnalyticsReportOptions {
    type: 'dashboard' | 'top-prompts' | 'top-workflows' | 'activity' | 'all'
    days: number
    limit: number
}

export function groupActivityByDay(activity: Array<{ createdAt: Date; action: string }>) {
    const activityByDay: Record<string, ActivityByDayBucket> = {}

    for (const item of activity) {
        const day = item.createdAt.toISOString().split('T')[0]
        if (!activityByDay[day]) {
            activityByDay[day] = { views: 0, copies: 0, runs: 0, edits: 0 }
        }

        switch (item.action) {
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

    return activityByDay
}

export async function trackAnalyticsAction(
    entityType: string,
    entityId: string,
    action: string,
    metadata?: Record<string, unknown>,
) {
    return prisma.analytics.create({
        data: {
            entityType,
            entityId,
            action,
            metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
    })
}

export async function listAnalyticsActivity(limit = 10) {
    const take = Math.min(Math.max(limit, 1), 50)

    const activities = await prisma.analytics.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
            id: true,
            entityType: true,
            entityId: true,
            action: true,
            metadata: true,
            createdAt: true,
        },
    })

    const activitiesWithEntities = await Promise.all(
        activities.map(async (activity) => {
            let entity: { title?: string; name?: string } | null = null
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
                entity = null
            }

            return {
                ...activity,
                entity,
            }
        }),
    )

    return { activities: activitiesWithEntities }
}

export async function getAnalyticsTrends() {
    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const dailyActivity = await prisma.analytics.groupBy({
        by: ['createdAt'],
        where: {
            createdAt: { gte: last30Days },
        },
        _count: true,
    })

    const dailyMap = new Map<string, number>()
    dailyActivity.forEach((entry) => {
        const dateStr = entry.createdAt.toISOString().split('T')[0]
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + entry._count)
    })

    const dailyTrend: Array<{ date: string; count: number }> = []
    for (let date = new Date(last30Days); date <= now; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0]
        dailyTrend.push({
            date: dateStr,
            count: dailyMap.get(dateStr) || 0,
        })
    }

    const actionBreakdown = await prisma.analytics.groupBy({
        by: ['action'],
        where: {
            createdAt: { gte: last30Days },
        },
        _count: true,
    })

    const topPrompts = await prisma.analytics.groupBy({
        by: ['entityId'],
        where: {
            entityType: 'prompt',
            createdAt: { gte: last30Days },
        },
        _count: true,
        orderBy: {
            _count: {
                entityId: 'desc',
            },
        },
        take: 5,
    })

    const promptIds = topPrompts.map((prompt) => prompt.entityId)
    const prompts = await prisma.prompt.findMany({
        where: { id: { in: promptIds } },
        select: { id: true, title: true },
    })
    const promptMap = new Map(prompts.map((prompt) => [prompt.id, prompt.title]))

    const topPromptsEnriched = topPrompts.map((prompt) => ({
        id: prompt.entityId,
        title: promptMap.get(prompt.entityId) || 'Unknown',
        count: prompt._count,
    }))

    const thisWeekCount = await prisma.analytics.count({
        where: { createdAt: { gte: last7Days } },
    })

    const lastWeekStart = new Date(last7Days.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekCount = await prisma.analytics.count({
        where: {
            createdAt: {
                gte: lastWeekStart,
                lt: last7Days,
            },
        },
    })

    const weeklyChange = lastWeekCount > 0
        ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
        : thisWeekCount > 0
            ? 100
            : 0

    return {
        dailyTrend,
        actionBreakdown: actionBreakdown.map((entry) => ({
            action: entry.action,
            count: entry._count,
        })),
        topPrompts: topPromptsEnriched,
        summary: {
            thisWeek: thisWeekCount,
            lastWeek: lastWeekCount,
            changePercent: weeklyChange,
        },
    }
}

export async function getAnalyticsReport(options: AnalyticsReportOptions) {
    const days = Math.max(options.days, 1)
    const limit = Math.min(Math.max(options.limit, 1), 100)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    if (options.type === 'dashboard') {
        const overview = await getAnalyticsOverview(startDate)

        return {
            overview,
            recent: {
                prompts: overview.recentPrompts,
                workflows: overview.recentWorkflows,
                period: `${days} days`,
            },
        }
    }

    if (options.type === 'top-prompts') {
        return {
            topPrompts: await getTopPrompts(limit),
        }
    }

    if (options.type === 'top-workflows') {
        return {
            topWorkflows: await getTopWorkflows(limit),
        }
    }

    if (options.type === 'activity') {
        const recentActivity = await prisma.analytics.findMany({
            where: { createdAt: { gte: startDate } },
            orderBy: { createdAt: 'desc' },
            take: limit * 5,
        })

        return {
            activity: recentActivity,
            activityByDay: groupActivityByDay(recentActivity),
            period: `${days} days`,
        }
    }

    const [overview, topPrompts, topWorkflows, recentActivity, modelUsage, categoryUsage, tagUsage] = await Promise.all([
        getAnalyticsOverview(startDate),
        getTopPrompts(limit),
        getTopWorkflows(limit),
        prisma.analytics.findMany({
            where: { createdAt: { gte: startDate } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }),
        prisma.prompt.groupBy({
            by: ['aiModel'],
            where: { aiModel: { not: null }, isArchived: false },
            _count: { aiModel: true },
            _sum: { usageCount: true },
        }),
        prisma.prompt.groupBy({
            by: ['category'],
            where: { isArchived: false },
            _count: { category: true },
        }),
        prisma.tag.findMany({
            select: {
                id: true,
                name: true,
                color: true,
                _count: { select: { prompts: true, workflows: true } },
            },
            orderBy: { prompts: { _count: 'desc' } },
            take: limit,
        }),
    ])

    return {
        overview: {
            totalPrompts: overview.totalPrompts,
            totalWorkflows: overview.totalWorkflows,
            totalFolders: overview.totalFolders,
            totalTags: overview.totalTags,
            archivedPrompts: overview.archivedPrompts,
            archivedWorkflows: overview.archivedWorkflows,
            favoritePrompts: overview.favoritePrompts,
            favoriteWorkflows: overview.favoriteWorkflows,
            totalUsage: overview.totalUsage,
            totalRuns: overview.totalRuns,
        },
        topPrompts,
        topWorkflows,
        recentActivity,
        modelUsage: modelUsage.map((entry) => ({
            model: entry.aiModel,
            count: entry._count.aiModel,
            usageCount: entry._sum.usageCount,
        })),
        categoryUsage: categoryUsage.map((entry) => ({
            category: entry.category,
            count: entry._count.category,
        })),
        tagUsage: tagUsage.map((entry) => ({
            id: entry.id,
            name: entry.name,
            color: entry.color,
            promptCount: entry._count.prompts,
            workflowCount: entry._count.workflows,
        })),
    }
}

async function getTopPrompts(limit: number) {
    return prisma.prompt.findMany({
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
}

async function getTopWorkflows(limit: number) {
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

    return topWorkflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        runCount: workflow.runCount,
        lastRunAt: workflow.lastRunAt,
        isFavorite: workflow.isFavorite,
        stepsCount: workflow._count.steps,
        folder: workflow.folder?.name ?? null,
    }))
}

async function getAnalyticsOverview(startDate: Date) {
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

    return {
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
        recentPrompts,
        recentWorkflows,
    }
}
