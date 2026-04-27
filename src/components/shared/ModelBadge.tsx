import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const modelColors: Record<string, string> = {
    'gpt-4': '#10a37f',
    'gpt-4o': '#10a37f',
    'gpt-3.5-turbo': '#10a37f',
    'claude-3': '#cc785c',
    'claude-3-opus': '#cc785c',
    'claude-3-sonnet': '#cc785c',
    'claude-3-haiku': '#cc785c',
    'gemini': '#4285f4',
    'gemini-pro': '#4285f4',
    'gemini-ultra': '#4285f4',
    'llama': '#0084ff',
    'mistral': '#ff7000',
    default: '#6b7280',
}

interface ModelBadgeProps {
    model: string
    className?: string
}

export function ModelBadge({ model, className }: ModelBadgeProps) {
    const normalizedModel = model.toLowerCase()
    let color = modelColors.default

    for (const [key, value] of Object.entries(modelColors)) {
        if (normalizedModel.includes(key)) {
            color = value
            break
        }
    }

    return (
        <Badge
            variant="outline"
            className={cn('font-mono text-xs', className)}
            style={{ borderColor: color, color }}
        >
            {model}
        </Badge>
    )
}
