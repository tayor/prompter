'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, Play, Edit, Star, Trash2, Plus, Archive, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
    id: string
    entityType: 'prompt' | 'workflow'
    entityId: string
    action: string
    metadata?: string
    createdAt: string
    entity?: {
        title?: string
        name?: string
    }
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    copy: Copy,
    run: Play,
    create: Plus,
    update: Edit,
    favorite: Star,
    unfavorite: Star,
    delete: Trash2,
    archive: Archive,
    restore: RotateCcw,
}

const actionLabels: Record<string, string> = {
    copy: 'Copied',
    run: 'Ran',
    create: 'Created',
    update: 'Updated',
    favorite: 'Favorited',
    unfavorite: 'Unfavorited',
    delete: 'Deleted',
    archive: 'Archived',
    restore: 'Restored',
}

interface ActivityFeedProps {
    limit?: number
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)

    const fetchActivities = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/analytics/activity?limit=${limit}`)
            if (res.ok) {
                const data = await res.json()
                setActivities(data.activities || [])
            }
        } catch (error) {
            console.error('Failed to fetch activities:', error)
        } finally {
            setLoading(false)
        }
    }, [limit])

    useEffect(() => {
        fetchActivities()
    }, [fetchActivities])

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-4 w-3/4 mb-1" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )
    }

    if (activities.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-6">
                        No recent activity
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {activities.map((activity) => {
                    const Icon = actionIcons[activity.action] || Edit
                    const actionLabel = actionLabels[activity.action] || activity.action
                    const entityName = activity.entity?.title || activity.entity?.name || 'Unknown'
                    const href = `/${activity.entityType === 'prompt' ? 'prompts' : 'workflows'}/${activity.entityId}`

                    return (
                        <div key={activity.id} className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                    <span className="font-medium">{actionLabel}</span>{' '}
                                    <Link
                                        href={href}
                                        className="text-primary hover:underline truncate"
                                    >
                                        {entityName}
                                    </Link>
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className="text-xs capitalize">
                                        {activity.entityType}
                                    </Badge>
                                    <span>
                                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
