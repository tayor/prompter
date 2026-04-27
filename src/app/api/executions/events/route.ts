import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import {
    subscribeToKanbanRealtimeEvents,
    type KanbanRealtimeEvent,
} from '@/lib/kanban/realtime-events'
import { kanbanExecutionParamsSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/executions/events - SSE stream for execution lifecycle events
export async function GET(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    const rawExecutionIdFilter = new URL(request.url).searchParams.get('executionId')
    let executionIdFilter: string | undefined
    if (rawExecutionIdFilter) {
        try {
            executionIdFilter = kanbanExecutionParamsSchema.parse({ id: rawExecutionIdFilter }).id
        } catch {
            return NextResponse.json(
                { error: 'Invalid executionId query parameter' },
                { status: 400 },
            )
        }
    }

    const encoder = new TextEncoder()

    let closed = false
    let unsubscribe: (() => void) | null = null
    let keepAliveTimer: NodeJS.Timeout | null = null

    const cleanup = (controller?: ReadableStreamDefaultController<Uint8Array>) => {
        if (closed) {
            return
        }
        closed = true

        if (keepAliveTimer) {
            clearInterval(keepAliveTimer)
            keepAliveTimer = null
        }

        unsubscribe?.()
        unsubscribe = null

        if (controller) {
            try {
                controller.close()
            } catch {
                // No-op: stream may already be closed
            }
        }
    }

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const sendEvent = (event: KanbanRealtimeEvent) => {
                if (executionIdFilter && event.executionId !== executionIdFilter) {
                    return
                }

                controller.enqueue(encoder.encode(`event: ${event.type}\n`))
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            }

            unsubscribe = subscribeToKanbanRealtimeEvents(sendEvent)
            controller.enqueue(encoder.encode('event: connected\n'))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`))

            keepAliveTimer = setInterval(() => {
                if (!closed) {
                    controller.enqueue(encoder.encode(': ping\n\n'))
                }
            }, 15000)

            request.signal.addEventListener('abort', () => {
                cleanup(controller)
            })
        },
        cancel() {
            cleanup()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    })
}
