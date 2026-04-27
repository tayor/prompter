import type {
    KanbanColumn,
    KanbanExecutionTrigger,
    KanbanScheduleStatus,
    KanbanScheduleType,
    Prisma,
} from '@prisma/client'
import { kanbanExecutionControlService, type KanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine, type KanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { requeueTask } from '@/lib/kanban/queue-operations'
import prisma from '@/lib/prisma'
import { getQueueValidationError } from '@/lib/services/queue-service'

const CRON_FIELD_COUNT = 5
const CRON_MINUTE_MS = 60_000
const CRON_MAX_LOOKAHEAD_MINUTES = 60 * 24 * 366 * 5
const CRON_CACHE = new Map<string, ParsedCronExpression | null>()
const TIMEZONE_VALIDITY_CACHE = new Map<string, boolean>()
const TIMEZONE_PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

const WEEKDAY_INDEX_BY_TOKEN = new Map<string, number>([
    ['sun', 0],
    ['mon', 1],
    ['tue', 2],
    ['wed', 3],
    ['thu', 4],
    ['fri', 5],
    ['sat', 6],
])

interface ParsedCronField {
    values: Set<number>
    wildcard: boolean
}

interface ParsedCronExpression {
    minutes: Set<number>
    hours: Set<number>
    daysOfMonth: Set<number>
    months: Set<number>
    daysOfWeek: Set<number>
    dayOfMonthWildcard: boolean
    dayOfWeekWildcard: boolean
}

interface CronDateTimeParts {
    minute: number
    hour: number
    dayOfMonth: number
    month: number
    dayOfWeek: number
}

interface DueSchedule {
    schedule: SchedulerScheduleSnapshot
    dueAt: Date
}

interface DispatchClaimResult {
    outcome: SchedulerDispatchOutcome
    message?: string
    startState?: string
}

export interface SchedulerTaskSnapshot {
    id: string
    column: KanbanColumn
    config: string
}

export interface SchedulerScheduleSnapshot {
    id: string
    type: KanbanScheduleType
    runAt: Date | null
    cronExpression: string | null
    timezone: string
    status: KanbanScheduleStatus
    nextRunAt: Date | null
    lastRunAt: Date | null
    allowConcurrentRuns: boolean
    skipIfTaskRunning: boolean
    catchUpMissedRuns: boolean
    updatedAt: Date
    taskId: string | null
    task: SchedulerTaskSnapshot | null
}

export interface SchedulerRuntimePrismaClient {
    kanbanSchedule: {
        findMany(args: Prisma.KanbanScheduleFindManyArgs): Promise<SchedulerScheduleSnapshot[]>
        updateMany(args: Prisma.KanbanScheduleUpdateManyArgs): Promise<{ count: number }>
    }
    kanbanExecution: {
        count(args: Prisma.KanbanExecutionCountArgs): Promise<number>
    }
}

export interface KanbanSchedulerRuntimeOptions {
    prismaClient?: SchedulerRuntimePrismaClient
    queueTask?: (taskId: string, toFront: boolean) => Promise<{ position: number }>
    executionEngine?: Pick<KanbanExecutionEngine, 'executeNextTask'>
    executionControl?: Pick<KanbanExecutionControlService, 'markStarted'>
    now?: () => Date
}

export interface DispatchDueSchedulesOptions {
    trigger?: KanbanExecutionTrigger
    limit?: number
    scheduleIds?: string[]
}

export type SchedulerDispatchOutcome =
    | 'dispatched'
    | 'skipped_lock'
    | 'skipped_no_task'
    | 'skipped_task_running'
    | 'skipped_invalid_task'

export interface SchedulerDispatchResult {
    scheduleId: string
    taskId: string | null
    dueAt: Date
    nextRunAt: Date | null
    outcome: SchedulerDispatchOutcome
    startState?: string
    message?: string
}

export interface SchedulerDispatchSummary {
    processedAt: Date
    evaluatedCount: number
    dueCount: number
    claimedCount: number
    dispatchedCount: number
    startedCount: number
    results: SchedulerDispatchResult[]
}

export function computeDueSchedules(
    schedules: SchedulerScheduleSnapshot[],
    now: Date,
): DueSchedule[] {
    return schedules
        .map((schedule) => {
            const dueAt = getScheduleDueAt(schedule, now)
            if (!dueAt || dueAt.getTime() > now.getTime()) {
                return null
            }

            return { schedule, dueAt }
        })
        .filter((entry): entry is DueSchedule => entry !== null)
        .sort((left, right) => {
            const dueDelta = left.dueAt.getTime() - right.dueAt.getTime()
            if (dueDelta !== 0) {
                return dueDelta
            }

            return left.schedule.id.localeCompare(right.schedule.id)
        })
}

export function getScheduleDueAt(schedule: SchedulerScheduleSnapshot, now: Date): Date | null {
    if (schedule.status !== 'active') {
        return null
    }

    if (schedule.type === 'one_time') {
        if (schedule.nextRunAt) {
            return schedule.nextRunAt
        }

        if (schedule.lastRunAt) {
            return null
        }

        return schedule.runAt
    }

    if (!schedule.cronExpression) {
        return null
    }

    if (schedule.nextRunAt) {
        return schedule.nextRunAt
    }

    const seedDate = schedule.catchUpMissedRuns && schedule.lastRunAt
        ? schedule.lastRunAt
        : now

    return computeNextCronOccurrence(schedule.cronExpression, seedDate, schedule.timezone)
}

export function computeNextRunAtForSchedule(
    schedule: SchedulerScheduleSnapshot,
    now: Date,
    dueAt: Date,
): Date | null {
    if (schedule.type === 'one_time') {
        return null
    }

    if (!schedule.cronExpression) {
        return null
    }

    const seedDate = schedule.catchUpMissedRuns ? dueAt : now
    return computeNextCronOccurrence(schedule.cronExpression, seedDate, schedule.timezone)
}

export function computeNextCronOccurrence(
    expression: string,
    fromDate: Date,
    timezone = 'UTC',
): Date | null {
    const parsed = parseCronExpression(expression)
    if (!parsed) {
        return null
    }
    if (!isValidTimeZone(timezone)) {
        return null
    }

    let candidate = roundToNextMinute(fromDate)
    for (let minute = 0; minute < CRON_MAX_LOOKAHEAD_MINUTES; minute += 1) {
        if (matchesCronExpression(candidate, parsed, timezone)) {
            return candidate
        }

        candidate = new Date(candidate.getTime() + CRON_MINUTE_MS)
    }

    return null
}

export class KanbanSchedulerRuntimeService {
    private readonly prismaClient: SchedulerRuntimePrismaClient
    private readonly queueTask: (taskId: string, toFront: boolean) => Promise<{ position: number }>
    private readonly executionEngine: Pick<KanbanExecutionEngine, 'executeNextTask'>
    private readonly executionControl: Pick<KanbanExecutionControlService, 'markStarted'>
    private readonly now: () => Date

    public constructor(options: KanbanSchedulerRuntimeOptions = {}) {
        this.prismaClient = options.prismaClient ?? (prisma as unknown as SchedulerRuntimePrismaClient)
        this.queueTask = options.queueTask ?? requeueTask
        this.executionEngine = options.executionEngine ?? kanbanExecutionEngine
        this.executionControl = options.executionControl ?? kanbanExecutionControlService
        this.now = options.now ?? (() => new Date())
    }

    public async dispatchDueSchedules(
        options: DispatchDueSchedulesOptions = {},
    ): Promise<SchedulerDispatchSummary> {
        const processedAt = this.now()
        const trigger = options.trigger ?? 'auto'
        const filteredScheduleIds = options.scheduleIds?.length
            ? Array.from(new Set(options.scheduleIds))
            : null

        const schedules = await this.prismaClient.kanbanSchedule.findMany({
            where: {
                status: 'active',
                ...(filteredScheduleIds ? { id: { in: filteredScheduleIds } } : {}),
            },
            include: {
                task: {
                    select: {
                        id: true,
                        column: true,
                        config: true,
                    },
                },
            },
            orderBy: [
                { nextRunAt: 'asc' },
                { runAt: 'asc' },
                { createdAt: 'asc' },
            ],
        })

        const dueSchedules = computeDueSchedules(schedules, processedAt)
        const selectedDueSchedules = options.limit
            ? dueSchedules.slice(0, options.limit)
            : dueSchedules

        const results: SchedulerDispatchResult[] = []
        let claimedCount = 0
        let dispatchedCount = 0
        let startedCount = 0

        for (const { schedule, dueAt } of selectedDueSchedules) {
            const nextRunAt = computeNextRunAtForSchedule(schedule, processedAt, dueAt)
            const claimed = await this.tryClaimSchedule(schedule, processedAt, nextRunAt)

            if (!claimed) {
                results.push({
                    scheduleId: schedule.id,
                    taskId: schedule.taskId,
                    dueAt,
                    nextRunAt,
                    outcome: 'skipped_lock',
                    message: 'Schedule was already claimed by another worker',
                })
                continue
            }

            claimedCount += 1
            const dispatch = await this.dispatchClaimedSchedule(schedule, trigger)

            if (dispatch.outcome === 'dispatched') {
                dispatchedCount += 1
                if (dispatch.startState && dispatch.startState !== 'busy') {
                    startedCount += 1
                }
            }

            results.push({
                scheduleId: schedule.id,
                taskId: schedule.taskId,
                dueAt,
                nextRunAt,
                outcome: dispatch.outcome,
                message: dispatch.message,
                startState: dispatch.startState,
            })
        }

        return {
            processedAt,
            evaluatedCount: schedules.length,
            dueCount: dueSchedules.length,
            claimedCount,
            dispatchedCount,
            startedCount,
            results,
        }
    }

    private async dispatchClaimedSchedule(
        schedule: SchedulerScheduleSnapshot,
        trigger: KanbanExecutionTrigger,
    ): Promise<DispatchClaimResult> {
        if (!schedule.taskId || !schedule.task) {
            return {
                outcome: 'skipped_no_task',
                message: 'Schedule has no task to dispatch',
            }
        }

        if (schedule.task.column === 'running') {
            return {
                outcome: 'skipped_task_running',
                message: 'Task is already running',
            }
        }

        const taskRunning = await this.isTaskRunning(schedule.task.id)
        if (taskRunning && (schedule.skipIfTaskRunning || !schedule.allowConcurrentRuns)) {
            return {
                outcome: 'skipped_task_running',
                message: 'Task run skipped by schedule policy',
            }
        }

        const queueValidationError = getQueueValidationError(schedule.task)
        if (queueValidationError) {
            return {
                outcome: 'skipped_invalid_task',
                message: queueValidationError,
            }
        }

        await this.queueTask(schedule.task.id, true)

        this.executionControl.markStarted()
        const startResult = await this.executionEngine.executeNextTask(trigger)

        return {
            outcome: 'dispatched',
            startState: startResult.state,
        }
    }

    private async isTaskRunning(taskId: string): Promise<boolean> {
        const runningCount = await this.prismaClient.kanbanExecution.count({
            where: {
                taskId,
                status: 'running',
            },
        })

        return runningCount > 0
    }

    private async tryClaimSchedule(
        schedule: SchedulerScheduleSnapshot,
        claimedAt: Date,
        nextRunAt: Date | null,
    ): Promise<boolean> {
        const claimResult = await this.prismaClient.kanbanSchedule.updateMany({
            where: {
                id: schedule.id,
                status: 'active',
                updatedAt: schedule.updatedAt,
                nextRunAt: schedule.nextRunAt,
                lastRunAt: schedule.lastRunAt,
            },
            data: {
                lastRunAt: claimedAt,
                nextRunAt,
            },
        })

        return claimResult.count === 1
    }
}

function parseCronExpression(expression: string): ParsedCronExpression | null {
    const normalizedExpression = expression.trim().replace(/\s+/g, ' ')
    const cached = CRON_CACHE.get(normalizedExpression)
    if (cached !== undefined) {
        return cached
    }

    const fields = normalizedExpression.split(' ')
    if (fields.length !== CRON_FIELD_COUNT) {
        CRON_CACHE.set(normalizedExpression, null)
        return null
    }

    const minutes = parseCronField(fields[0], 0, 59)
    const hours = parseCronField(fields[1], 0, 23)
    const daysOfMonth = parseCronField(fields[2], 1, 31)
    const months = parseCronField(fields[3], 1, 12)
    const daysOfWeek = parseCronField(fields[4], 0, 7, true)

    if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
        CRON_CACHE.set(normalizedExpression, null)
        return null
    }

    const parsed: ParsedCronExpression = {
        minutes: minutes.values,
        hours: hours.values,
        daysOfMonth: daysOfMonth.values,
        months: months.values,
        daysOfWeek: daysOfWeek.values,
        dayOfMonthWildcard: daysOfMonth.wildcard,
        dayOfWeekWildcard: daysOfWeek.wildcard,
    }

    CRON_CACHE.set(normalizedExpression, parsed)
    return parsed
}

function parseCronField(
    field: string,
    min: number,
    max: number,
    normalizeDayOfWeek = false,
): ParsedCronField | null {
    const normalizedField = field.trim()
    if (normalizedField.length === 0) {
        return null
    }

    const values = new Set<number>()
    const parts = normalizedField.split(',')

    for (const part of parts) {
        const rangePart = part.trim()
        if (rangePart.length === 0) {
            return null
        }

        const [segment, stepToken] = rangePart.split('/')
        const step = stepToken === undefined ? 1 : parseCronInteger(stepToken)

        if (!step || step <= 0) {
            return null
        }

        const range = parseRangeBounds(segment, min, max)
        if (!range) {
            return null
        }

        for (let value = range.start; value <= range.end; value += step) {
            const normalizedValue = normalizeDayOfWeek && value === 7 ? 0 : value
            if (normalizedValue < min || normalizedValue > (normalizeDayOfWeek ? 6 : max)) {
                return null
            }

            values.add(normalizedValue)
        }
    }

    if (values.size === 0) {
        return null
    }

    return {
        values,
        wildcard: normalizedField === '*',
    }
}

function parseRangeBounds(token: string, min: number, max: number): { start: number, end: number } | null {
    if (token === '*') {
        return { start: min, end: max }
    }

    if (token.includes('-')) {
        const [startToken, endToken] = token.split('-')
        const start = parseCronInteger(startToken)
        const end = parseCronInteger(endToken)

        if (start === null || end === null || start < min || end > max || start > end) {
            return null
        }

        return { start, end }
    }

    const value = parseCronInteger(token)
    if (value === null || value < min || value > max) {
        return null
    }

    return { start: value, end: value }
}

function parseCronInteger(token: string): number | null {
    if (!/^\d+$/.test(token)) {
        return null
    }

    return Number.parseInt(token, 10)
}

function roundToNextMinute(fromDate: Date): Date {
    const candidate = new Date(fromDate.getTime())
    candidate.setUTCSeconds(0, 0)
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
    return candidate
}

function matchesCronExpression(
    date: Date,
    parsed: ParsedCronExpression,
    timezone: string,
): boolean {
    const dateParts = timezone === 'UTC'
        ? getUtcDateTimeParts(date)
        : getTimeZoneDateTimeParts(date, timezone)

    if (!parsed.minutes.has(dateParts.minute)) {
        return false
    }

    if (!parsed.hours.has(dateParts.hour)) {
        return false
    }

    if (!parsed.months.has(dateParts.month)) {
        return false
    }

    const dayOfMonthMatches = parsed.daysOfMonth.has(dateParts.dayOfMonth)
    const dayOfWeekMatches = parsed.daysOfWeek.has(dateParts.dayOfWeek)

    if (parsed.dayOfMonthWildcard && parsed.dayOfWeekWildcard) {
        return true
    }

    if (parsed.dayOfMonthWildcard) {
        return dayOfWeekMatches
    }

    if (parsed.dayOfWeekWildcard) {
        return dayOfMonthMatches
    }

    return dayOfMonthMatches || dayOfWeekMatches
}

export function isValidTimeZone(timezone: string): boolean {
    const normalizedTimezone = timezone.trim()
    if (!normalizedTimezone) {
        return false
    }

    const cached = TIMEZONE_VALIDITY_CACHE.get(normalizedTimezone)
    if (cached !== undefined) {
        return cached
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimezone }).format(new Date())
        TIMEZONE_VALIDITY_CACHE.set(normalizedTimezone, true)
        return true
    } catch {
        TIMEZONE_VALIDITY_CACHE.set(normalizedTimezone, false)
        return false
    }
}

function getUtcDateTimeParts(date: Date): CronDateTimeParts {
    return {
        minute: date.getUTCMinutes(),
        hour: date.getUTCHours(),
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        dayOfWeek: date.getUTCDay(),
    }
}

function getTimeZoneDateTimeParts(date: Date, timezone: string): CronDateTimeParts {
    let formatter = TIMEZONE_PARTS_FORMATTER_CACHE.get(timezone)
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
        TIMEZONE_PARTS_FORMATTER_CACHE.set(timezone, formatter)
    }

    const partsMap: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
    for (const part of formatter.formatToParts(date)) {
        partsMap[part.type] = part.value
    }

    return {
        minute: Number.parseInt(partsMap.minute ?? '0', 10),
        hour: Number.parseInt(partsMap.hour ?? '0', 10),
        dayOfMonth: Number.parseInt(partsMap.day ?? '0', 10),
        month: Number.parseInt(partsMap.month ?? '0', 10),
        dayOfWeek: WEEKDAY_INDEX_BY_TOKEN.get((partsMap.weekday ?? '').slice(0, 3).toLowerCase()) ?? 0,
    }
}

const globalForKanbanSchedulerRuntime = globalThis as unknown as {
    kanbanSchedulerRuntimeService: KanbanSchedulerRuntimeService | undefined
}

export const kanbanSchedulerRuntimeService = globalForKanbanSchedulerRuntime.kanbanSchedulerRuntimeService
    ?? new KanbanSchedulerRuntimeService()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanSchedulerRuntime.kanbanSchedulerRuntimeService = kanbanSchedulerRuntimeService
}
