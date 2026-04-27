'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
    value: number | null
    onChange?: (value: number | null) => void
    readonly?: boolean
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
}

const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
}

export function StarRating({
    value,
    onChange,
    readonly = false,
    size = 'md',
    showLabel = false
}: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null)

    const displayValue = hoverValue ?? value ?? 0

    const handleClick = (rating: number) => {
        if (readonly || !onChange) return
        // Clicking the same star clears the rating
        if (value === rating) {
            onChange(null)
        } else {
            onChange(rating)
        }
    }

    return (
        <div className="flex items-center gap-1">
            <div
                className={cn(
                    "flex items-center gap-0.5",
                    !readonly && "cursor-pointer"
                )}
                onMouseLeave={() => !readonly && setHoverValue(null)}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        disabled={readonly}
                        onClick={() => handleClick(star)}
                        onMouseEnter={() => !readonly && setHoverValue(star)}
                        className={cn(
                            "transition-colors focus:outline-none disabled:cursor-default",
                            !readonly && "hover:scale-110"
                        )}
                    >
                        <Star
                            className={cn(
                                sizeClasses[size],
                                star <= displayValue
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground/40'
                            )}
                        />
                    </button>
                ))}
            </div>
            {showLabel && value !== null && (
                <span className="text-xs text-muted-foreground ml-1">
                    ({value}/5)
                </span>
            )}
        </div>
    )
}
