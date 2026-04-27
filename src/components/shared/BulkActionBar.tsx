'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Trash2, Tag, FolderInput, Star, Archive, Loader2 } from 'lucide-react'

interface Tag {
    id: string
    name: string
    color: string | null
}

interface Folder {
    id: string
    name: string
    color: string | null
}

interface BulkActionBarProps {
    selectedCount: number
    selectedIds: string[]
    onComplete: () => void
    onCancel: () => void
}

export function BulkActionBar({ selectedCount, selectedIds, onComplete, onCancel }: BulkActionBarProps) {
    const [loading, setLoading] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [showTagDialog, setShowTagDialog] = useState(false)
    const [showFolderDialog, setShowFolderDialog] = useState(false)
    const [tags, setTags] = useState<Tag[]>([])
    const [folders, setFolders] = useState<Folder[]>([])
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [tagAction, setTagAction] = useState<'add' | 'remove'>('add')

    const fetchTags = async () => {
        const res = await fetch('/api/tags')
        const data = await res.json()
        setTags(data.tags || [])
    }

    const fetchFolders = async () => {
        const res = await fetch('/api/folders')
        const data = await res.json()
        setFolders(data.folders || [])
    }

    const performBulkOperation = async (
        operation: string,
        extra?: { tagIds?: string[]; folderId?: string | null }
    ) => {
        setLoading(true)
        try {
            const res = await fetch('/api/prompts/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promptIds: selectedIds,
                    operation,
                    ...extra,
                }),
            })

            if (!res.ok) {
                throw new Error('Operation failed')
            }

            const result = await res.json()
            toast.success(`${result.success} prompts ${operation === 'delete' ? 'deleted' : 'updated'}`)
            onComplete()
        } catch {
            toast.error('Bulk operation failed')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = () => {
        setConfirmDelete(true)
    }

    const confirmDeleteAction = async () => {
        await performBulkOperation('delete')
        setConfirmDelete(false)
    }

    const handleTagAction = async () => {
        if (selectedTags.size === 0) {
            toast.error('Please select at least one tag')
            return
        }
        await performBulkOperation(tagAction === 'add' ? 'addTags' : 'removeTags', {
            tagIds: Array.from(selectedTags),
        })
        setShowTagDialog(false)
        setSelectedTags(new Set())
    }

    const handleMoveToFolder = async () => {
        await performBulkOperation('moveToFolder', {
            folderId: selectedFolder,
        })
        setShowFolderDialog(false)
        setSelectedFolder(null)
    }

    const handleFavorite = () => performBulkOperation('favorite')
    const handleArchive = () => performBulkOperation('archive')

    if (selectedCount === 0) return null

    return (
        <>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-2 bg-background border rounded-lg shadow-lg px-4 py-3">
                    <span className="text-sm font-medium mr-4">
                        {selectedCount} selected
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchTags()
                            setShowTagDialog(true)
                        }}
                        disabled={loading}
                    >
                        <Tag className="h-4 w-4 mr-1" />
                        Tags
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            fetchFolders()
                            setShowFolderDialog(true)
                        }}
                        disabled={loading}
                    >
                        <FolderInput className="h-4 w-4 mr-1" />
                        Move
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFavorite}
                        disabled={loading}
                    >
                        <Star className="h-4 w-4 mr-1" />
                        Favorite
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                        disabled={loading}
                    >
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                    </Button>

                    <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>

                    {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {selectedCount} prompts?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. All selected prompts will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteAction} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Delete {selectedCount} prompts
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tag Dialog */}
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Tags</DialogTitle>
                        <DialogDescription>
                            Add or remove tags from {selectedCount} selected prompts.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex gap-4">
                            <Button
                                variant={tagAction === 'add' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTagAction('add')}
                            >
                                Add Tags
                            </Button>
                            <Button
                                variant={tagAction === 'remove' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTagAction('remove')}
                            >
                                Remove Tags
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {tags.map((tag) => (
                                <div key={tag.id} className="flex items-center gap-2">
                                    <Checkbox
                                        id={tag.id}
                                        checked={selectedTags.has(tag.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedTags((prev) => {
                                                const next = new Set(prev)
                                                if (checked) {
                                                    next.add(tag.id)
                                                } else {
                                                    next.delete(tag.id)
                                                }
                                                return next
                                            })
                                        }}
                                    />
                                    <Label
                                        htmlFor={tag.id}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        {tag.color && (
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                        )}
                                        {tag.name}
                                    </Label>
                                </div>
                            ))}
                            {tags.length === 0 && (
                                <p className="text-sm text-muted-foreground">No tags available</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTagDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleTagAction} disabled={loading || selectedTags.size === 0}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {tagAction === 'add' ? 'Add' : 'Remove'} Tags
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Folder Dialog */}
            <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move to Folder</DialogTitle>
                        <DialogDescription>
                            Move {selectedCount} prompts to a folder.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select value={selectedFolder ?? 'none'} onValueChange={(v) => setSelectedFolder(v === 'none' ? null : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select folder..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No folder (root)</SelectItem>
                                {folders.map((folder) => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                        {folder.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleMoveToFolder} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Move Prompts
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
