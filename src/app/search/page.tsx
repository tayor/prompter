'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TagBadge } from '@/components/shared/TagBadge'
import { ModelBadge } from '@/components/shared/ModelBadge'
import { Search as SearchIcon, FileText, Star, Clock, Bookmark, X } from 'lucide-react'
import Link from 'next/link'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { useSearchHistory } from '@/hooks/useSearchHistory'

interface Prompt {
    id: string
    title: string
    content: string
    description: string | null
    aiModel: string | null
    isFavorite: boolean
    updatedAt: string
    folder: { name: string; color: string | null } | null
    tags: Array<{ tag: { id: string; name: string; color: string | null } }>
}

interface SearchResults {
    prompts: Prompt[]
    pagination: { total: number }
}

export default function SearchPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Prompt[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [total, setTotal] = useState(0)
    const [showDropdown, setShowDropdown] = useState(false)
    const [saveDialogOpen, setSaveDialogOpen] = useState(false)
    const [saveName, setSaveName] = useState('')

    const {
        history,
        savedSearches,
        addToHistory,
        clearHistory,
        saveSearch,
        deleteSavedSearch,
    } = useSearchHistory()

    const performSearch = useDebouncedCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([])
            setSearched(false)
            return
        }

        setLoading(true)
        setSearched(true)
        setShowDropdown(false)

        try {
            const res = await fetch(`/api/prompts?q=${encodeURIComponent(searchQuery)}&limit=50`)
            const data: SearchResults = await res.json()
            setResults(data.prompts)
            setTotal(data.pagination.total)
            // Add to history after successful search
            addToHistory(searchQuery)
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setLoading(false)
        }
    }, 300)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setQuery(value)
        performSearch(value)
    }

    const handleHistoryClick = (q: string) => {
        setQuery(q)
        performSearch(q)
        setShowDropdown(false)
    }

    const handleSaveSearch = () => {
        if (query.trim() && saveName.trim()) {
            saveSearch(query, saveName)
            setSaveDialogOpen(false)
            setSaveName('')
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Search" />
            <div className="flex-1 p-6 space-y-6">
                {/* Search Input */}
                <div className="relative max-w-2xl">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Input
                        type="search"
                        placeholder="Search prompts by title, content, or description..."
                        value={query}
                        onChange={handleInputChange}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        className="pl-12 pr-10 h-12 text-lg"
                        autoFocus
                    />
                    {query && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                            onClick={() => setSaveDialogOpen(true)}
                            title="Save this search"
                        >
                            <Bookmark className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Search Dropdown */}
                    {showDropdown && !searched && (savedSearches.length > 0 || history.length > 0) && (
                        <Card className="absolute top-full mt-1 w-full z-20 shadow-lg">
                            <CardContent className="p-2">
                                {savedSearches.length > 0 && (
                                    <div className="mb-2">
                                        <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                                            <Bookmark className="h-3 w-3" />
                                            Saved Searches
                                        </div>
                                        {savedSearches.slice(0, 5).map((s) => (
                                            <div
                                                key={s.id}
                                                className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer group"
                                                onClick={() => handleHistoryClick(s.query)}
                                            >
                                                <span className="text-sm">{s.name}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteSavedSearch(s.id)
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {history.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground">
                                            <span className="flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                Recent Searches
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 text-xs"
                                                onClick={clearHistory}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                        {history.slice(0, 5).map((q, idx) => (
                                            <div
                                                key={idx}
                                                className="px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer text-sm"
                                                onClick={() => handleHistoryClick(q)}
                                            >
                                                {q}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Save Dialog */}
                    {saveDialogOpen && (
                        <Card className="absolute top-full mt-1 w-full z-20 shadow-lg">
                            <CardContent className="p-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Name this search..."
                                        value={saveName}
                                        onChange={(e) => setSaveName(e.target.value)}
                                        autoFocus
                                    />
                                    <Button size="sm" onClick={handleSaveSearch}>Save</Button>
                                    <Button size="sm" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Results */}
                {loading ? (
                    <div className="space-y-4 max-w-2xl">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-5 w-3/4 mb-2" />
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-2/3" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : searched && results.length === 0 ? (
                    <EmptyState
                        type="search"
                        title="No results found"
                        description={`No prompts match "${query}". Try different keywords.`}
                    />
                ) : searched ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Found {total} result{total !== 1 ? 's' : ''} for &quot;{query}&quot;
                        </p>
                        <div className="space-y-3 max-w-2xl">
                            {results.map((prompt) => (
                                <Link key={prompt.id} href={`/prompts/${prompt.id}`}>
                                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                        <h3 className="font-semibold truncate">{prompt.title}</h3>
                                                        {prompt.isFavorite && (
                                                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                        {highlightMatch(prompt.description || prompt.content.slice(0, 150), query)}
                                                    </p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {prompt.aiModel && <ModelBadge model={prompt.aiModel} />}
                                                        {prompt.folder && (
                                                            <Badge variant="outline">{prompt.folder.name}</Badge>
                                                        )}
                                                        {prompt.tags.slice(0, 2).map(({ tag }) => (
                                                            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                                    {new Date(prompt.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <SearchIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p>Start typing to search your prompts</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query) return text

    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
                {part}
            </mark>
        ) : (
            part
        )
    )
}
