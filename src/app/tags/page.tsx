'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TagBadge } from '@/components/shared/TagBadge'
import { toast } from 'sonner'
import { Plus, FileText, Workflow, MoreVertical, Edit, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Tag {
    id: string
    name: string
    color: string | null
    _count: {
        prompts: number
        workflows: number
    }
}

const TAG_COLORS = [
    '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
    '#8B5CF6', '#EC4899', '#84CC16', '#F97316', '#6366F1',
    '#14B8A6', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9', '#D946EF',
]

export default function TagsPage() {
    const [tags, setTags] = useState<Tag[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTag, setEditingTag] = useState<Tag | null>(null)
    const [formData, setFormData] = useState({ name: '', color: '#3B82F6' })

    useEffect(() => {
        fetchTags()
    }, [])

    const fetchTags = async () => {
        try {
            const res = await fetch('/api/tags')
            const data = await res.json()
            setTags(data.tags || [])
        } catch {
            toast.error('Failed to load tags')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error('Name is required')
            return
        }

        try {
            const url = editingTag ? `/api/tags/${editingTag.id}` : '/api/tags'
            const method = editingTag ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (res.status === 409) {
                toast.error('Tag already exists')
                return
            }

            if (!res.ok) throw new Error('Failed')

            toast.success(editingTag ? 'Tag updated' : 'Tag created')
            setDialogOpen(false)
            setEditingTag(null)
            setFormData({ name: '', color: '#3B82F6' })
            fetchTags()
        } catch {
            toast.error('Failed to save tag')
        }
    }

    const handleEdit = (tag: Tag) => {
        setEditingTag(tag)
        setFormData({
            name: tag.name,
            color: tag.color || '#3B82F6',
        })
        setDialogOpen(true)
    }

    const handleDelete = async (tag: Tag) => {
        if (!confirm(`Delete tag "${tag.name}"?`)) return

        try {
            await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
            toast.success('Tag deleted')
            fetchTags()
        } catch {
            toast.error('Failed to delete tag')
        }
    }

    const openNewDialog = () => {
        setEditingTag(null)
        setFormData({ name: '', color: '#3B82F6' })
        setDialogOpen(true)
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Tags" />
            <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-muted-foreground">
                        Categorize your prompts and workflows with tags
                    </p>
                    <Button onClick={openNewDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Tag
                    </Button>
                </div>

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[...Array(8)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-6 w-24 mb-2" />
                                    <Skeleton className="h-4 w-16" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : tags.length === 0 ? (
                    <EmptyState type="tags" />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {tags.map((tag) => (
                            <Card key={tag.id} className="group hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <TagBadge name={tag.name} color={tag.color} className="text-sm mb-2" />
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3" />
                                                    {tag._count.prompts}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Workflow className="h-3 w-3" />
                                                    {tag._count.workflows}
                                                </span>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(tag)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(tag)}
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTag ? 'Edit Tag' : 'New Tag'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Tag name..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`h-8 w-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData((p) => ({ ...p, color }))}
                                    />
                                ))}
                                {/* Custom color input */}
                                <label className="relative cursor-pointer">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div
                                        className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground text-xs"
                                        title="Custom color"
                                    >
                                        +
                                    </div>
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Click + to choose a custom color
                            </p>
                        </div>
                        <div className="pt-2">
                            <Label className="text-sm text-muted-foreground">Preview</Label>
                            <div className="mt-2">
                                <TagBadge name={formData.name || 'Tag name'} color={formData.color} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingTag ? 'Save Changes' : 'Create Tag'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
