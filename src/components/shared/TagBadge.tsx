import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface TagBadgeProps {
    name: string
    color?: string | null
    className?: string
    onClick?: () => void
    removable?: boolean
    onRemove?: () => void
}

export function TagBadge({
    name,
    color,
    className,
    onClick,
    removable,
    onRemove,
}: TagBadgeProps) {
    return (
        <Badge
            variant="secondary"
            className={cn(
                'cursor-default transition-colors',
                onClick && 'cursor-pointer hover:bg-secondary/80',
                className
            )}
            style={color ? { backgroundColor: `${color}20`, borderColor: color, color } : undefined}
            onClick={onClick}
        >
            {name}
            {removable && (
                <button
                    type="button"
                    className="ml-1 rounded-full outline-none hover:bg-foreground/20"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove?.()
                    }}
                >
                    ×
                </button>
            )}
        </Badge>
    )
}
