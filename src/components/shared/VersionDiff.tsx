'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { GitCompare, ChevronDown, ChevronUp } from 'lucide-react'

interface VersionDiffProps {
    currentContent: string
    previousContent: string
    currentVersion: string
    previousVersion: string
}

interface DiffLine {
    type: 'added' | 'removed' | 'unchanged'
    content: string
    lineNumber: number
}

function computeSimpleDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const result: DiffLine[] = []
    let lineNumber = 1

    // Simple line-by-line comparison
    const maxLen = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i]
        const newLine = newLines[i]

        if (oldLine === undefined && newLine !== undefined) {
            result.push({ type: 'added', content: newLine, lineNumber: lineNumber++ })
        } else if (oldLine !== undefined && newLine === undefined) {
            result.push({ type: 'removed', content: oldLine, lineNumber: lineNumber++ })
        } else if (oldLine !== newLine) {
            result.push({ type: 'removed', content: oldLine!, lineNumber: lineNumber })
            result.push({ type: 'added', content: newLine!, lineNumber: lineNumber++ })
        } else {
            result.push({ type: 'unchanged', content: newLine!, lineNumber: lineNumber++ })
        }
    }

    return result
}

export function VersionDiff({
    currentContent,
    previousContent,
    currentVersion,
    previousVersion
}: VersionDiffProps) {
    const [expanded, setExpanded] = useState(false)
    const diff = computeSimpleDiff(previousContent, currentContent)

    const addedCount = diff.filter(d => d.type === 'added').length
    const removedCount = diff.filter(d => d.type === 'removed').length
    const hasChanges = addedCount > 0 || removedCount > 0

    if (!hasChanges) {
        return (
            <div className="text-sm text-muted-foreground text-center py-4">
                No differences between versions
            </div>
        )
    }

    return (
        <Card className="border-dashed">
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <GitCompare className="h-4 w-4" />
                        <span className="font-medium text-sm">Changes from {previousVersion} to {currentVersion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                            +{addedCount}
                        </Badge>
                        <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                            -{removedCount}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="pt-0">
                    <div className="font-mono text-sm bg-muted rounded-md overflow-auto max-h-96">
                        {diff.map((line, idx) => (
                            <div
                                key={idx}
                                className={`px-3 py-0.5 ${line.type === 'added'
                                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                        : line.type === 'removed'
                                            ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                                            : ''
                                    }`}
                            >
                                <span className="select-none text-muted-foreground w-6 inline-block">
                                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                </span>
                                <span className="whitespace-pre-wrap">{line.content || ' '}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
