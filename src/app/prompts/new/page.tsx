'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { toast } from 'sonner'
import { Save, ArrowLeft, Eye, Code, Loader2, Undo2, Redo2 } from 'lucide-react'
import Link from 'next/link'
import { PromptStats } from '@/components/shared/PromptStats'
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

export default function NewPromptPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        description: '',
        aiModel: '',
        category: 'user',
        folderId: '',
    })

    // Extract variables from content
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
        if (!formData.content.trim()) {
            toast.error('Content is required')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    aiModel: formData.aiModel || undefined,
                    folderId: formData.folderId || undefined,
                    variables,
                }),
            })

            if (!res.ok) throw new Error('Failed to create prompt')

            const prompt = await res.json()
            toast.success('Prompt created successfully')
            router.push(`/prompts/${prompt.id}`)
        } catch {
            toast.error('Failed to create prompt')
        } finally {
            setSaving(false)
        }
    }

    const updateField = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="New Prompt" />
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    {/* Back Link */}
                    <Button variant="ghost" asChild className="mb-4">
                        <Link href="/prompts">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Prompts
                        </Link>
                    </Button>

                    {/* Title & Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    placeholder="Enter prompt title..."
                                    value={formData.title}
                                    onChange={(e) => updateField('title', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    placeholder="Brief description of what this prompt does..."
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
                                        <p className="text-muted-foreground italic">Enter your prompt content to see preview...</p>
                                    )}
                                </div>
                            ) : (
                                <Textarea
                                    placeholder="Enter your prompt content here...

Use {{variable}} syntax for placeholders, e.g.:
- {{topic}} for a topic input
- {{tone}} for tone selection
- {{context}} for additional context"
                                    value={formData.content}
                                    onChange={(e) => updateField('content', e.target.value)}
                                    className="min-h-[300px] font-mono text-sm"
                                />
                            )}

                            {/* Variables detected */}
                            {variables.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <Label className="text-sm text-muted-foreground mb-2 block">
                                        Detected Variables ({variables.length})
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

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/prompts">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Create Prompt
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}
