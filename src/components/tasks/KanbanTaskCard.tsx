'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { KanbanTask } from '@/components/tasks/types'

interface KanbanTaskCardProps {
    task: KanbanTask
    disabled?: boolean
    isSelected?: boolean
    onSelect?: (task: KanbanTask) => void
}

interface KanbanTaskCardPreviewProps {
    task: KanbanTask
    isSelected?: boolean
}

function TaskCardBody({ task, isSelected, dragging }: { task: KanbanTask, isSelected?: boolean, dragging?: boolean }) {
    const latestExecution = task.latestExecution ?? null
    const durationLabel = latestExecution?.durationMs != null
        ? formatDuration(latestExecution.durationMs)
        : null
    const statusLabel = latestExecution ? EXECUTION_STATUS_LABELS[latestExecution.status] : null

    return (
        <div
            className={cn(
                'rounded-lg border bg-card p-3 shadow-sm transition-shadow',
                'hover:shadow-md',
                isSelected && 'ring-2 ring-primary',
                dragging && 'opacity-70',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">{task.displayName || task.name}</h4>
                    <p className="truncate text-xs text-muted-foreground">{task.sourcePath}</p>
                </div>
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {task.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
            )}

            <div className="mt-2 flex items-center gap-2">
                {task.dependencies.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                        {task.dependencies.length} deps
                    </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                    #{task.position + 1}
                </Badge>
            </div>

            {latestExecution && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                        variant={getExecutionStatusVariant(latestExecution.status)}
                        className="text-[10px]"
                    >
                        {statusLabel}
                    </Badge>
                    {durationLabel && (
                        <Badge variant="outline" className="text-[10px]">
                            {durationLabel}
                        </Badge>
                    )}
                    {latestExecution.exitCode !== null && (
                        <Badge
                            variant={latestExecution.exitCode === 0 ? 'secondary' : 'destructive'}
                            className="text-[10px]"
                        >
                            exit {latestExecution.exitCode}
                        </Badge>
                    )}
                </div>
            )}
        </div>
    )
}

export function KanbanTaskCard({ task, disabled = false, isSelected = false, onSelect }: KanbanTaskCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        disabled,
        data: {
            type: 'task',
            task,
        },
    })

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn('touch-none', !disabled && 'cursor-grab active:cursor-grabbing')}
            aria-label={`Task: ${task.name}`}
            onClick={() => onSelect?.(task)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(task) } }}
            {...attributes}
            {...listeners}
        >
            <TaskCardBody task={task} isSelected={isSelected} dragging={isDragging} />
        </div>
    )
}

export function KanbanTaskCardPreview({ task, isSelected = false }: KanbanTaskCardPreviewProps) {
    return <TaskCardBody task={task} isSelected={isSelected} dragging />
}

const EXECUTION_STATUS_LABELS: Record<NonNullable<KanbanTask['latestExecution']>['status'], string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
}

function getExecutionStatusVariant(status: NonNullable<KanbanTask['latestExecution']>['status']) {
    switch (status) {
        case 'completed':
            return 'secondary'
        case 'failed':
            return 'destructive'
        case 'running':
            return 'default'
        case 'cancelled':
            return 'outline'
        case 'pending':
        default:
            return 'outline'
    }
}

function formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(Math.round(durationMs / 1000), 0)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
}
