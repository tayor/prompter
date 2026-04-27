'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard, type MoveTaskPayload } from '@/components/tasks/KanbanBoard'
import { TaskConfigSlot } from '@/components/tasks/TaskConfigSlot'
import type { KanbanTask, KanbanTaskExecutionSummary } from '@/components/tasks/types'
import { cloneDefaultKanbanSettings, parseKanbanSettingsPayload } from '@/lib/kanban/settings-defaults'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TasksResponse {
    tasks: KanbanTask[]
}

type RuntimeStatus = 'running' | 'idle' | 'stopped'
type RuntimeAction =
    | 'start'
    | 'stop'
    | 'cancel'
    | 'retry'
    | 'rerun'
    | 'shuffle-full'
    | 'shuffle-single'
    | 'feeling-lucky'

type RuntimeConnectionStatus = 'connecting' | 'connected' | 'error'
type RuntimeExecutionStatus = KanbanTaskExecutionSummary['status']

interface TasksApiError {
    error?: string
    taskId?: string
}

interface RuntimeExecutionTaskRef {
    id: string
    name: string
    displayName?: string | null
    column?: string
    position?: number
}

interface RuntimeExecutionRecord {
    id: string
    taskId: string
    status: RuntimeExecutionStatus
    trigger: 'manual' | 'auto' | 'retry' | 'random'
    startedAt: string | null
    completedAt: string | null
    durationMs: number | null
    exitCode: number | null
    error: string | null
    createdAt: string
    task?: RuntimeExecutionTaskRef | null
}

interface RuntimeStatusResponse {
    status: RuntimeStatus
    runningExecution: RuntimeExecutionRecord | null
    history?: RuntimeExecutionRecord[]
    logs?: {
        runningExecutionPreview?: string | null
    }
}

interface RuntimeRealtimeEvent {
    type:
        | 'execution:started'
        | 'execution:log'
        | 'execution:completed'
        | 'execution:failed'
        | 'engine:status'
        | 'queue:empty'
        | 'dependency:blocked'
        | 'script:changed'
    executionId?: string
    taskId?: string
    payload: Record<string, unknown>
}

interface LogLine {
    id: string
    stream: 'stdout' | 'stderr'
    text: string
}

interface RuntimeSettingsResponse {
    kanban?: unknown
}

async function readApiError(response: Response, fallback: string): Promise<string> {
    try {
        const errorPayload: TasksApiError = await response.json()
        if (errorPayload.error) {
            if (errorPayload.taskId) {
                return `${errorPayload.error} (task: ${errorPayload.taskId})`
            }
            return errorPayload.error
        }
    } catch {
        // ignored
    }

    return fallback
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<KanbanTask[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [kanbanSettings, setKanbanSettings] = useState(() => cloneDefaultKanbanSettings())
    const [runtimeLoading, setRuntimeLoading] = useState(true)
    const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('idle')
    const [runningExecution, setRunningExecution] = useState<RuntimeExecutionRecord | null>(null)
    const [executionHistory, setExecutionHistory] = useState<RuntimeExecutionRecord[]>([])
    const [runtimeAction, setRuntimeAction] = useState<RuntimeAction | null>(null)
    const [logsByExecutionId, setLogsByExecutionId] = useState<Record<string, LogLine[]>>({})
    const [activeLogExecutionId, setActiveLogExecutionId] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<RuntimeConnectionStatus>('connecting')
    const [currentTimestampMs, setCurrentTimestampMs] = useState(() => Date.now())
    const logContainerRef = useRef<HTMLDivElement | null>(null)
    const logLineLimit = Math.max(Math.min(kanbanSettings.execution.liveLogLineLimit, 5000), 100)

    const latestExecutionByTaskId = useMemo(() => {
        const map = new Map<string, RuntimeExecutionRecord>()
        if (runningExecution) {
            map.set(runningExecution.taskId, runningExecution)
        }

        for (const execution of executionHistory) {
            if (!map.has(execution.taskId)) {
                map.set(execution.taskId, execution)
            }
        }

        return map
    }, [executionHistory, runningExecution])

    const tasksWithRuntime = useMemo(
        () => tasks.map((task) => ({
            ...task,
            latestExecution: toTaskExecutionSummary(latestExecutionByTaskId.get(task.id)),
        })),
        [latestExecutionByTaskId, tasks],
    )

    const selectedTask = useMemo(
        () => tasksWithRuntime.find((task) => task.id === selectedTaskId) ?? null,
        [selectedTaskId, tasksWithRuntime],
    )

    const notifyRuntimeEvent = useCallback((
        type: 'success' | 'error' | 'info',
        title: string,
        message: string,
    ) => {
        if (kanbanSettings.notifications.inApp) {
            if (type === 'success') {
                toast.success(title, { description: message })
            } else if (type === 'error') {
                toast.error(title, { description: message })
            } else {
                toast.info(title, { description: message })
            }
        }

        if (kanbanSettings.notifications.sound) {
            playNotificationSound(type)
        }

        if (
            !kanbanSettings.notifications.desktop
            || typeof window === 'undefined'
            || !('Notification' in window)
            || Notification.permission !== 'granted'
        ) {
            return
        }

        try {
            const notification = new Notification(title, { body: message, tag: 'kanban-runtime' })
            notification.onclick = () => {
                window.focus()
                notification.close()
            }
        } catch {
            // noop
        }
    }, [
        kanbanSettings.notifications.desktop,
        kanbanSettings.notifications.inApp,
        kanbanSettings.notifications.sound,
    ])

    const fetchKanbanSettings = useCallback(async () => {
        try {
            const response = await fetch('/api/settings', { cache: 'no-store' })
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load settings'))
            }

            const payload: RuntimeSettingsResponse = await response.json()
            setKanbanSettings(parseKanbanSettingsPayload(payload.kanban))
        } catch (error) {
            console.error(error)
        }
    }, [])

    const fetchTasks = useCallback(async () => {
        try {
            const response = await fetch('/api/tasks', { cache: 'no-store' })
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load tasks'))
            }

            const data: TasksResponse = await response.json()
            setTasks(data.tasks)
            setSelectedTaskId((currentId) => {
                if (!currentId) {
                    return currentId
                }

                return data.tasks.some((task) => task.id === currentId) ? currentId : null
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load tasks'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchRuntimeStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/execution/status?includeHistory=true&includeLogs=true', {
                cache: 'no-store',
            })
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load execution runtime status'))
            }

            const data: RuntimeStatusResponse = await response.json()
            setRuntimeStatus(data.status)
            setRunningExecution(data.runningExecution ?? null)
            setExecutionHistory(Array.isArray(data.history) ? data.history : [])

            const runningExecutionId = data.runningExecution?.id
            if (runningExecutionId) {
                if (kanbanSettings.ui.autoSelectRunningLog) {
                    setActiveLogExecutionId((currentId) => currentId ?? runningExecutionId)
                }

                const preview = typeof data.logs?.runningExecutionPreview === 'string'
                    ? data.logs.runningExecutionPreview
                    : null
                if (preview && preview.length > 0) {
                    setLogsByExecutionId((previous) => {
                        if (previous[runningExecutionId]) {
                            return previous
                        }

                        return {
                            ...previous,
                            [runningExecutionId]: parsePreviewLogLines(preview),
                        }
                    })
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load runtime status'
            toast.error(message)
        } finally {
            setRuntimeLoading(false)
        }
    }, [kanbanSettings.ui.autoSelectRunningLog])

    useEffect(() => {
        void fetchTasks()
    }, [fetchTasks])

    useEffect(() => {
        void fetchKanbanSettings()
    }, [fetchKanbanSettings])

    useEffect(() => {
        void fetchRuntimeStatus()
    }, [fetchRuntimeStatus])

    useEffect(() => {
        const pollTimer = window.setInterval(() => {
            void fetchRuntimeStatus()
        }, 5000)

        return () => {
            window.clearInterval(pollTimer)
        }
    }, [fetchRuntimeStatus])

    const appendRealtimeLogChunk = useCallback((executionId: string, stream: 'stdout' | 'stderr', chunk: string) => {
        const lines = chunk
            .replace(/\r\n/g, '\n')
            .split('\n')
            .filter((line) => line.trim().length > 0)

        if (lines.length === 0) {
            return
        }

        setLogsByExecutionId((previous) => {
            const existing = previous[executionId] ?? []
            const appendedLines = lines.map((line) => ({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                stream,
                text: line,
            }))

            return {
                ...previous,
                [executionId]: [...existing, ...appendedLines].slice(-logLineLimit),
            }
        })
    }, [logLineLimit])

    useEffect(() => {
        const eventSource = new EventSource('/api/executions/events')
        setConnectionStatus('connecting')

        const handleConnected = () => {
            setConnectionStatus('connected')
        }

        const handleExecutionStarted = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent) {
                return
            }

            if (realtimeEvent.executionId && kanbanSettings.ui.autoSelectRunningLog) {
                setActiveLogExecutionId(realtimeEvent.executionId)
            }

            void Promise.all([fetchRuntimeStatus(), fetchTasks()])
        }

        const handleExecutionLog = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            const executionId = realtimeEvent?.executionId
            if (!executionId) {
                return
            }

            const streamCandidate = realtimeEvent.payload.stream
            const dataCandidate = realtimeEvent.payload.data

            if ((streamCandidate !== 'stdout' && streamCandidate !== 'stderr') || typeof dataCandidate !== 'string') {
                return
            }

            if (kanbanSettings.ui.autoSelectRunningLog) {
                setActiveLogExecutionId((currentId) => currentId ?? executionId)
            }
            appendRealtimeLogChunk(executionId, streamCandidate, dataCandidate)
        }

        const handleExecutionFinished = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent) {
                return
            }

            const payloadTaskName = typeof realtimeEvent.payload.taskName === 'string'
                ? realtimeEvent.payload.taskName
                : realtimeEvent.taskId || 'task'
            if (realtimeEvent.type === 'execution:completed' && kanbanSettings.notifications.onTaskCompleted) {
                notifyRuntimeEvent('success', 'Execution completed', payloadTaskName)
            }
            if (realtimeEvent.type === 'execution:failed' && kanbanSettings.notifications.onTaskFailed) {
                const failureReason = typeof realtimeEvent.payload.reason === 'string'
                    ? realtimeEvent.payload.reason
                    : 'Execution failed'
                notifyRuntimeEvent('error', `Execution failed: ${payloadTaskName}`, failureReason)
            }

            void Promise.all([fetchRuntimeStatus(), fetchTasks()])
        }

        const handleQueueEmpty = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent || !kanbanSettings.notifications.onQueueEmpty) {
                return
            }

            const message = typeof realtimeEvent.payload.message === 'string'
                ? realtimeEvent.payload.message
                : 'No queued tasks are ready to run.'
            notifyRuntimeEvent('info', 'Queue empty', message)
        }

        const handleDependencyBlocked = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent || !kanbanSettings.notifications.onDependencyBlocked) {
                return
            }

            const blockedCount = typeof realtimeEvent.payload.blockedCount === 'number'
                ? realtimeEvent.payload.blockedCount
                : null
            const message = blockedCount
                ? `${blockedCount} queued task(s) are blocked by dependencies.`
                : 'Queued tasks are blocked by dependencies.'
            notifyRuntimeEvent('info', 'Dependencies blocked', message)
        }

        const handleScriptChanged = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent || !kanbanSettings.notifications.onScriptChanged) {
                return
            }

            const eventType = typeof realtimeEvent.payload.eventType === 'string'
                ? realtimeEvent.payload.eventType
                : 'change'
            const sourcePath = typeof realtimeEvent.payload.sourcePath === 'string'
                ? realtimeEvent.payload.sourcePath
                : realtimeEvent.taskId || 'Script source'
            notifyRuntimeEvent('info', `Script ${eventType}`, sourcePath)
            void fetchTasks()
        }

        const handleEngineStatus = (event: MessageEvent<string>) => {
            const realtimeEvent = parseRealtimeEvent(event)
            if (!realtimeEvent) {
                return
            }

            const status = realtimeEvent.payload.status
            if (status === 'running' || status === 'idle' || status === 'stopped') {
                setRuntimeStatus(status)
            }
        }

        const handleError = () => {
            setConnectionStatus('error')
        }

        eventSource.addEventListener('connected', handleConnected as EventListener)
        eventSource.addEventListener('execution:started', handleExecutionStarted as EventListener)
        eventSource.addEventListener('execution:log', handleExecutionLog as EventListener)
        eventSource.addEventListener('execution:completed', handleExecutionFinished as EventListener)
        eventSource.addEventListener('execution:failed', handleExecutionFinished as EventListener)
        eventSource.addEventListener('engine:status', handleEngineStatus as EventListener)
        eventSource.addEventListener('queue:empty', handleQueueEmpty as EventListener)
        eventSource.addEventListener('dependency:blocked', handleDependencyBlocked as EventListener)
        eventSource.addEventListener('script:changed', handleScriptChanged as EventListener)
        eventSource.onerror = handleError

        return () => {
            eventSource.removeEventListener('connected', handleConnected as EventListener)
            eventSource.removeEventListener('execution:started', handleExecutionStarted as EventListener)
            eventSource.removeEventListener('execution:log', handleExecutionLog as EventListener)
            eventSource.removeEventListener('execution:completed', handleExecutionFinished as EventListener)
            eventSource.removeEventListener('execution:failed', handleExecutionFinished as EventListener)
            eventSource.removeEventListener('engine:status', handleEngineStatus as EventListener)
            eventSource.removeEventListener('queue:empty', handleQueueEmpty as EventListener)
            eventSource.removeEventListener('dependency:blocked', handleDependencyBlocked as EventListener)
            eventSource.removeEventListener('script:changed', handleScriptChanged as EventListener)
            eventSource.close()
        }
    }, [
        appendRealtimeLogChunk,
        fetchRuntimeStatus,
        fetchTasks,
        kanbanSettings.notifications.onDependencyBlocked,
        kanbanSettings.notifications.onQueueEmpty,
        kanbanSettings.notifications.onScriptChanged,
        kanbanSettings.notifications.onTaskCompleted,
        kanbanSettings.notifications.onTaskFailed,
        kanbanSettings.ui.autoSelectRunningLog,
        notifyRuntimeEvent,
    ])

    useEffect(() => {
        if (!runningExecution?.startedAt) {
            return
        }

        setCurrentTimestampMs(Date.now())
        const timer = window.setInterval(() => {
            setCurrentTimestampMs(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [runningExecution?.id, runningExecution?.startedAt])

    const activeLogLines = useMemo(
        () => (activeLogExecutionId ? logsByExecutionId[activeLogExecutionId] ?? [] : []),
        [activeLogExecutionId, logsByExecutionId],
    )

    useEffect(() => {
        if (!activeLogExecutionId || !kanbanSettings.ui.autoScrollLogs) {
            return
        }

        const container = logContainerRef.current
        if (container) {
            container.scrollTop = container.scrollHeight
        }
    }, [activeLogExecutionId, activeLogLines.length, kanbanSettings.ui.autoScrollLogs])

    const queueCount = useMemo(
        () => tasksWithRuntime.filter((task) => task.column === 'queued').length,
        [tasksWithRuntime],
    )
    const backlogCount = useMemo(
        () => tasksWithRuntime.filter((task) => task.column === 'backlog').length,
        [tasksWithRuntime],
    )
    const runningTaskName = useMemo(() => {
        if (!runningExecution) {
            return null
        }

        const boardTask = tasksWithRuntime.find((task) => task.id === runningExecution.taskId)
        if (boardTask) {
            return boardTask.displayName || boardTask.name
        }

        return runningExecution.task?.displayName
            || runningExecution.task?.name
            || runningExecution.taskId
    }, [runningExecution, tasksWithRuntime])

    const runningDuration = useMemo(() => {
        if (!runningExecution?.startedAt) {
            return null
        }

        const startedAtMs = Date.parse(runningExecution.startedAt)
        if (Number.isNaN(startedAtMs)) {
            return null
        }

        return formatDuration(Math.max(currentTimestampMs - startedAtMs, 0))
    }, [currentTimestampMs, runningExecution?.startedAt])

    const runRuntimeAction = useCallback(async (
        action: RuntimeAction,
        endpoint: string,
        payload: Record<string, unknown>,
        successMessage: string,
        failureMessage: string,
    ) => {
        setRuntimeAction(action)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                throw new Error(await readApiError(response, failureMessage))
            }

            await response.json().catch(() => null)
            toast.success(successMessage)
            await Promise.all([fetchTasks(), fetchRuntimeStatus()])
        } catch (error) {
            const message = error instanceof Error ? error.message : failureMessage
            toast.error(message)
        } finally {
            setRuntimeAction(null)
        }
    }, [fetchRuntimeStatus, fetchTasks])

    const handleStartEngine = useCallback(() => {
        void runRuntimeAction(
            'start',
            '/api/execution/start',
            { trigger: 'manual', startIfIdle: true },
            'Execution engine started',
            'Failed to start execution engine',
        )
    }, [runRuntimeAction])

    const handleStopEngine = useCallback(() => {
        void runRuntimeAction(
            'stop',
            '/api/execution/stop',
            { graceful: true, reason: 'Stopped from tasks UI' },
            'Execution engine stopped',
            'Failed to stop execution engine',
        )
    }, [runRuntimeAction])

    const handleCancelRunning = useCallback(() => {
        void runRuntimeAction(
            'cancel',
            '/api/execution/cancel',
            {
                executionId: runningExecution?.id,
                taskId: runningExecution?.taskId,
                signal: 'SIGTERM',
            },
            'Running execution cancelled',
            'Failed to cancel running execution',
        )
    }, [runRuntimeAction, runningExecution?.id, runningExecution?.taskId])

    const handleRetrySelected = useCallback(() => {
        if (!selectedTask || selectedTask.column !== 'failed') {
            return
        }

        void runRuntimeAction(
            'retry',
            '/api/execution/retry',
            { taskId: selectedTask.id, toFrontOfQueue: true },
            'Task queued for retry',
            'Failed to queue retry',
        )
    }, [runRuntimeAction, selectedTask])

    const handleRerunSelected = useCallback(() => {
        if (!selectedTask || selectedTask.column !== 'completed') {
            return
        }

        void runRuntimeAction(
            'rerun',
            '/api/execution/rerun',
            { taskId: selectedTask.id, toFrontOfQueue: true },
            'Task queued for rerun',
            'Failed to queue rerun',
        )
    }, [runRuntimeAction, selectedTask])

    const handleFullShuffle = useCallback(() => {
        void runRuntimeAction(
            'shuffle-full',
            '/api/queue/shuffle',
            { mode: 'full' },
            'Queue shuffled',
            'Failed to shuffle queue',
        )
    }, [runRuntimeAction])

    const handleSingleShuffle = useCallback(() => {
        void runRuntimeAction(
            'shuffle-single',
            '/api/queue/shuffle/single',
            { column: 'queued' },
            'Queue front shuffled',
            'Failed to single-shuffle queue',
        )
    }, [runRuntimeAction])

    const handleFeelingLucky = useCallback(() => {
        void runRuntimeAction(
            'feeling-lucky',
            '/api/queue/feeling-lucky',
            {
                sourceColumn: 'backlog',
                targetColumn: 'queued',
                autoStart: true,
                applyDefaults: true,
            },
            'Feeling lucky started a random task',
            'Failed to run feeling-lucky flow',
        )
    }, [runRuntimeAction])

    const handleMoveTask = useCallback(async (payload: MoveTaskPayload) => {
        setSaving(true)
        try {
            const response = await fetch('/api/tasks/batch/move', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskIds: [payload.taskId],
                    fromColumn: payload.fromColumn,
                    toColumn: payload.toColumn,
                    position: payload.position,
                }),
            })

            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to move task'))
            }

            await fetchTasks()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to move task'
            toast.error(message)
            throw error
        } finally {
            setSaving(false)
        }
    }, [fetchTasks])

    const handleReorderQueued = useCallback(async (taskIdsInOrder: string[]) => {
        setSaving(true)
        try {
            const response = await fetch('/api/tasks/batch/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    column: 'queued',
                    tasks: taskIdsInOrder.map((id, position) => ({ id, position })),
                }),
            })

            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to reorder queued tasks'))
            }

            await fetchTasks()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reorder queued tasks'
            toast.error(message)
            throw error
        } finally {
            setSaving(false)
        }
    }, [fetchTasks])

    const controlsDisabled = saving || runtimeLoading || runtimeAction !== null
    const canRetrySelectedTask = selectedTask?.column === 'failed'
    const canRerunSelectedTask = selectedTask?.column === 'completed'

    return (
        <div className="flex h-full flex-col">
            <Header title="Tasks" />
            <div className="flex-1 overflow-auto p-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0 space-y-3">
                        <Card>
                            <CardHeader className="space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <CardTitle>Runtime Controls</CardTitle>
                                        <CardDescription>
                                            Manage execution, retries, queue shuffle, and feeling-lucky runs.
                                        </CardDescription>
                                    </div>
                                    <Badge variant={getRuntimeStatusVariant(runtimeStatus)}>
                                        {runtimeStatus.toUpperCase()}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">Queued {queueCount}</Badge>
                                    <Badge variant="outline">Backlog {backlogCount}</Badge>
                                    {runningTaskName && (
                                        <Badge variant="secondary">
                                            Running {runningTaskName}
                                            {runningDuration ? ` • ${runningDuration}` : ''}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleStartEngine}
                                        disabled={controlsDisabled || runtimeStatus === 'running'}
                                    >
                                        {runtimeAction === 'start' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Start
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleStopEngine}
                                        disabled={controlsDisabled || runtimeStatus === 'stopped'}
                                    >
                                        {runtimeAction === 'stop' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Stop
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={handleCancelRunning}
                                        disabled={controlsDisabled || !runningExecution}
                                    >
                                        {runtimeAction === 'cancel' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Cancel
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleRetrySelected}
                                        disabled={controlsDisabled || !canRetrySelectedTask}
                                    >
                                        {runtimeAction === 'retry' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Retry selected
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleRerunSelected}
                                        disabled={controlsDisabled || !canRerunSelectedTask}
                                    >
                                        {runtimeAction === 'rerun' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Rerun selected
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleFullShuffle}
                                        disabled={controlsDisabled || queueCount < 2}
                                    >
                                        {runtimeAction === 'shuffle-full' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Shuffle queue
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSingleShuffle}
                                        disabled={controlsDisabled || queueCount < 2}
                                    >
                                        {runtimeAction === 'shuffle-single' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Single shuffle
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleFeelingLucky}
                                        disabled={controlsDisabled || backlogCount === 0}
                                    >
                                        {runtimeAction === 'feeling-lucky' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        Feeling lucky
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Selected task:&nbsp;
                                    <span className="font-medium">
                                        {selectedTask ? selectedTask.displayName || selectedTask.name : 'None'}
                                    </span>
                                </p>
                            </CardContent>
                        </Card>

                        <p className="text-sm text-muted-foreground">
                            Drag tasks between columns. Manual reordering is supported in queued.
                        </p>
                        {loading ? (
                            <KanbanBoardSkeleton />
                        ) : (
                            <KanbanBoard
                                tasks={tasksWithRuntime}
                                disabled={saving}
                                selectedTaskId={selectedTaskId}
                                onSelectTask={(task) => setSelectedTaskId(task.id)}
                                onMoveTask={handleMoveTask}
                                onReorderQueued={handleReorderQueued}
                            />
                        )}

                        <Card>
                            <CardHeader className="space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <CardTitle>Live Logs</CardTitle>
                                        <CardDescription>
                                            Streaming stdout/stderr from /api/executions/events.
                                        </CardDescription>
                                    </div>
                                    <Badge variant={getConnectionStatusVariant(connectionStatus)}>
                                        {connectionStatus.toUpperCase()}
                                    </Badge>
                                </div>
                                {runningTaskName ? (
                                    <p className="text-xs text-muted-foreground">
                                        Active task:&nbsp;
                                        <span className="font-medium">{runningTaskName}</span>
                                        {runningDuration ? ` • ${runningDuration}` : ''}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No task currently running.</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div
                                    ref={logContainerRef}
                                    className="h-72 overflow-auto rounded-md border bg-slate-950 p-3 font-mono text-xs text-slate-100"
                                    style={{ fontSize: `${kanbanSettings.ui.terminalFontSize}px` }}
                                >
                                    {activeLogExecutionId && activeLogLines.length > 0 ? (
                                        activeLogLines.map((line) => (
                                            <p
                                                key={line.id}
                                                className={cn(
                                                    'whitespace-pre-wrap break-words',
                                                    line.stream === 'stderr' ? 'text-rose-300' : 'text-emerald-300',
                                                )}
                                            >
                                                [{line.stream}] {line.text}
                                            </p>
                                        ))
                                    ) : (
                                        <p className="text-slate-400">
                                            {runningExecution
                                                ? 'Waiting for log output...'
                                                : 'Start the engine to stream live logs.'}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <TaskConfigSlot task={selectedTask} />
                </div>
            </div>
        </div>
    )
}

function KanbanBoardSkeleton() {
    return (
        <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, index) => (
                <Card key={index} className="w-80 min-w-80">
                    <CardHeader>
                        <Skeleton className="h-5 w-28" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function parseRealtimeEvent(event: MessageEvent<string>): RuntimeRealtimeEvent | null {
    try {
        return JSON.parse(event.data) as RuntimeRealtimeEvent
    } catch {
        return null
    }
}

function toTaskExecutionSummary(
    execution: RuntimeExecutionRecord | undefined,
): KanbanTaskExecutionSummary | null {
    if (!execution) {
        return null
    }

    return {
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        durationMs: execution.durationMs,
        exitCode: execution.exitCode,
        error: execution.error,
    }
}

function parsePreviewLogLines(preview: string): LogLine[] {
    return preview
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line, index) => {
            const parsedLine = line.match(/^\[[^\]]+\]\s+\[(stdout|stderr)\]\s?(.*)$/)
            return {
                id: `preview-${index}-${Math.random().toString(36).slice(2, 8)}`,
                stream: parsedLine?.[1] === 'stderr' ? 'stderr' : 'stdout',
                text: parsedLine?.[2] ?? line,
            } satisfies LogLine
        })
}

function playNotificationSound(type: 'success' | 'error' | 'info'): void {
    if (typeof window === 'undefined') {
        return
    }

    const AudioContextCtor = window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
        return
    }

    try {
        const context = new AudioContextCtor()
        const oscillator = context.createOscillator()
        const gainNode = context.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = type === 'error' ? 220 : type === 'success' ? 660 : 440
        gainNode.gain.value = 0.05

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.12)
        oscillator.onended = () => {
            void context.close().catch(() => undefined)
        }
    } catch {
        // noop
    }
}

function getRuntimeStatusVariant(status: RuntimeStatus): 'default' | 'secondary' | 'outline' {
    switch (status) {
        case 'running':
            return 'default'
        case 'stopped':
            return 'outline'
        case 'idle':
        default:
            return 'secondary'
    }
}

function getConnectionStatusVariant(
    status: RuntimeConnectionStatus,
): 'default' | 'secondary' | 'destructive' {
    switch (status) {
        case 'connected':
            return 'secondary'
        case 'error':
            return 'destructive'
        case 'connecting':
        default:
            return 'default'
    }
}

function formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(Math.round(durationMs / 1000), 0)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`
    }

    return `${seconds}s`
}
