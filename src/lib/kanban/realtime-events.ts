import { EventEmitter } from 'node:events'

export type KanbanRealtimeEventType =
    | 'execution:started'
    | 'execution:log'
    | 'execution:completed'
    | 'execution:failed'
    | 'engine:status'
    | 'queue:empty'
    | 'dependency:blocked'
    | 'script:changed'

export interface KanbanRealtimeEvent {
    type: KanbanRealtimeEventType
    emittedAt: string
    executionId?: string
    taskId?: string
    payload: Record<string, unknown>
}

interface EmitKanbanRealtimeEventInput {
    type: KanbanRealtimeEventType
    executionId?: string
    taskId?: string
    payload: Record<string, unknown>
}

type KanbanRealtimeEventListener = (event: KanbanRealtimeEvent) => void

class KanbanRealtimeEventBus {
    private readonly emitter = new EventEmitter()

    public constructor() {
        this.emitter.setMaxListeners(200)
    }

    public emit(event: EmitKanbanRealtimeEventInput): void {
        this.emitter.emit('event', {
            ...event,
            emittedAt: new Date().toISOString(),
        } satisfies KanbanRealtimeEvent)
    }

    public subscribe(listener: KanbanRealtimeEventListener): () => void {
        this.emitter.on('event', listener)

        return () => {
            this.emitter.off('event', listener)
        }
    }
}

const globalForKanbanRealtimeEventBus = globalThis as unknown as {
    kanbanRealtimeEventBus: KanbanRealtimeEventBus | undefined
}

export const kanbanRealtimeEventBus = globalForKanbanRealtimeEventBus.kanbanRealtimeEventBus
    ?? new KanbanRealtimeEventBus()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanRealtimeEventBus.kanbanRealtimeEventBus = kanbanRealtimeEventBus
}

export function emitKanbanRealtimeEvent(event: EmitKanbanRealtimeEventInput): void {
    kanbanRealtimeEventBus.emit(event)
}

export function subscribeToKanbanRealtimeEvents(listener: KanbanRealtimeEventListener): () => void {
    return kanbanRealtimeEventBus.subscribe(listener)
}
