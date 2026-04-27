'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface FolderNode {
    id: string
    name: string
    color: string | null
    parentId: string | null
    _count: { prompts: number }
    children?: FolderNode[]
}

interface FolderTreeProps {
    collapsed?: boolean
}

export function FolderTree({ collapsed = false }: FolderTreeProps) {
    const [folders, setFolders] = useState<FolderNode[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentFolderId = searchParams.get('folderId')

    // Build hierarchical tree from flat list
    const buildTree = useCallback((flatFolders: FolderNode[]): FolderNode[] => {
        const map = new Map<string, FolderNode>()
        const roots: FolderNode[] = []

        flatFolders.forEach((f) => map.set(f.id, { ...f, children: [] }))

        flatFolders.forEach((f) => {
            const node = map.get(f.id)!
            if (f.parentId && map.has(f.parentId)) {
                map.get(f.parentId)!.children!.push(node)
            } else {
                roots.push(node)
            }
        })

        return roots
    }, [])

    const fetchFolders = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/folders')
            const data = await res.json()
            const flatFolders = Array.isArray(data) ? data : (data.flat || [])
            setFolders(buildTree(flatFolders))
        } catch (error) {
            console.error('Failed to fetch folders:', error)
        } finally {
            setLoading(false)
        }
    }, [buildTree])

    useEffect(() => {
        fetchFolders()
    }, [fetchFolders])

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    if (collapsed) {
        return null
    }

    if (loading) {
        return (
            <div className="space-y-1 px-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4 ml-4" />
                <Skeleton className="h-6 w-full" />
            </div>
        )
    }

    const renderNode = (node: FolderNode, depth: number = 0) => {
        const hasChildren = node.children && node.children.length > 0
        const isExpanded = expandedIds.has(node.id)
        const isActive = currentFolderId === node.id

        return (
            <div key={node.id}>
                <div
                    className={cn(
                        'group flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors',
                        'hover:bg-accent cursor-pointer',
                        isActive && 'bg-accent font-medium'
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                    {hasChildren ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={(e) => {
                                e.preventDefault()
                                toggleExpand(node.id)
                            }}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                            ) : (
                                <ChevronRight className="h-3 w-3" />
                            )}
                        </Button>
                    ) : (
                        <span className="w-5" />
                    )}
                    <Link
                        href={`/prompts?folderId=${node.id}`}
                        className="flex items-center gap-2 flex-1 min-w-0"
                    >
                        {isExpanded ? (
                            <FolderOpen
                                className="h-4 w-4 shrink-0"
                                style={{ color: node.color || undefined }}
                            />
                        ) : (
                            <Folder
                                className="h-4 w-4 shrink-0"
                                style={{ color: node.color || undefined }}
                            />
                        )}
                        <span className="truncate">{node.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {node._count.prompts}
                        </span>
                    </Link>
                </div>
                {hasChildren && isExpanded && (
                    <div>
                        {node.children!.map((child) => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Folders
                </span>
            </div>
            <Link
                href="/prompts"
                className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors',
                    'hover:bg-accent',
                    !currentFolderId && pathname === '/prompts' && 'bg-accent font-medium'
                )}
            >
                <FileText className="h-4 w-4" />
                <span>All Prompts</span>
            </Link>
            {folders.map((folder) => renderNode(folder))}
        </div>
    )
}
