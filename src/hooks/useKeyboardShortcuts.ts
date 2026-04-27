'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutConfig {
    key: string
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    action: () => void
    description: string
    scope?: 'global' | 'editor' | 'list'
}

// Check if user is currently typing in an input field
function isTyping(): boolean {
    const activeElement = document.activeElement
    if (!activeElement) return false

    const tagName = activeElement.tagName.toLowerCase()
    if (tagName === 'input' || tagName === 'textarea') return true
    if ((activeElement as HTMLElement).contentEditable === 'true') return true

    return false
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if user is typing (unless the shortcut requires ctrl/cmd)
        const inTypingContext = isTyping()

        for (const shortcut of shortcuts) {
            const ctrlMatch = shortcut.ctrl
                ? (e.ctrlKey || e.metaKey)
                : !(e.ctrlKey || e.metaKey)
            const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
            const altMatch = shortcut.alt ? e.altKey : !e.altKey
            const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

            if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
                // Only block typing shortcuts if they require modifier keys
                if (inTypingContext && !shortcut.ctrl && !shortcut.alt) {
                    continue
                }

                e.preventDefault()
                shortcut.action()
                return
            }
        }
    }, [shortcuts])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}

// Global shortcuts configuration
export function useGlobalShortcuts() {
    const router = useRouter()

    const shortcuts: ShortcutConfig[] = [
        {
            key: 'n',
            ctrl: true,
            description: 'Create new prompt',
            scope: 'global',
            action: () => router.push('/prompts/new'),
        },
        {
            key: 'n',
            ctrl: true,
            shift: true,
            description: 'Create new workflow',
            scope: 'global',
            action: () => router.push('/workflows/new'),
        },
        {
            key: '/',
            ctrl: true,
            description: 'Focus search',
            scope: 'global',
            action: () => {
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
                if (searchInput) searchInput.focus()
            },
        },
    ]

    useKeyboardShortcuts(shortcuts)

    return shortcuts
}

// Shortcuts for prompt list page
export function usePromptListShortcuts(callbacks: {
    onNavigateDown?: () => void
    onNavigateUp?: () => void
    onOpenSelected?: () => void
    onCopySelected?: () => void
    onToggleFavorite?: () => void
}) {
    const shortcuts: ShortcutConfig[] = [
        {
            key: 'j',
            description: 'Select next prompt',
            scope: 'list',
            action: () => callbacks.onNavigateDown?.(),
        },
        {
            key: 'k',
            description: 'Select previous prompt',
            scope: 'list',
            action: () => callbacks.onNavigateUp?.(),
        },
        {
            key: 'ArrowDown',
            description: 'Select next prompt',
            scope: 'list',
            action: () => callbacks.onNavigateDown?.(),
        },
        {
            key: 'ArrowUp',
            description: 'Select previous prompt',
            scope: 'list',
            action: () => callbacks.onNavigateUp?.(),
        },
        {
            key: 'Enter',
            description: 'Open selected prompt',
            scope: 'list',
            action: () => callbacks.onOpenSelected?.(),
        },
        {
            key: 'c',
            description: 'Copy selected prompt',
            scope: 'list',
            action: () => callbacks.onCopySelected?.(),
        },
        {
            key: 'f',
            description: 'Toggle favorite on selected',
            scope: 'list',
            action: () => callbacks.onToggleFavorite?.(),
        },
    ]

    useKeyboardShortcuts(shortcuts)

    return shortcuts
}

// All shortcuts for help modal
export const ALL_SHORTCUTS = [
    { key: '⌘K', description: 'Open command palette', category: 'Global' },
    { key: '⌘N', description: 'Create new prompt', category: 'Global' },
    { key: '⌘⇧N', description: 'Create new workflow', category: 'Global' },
    { key: '⌘/', description: 'Focus search', category: 'Global' },
    { key: '?', description: 'Show keyboard shortcuts', category: 'Global' },
    { key: '⌘⇧P', description: 'Toggle preview mode', category: 'Editor' },
    { key: '⌘S', description: 'Save prompt/workflow', category: 'Editor' },
    { key: 'J/↓', description: 'Navigate down in list', category: 'List' },
    { key: 'K/↑', description: 'Navigate up in list', category: 'List' },
    { key: 'Enter', description: 'Open selected item', category: 'List' },
    { key: 'C', description: 'Copy selected prompt', category: 'List' },
    { key: 'F', description: 'Toggle favorite', category: 'List' },
]
