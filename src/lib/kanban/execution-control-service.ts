export type ExecutionEngineStatus = 'running' | 'idle' | 'stopped'

export class KanbanExecutionControlService {
    private stopped = false

    public markStarted(): void {
        this.stopped = false
    }

    public markStopped(): void {
        this.stopped = true
    }

    public isStopped(): boolean {
        return this.stopped
    }

    public getStatus(isRunning: boolean): ExecutionEngineStatus {
        if (isRunning) {
            return 'running'
        }
        return this.stopped ? 'stopped' : 'idle'
    }
}

const globalForKanbanExecutionControlService = globalThis as unknown as {
    kanbanExecutionControlService: KanbanExecutionControlService | undefined
}

export const kanbanExecutionControlService = globalForKanbanExecutionControlService.kanbanExecutionControlService
    ?? new KanbanExecutionControlService()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanExecutionControlService.kanbanExecutionControlService = kanbanExecutionControlService
}
