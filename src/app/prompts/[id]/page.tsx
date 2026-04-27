'use client'

import { useState, useEffect, useMemo, useCallback, use } from 'react'
import ReactMarkdown from 'react-markdown'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Save, ArrowLeft, Eye, Code, Loader2, Copy, Trash2, Star, History, Pin, Undo2, Redo2 } from 'lucide-react'
import Link from 'next/link'
import { PromptStats } from '@/components/shared/PromptStats'
import { StarRating } from '@/components/shared/StarRating'
import { VariableSubstitutionPreview } from '@/components/shared/VariableSubstitutionPreview'

const AI_MODELS = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
]

const CATEGORIES = [
    { value: 'user', label: 'User Prompt' },
    { value: 'system', label: 'System Prompt' },
    { value: 'assistant', label: 'Assistant Prompt' },
]

interface PromptVersion {
    id: string
    version: number
    content: string
    changeNote: string | null
    createdAt: string
}

interface Prompt {
    id: string
    title: string
    content: string
    description: string | null
    aiModel: string | null
    category: string
    isFavorite: boolean
    isPinned: boolean
    usageCount: number
    rating: number | null
    folderId: string | null
    versions: PromptVersion[]
    tags: Array<{ tag: { id: string; name: string; color: string | null } }>
}

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(true)
    const [prompt, setPrompt] = useState<Prompt | null>(null)
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        description: '',
        aiModel: '',
        category: 'user',
    })

    const fetchPrompt = useCallback(async () => {
        try {
            const res = await fetch(`/api/prompts/${id}`)
            if (!res.ok) throw new Error('Not found')
            const data: Prompt = await res.json()
            setPrompt(data)
            setFormData({
                title: data.title,
                content: data.content,
                description: data.description ?? '',
                aiModel: data.aiModel ?? '',
                category: data.category,
            })
        } catch {
            toast.error('Prompt not found')
            router.push('/prompts')
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        fetchPrompt()
    }, [fetchPrompt])

    const variables = useMemo(() => {
        const matches = formData.content.match(/\{\{([^}]+)\}\}/g)
        if (!matches) return []
        return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))]
    }, [formData.content])

    // Keyboard shortcuts: Ctrl+Shift+P (toggle preview), Ctrl+S (save)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault()
                setShowPreview((prev) => !prev)
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                // Trigger form submit
                const form = document.querySelector('form')
                if (form) form.requestSubmit()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim()) {
            toast.error('Title is required')
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/prompts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    aiModel: formData.aiModel || null,
                    variables,
                }),
            })

            if (!res.ok) throw new Error('Failed to update')

            toast.success('Prompt saved')
            fetchPrompt() // Refresh to get new version
        } catch {
            toast.error('Failed to save prompt')
        } finally {
            setSaving(false)
        }
    }

    const handleCopy = async () => {
        try {
            await fetch(`/api/prompts/${id}/copy`, { method: 'POST' })
            await navigator.clipboard.writeText(formData.content)
            toast.success('Copied to clipboard')
        } catch {
            toast.error('Failed to copy')
        }
    }

    const handleDelete = async () => {
        if (!confirm('Delete this prompt? This cannot be undone.')) return

        try {
            await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
            toast.success('Prompt deleted')
            router.push('/prompts')
        } catch {
            toast.error('Failed to delete')
        }
    }

    const handleToggleFavorite = async () => {
        if (!prompt) return

        try {
            await fetch(`/api/prompts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !prompt.isFavorite }),
            })
            setPrompt((prev) => prev ? { ...prev, isFavorite: !prev.isFavorite } : null)
            toast.success(prompt.isFavorite ? 'Removed from favorites' : 'Added to favorites')
        } catch {
            toast.error('Failed to update')
        }
    }

    const handleTogglePin = async () => {
        if (!prompt) return

        try {
            await fetch(`/api/prompts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPinned: !prompt.isPinned }),
            })
            setPrompt((prev) => prev ? { ...prev, isPinned: !prev.isPinned } : null)
            toast.success(prompt.isPinned ? 'Unpinned from dashboard' : 'Pinned to dashboard')
        } catch {
            toast.error('Failed to update')
        }
    }

    const handleRatingChange = async (rating: number | null) => {
        if (!prompt) return

        try {
            await fetch(`/api/prompts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating }),
            })
            setPrompt((prev) => prev ? { ...prev, rating } : null)
            toast.success(rating ? `Rated ${rating}/5` : 'Rating cleared')
        } catch {
            toast.error('Failed to update rating')
        }
    }

    const updateField = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Edit Prompt" />
                <div className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-10 w-32" />
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-32 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Edit Prompt" />
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" asChild>
                            <Link href="/prompts">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                        <div className="flex items-center gap-4">
                            {/* Rating */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background">
                                <span className="text-xs text-muted-foreground">Rating:</span>
                                <StarRating
                                    value={prompt?.rating ?? null}
                                    onChange={handleRatingChange}
                                    size="sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" asChild>
                                    <Link href={`/prompts/${id}/history`}>
                                        <History className="mr-2 h-4 w-4" />
                                        Version History
                                    </Link>
                                </Button>
                                <Button type="button" variant="outline" size="icon" onClick={handleTogglePin} title={prompt?.isPinned ? 'Unpin from dashboard' : 'Pin to dashboard'}>
                                    <Pin className={prompt?.isPinned ? 'fill-blue-500 text-blue-500' : ''} />
                                </Button>
                                <Button type="button" variant="outline" size="icon" onClick={handleToggleFavorite}>
                                    <Star className={prompt?.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''} />
                                </Button>
                                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="outline" size="icon" onClick={handleDelete}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => updateField('title', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="aiModel">AI Model</Label>
                                    <Select
                                        value={formData.aiModel}
                                        onValueChange={(value) => updateField('aiModel', value)}
                                    >
                                        <SelectTrigger id="aiModel">
                                            <SelectValue placeholder="Select model..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {AI_MODELS.map((model) => (
                                                <SelectItem key={model.value} value={model.value}>
                                                    {model.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => updateField('category', value)}
                                    >
                                        <SelectTrigger id="category">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map((cat) => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Editor */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Prompt Content</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => document.execCommand('undo')}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Undo2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => document.execCommand('redo')}
                                    title="Redo (Ctrl+Y)"
                                >
                                    <Redo2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant={showPreview ? 'outline' : 'secondary'}
                                    size="sm"
                                    onClick={() => setShowPreview(false)}
                                >
                                    <Code className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button
                                    type="button"
                                    variant={showPreview ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setShowPreview(true)}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {showPreview ? (
                                <div className="min-h-[300px] p-4 rounded-md border bg-muted/50 prose prose-sm dark:prose-invert max-w-none">
                                    {formData.content ? (
                                        <ReactMarkdown
                                            components={{
                                                // Highlight variables in preview
                                                p: ({ children }) => {
                                                    if (typeof children === 'string') {
                                                        const parts = children.split(/(\{\{[^}]+\}\})/g)
                                                        return (
                                                            <p>
                                                                {parts.map((part, i) =>
                                                                    part.match(/^\{\{[^}]+\}\}$/) ? (
                                                                        <span key={i} className="bg-primary/20 text-primary px-1 rounded font-mono text-xs">
                                                                            {part}
                                                                        </span>
                                                                    ) : (
                                                                        part
                                                                    )
                                                                )}
                                                            </p>
                                                        )
                                                    }
                                                    return <p>{children}</p>
                                                },
                                            }}
                                        >
                                            {formData.content}
                                        </ReactMarkdown>
                                    ) : (
                                        <p className="text-muted-foreground italic">No content to preview</p>
                                    )}
                                </div>
                            ) : (
                                <Textarea
                                    value={formData.content}
                                    onChange={(e) => updateField('content', e.target.value)}
                                    className="min-h-[300px] font-mono text-sm"
                                />
                            )}

                            {variables.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <Label className="text-sm text-muted-foreground mb-2 block">
                                        Variables ({variables.length})
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {variables.map((v) => (
                                            <Badge key={v} variant="secondary" className="font-mono">
                                                {`{{${v}}}`}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <PromptStats content={formData.content} aiModel={formData.aiModel} />

                            {/* Variable Substitution Preview */}
                            <VariableSubstitutionPreview
                                content={formData.content}
                                variables={variables}
                            />
                        </CardContent>
                    </Card>

                    {/* Version History */}
                    {prompt?.versions && prompt.versions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Version History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {prompt.versions.map((v) => (
                                        <div
                                            key={v.id}
                                            className="flex items-center justify-between p-3 rounded-lg border"
                                        >
                                            <div>
                                                <span className="font-medium">Version {v.version}</span>
                                                {v.changeNote && (
                                                    <span className="text-muted-foreground ml-2">— {v.changeNote}</span>
                                                )}
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(v.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/prompts">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}
