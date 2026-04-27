'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TagBadge } from '@/components/shared/TagBadge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Plus,
    Search,
    Star,
    MoreVertical,
    Play,
    Edit,
    Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface Workflow {
    id: string
    name: string
    description: string | null
    icon: string | null
    color: string | null
    isTemplate: boolean
    isFavorite: boolean
    runCount: number
    updatedAt: string
    folder: { name: string; color: string | null } | null
    tags: Array<{ tag: { id: string; name: string; color: string | null } }>
    _count: { steps: number; runs: number }
}

interface WorkflowsResponse {
    workflows: Workflow[]
    pagination: { total: number }
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('updated')

    const fetchWorkflows = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ sort: sortBy, order: 'desc', limit: '50' })
            if (searchQuery.trim()) {
                params.set('q', searchQuery.trim())
            }
            const res = await fetch(`/api/workflows?${params}`)
            if (!res.ok) {
                throw new Error('Failed to load workflows')
            }
            const data: WorkflowsResponse = await res.json()
            setWorkflows(data.workflows)
        } catch {
            toast.error('Failed to load workflows')
        } finally {
            setLoading(false)
        }
    }, [searchQuery, sortBy])

    useEffect(() => {
        fetchWorkflows()
    }, [fetchWorkflows])

    const handleDelete = async (workflow: Workflow) => {
        if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return

        try {
            const response = await fetch(`/api/workflows/${workflow.id}`, { method: 'DELETE' })
            if (!response.ok) {
                throw new Error('Failed to delete workflow')
            }
            toast.success('Workflow deleted')
            await fetchWorkflows()
        } catch {
            toast.error('Failed to delete workflow')
        }
    }

    const handleToggleFavorite = async (workflow: Workflow) => {
        try {
            await fetch(`/api/workflows/${workflow.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !workflow.isFavorite }),
            })
            setWorkflows((prev) =>
                prev.map((w) => (w.id === workflow.id ? { ...w, isFavorite: !w.isFavorite } : w))
            )
        } catch {
            toast.error('Failed to update')
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Workflows" />
            <div className="flex-1 p-6 space-y-4">
                {/* Toolbar */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search workflows..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="updated">Last Updated</SelectItem>
                            <SelectItem value="created">Date Created</SelectItem>
                            <SelectItem value="usage">Most Used</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button asChild>
                        <Link href="/workflows/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New Workflow
                        </Link>
                    </Button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4 space-y-3">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : workflows.length === 0 ? (
                    <EmptyState
                        type={searchQuery ? 'search' : 'workflows'}
                        title={searchQuery ? 'No matching workflows' : undefined}
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {workflows.map((workflow) => (
                            <WorkflowCard
                                key={workflow.id}
                                workflow={workflow}
                                onDelete={() => handleDelete(workflow)}
                                onToggleFavorite={() => handleToggleFavorite(workflow)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function WorkflowCard({
    workflow,
    onDelete,
    onToggleFavorite,
}: {
    workflow: Workflow
    onDelete: () => void
    onToggleFavorite: () => void
}) {
    return (
        <Card className="group hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center h-12 w-12 rounded-lg text-2xl"
                            style={{ backgroundColor: `${workflow.color || '#8B5CF6'}20` }}
                        >
                            {workflow.icon || '⚡'}
                        </div>
                        <div className="min-w-0">
                            <Link href={`/workflows/${workflow.id}`}>
                                <h3 className="font-semibold truncate hover:text-primary transition-colors">
                                    {workflow.name}
                                </h3>
                            </Link>
                            <p className="text-xs text-muted-foreground">
                                {workflow._count.steps} steps
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleFavorite}>
                            <Star
                                className={`h-4 w-4 ${workflow.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`}
                            />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/workflows/${workflow.id}/run`}>
                                        <Play className="mr-2 h-4 w-4" />
                                        Run
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/workflows/${workflow.id}`}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {workflow.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{workflow.description}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    {workflow.isTemplate && <Badge variant="secondary">Template</Badge>}
                    {workflow.folder && (
                        <Badge variant="outline">{workflow.folder.name}</Badge>
                    )}
                    {workflow.tags.slice(0, 2).map(({ tag }) => (
                        <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{workflow.runCount} runs</span>
                    <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
                </div>
            </CardContent>
        </Card>
    )
}
