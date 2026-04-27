import type { ParsedKanbanTask } from '@/lib/kanban/types'

export type DependencyEligibilityState = 'eligible' | 'waiting' | 'blocked'

export interface DependencyEligibility {
    taskId: string
    state: DependencyEligibilityState
    completedDependencyIds: string[]
    pendingDependencyIds: string[]
    failedDependencyIds: string[]
    missingDependencyIds: string[]
    reason?: string
}

export interface QueuedTaskEligibilityResult {
    nextTask: ParsedKanbanTask | null
    eligible: DependencyEligibility[]
    waiting: DependencyEligibility[]
    blocked: DependencyEligibility[]
}

export function resolveTaskDependencyEligibility(
    task: ParsedKanbanTask,
    taskById: Map<string, ParsedKanbanTask>,
): DependencyEligibility {
    const completedDependencyIds: string[] = []
    const pendingDependencyIds: string[] = []
    const failedDependencyIds: string[] = []
    const missingDependencyIds: string[] = []

    for (const dependencyId of task.dependencies) {
        const dependencyTask = taskById.get(dependencyId)
        if (!dependencyTask) {
            missingDependencyIds.push(dependencyId)
            continue
        }

        if (dependencyTask.column === 'completed') {
            completedDependencyIds.push(dependencyId)
            continue
        }

        if (dependencyTask.column === 'failed') {
            failedDependencyIds.push(dependencyId)
            continue
        }

        pendingDependencyIds.push(dependencyId)
    }

    if (failedDependencyIds.length > 0) {
        return {
            taskId: task.id,
            state: 'blocked',
            completedDependencyIds,
            pendingDependencyIds,
            failedDependencyIds,
            missingDependencyIds,
            reason: `Blocked by failed dependencies: ${failedDependencyIds.join(', ')}`,
        }
    }

    if (missingDependencyIds.length > 0) {
        return {
            taskId: task.id,
            state: 'blocked',
            completedDependencyIds,
            pendingDependencyIds,
            failedDependencyIds,
            missingDependencyIds,
            reason: `Blocked by missing dependencies: ${missingDependencyIds.join(', ')}`,
        }
    }

    if (pendingDependencyIds.length > 0) {
        return {
            taskId: task.id,
            state: 'waiting',
            completedDependencyIds,
            pendingDependencyIds,
            failedDependencyIds,
            missingDependencyIds,
            reason: `Waiting for dependencies: ${pendingDependencyIds.join(', ')}`,
        }
    }

    return {
        taskId: task.id,
        state: 'eligible',
        completedDependencyIds,
        pendingDependencyIds,
        failedDependencyIds,
        missingDependencyIds,
    }
}

export function resolveQueuedTaskEligibility(allTasks: ParsedKanbanTask[]): QueuedTaskEligibilityResult {
    const taskById = new Map(allTasks.map((task) => [task.id, task]))
    const queuedTasks = allTasks
        .filter((task) => task.column === 'queued')
        .sort((left, right) => left.position - right.position)

    const eligible: DependencyEligibility[] = []
    const waiting: DependencyEligibility[] = []
    const blocked: DependencyEligibility[] = []

    for (const task of queuedTasks) {
        const eligibility = resolveTaskDependencyEligibility(task, taskById)
        switch (eligibility.state) {
            case 'eligible':
                eligible.push(eligibility)
                break
            case 'waiting':
                waiting.push(eligibility)
                break
            case 'blocked':
                blocked.push(eligibility)
                break
        }
    }

    const nextEligible = eligible[0]
    const nextTask = nextEligible ? taskById.get(nextEligible.taskId) ?? null : null

    return {
        nextTask,
        eligible,
        waiting,
        blocked,
    }
}
