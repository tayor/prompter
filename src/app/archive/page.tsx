'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RotateCcw, Trash2, MoreVertical, FileText, Workflow, Loader2 } from 'lucide-react'

interface ArchivedItem {
    id: string
    title: string
    name?: string
    description: string | null
    archivedAt?: string
    updatedAt: string
    folder?: { name: string } | null
}

export default function ArchivePage() {
    const [prompts, setPrompts] = useState<ArchivedItem[]>([])
    const [workflows, setWorkflows] = useState<ArchivedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [activeTab, setActiveTab] = useState<'prompts' | 'workflows'>('prompts')
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        fetchArchived()
    }, [])

    const fetchArchived = async () => {
        setLoading(true)
        try {
            const [promptsRes, workflowsRes] = await Promise.all([
                fetch('/api/prompts?isArchived=true&limit=100'),
                fetch('/api/workflows?isArchived=true&limit=100'),
            ])
            const promptsData = await promptsRes.json()
            const workflowsData = await workflowsRes.json()
            setPrompts(promptsData.prompts || [])
            setWorkflows(workflowsData.workflows || [])
        } catch {
            toast.error('Failed to load archived items')
        } finally {
            setLoading(false)
        }
    }

    const handleRestore = async (id: string, type: 'prompt' | 'workflow') => {
        setProcessing(true)
        try {
            const endpoint = type === 'prompt' ? `/api/prompts/${id}` : `/api/workflows/${id}`
            await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isArchived: false }),
            })
            toast.success(`${type === 'prompt' ? 'Prompt' : 'Workflow'} restored`)
            fetchArchived()
        } catch {
            toast.error('Failed to restore item')
        } finally {
            setProcessing(false)
        }
    }

    const handlePermanentDelete = async (id: string, type: 'prompt' | 'workflow') => {
        setProcessing(true)
        try {
            const endpoint = type === 'prompt' ? `/api/prompts/${id}` : `/api/workflows/${id}`
            await fetch(endpoint, { method: 'DELETE' })
            toast.success('Permanently deleted')
            setConfirmDelete(null)
            fetchArchived()
        } catch {
            toast.error('Failed to delete item')
        } finally {
            setProcessing(false)
        }
    }

    const handleBulkRestore = async () => {
        if (selectedIds.size === 0) return
        setProcessing(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map((id) =>
                    fetch(`/api/${activeTab}/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isArchived: false }),
                    })
                )
            )
            toast.success(`${selectedIds.size} items restored`)
            setSelectedIds(new Set())
            fetchArchived()
        } catch {
            toast.error('Failed to restore items')
        } finally {
            setProcessing(false)
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }


    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Archive" />
                <div className="flex-1 p-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-5 w-3/4 mb-2" />
                                    <Skeleton className="h-4 w-full" />
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
            <Header title="Archive" />
            <div className="flex-1 p-6 space-y-4 overflow-auto">
                <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as 'prompts' | 'workflows')
                    setSelectedIds(new Set())
                }}>
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="prompts" className="gap-2">
                                <FileText className="h-4 w-4" />
                                Prompts
                                {prompts.length > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                        {prompts.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="workflows" className="gap-2">
                                <Workflow className="h-4 w-4" />
                                Workflows
                                {workflows.length > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                        {workflows.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    {selectedIds.size} selected
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleBulkRestore}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                    )}
                                    Restore Selected
                                </Button>
                            </div>
                        )}
                    </div>

                    <TabsContent value="prompts" className="mt-0">
                        {prompts.length === 0 ? (
                            <EmptyState
                                type="prompts"
                                title="No archived prompts"
                            />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {prompts.map((item) => (
                                    <ArchivedCard
                                        key={item.id}
                                        item={item}
                                        type="prompt"
                                        isSelected={selectedIds.has(item.id)}
                                        onToggleSelect={() => toggleSelect(item.id)}
                                        onRestore={() => handleRestore(item.id, 'prompt')}
                                        onDelete={() => setConfirmDelete(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="workflows" className="mt-0">
                        {workflows.length === 0 ? (
                            <EmptyState
                                type="workflows"
                                title="No archived workflows"
                            />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {workflows.map((item) => (
                                    <ArchivedCard
                                        key={item.id}
                                        item={{ ...item, title: item.name || item.title }}
                                        type="workflow"
                                        isSelected={selectedIds.has(item.id)}
                                        onToggleSelect={() => toggleSelect(item.id)}
                                        onRestore={() => handleRestore(item.id, 'workflow')}
                                        onDelete={() => setConfirmDelete(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Delete Confirmation */}
            <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Permanently Delete?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. The item will be permanently removed from the database.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                confirmDelete &&
                                handlePermanentDelete(
                                    confirmDelete,
                                    activeTab === 'prompts' ? 'prompt' : 'workflow'
                                )
                            }
                            disabled={processing}
                        >
                            {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ArchivedCard({
    item,
    type,
    isSelected,
    onToggleSelect,
    onRestore,
    onDelete,
}: {
    item: ArchivedItem
    type: 'prompt' | 'workflow'
    isSelected: boolean
    onToggleSelect: () => void
    onRestore: () => void
    onDelete: () => void
}) {
    return (
        <Card className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={onToggleSelect}
                        />
                        <Link
                            href={`/${type === 'prompt' ? 'prompts' : 'workflows'}/${item.id}`}
                            className="flex-1 min-w-0"
                        >
                            <h3 className="font-semibold truncate hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                        </Link>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onRestore}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Permanently
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description || 'No description'}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{item.folder?.name || 'No folder'}</span>
                    <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
            </CardContent>
        </Card>
    )
}
