import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import {
    listQueuedTasks,
    parseTaskConfig,
    reorderQueuedTasks,
    serializeKanbanTask,
} from '@/lib/kanban/queue-operations'
import { shuffleQueuedTasksSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface WeightedTask {
    id: string
    weight: number
}

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/queue/shuffle - Fully shuffle queued tasks (or weighted mode)
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = shuffleQueuedTasksSchema.parse(body)

        const queuedTasks = await listQueuedTasks()
        if (queuedTasks.length <= 1) {
            return NextResponse.json({
                tasks: queuedTasks.map((task) => serializeKanbanTask(task)),
                meta: {
                    mode: data.mode,
                    changed: false,
                    shuffledCount: 0,
                },
            })
        }

        const desiredOrder = data.mode === 'weighted'
            ? weightedShuffle(queuedTasks.map((task) => ({
                id: task.id,
                weight: getTaskWeight(task.config),
            })))
            : fullShuffle(queuedTasks.map((task) => task.id))
        const reorderResult = await reorderQueuedTasks(desiredOrder)
        const updatedTasks = await listQueuedTasks()

        return NextResponse.json({
            tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                mode: data.mode,
                changed: reorderResult.changedTaskIds.length > 0,
                shuffledCount: reorderResult.changedTaskIds.length,
            },
        })
    } catch (error) {
        console.error('Failed to shuffle queued tasks:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid queue shuffle payload', details: error },
                { status: 400 },
            )
        }
        if (error instanceof Error && error.message.includes('queued column')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to shuffle queued tasks' }, { status: 500 })
    }
}

function fullShuffle(taskIds: string[]): string[] {
    const shuffledTaskIds = [...taskIds]

    for (let index = shuffledTaskIds.length - 1; index > 0; index -= 1) {
        const randomIndex = randomInt(index + 1)
        const swapTarget = shuffledTaskIds[randomIndex]
        shuffledTaskIds[randomIndex] = shuffledTaskIds[index]
        shuffledTaskIds[index] = swapTarget
    }

    return shuffledTaskIds
}

function weightedShuffle(tasks: WeightedTask[]): string[] {
    const pool = tasks.map((task) => ({ ...task }))
    const orderedTaskIds: string[] = []

    while (pool.length > 0) {
        const totalWeight = pool.reduce((sum, task) => sum + task.weight, 0)
        let roll = randomInt(totalWeight)

        let selectedIndex = 0
        for (let index = 0; index < pool.length; index += 1) {
            roll -= pool[index].weight
            if (roll < 0) {
                selectedIndex = index
                break
            }
        }

        orderedTaskIds.push(pool[selectedIndex].id)
        pool.splice(selectedIndex, 1)
    }

    return orderedTaskIds
}

function getTaskWeight(rawConfig: string): number {
    const parsedConfig = parseTaskConfig(rawConfig)
    const candidate = parsedConfig.weight

    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        return 1
    }

    const rounded = Math.round(candidate)
    if (rounded < 1) {
        return 1
    }
    if (rounded > 10) {
        return 10
    }

    return rounded
}
