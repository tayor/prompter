import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    trackAnalyticsAction,
    groupActivityByDay,
    listAnalyticsActivity,
    getAnalyticsReport,
    getAnalyticsTrends,
} from '@/lib/services/analytics-service'

before(async () => {
    await prisma.analytics.deleteMany({})
})

after(async () => {
    await prisma.analytics.deleteMany({})
    await prisma.$disconnect()
})

describe('trackAnalyticsAction', () => {
    it('creates an analytics record', async () => {
        await trackAnalyticsAction('prompt', 'p1', 'view', { source: 'test' })
        const records = await prisma.analytics.findMany({ where: { entityId: 'p1' } })
        assert.equal(records.length, 1)
        assert.equal(records[0].action, 'view')
    })
})

describe('groupActivityByDay', () => {
    it('groups activity by day and action', () => {
        const now = new Date()
        const activity = [
            { createdAt: now, action: 'view' },
            { createdAt: now, action: 'view' },
            { createdAt: now, action: 'copy' },
            { createdAt: now, action: 'run' },
            { createdAt: now, action: 'edit' },
        ]
        const buckets = groupActivityByDay(activity)
        const todayKey = now.toISOString().split('T')[0]
        assert.ok(buckets[todayKey])
        assert.equal(buckets[todayKey].views, 2)
        assert.equal(buckets[todayKey].copies, 1)
        assert.equal(buckets[todayKey].runs, 1)
        assert.equal(buckets[todayKey].edits, 1)
    })

    it('handles empty activity array', () => {
        const buckets = groupActivityByDay([])
        assert.deepEqual(buckets, {})
    })
})

describe('listAnalyticsActivity', () => {
    it('returns recent activity', async () => {
        const result = await listAnalyticsActivity(10)
        assert.ok(result.activities)
        assert.ok(Array.isArray(result.activities))
    })
})

describe('getAnalyticsTrends', () => {
    it('returns trends data', async () => {
        const trends = await getAnalyticsTrends()
        assert.ok(trends)
        assert.ok(trends.dailyTrend)
    })
})

describe('getAnalyticsReport', () => {
    it('returns dashboard report', async () => {
        const report = await getAnalyticsReport({ type: 'dashboard', days: 30, limit: 10 })
        assert.ok(report)
        assert.ok(report.overview)
    })

    it('returns all report', async () => {
        const report = await getAnalyticsReport({ type: 'all', days: 30, limit: 10 })
        assert.ok(report)
    })
})
