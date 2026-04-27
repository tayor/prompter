'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { KANBAN_COLUMN_LABELS } from '@/components/tasks/types'
import { KanbanTaskCard } from '@/components/tasks/KanbanTaskCard'
import type { KanbanTask } from '@/components/tasks/types'
import type { KanbanColumn as KanbanColumnType } from '@/lib/validators'

interface KanbanColumnProps {
    column: KanbanColumnType
    tasks: KanbanTask[]
    disabled?: boolean
    selectedTaskId?: string | null
    onSelectTask?: (task: KanbanTask) => void
}

export function KanbanColumn({
    column,
    tasks,
    disabled = false,
    selectedTaskId,
    onSelectTask,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: column,
        data: {
            type: 'column',
            column,
        },
    })

    return (
        <div className="w-80 min-w-80 rounded-xl border bg-muted/30">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">{KANBAN_COLUMN_LABELS[column]}</h3>
                <Badge variant="secondary">{tasks.length}</Badge>
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    'min-h-32 space-y-3 p-3 transition-colors',
                    isOver && 'bg-primary/5',
                )}
            >
                <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <KanbanTaskCard
                            key={task.id}
                            task={task}
                            disabled={disabled}
                            isSelected={task.id === selectedTaskId}
                            onSelect={onSelectTask}
                        />
                    ))}
                </SortableContext>

                {tasks.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Drop tasks here
                    </div>
                )}
            </div>
        </div>
    )
}
