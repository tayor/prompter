import type { KanbanColumn } from '@/lib/validators'

export interface KanbanTaskExecutionSummary {
    id: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    startedAt: string | null
    completedAt: string | null
    durationMs: number | null
    exitCode: number | null
    error: string | null
}

export interface KanbanTask {
    id: string
    name: string
    displayName: string | null
    description: string | null
    sourcePath: string
    sourceHash: string | null
    column: KanbanColumn
    position: number
    config: Record<string, unknown>
    dependencies: string[]
    latestExecution?: KanbanTaskExecutionSummary | null
    createdAt: string
    updatedAt: string
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
    'backlog',
    'queued',
    'running',
    'completed',
    'failed',
    'paused',
]

export const KANBAN_COLUMN_LABELS: Record<KanbanColumn, string> = {
    backlog: 'Backlog',
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    paused: 'Paused',
}
