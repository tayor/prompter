'use client'

import { useMemo } from 'react'
import { FileText, Hash, Coins } from 'lucide-react'

interface PromptStatsProps {
    content: string
    aiModel?: string | null
}

// Token limits for common AI models (approximate)
const MODEL_TOKEN_LIMITS: Record<string, number> = {
    'gpt-4': 8192,
    'gpt-4o': 128000,
    'gpt-3.5-turbo': 4096,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'gemini-pro': 32768,
}

// Estimate tokens (roughly 4 characters per token for English)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

export function PromptStats({ content, aiModel }: PromptStatsProps) {
    const stats = useMemo(() => {
        const charCount = content.length
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
        const tokenEstimate = estimateTokens(content)
        const modelLimit = aiModel ? MODEL_TOKEN_LIMITS[aiModel] : null

        let tokenStatus: 'safe' | 'warning' | 'danger' = 'safe'
        let tokenPercentage: number | null = null

        if (modelLimit) {
            tokenPercentage = (tokenEstimate / modelLimit) * 100
            if (tokenPercentage >= 80) {
                tokenStatus = 'danger'
            } else if (tokenPercentage >= 50) {
                tokenStatus = 'warning'
            }
        }

        return { charCount, wordCount, tokenEstimate, modelLimit, tokenStatus, tokenPercentage }
    }, [content, aiModel])

    const tokenColor = {
        safe: 'text-green-600 dark:text-green-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        danger: 'text-red-600 dark:text-red-400',
    }[stats.tokenStatus]

    return (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t mt-4">
            <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{stats.charCount.toLocaleString()} chars</span>
            </div>
            <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span>{stats.wordCount.toLocaleString()} words</span>
            </div>
            <div className={`flex items-center gap-1 ${tokenColor}`}>
                <Coins className="h-3 w-3" />
                <span>~{stats.tokenEstimate.toLocaleString()} tokens</span>
                {stats.tokenPercentage !== null && (
                    <span className="ml-1">
                        ({stats.tokenPercentage.toFixed(0)}% of {aiModel})
                    </span>
                )}
            </div>
        </div>
    )
}
