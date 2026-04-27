'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface VariableHighlighterProps {
    content: string
    className?: string
    onVariableClick?: (variableName: string) => void
    variables?: Record<string, string> // Optional: provide values to show tooltips
}

/**
 * Component that highlights {{variables}} in text content
 * Variables are displayed as interactive pills with optional tooltips
 */
export function VariableHighlighter({
    content,
    className,
    onVariableClick,
    variables,
}: VariableHighlighterProps) {
    // Parse content and split into text and variable segments
    const segments = React.useMemo(() => {
        const result: Array<{ type: 'text' | 'variable'; content: string; variableName?: string }> = []
        const regex = /\{\{([^}]+)\}\}/g
        let lastIndex = 0
        let match

        while ((match = regex.exec(content)) !== null) {
            // Add text before the variable
            if (match.index > lastIndex) {
                result.push({
                    type: 'text',
                    content: content.slice(lastIndex, match.index),
                })
            }

            // Add the variable
            result.push({
                type: 'variable',
                content: match[0],
                variableName: match[1].trim(),
            })

            lastIndex = match.index + match[0].length
        }

        // Add remaining text
        if (lastIndex < content.length) {
            result.push({
                type: 'text',
                content: content.slice(lastIndex),
            })
        }

        return result
    }, [content])

    return (
        <span className={cn('whitespace-pre-wrap', className)}>
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                    return <span key={index}>{segment.content}</span>
                }

                const variableName = segment.variableName!
                const hasValue = variables && variables[variableName] !== undefined
                const value = hasValue ? variables[variableName] : undefined

                return (
                    <VariablePill
                        key={index}
                        name={variableName}
                        value={value}
                        onClick={onVariableClick ? () => onVariableClick(variableName) : undefined}
                    />
                )
            })}
        </span>
    )
}

interface VariablePillProps {
    name: string
    value?: string
    onClick?: () => void
}

function VariablePill({ name, value, onClick }: VariablePillProps) {
    const hasValue = value !== undefined

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-sm font-mono',
                'transition-all duration-200 border',
                hasValue
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 dark:shadow-emerald-500/20 dark:shadow-sm'
                    : 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40 dark:shadow-violet-500/20 dark:shadow-sm',
                onClick && 'cursor-pointer hover:scale-105 hover:shadow-md'
            )}
            onClick={onClick}
            title={hasValue ? `${name} = "${value}"` : `Variable: ${name}`}
        >
            <span className="opacity-50">{'{'}</span>
            <span className="opacity-50">{'{'}</span>
            <span className="font-semibold px-0.5">{name}</span>
            <span className="opacity-50">{'}'}</span>
            <span className="opacity-50">{'}'}</span>
        </span>
    )
}

/**
 * Extract unique variable names from content
 */
export function extractVariableNames(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g
    const variables = new Set<string>()
    let match

    while ((match = regex.exec(content)) !== null) {
        variables.add(match[1].trim())
    }

    return Array.from(variables)
}

/**
 * Higher-order component to show variable count badge
 */
export function VariableCount({ content }: { content: string }) {
    const count = extractVariableNames(content).length

    if (count === 0) return null

    return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            {count} variable{count !== 1 ? 's' : ''}
        </span>
    )
}
