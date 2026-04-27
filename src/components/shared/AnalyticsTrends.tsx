'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, BarChart3, Activity, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface TrendData {
    dailyTrend: Array<{ date: string; count: number }>
    actionBreakdown: Array<{ action: string; count: number }>
    topPrompts: Array<{ id: string; title: string; count: number }>
    summary: {
        thisWeek: number
        lastWeek: number
        changePercent: number
    }
}

export function AnalyticsTrends() {
    const [data, setData] = useState<TrendData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchTrends = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/analytics/trends')
            const result = await res.json()
            setData(result)
        } catch (error) {
            console.error('Failed to fetch trends:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTrends()
    }, [])

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        )
    }

    if (!data) {
        return null
    }

    const maxCount = Math.max(...data.dailyTrend.map((d) => d.count), 1)
    const isPositive = data.summary.changePercent >= 0

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Usage Trends
                    </CardTitle>
                    <CardDescription>Last 30 days activity</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchTrends}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Weekly Summary */}
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-2xl font-bold">{data.summary.thisWeek}</div>
                        <div className="text-sm text-muted-foreground">Actions this week</div>
                    </div>
                    <Badge
                        variant="secondary"
                        className={isPositive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}
                    >
                        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {isPositive ? '+' : ''}{data.summary.changePercent}%
                    </Badge>
                </div>

                {/* Activity Chart (Simple bar visualization) */}
                <div className="space-y-2">
                    <div className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Daily Activity
                    </div>
                    <div className="flex items-end gap-0.5 h-16">
                        {data.dailyTrend.slice(-14).map((day, idx) => (
                            <div
                                key={idx}
                                className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                                style={{
                                    height: `${Math.max((day.count / maxCount) * 100, 4)}%`,
                                }}
                                title={`${day.date}: ${day.count} actions`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>14 days ago</span>
                        <span>Today</span>
                    </div>
                </div>

                {/* Action Breakdown */}
                {data.actionBreakdown.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Actions</div>
                        <div className="flex flex-wrap gap-2">
                            {data.actionBreakdown.map((action) => (
                                <Badge key={action.action} variant="outline">
                                    {action.action}: {action.count}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Prompts */}
                {data.topPrompts.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Most Used Prompts</div>
                        <div className="space-y-1">
                            {data.topPrompts.slice(0, 3).map((prompt) => (
                                <Link
                                    key={prompt.id}
                                    href={`/prompts/${prompt.id}`}
                                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm"
                                >
                                    <span className="truncate">{prompt.title}</span>
                                    <Badge variant="secondary">{prompt.count}</Badge>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
