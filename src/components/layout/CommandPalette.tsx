'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import { OPEN_COMMAND_PALETTE_EVENT } from '@/components/layout/command-palette-events'
import {
    FileText,
    Workflow,
    Folder,
    Tag,
    Search,
    Settings,
    Plus,
    Home,
    Star,
    Clock,
} from 'lucide-react'

interface SearchResult {
    id: string
    title: string
    type: 'prompt' | 'workflow'
    description?: string | null
    isFavorite?: boolean
}

const commands = [
    {
        group: 'Quick Actions',
        items: [
            { label: 'Create New Prompt', icon: Plus, href: '/prompts/new' },
            { label: 'Create New Workflow', icon: Plus, href: '/workflows/new' },
        ],
    },
    {
        group: 'Navigation',
        items: [
            { label: 'Dashboard', icon: Home, href: '/' },
            { label: 'All Prompts', icon: FileText, href: '/prompts' },
            { label: 'All Workflows', icon: Workflow, href: '/workflows' },
            { label: 'Folders', icon: Folder, href: '/folders' },
            { label: 'Tags', icon: Tag, href: '/tags' },
            { label: 'Favorites', icon: Star, href: '/prompts?isFavorite=true' },
            { label: 'Analytics', icon: Clock, href: '/analytics' },
            { label: 'Search', icon: Search, href: '/search' },
            { label: 'Settings', icon: Settings, href: '/settings' },
        ],
    },
]

export function CommandPalette() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const latestSearchRequestIdRef = useRef(0)

    useEffect(() => {
        const handleToggleShortcut = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((current) => !current)
            }
        }
        const handleOpenEvent = () => {
            setOpen(true)
        }

        document.addEventListener('keydown', handleToggleShortcut)
        window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent)

        return () => {
            document.removeEventListener('keydown', handleToggleShortcut)
            window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent)
        }
    }, [])

    // Search when query changes
    useEffect(() => {
        if (!query || query.length < 2) {
            latestSearchRequestIdRef.current += 1
            setResults([])
            setLoading(false)
            return
        }

        const requestId = latestSearchRequestIdRef.current + 1
        latestSearchRequestIdRef.current = requestId
        const controller = new AbortController()
        const searchTimeout = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`, {
                    signal: controller.signal,
                })
                if (res.ok) {
                    const data = await res.json()
                    const combined: SearchResult[] = [
                        ...(data.prompts || []).map((p: { id: string; title: string; description?: string | null; isFavorite?: boolean }) => ({
                            id: p.id,
                            title: p.title,
                            type: 'prompt' as const,
                            description: p.description,
                            isFavorite: p.isFavorite,
                        })),
                        ...(data.workflows || []).map((w: { id: string; name: string; description?: string | null; isFavorite?: boolean }) => ({
                            id: w.id,
                            title: w.name,
                            type: 'workflow' as const,
                            description: w.description,
                            isFavorite: w.isFavorite,
                        })),
                    ]
                    if (requestId === latestSearchRequestIdRef.current) {
                        setResults(combined)
                    }
                }
            } catch {
                // Ignore aborted requests
            } finally {
                if (requestId === latestSearchRequestIdRef.current) {
                    setLoading(false)
                }
            }
        }, 300)

        return () => {
            clearTimeout(searchTimeout)
            controller.abort()
        }
    }, [query])

    // Reset query when dialog closes
    useEffect(() => {
        if (!open) {
            latestSearchRequestIdRef.current += 1
            setQuery('')
            setResults([])
            setLoading(false)
        }
    }, [open])

    const runCommand = useCallback(
        (href: string) => {
            setOpen(false)
            router.push(href)
        },
        [router]
    )

    const hasQuery = query.length >= 2
    const showResults = hasQuery && results.length > 0

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput
                placeholder="Search prompts, workflows, or type a command..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>
                    {loading ? 'Searching...' : hasQuery ? 'No results found.' : 'Start typing to search...'}
                </CommandEmpty>

                {/* Search Results */}
                {showResults && (
                    <>
                        <CommandGroup heading="Search Results">
                            {results.map((result) => (
                                <CommandItem
                                    key={`${result.type}-${result.id}`}
                                    onSelect={() => runCommand(
                                        result.type === 'prompt'
                                            ? `/prompts/${result.id}`
                                            : `/workflows/${result.id}`
                                    )}
                                    className="cursor-pointer"
                                >
                                    {result.type === 'prompt' ? (
                                        <FileText className="mr-2 h-4 w-4" />
                                    ) : (
                                        <Workflow className="mr-2 h-4 w-4" />
                                    )}
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="flex items-center gap-2">
                                            {result.title}
                                            {result.isFavorite && (
                                                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                            )}
                                        </span>
                                        {result.description && (
                                            <span className="text-xs text-muted-foreground truncate">
                                                {result.description}
                                            </span>
                                        )}
                                    </div>
                                    <span className="ml-auto text-xs text-muted-foreground capitalize">
                                        {result.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="">
                            <CommandItem
                                onSelect={() => runCommand(`/search?q=${encodeURIComponent(query)}`)}
                                className="cursor-pointer"
                            >
                                <Search className="mr-2 h-4 w-4" />
                                <span>Search for &quot;{query}&quot;</span>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}

                {/* Commands (shown when no search query) */}
                {!hasQuery && commands.map((group, index) => (
                    <div key={group.group}>
                        <CommandGroup heading={group.group}>
                            {group.items.map((item) => (
                                <CommandItem
                                    key={item.href}
                                    onSelect={() => runCommand(item.href)}
                                    className="cursor-pointer"
                                >
                                    <item.icon className="mr-2 h-4 w-4" />
                                    <span>{item.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {index < commands.length - 1 && <CommandSeparator />}
                    </div>
                ))}
            </CommandList>
        </CommandDialog>
    )
}
