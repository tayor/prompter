'use client'

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'prompter-search-history'
const SAVED_SEARCHES_KEY = 'prompter-saved-searches'
const MAX_HISTORY = 10

interface SavedSearch {
    id: string
    name: string
    query: string
    createdAt: string
}

// Helper to safely get from localStorage (handles SSR)
function getStoredHistory(): string[] {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

function getStoredSavedSearches(): SavedSearch[] {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(SAVED_SEARCHES_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

export function useSearchHistory() {
    // Use lazy initialization to load from localStorage
    const [history, setHistory] = useState<string[]>(getStoredHistory)
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(getStoredSavedSearches)

    // Add to history
    const addToHistory = useCallback((query: string) => {
        if (!query.trim()) return

        setHistory((prev) => {
            // Remove duplicates and add to front
            const filtered = prev.filter((q) => q.toLowerCase() !== query.toLowerCase())
            const newHistory = [query, ...filtered].slice(0, MAX_HISTORY)

            // Persist
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
            return newHistory
        })
    }, [])

    // Clear history
    const clearHistory = useCallback(() => {
        setHistory([])
        localStorage.removeItem(STORAGE_KEY)
    }, [])

    // Save a search
    const saveSearch = useCallback((query: string, name: string) => {
        if (!query.trim() || !name.trim()) return

        const newSearch: SavedSearch = {
            id: Date.now().toString(),
            name,
            query,
            createdAt: new Date().toISOString(),
        }

        setSavedSearches((prev) => {
            const newSearches = [newSearch, ...prev]
            localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSearches))
            return newSearches
        })

        return newSearch
    }, [])

    // Delete saved search
    const deleteSavedSearch = useCallback((id: string) => {
        setSavedSearches((prev) => {
            const newSearches = prev.filter((s) => s.id !== id)
            localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSearches))
            return newSearches
        })
    }, [])

    // Rename saved search
    const renameSavedSearch = useCallback((id: string, name: string) => {
        setSavedSearches((prev) => {
            const newSearches = prev.map((s) => (s.id === id ? { ...s, name } : s))
            localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSearches))
            return newSearches
        })
    }, [])

    return {
        history,
        savedSearches,
        addToHistory,
        clearHistory,
        saveSearch,
        deleteSavedSearch,
        renameSavedSearch,
    }
}
