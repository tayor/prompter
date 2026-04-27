'use client'

import { useEffect } from 'react'

/**
 * Hook to announce dynamic content changes to screen readers
 */
export function useAnnounce() {
    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const region = document.getElementById(`sr-${priority}`)
        if (region) {
            region.textContent = message
            // Clear after announcement
            setTimeout(() => {
                region.textContent = ''
            }, 1000)
        }
    }

    return { announce }
}

/**
 * Component that provides live regions for screen reader announcements
 * Include this once in your app layout
 */
export function ScreenReaderAnnouncer() {
    return (
        <>
            {/* Polite announcements - queued after current speech */}
            <div
                id="sr-polite"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            />
            {/* Assertive announcements - interrupt current speech */}
            <div
                id="sr-assertive"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="sr-only"
            />
        </>
    )
}

/**
 * Hook to trap focus within an element (for modals, dialogs)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
    useEffect(() => {
        if (!isActive || !containerRef.current) return

        const container = containerRef.current
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault()
                    lastElement?.focus()
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault()
                    firstElement?.focus()
                }
            }
        }

        container.addEventListener('keydown', handleKeyDown)
        firstElement?.focus()

        return () => {
            container.removeEventListener('keydown', handleKeyDown)
        }
    }, [containerRef, isActive])
}

/**
 * Skip to main content link component
 */
export function SkipToMain() {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded-md focus:shadow-lg"
        >
            Skip to main content
        </a>
    )
}
