'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TagBadge } from '@/components/shared/TagBadge'
import { ModelBadge } from '@/components/shared/ModelBadge'
import {
    FileText,
    Workflow,
    Folder,
    Tag,
    TrendingUp,
    Download,
    BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface AnalyticsData {
    overview: {
        totalPrompts: number
        totalWorkflows: number
        totalFolders: number
        totalTags: number
        archivedPrompts: number
        archivedWorkflows: number
        favoritePrompts: number
        favoriteWorkflows: number
    }
    topPrompts: Array<{
        id: string
        title: string
        usageCount: number
        lastUsedAt: string | null
        aiModel: string | null
    }>
    topWorkflows: Array<{
        id: string
        name: string
        runCount: number
        stepsCount: number
    }>
    modelUsage: Array<{
        model: string
        count: number
        usageCount: number
    }>
    categoryUsage: Array<{
        category: string
        count: number
    }>
    tagUsage: Array<{
        id: string
        name: string
        color: string | null
        promptCount: number
        workflowCount: number
    }>
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/analytics')
            const result = await res.json()
            setData(result)
        } catch {
            toast.error('Failed to load analytics')
        } finally {
            setLoading(false)
        }
    }

    const handleExport = async () => {
        try {
            window.location.href = '/api/export'
            toast.success('Export started')
        } catch {
            toast.error('Export failed')
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Analytics" />
                <div className="flex-1 p-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="pt-6">
                                    <Skeleton className="h-8 w-20 mb-2" />
                                    <Skeleton className="h-4 w-24" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Analytics" />
            <div className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                    </Button>
                </div>

                {/* Overview Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Prompts"
                        value={data?.overview.totalPrompts ?? 0}
                        icon={FileText}
                        subtext={`${data?.overview.favoritePrompts ?? 0} favorites, ${data?.overview.archivedPrompts ?? 0} archived`}
                    />
                    <StatCard
                        title="Total Workflows"
                        value={data?.overview.totalWorkflows ?? 0}
                        icon={Workflow}
                        subtext={`${data?.overview.favoriteWorkflows ?? 0} favorites`}
                    />
                    <StatCard
                        title="Folders"
                        value={data?.overview.totalFolders ?? 0}
                        icon={Folder}
                        subtext="For organization"
                    />
                    <StatCard
                        title="Tags"
                        value={data?.overview.totalTags ?? 0}
                        icon={Tag}
                        subtext="For categorization"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Top Prompts */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Most Used Prompts
                            </CardTitle>
                            <CardDescription>Top prompts by usage count</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data?.topPrompts.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No usage data yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {data?.topPrompts.map((prompt, i) => (
                                        <Link
                                            key={prompt.id}
                                            href={`/prompts/${prompt.id}`}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-muted-foreground w-6">
                                                    {i + 1}.
                                                </span>
                                                <div>
                                                    <p className="font-medium">{prompt.title}</p>
                                                    {prompt.aiModel && <ModelBadge model={prompt.aiModel} />}
                                                </div>
                                            </div>
                                            <Badge variant="secondary">{prompt.usageCount} uses</Badge>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Workflows */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Most Run Workflows
                            </CardTitle>
                            <CardDescription>Top workflows by run count</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data?.topWorkflows.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No run data yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {data?.topWorkflows.map((workflow, i) => (
                                        <Link
                                            key={workflow.id}
                                            href={`/workflows/${workflow.id}`}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-muted-foreground w-6">
                                                    {i + 1}.
                                                </span>
                                                <div>
                                                    <p className="font-medium">{workflow.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {workflow.stepsCount} steps
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary">{workflow.runCount} runs</Badge>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Breakdowns Row */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Model Usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle>By AI Model</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data?.modelUsage.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No data</p>
                            ) : (
                                <div className="space-y-2">
                                    {data?.modelUsage.map((m) => (
                                        <div key={m.model} className="flex items-center justify-between">
                                            <ModelBadge model={m.model} />
                                            <span className="text-sm text-muted-foreground">{m.count} prompts</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Category Usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle>By Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data?.categoryUsage.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No data</p>
                            ) : (
                                <div className="space-y-2">
                                    {data?.categoryUsage.map((c) => (
                                        <div key={c.category} className="flex items-center justify-between">
                                            <Badge variant="outline" className="capitalize">
                                                {c.category}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">{c.count} prompts</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tag Usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Popular Tags</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data?.tagUsage.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">No tags</p>
                            ) : (
                                <div className="space-y-2">
                                    {data?.tagUsage.slice(0, 8).map((t) => (
                                        <div key={t.id} className="flex items-center justify-between">
                                            <TagBadge name={t.name} color={t.color} />
                                            <span className="text-sm text-muted-foreground">
                                                {t.promptCount + t.workflowCount} items
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function StatCard({
    title,
    value,
    icon: Icon,
    subtext,
}: {
    title: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    subtext: string
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{subtext}</p>
            </CardContent>
        </Card>
    )
}
