export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        return
    }

    if (process.env.npm_lifecycle_event === 'build') {
        return
    }

    const [
        { recoverInterruptedKanbanExecutions },
        { ensureKanbanScriptWatcherStarted },
        { ensureKanbanSchedulerRunnerStarted },
    ] = await Promise.all([
        import('@/lib/kanban/execution-engine'),
        import('@/lib/kanban/script-watcher'),
        import('@/lib/kanban/scheduler-runner'),
    ])

    try {
        const recovery = await recoverInterruptedKanbanExecutions()
        if (recovery.recoveredExecutions > 0 || recovery.recoveredTasks > 0) {
            console.warn('Recovered interrupted kanban runtime state:', recovery)
        }
    } catch (error) {
        console.error('Failed to recover interrupted kanban runtime state:', error)
    }

    await Promise.all([
        ensureKanbanScriptWatcherStarted(),
        ensureKanbanSchedulerRunnerStarted(),
    ])
}
