'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KANBAN_COLUMNS } from '@/components/tasks/types'
import { KanbanTaskCardPreview } from '@/components/tasks/KanbanTaskCard'
import { KanbanColumn } from '@/components/tasks/KanbanColumn'
import type { KanbanTask } from '@/components/tasks/types'
import type { KanbanColumn as KanbanColumnType } from '@/lib/validators'

interface ColumnState {
    [key: string]: KanbanTask[]
}

export interface MoveTaskPayload {
    taskId: string
    fromColumn: KanbanColumnType
    toColumn: KanbanColumnType
    position: number
}

interface KanbanBoardProps {
    tasks: KanbanTask[]
    disabled?: boolean
    selectedTaskId?: string | null
    onSelectTask?: (task: KanbanTask) => void
    onMoveTask: (payload: MoveTaskPayload) => Promise<void>
    onReorderQueued: (taskIdsInOrder: string[]) => Promise<void>
}

function buildColumns(tasks: KanbanTask[]): ColumnState {
    const columns: ColumnState = {
        backlog: [],
        queued: [],
        running: [],
        completed: [],
        failed: [],
        paused: [],
    }

    for (const task of tasks) {
        columns[task.column].push(task)
    }

    for (const column of KANBAN_COLUMNS) {
        columns[column].sort((left, right) => left.position - right.position)
    }

    return columns
}

function findTaskColumn(columns: ColumnState, taskId: string): KanbanColumnType | null {
    for (const column of KANBAN_COLUMNS) {
        if (columns[column].some((task) => task.id === taskId)) {
            return column
        }
    }

    return null
}

function findTaskById(columns: ColumnState, taskId: string): KanbanTask | null {
    for (const column of KANBAN_COLUMNS) {
        const task = columns[column].find((item) => item.id === taskId)
        if (task) {
            return task
        }
    }

    return null
}

function resolveOverColumn(columns: ColumnState, overId: string): KanbanColumnType | null {
    if (KANBAN_COLUMNS.includes(overId as KanbanColumnType)) {
        return overId as KanbanColumnType
    }

    return findTaskColumn(columns, overId)
}

export function KanbanBoard({
    tasks,
    disabled = false,
    selectedTaskId,
    onSelectTask,
    onMoveTask,
    onReorderQueued,
}: KanbanBoardProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    )
    const [columns, setColumns] = useState<ColumnState>(buildColumns(tasks))
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
    const dragStartStateRef = useRef<ColumnState | null>(null)

    useEffect(() => {
        setColumns(buildColumns(tasks))
    }, [tasks])

    const activeTask = useMemo(() => {
        if (!activeTaskId) {
            return null
        }

        return findTaskById(columns, activeTaskId)
    }, [activeTaskId, columns])

    const handleDragStart = (event: DragStartEvent) => {
        if (disabled) {
            return
        }

        const taskId = String(event.active.id)
        dragStartStateRef.current = columns
        setActiveTaskId(taskId)
    }

    const handleDragOver = (event: DragOverEvent) => {
        if (disabled || !event.over) {
            return
        }

        const activeId = String(event.active.id)
        const overId = String(event.over.id)

        setColumns((previous) => {
            const activeColumn = findTaskColumn(previous, activeId)
            const overColumn = resolveOverColumn(previous, overId)

            if (!activeColumn || !overColumn) {
                return previous
            }

            const activeTasks = previous[activeColumn]
            const activeIndex = activeTasks.findIndex((task) => task.id === activeId)
            if (activeIndex < 0) {
                return previous
            }

            if (activeColumn === overColumn) {
                if (activeColumn !== 'queued') {
                    return previous
                }

                if (overId === activeId) {
                    return previous
                }

                const overIndex = overId === overColumn
                    ? activeTasks.length - 1
                    : activeTasks.findIndex((task) => task.id === overId)

                if (overIndex < 0 || overIndex === activeIndex) {
                    return previous
                }

                return {
                    ...previous,
                    [activeColumn]: arrayMove(activeTasks, activeIndex, overIndex),
                }
            }

            const nextActiveTasks = [...activeTasks]
            const [movedTask] = nextActiveTasks.splice(activeIndex, 1)
            if (!movedTask) {
                return previous
            }

            const overTasks = [...previous[overColumn]]
            const overIndex = overId === overColumn
                ? overTasks.length
                : overTasks.findIndex((task) => task.id === overId)

            const insertionIndex = overIndex < 0 ? overTasks.length : overIndex
            overTasks.splice(insertionIndex, 0, {
                ...movedTask,
                column: overColumn,
            })

            return {
                ...previous,
                [activeColumn]: nextActiveTasks,
                [overColumn]: overTasks,
            }
        })
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const dragStartColumns = dragStartStateRef.current
        const activeId = String(event.active.id)
        setActiveTaskId(null)
        dragStartStateRef.current = null

        if (!dragStartColumns) {
            return
        }

        if (!event.over || disabled) {
            setColumns(dragStartColumns)
            return
        }

        const fromColumn = findTaskColumn(dragStartColumns, activeId)
        const toColumn = findTaskColumn(columns, activeId)
        if (!fromColumn || !toColumn) {
            setColumns(dragStartColumns)
            return
        }

        const fromIndex = dragStartColumns[fromColumn].findIndex((task) => task.id === activeId)
        const toIndex = columns[toColumn].findIndex((task) => task.id === activeId)

        if (fromIndex < 0 || toIndex < 0) {
            setColumns(dragStartColumns)
            return
        }

        if (fromColumn === toColumn && fromIndex === toIndex) {
            return
        }

        try {
            if (fromColumn === toColumn) {
                if (toColumn !== 'queued') {
                    setColumns(dragStartColumns)
                    return
                }

                await onReorderQueued(columns.queued.map((task) => task.id))
                return
            }

            await onMoveTask({
                taskId: activeId,
                fromColumn,
                toColumn,
                position: toIndex,
            })
        } catch {
            setColumns(dragStartColumns)
        }
    }

    const handleDragCancel = () => {
        const dragStartColumns = dragStartStateRef.current
        setActiveTaskId(null)
        dragStartStateRef.current = null

        if (dragStartColumns) {
            setColumns(dragStartColumns)
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={(event) => void handleDragEnd(event)}
        >
            <ScrollArea className="w-full">
                <div className="flex min-w-full gap-4 pb-2">
                    {KANBAN_COLUMNS.map((column) => (
                        <KanbanColumn
                            key={column}
                            column={column}
                            tasks={columns[column]}
                            disabled={disabled}
                            selectedTaskId={selectedTaskId}
                            onSelectTask={onSelectTask}
                        />
                    ))}
                </div>
            </ScrollArea>
            <DragOverlay>
                {activeTask ? <KanbanTaskCardPreview task={activeTask} /> : null}
            </DragOverlay>
        </DndContext>
    )
}
