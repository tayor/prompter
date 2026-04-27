'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface HistoryState<T> {
    past: T[]
    present: T
    future: T[]
}

interface UseUndoRedoReturn<T> {
    state: T
    set: (newState: T) => void
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    clear: () => void
}

/**
 * Custom hook for undo/redo functionality
 * @param initialState - The initial state value
 * @param maxHistory - Maximum history length (default: 50)
 */
export function useUndoRedo<T>(
    initialState: T,
    maxHistory: number = 50
): UseUndoRedoReturn<T> {
    const [history, setHistory] = useState<HistoryState<T>>({
        past: [],
        present: initialState,
        future: [],
    })

    // Debounce timer to avoid recording every keystroke
    const debounceTimer = useRef<NodeJS.Timeout | null>(null)
    const pendingState = useRef<T | null>(null)

    const set = useCallback((newState: T) => {
        // Clear pending debounce
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }

        // Store the pending state
        pendingState.current = newState

        // Update present immediately for UI responsiveness
        setHistory((prev) => ({
            ...prev,
            present: newState,
        }))

        // Debounce history recording to batch rapid changes
        debounceTimer.current = setTimeout(() => {
            setHistory((prev) => {
                const newPast = [...prev.past, prev.present].slice(-maxHistory)
                return {
                    past: newPast,
                    present: pendingState.current ?? newState,
                    future: [] // Clear future on new changes
                }
            })
            pendingState.current = null
        }, 500)
    }, [maxHistory])

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current)
            }
            pendingState.current = null
        }
    }, [])

    const undo = useCallback(() => {
        setHistory((prev) => {
            if (prev.past.length === 0) return prev

            const previous = prev.past[prev.past.length - 1]
            const newPast = prev.past.slice(0, -1)

            return {
                past: newPast,
                present: previous,
                future: [prev.present, ...prev.future].slice(0, maxHistory),
            }
        })
    }, [maxHistory])

    const redo = useCallback(() => {
        setHistory((prev) => {
            if (prev.future.length === 0) return prev

            const next = prev.future[0]
            const newFuture = prev.future.slice(1)

            return {
                past: [...prev.past, prev.present].slice(-maxHistory),
                present: next,
                future: newFuture,
            }
        })
    }, [maxHistory])

    const clear = useCallback(() => {
        setHistory((prev) => ({
            past: [],
            present: prev.present,
            future: [],
        }))
    }, [])

    return {
        state: history.present,
        set,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        clear,
    }
}

/**
 * Hook to add keyboard shortcuts for undo/redo
 */
export function useUndoRedoShortcuts(
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey

            if (isMod && e.key === 'z' && !e.shiftKey && canUndo) {
                e.preventDefault()
                undo()
            }

            if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) {
                e.preventDefault()
                redo()
            }
        },
        [undo, redo, canUndo, canRedo]
    )

    return { onKeyDown: handleKeyDown }
}
