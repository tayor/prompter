'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ALL_SHORTCUTS } from '@/hooks/useKeyboardShortcuts'

export function KeyboardShortcutsHelp() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                const activeElement = document.activeElement
                const tagName = activeElement?.tagName.toLowerCase()
                if (tagName === 'input' || tagName === 'textarea') return

                e.preventDefault()
                setOpen(true)
            }

            if (e.key === 'Escape' && open) {
                setOpen(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open])

    const groupedShortcuts = ALL_SHORTCUTS.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) {
            acc[shortcut.category] = []
        }
        acc[shortcut.category].push(shortcut)
        return acc
    }, {} as Record<string, typeof ALL_SHORTCUTS>)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                    {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                        <div key={category}>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                                {category}
                            </h4>
                            <div className="space-y-2">
                                {shortcuts.map((shortcut, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-1"
                                    >
                                        <span className="text-sm">{shortcut.description}</span>
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {shortcut.key}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd> to toggle this dialog
                </p>
            </DialogContent>
        </Dialog>
    )
}
