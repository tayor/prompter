import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { GET as getScheduleById } from '@/app/api/schedules/[id]/route'
import { POST as runScheduleNow } from '@/app/api/schedules/[id]/run-now/route'
import { GET as listSchedules, POST as createSchedule } from '@/app/api/schedules/route'

function createJsonRequest(url: string, method: 'POST', payload: unknown) {
    return new Request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    })
}

function createNextRequest(url: string, method = 'GET', payload?: unknown) {
    return new NextRequest(new URL(url), {
        method,
        headers: { 'content-type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
    })
}

test('schedule create route rejects invalid payloads', async () => {
    const response = await createSchedule(
        createJsonRequest('http://localhost/api/schedules', 'POST', {
            type: 'one_time',
        }),
    )

    assert.equal(response.status, 400)
    const body = await response.json() as { error?: string }
    assert.equal(body.error, 'Invalid schedule data')
})

test('schedule list route rejects invalid query parameters', async () => {
    const response = await listSchedules(createNextRequest('http://localhost/api/schedules?page=0'))

    assert.equal(response.status, 400)
    const body = await response.json() as { error?: string }
    assert.equal(body.error, 'Invalid schedule query parameters')
})

test('schedule list route validation errors do not write server error logs', async () => {
    const originalConsoleError = console.error
    const capturedLogs: unknown[][] = []
    console.error = (...args: unknown[]) => {
        capturedLogs.push(args)
    }

    try {
        await listSchedules(createNextRequest('http://localhost/api/schedules?page=0'))
    } finally {
        console.error = originalConsoleError
    }

    assert.equal(capturedLogs.length, 0)
})

test('schedule detail route validates route params before database access', async () => {
    const response = await getScheduleById(
        createNextRequest('http://localhost/api/schedules/invalid'),
        {
            params: Promise.resolve({ id: 'x'.repeat(192) }),
        },
    )

    assert.equal(response.status, 400)
    const body = await response.json() as { error?: string }
    assert.equal(body.error, 'Invalid schedule id')
})

test('schedule run-now route rejects non-localhost requests', async () => {
    const response = await runScheduleNow(
        createNextRequest('http://example.com/api/schedules/schedule-id/run-now', 'POST', {}),
        {
            params: Promise.resolve({ id: 'schedule-id' }),
        },
    )

    assert.equal(response.status, 403)
})

test('schedule run-now route validates payload with control schema', async () => {
    const response = await runScheduleNow(
        createNextRequest('http://localhost/api/schedules/schedule-id/run-now', 'POST', {
            at: 'not-a-date',
        }),
        {
            params: Promise.resolve({ id: 'schedule-id' }),
        },
    )

    assert.equal(response.status, 400)
    const body = await response.json() as { error?: string }
    assert.equal(body.error, 'Invalid schedule run-now payload')
})
