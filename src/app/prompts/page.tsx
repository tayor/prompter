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
import { ModelBadge } from '@/components/shared/ModelBadge'
import { StarRating } from '@/components/shared/StarRating'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { Checkbox } from '@/components/ui/checkbox'
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
    Copy,
    Trash2,
    Edit,
    History,
    ChevronLeft,
    ChevronRight,
    Download,
    CheckSquare,
    X,
} from 'lucide-react'
import { toast } from 'sonner'

interface Prompt {
    id: string
    title: string
    content: string
    description: string | null
    aiModel: string | null
    category?: string
    usageCount: number
    rating: number | null
    isFavorite: boolean
    isArchived: boolean
    createdAt: string
    updatedAt: string
    folder: { id: string; name: string; color: string | null } | null
    tags: Array<{ tag: { id: string; name: string; color: string | null } }>
}

interface PromptsResponse {
    prompts: Prompt[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

const ITEMS_PER_PAGE = 12

// CSV escape function for proper formatting
function escapeCSV(value: string | null | undefined): string {
    if (value == null) return ''
    const str = String(value)
    // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('updated')
    const [showFavorites, setShowFavorites] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })

    // Selection mode
    const [selectMode, setSelectMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [exporting, setExporting] = useState(false)

    // Keyboard navigation
    const [focusedIndex, setFocusedIndex] = useState<number>(-1)

    // Keyboard shortcuts for J/K navigation and C to copy
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return
            }

            if (e.key === 'j' || e.key === 'ArrowDown') {
                e.preventDefault()
                setFocusedIndex((prev) => Math.min(prev + 1, prompts.length - 1))
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                e.preventDefault()
                setFocusedIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'c' && focusedIndex >= 0 && focusedIndex < prompts.length) {
                e.preventDefault()
                const prompt = prompts[focusedIndex]
                void (async () => {
                    try {
                        const response = await fetch(`/api/prompts/${prompt.id}/copy`, {
                            method: 'POST',
                        })
                        const data = await response.json().catch(() => ({}))

                        if (!response.ok) {
                            throw new Error('Copy request failed')
                        }

                        const content = typeof data.content === 'string' ? data.content : prompt.content
                        await navigator.clipboard.writeText(content)

                        setPrompts((prev) =>
                            prev.map((p) =>
                                p.id === prompt.id
                                    ? { ...p, usageCount: p.usageCount + 1 }
                                    : p
                            )
                        )

                        toast.success(`Copied "${prompt.title}" to clipboard`)
                    } catch {
                        toast.error('Failed to copy prompt')
                    }
                })()
            } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < prompts.length) {
                window.location.href = `/prompts/${prompts[focusedIndex].id}`
            } else if (e.key === 'Escape') {
                setFocusedIndex(-1)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [focusedIndex, prompts])

    // Reset focus when prompts change
    useEffect(() => {
        setFocusedIndex(-1)
    }, [prompts])

    useEffect(() => {
        setCurrentPage(1) // Reset to page 1 when filters change
    }, [sortBy, showFavorites])

    const fetchPrompts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                sort: sortBy,
                order: 'desc',
                limit: String(ITEMS_PER_PAGE),
                page: String(currentPage),
            })
            if (showFavorites) params.set('isFavorite', 'true')
            if (searchQuery.trim()) params.set('q', searchQuery.trim())

            const res = await fetch(`/api/prompts?${params}`)
            if (!res.ok) {
                throw new Error('Failed to load prompts')
            }
            const data: PromptsResponse = await res.json()
            setPrompts(data.prompts)
            setPagination({
                total: data.pagination.total,
                totalPages: data.pagination.totalPages,
            })
        } catch {
            toast.error('Failed to load prompts')
        } finally {
            setLoading(false)
        }
    }, [sortBy, currentPage, searchQuery, showFavorites])

    useEffect(() => {
        fetchPrompts()
    }, [fetchPrompts])

    const handleCopy = async (prompt: Prompt) => {
        try {
            const response = await fetch(`/api/prompts/${prompt.id}/copy`, { method: 'POST' })
            if (!response.ok) {
                throw new Error('Failed to copy prompt')
            }
            await navigator.clipboard.writeText(prompt.content)
            toast.success('Prompt copied to clipboard')
            void fetchPrompts()
        } catch {
            toast.error('Failed to copy prompt')
        }
    }

    const handleDelete = async (prompt: Prompt) => {
        if (!confirm(`Delete "${prompt.title}"? This cannot be undone.`)) return

        try {
            const response = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
            if (!response.ok) {
                throw new Error('Failed to delete prompt')
            }
            toast.success('Prompt deleted')
            const nextPage = prompts.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
            if (nextPage !== currentPage) {
                setCurrentPage(nextPage)
            } else {
                await fetchPrompts()
            }
        } catch {
            toast.error('Failed to delete prompt')
        }
    }

    const handleToggleFavorite = async (prompt: Prompt) => {
        try {
            await fetch(`/api/prompts/${prompt.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !prompt.isFavorite }),
            })
            setPrompts((prev) =>
                prev.map((p) =>
                    p.id === prompt.id ? { ...p, isFavorite: !p.isFavorite } : p
                )
            )
            toast.success(prompt.isFavorite ? 'Removed from favorites' : 'Added to favorites')
        } catch {
            toast.error('Failed to update favorite')
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

    const selectAll = async () => {
        try {
            // Fetch ALL prompt IDs (not just current page)
            const res = await fetch('/api/prompts/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: showFavorites || undefined }),
            })
            const data = await res.json()
            setSelectedIds(new Set(data.ids))
            toast.success(`Selected ${data.count} prompts`)
        } catch {
            toast.error('Failed to select all')
        }
    }

    const deselectAll = () => {
        setSelectedIds(new Set())
    }

    const exitSelectMode = () => {
        setSelectMode(false)
        setSelectedIds(new Set())
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            // Use export endpoint (no pagination limit)
            const params = new URLSearchParams()
            if (showFavorites) params.set('isFavorite', 'true')
            if (selectedIds.size > 0) {
                params.set('ids', Array.from(selectedIds).join(','))
            }

            const res = await fetch(`/api/prompts/export?${params}`)
            const data: { prompts: Prompt[] } = await res.json()

            const promptsToExport = data.prompts

            // Build CSV
            const headers = [
                'ID',
                'Title',
                'Description',
                'Content (Markdown)',
                'AI Model',
                'Category',
                'Folder',
                'Tags',
                'Usage Count',
                'Is Favorite',
                'Created At',
                'Updated At',
            ]

            const rows = promptsToExport.map((p) => [
                escapeCSV(p.id),
                escapeCSV(p.title),
                escapeCSV(p.description),
                escapeCSV(p.content),
                escapeCSV(p.aiModel),
                escapeCSV(p.category),
                escapeCSV(p.folder?.name),
                escapeCSV(p.tags.map((t) => t.tag.name).join(', ')),
                String(p.usageCount),
                p.isFavorite ? 'Yes' : 'No',
                new Date(p.createdAt).toISOString(),
                new Date(p.updatedAt).toISOString(),
            ])

            const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `prompts-export-${new Date().toISOString().split('T')[0]}.csv`
            link.click()
            URL.revokeObjectURL(url)

            toast.success(`Exported ${promptsToExport.length} prompts`)
            exitSelectMode()
        } catch {
            toast.error('Failed to export prompts')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Prompts" />
            <div className="flex-1 p-6 space-y-4 overflow-auto">
                {/* Toolbar */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search prompts..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
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
                            <SelectItem value="rating">Highest Rated</SelectItem>
                            <SelectItem value="title">Title</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant={showFavorites ? 'secondary' : 'outline'}
                        size="icon"
                        onClick={() => setShowFavorites(!showFavorites)}
                    >
                        <Star className={showFavorites ? 'fill-yellow-500 text-yellow-500' : ''} />
                    </Button>

                    {/* Export / Select Mode Controls */}
                    {selectMode ? (
                        <>
                            <Button variant="outline" size="sm" onClick={selectAll}>
                                Select All
                            </Button>
                            <Button variant="outline" size="sm" onClick={deselectAll}>
                                Deselect All
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={exporting}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {exporting ? 'Exporting...' : `Export${selectedIds.size > 0 ? ` (${selectedIds.size})` : ' All'}`}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={exitSelectMode}>
                                <X className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setSelectMode(true)}>
                                <CheckSquare className="mr-2 h-4 w-4" />
                                Select & Export
                            </Button>
                            <Button asChild>
                                <Link href="/prompts/new">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Prompt
                                </Link>
                            </Button>
                        </>
                    )}
                </div>

                {/* Selection info bar */}
                {selectMode && (
                    <div className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-md">
                        {selectedIds.size === 0
                            ? 'Click on prompts to select them for export, or export all'
                            : `${selectedIds.size} prompt${selectedIds.size === 1 ? '' : 's'} selected`}
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4 space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-16" />
                                        <Skeleton className="h-5 w-16" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : prompts.length === 0 ? (
                    <EmptyState
                        type={searchQuery ? 'search' : 'prompts'}
                        title={searchQuery ? 'No matching prompts' : undefined}
                    />
                ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {prompts.map((prompt, idx) => (
                                    <PromptCard
                                        key={prompt.id}
                                        prompt={prompt}
                                    onCopy={() => handleCopy(prompt)}
                                    onDelete={() => handleDelete(prompt)}
                                    onToggleFavorite={() => handleToggleFavorite(prompt)}
                                    selectMode={selectMode}
                                    isSelected={selectedIds.has(prompt.id)}
                                    onToggleSelect={() => toggleSelect(prompt.id)}
                                    isFocused={focusedIndex === idx}
                                    onFocus={() => setFocusedIndex(idx)}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                                    {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of{' '}
                                    {pagination.total} prompts
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <span className="text-sm px-3">
                                        Page {currentPage} of {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                                        disabled={currentPage === pagination.totalPages}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bulk Actions */}
            {selectMode && (
                <BulkActionBar
                    selectedCount={selectedIds.size}
                    selectedIds={Array.from(selectedIds)}
                    onComplete={() => {
                        exitSelectMode()
                        void fetchPrompts()
                    }}
                    onCancel={exitSelectMode}
                />
            )}
        </div>
    )
}

function PromptCard({
    prompt,
    onCopy,
    onDelete,
    onToggleFavorite,
    selectMode,
    isSelected,
    onToggleSelect,
    isFocused = false,
    onFocus,
}: {
    prompt: Prompt
    onCopy: () => void
    onDelete: () => void
    onToggleFavorite: () => void
    selectMode: boolean
    isSelected: boolean
    onToggleSelect: () => void
    isFocused?: boolean
    onFocus?: () => void
}) {
    return (
        <Card
            className={`group hover:shadow-md transition-all ${selectMode ? 'cursor-pointer' : ''
                } ${isSelected ? 'ring-2 ring-primary' : ''} ${isFocused ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
            onClick={selectMode ? onToggleSelect : undefined}
            onMouseEnter={onFocus}
            tabIndex={0}
        >
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    {selectMode ? (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={onToggleSelect}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            />
                            <h3 className="font-semibold truncate">{prompt.title}</h3>
                        </div>
                    ) : (
                        <Link href={`/prompts/${prompt.id}`} className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate hover:text-primary transition-colors">
                                {prompt.title}
                            </h3>
                        </Link>
                    )}
                    {!selectMode && (
                        <div className="flex items-center gap-1 ml-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onCopy}
                                title="Copy to clipboard"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onToggleFavorite}
                            >
                                <Star
                                    className={`h-4 w-4 ${prompt.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''
                                        }`}
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
                                        <Link href={`/prompts/${prompt.id}`}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/prompts/${prompt.id}/history`}>
                                            <History className="mr-2 h-4 w-4" />
                                            Version History
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                    {prompt.description || prompt.content.slice(0, 100)}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                    {prompt.aiModel && <ModelBadge model={prompt.aiModel} />}
                    {prompt.folder && (
                        <Badge variant="outline" style={{ borderColor: prompt.folder.color ?? undefined }}>
                            {prompt.folder.name}
                        </Badge>
                    )}
                    {prompt.tags.slice(0, 2).map(({ tag }) => (
                        <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                    ))}
                    {prompt.tags.length > 2 && (
                        <Badge variant="secondary">+{prompt.tags.length - 2}</Badge>
                    )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-3">
                        <span>{prompt.usageCount} uses</span>
                        {prompt.rating && (
                            <StarRating value={prompt.rating} readonly size="sm" />
                        )}
                    </div>
                    <span>{new Date(prompt.updatedAt).toLocaleDateString()}</span>
                </div>
            </CardContent>
        </Card>
    )
}
