'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp'
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts'
import { usePathname } from 'next/navigation'
import { Loader2, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function GlobalShortcuts() {
    useGlobalShortcuts()
    return null
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth()
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Show loading state
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Login page - no shell
    if (pathname === '/login') {
        return <>{children}</>
    }

    // Not authenticated - will redirect in AuthProvider
    if (!isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Authenticated - show full app shell
    return (
        <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Menu Button */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-3 left-3 z-50 md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
            >
                <Menu className="h-6 w-6" />
            </Button>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="relative h-full bg-background border-r">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <div onClick={() => setMobileMenuOpen(false)}>
                        <Sidebar />
                    </div>
                </div>
            </div>

            <main id="main-content" className="flex-1 overflow-auto pl-0 md:pl-0">
                {children}
            </main>
            <CommandPalette />
            <KeyboardShortcutsHelp />
            <GlobalShortcuts />
        </div>
    )
}

