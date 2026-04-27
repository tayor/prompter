import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/analytics/trends - Get time-based usage trends
export async function GET() {
    try {
        const now = new Date()
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // Get daily activity counts for last 30 days
        const dailyActivity = await prisma.analytics.groupBy({
            by: ['createdAt'],
            where: {
                createdAt: { gte: last30Days },
            },
            _count: true,
        })

        // Aggregate by date
        const dailyMap = new Map<string, number>()
        dailyActivity.forEach((entry) => {
            const dateStr = entry.createdAt.toISOString().split('T')[0]
            dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + entry._count)
        })

        // Generate all dates in range
        const dailyTrend: Array<{ date: string; count: number }> = []
        for (let d = new Date(last30Days); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0]
            dailyTrend.push({
                date: dateStr,
                count: dailyMap.get(dateStr) || 0,
            })
        }

        // Get action breakdown
        const actionBreakdown = await prisma.analytics.groupBy({
            by: ['action'],
            where: {
                createdAt: { gte: last30Days },
            },
            _count: true,
        })

        // Get top prompts by usage (last 30 days)
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

        // Enrich top prompts with titles
        const promptIds = topPrompts.map((p) => p.entityId)
        const prompts = await prisma.prompt.findMany({
            where: { id: { in: promptIds } },
            select: { id: true, title: true },
        })
        const promptMap = new Map(prompts.map((p) => [p.id, p.title]))

        const topPromptsEnriched = topPrompts.map((p) => ({
            id: p.entityId,
            title: promptMap.get(p.entityId) || 'Unknown',
            count: p._count,
        }))

        // Get weekly summary
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
            : thisWeekCount > 0 ? 100 : 0

        return NextResponse.json({
            dailyTrend,
            actionBreakdown: actionBreakdown.map((a) => ({
                action: a.action,
                count: a._count,
            })),
            topPrompts: topPromptsEnriched,
            summary: {
                thisWeek: thisWeekCount,
                lastWeek: lastWeekCount,
                changePercent: weeklyChange,
            },
        })
    } catch (error) {
        console.error('Analytics trends failed:', error)
        return NextResponse.json({ error: 'Failed to get trends' }, { status: 500 })
    }
}
