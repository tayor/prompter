import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { listQueuedTasks, reorderQueuedTasks, serializeKanbanTask } from '@/lib/kanban/queue-operations'
import { singleShuffleQueuedTaskSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/queue/shuffle/single - Promote one random queued task to the front
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        singleShuffleQueuedTaskSchema.parse(body)

        const queuedTasks = await listQueuedTasks()
        if (queuedTasks.length <= 1) {
            return NextResponse.json({
                tasks: queuedTasks.map((task) => serializeKanbanTask(task)),
                meta: {
                    changed: false,
                    promotedTaskId: null,
                },
            })
        }

        const promotedIndex = randomInt(1, queuedTasks.length)
        const promotedTaskId = queuedTasks[promotedIndex].id
        const desiredOrder = [
            promotedTaskId,
            ...queuedTasks
                .filter((task) => task.id !== promotedTaskId)
                .map((task) => task.id),
        ]

        const reorderResult = await reorderQueuedTasks(desiredOrder)
        const updatedTasks = await listQueuedTasks()

        return NextResponse.json({
            tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                changed: reorderResult.changedTaskIds.length > 0,
                promotedTaskId,
            },
        })
    } catch (error) {
        console.error('Failed to single-shuffle queued tasks:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid single-shuffle payload', details: error },
                { status: 400 },
            )
        }
        if (error instanceof Error && error.message.includes('queued column')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to single-shuffle queued tasks' }, { status: 500 })
    }
}
