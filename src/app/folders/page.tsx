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
import { toast } from 'sonner'
import { Plus, FileText, Workflow, MoreVertical, Edit, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Folder {
    id: string
    name: string
    icon: string | null
    color: string | null
    parentId: string | null
    _count: {
        prompts: number
        workflows: number
        children: number
    }
}

const FOLDER_COLORS = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

const FOLDER_ICONS = ['📁', '💼', '🏠', '📋', '🎯', '💡', '🔧', '📚', '🎨', '🚀']

export default function FoldersPage() {
    const [folders, setFolders] = useState<Folder[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
    const [formData, setFormData] = useState({ name: '', icon: '📁', color: '#3B82F6' })

    useEffect(() => {
        fetchFolders()
    }, [])

    const fetchFolders = async () => {
        try {
            const res = await fetch('/api/folders')
            const data = await res.json()
            setFolders(data.flat || [])
        } catch {
            toast.error('Failed to load folders')
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
            const url = editingFolder ? `/api/folders/${editingFolder.id}` : '/api/folders'
            const method = editingFolder ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (!res.ok) throw new Error('Failed')

            toast.success(editingFolder ? 'Folder updated' : 'Folder created')
            setDialogOpen(false)
            setEditingFolder(null)
            setFormData({ name: '', icon: '📁', color: '#3B82F6' })
            fetchFolders()
        } catch {
            toast.error('Failed to save folder')
        }
    }

    const handleEdit = (folder: Folder) => {
        setEditingFolder(folder)
        setFormData({
            name: folder.name,
            icon: folder.icon || '📁',
            color: folder.color || '#3B82F6',
        })
        setDialogOpen(true)
    }

    const handleDelete = async (folder: Folder) => {
        if (!confirm(`Delete "${folder.name}"? Contents will be moved to parent folder.`)) return

        try {
            await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' })
            toast.success('Folder deleted')
            fetchFolders()
        } catch {
            toast.error('Failed to delete folder')
        }
    }

    const openNewDialog = () => {
        setEditingFolder(null)
        setFormData({ name: '', icon: '📁', color: '#3B82F6' })
        setDialogOpen(true)
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Folders" />
            <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-muted-foreground">
                        Organize your prompts and workflows into folders
                    </p>
                    <Button onClick={openNewDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Folder
                    </Button>
                </div>

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-12 w-12 rounded-lg mb-3" />
                                    <Skeleton className="h-5 w-3/4 mb-2" />
                                    <Skeleton className="h-4 w-1/2" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : folders.length === 0 ? (
                    <EmptyState type="folders" />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {folders.map((folder) => (
                            <Card key={folder.id} className="group hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex items-center justify-center h-12 w-12 rounded-lg text-2xl"
                                                style={{ backgroundColor: `${folder.color}20` }}
                                            >
                                                {folder.icon || '📁'}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{folder.name}</h3>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="h-3 w-3" />
                                                        {folder._count.prompts}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Workflow className="h-3 w-3" />
                                                        {folder._count.workflows}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(folder)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(folder)}
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
                        <DialogTitle>{editingFolder ? 'Edit Folder' : 'New Folder'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Folder name..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <div className="flex flex-wrap gap-2">
                                {FOLDER_ICONS.map((icon) => (
                                    <Button
                                        key={icon}
                                        type="button"
                                        variant={formData.icon === icon ? 'secondary' : 'outline'}
                                        size="icon"
                                        onClick={() => setFormData((p) => ({ ...p, icon }))}
                                    >
                                        {icon}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex flex-wrap gap-2">
                                {FOLDER_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`h-8 w-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData((p) => ({ ...p, color }))}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingFolder ? 'Save Changes' : 'Create Folder'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
