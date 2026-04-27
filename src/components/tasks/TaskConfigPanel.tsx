'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { VariableSubstitutionPreview } from '@/components/shared/VariableSubstitutionPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
    TASK_TOOL_OPTIONS,
    useTaskConfigPanel,
    type TaskConfigTask,
} from '@/hooks/useTaskConfigPanel'
import type {
    KanbanScheduleStatus,
    KanbanScheduleType,
    KanbanTool,
} from '@/lib/validators'
import { extractVariables } from '@/lib/variable-resolver'
import { cn } from '@/lib/utils'

interface TaskConfigPanelProps {
    taskId: string
    className?: string
    onSaved?: (task: TaskConfigTask) => void
}

const CUSTOM_MODEL_VALUE = '__custom_model__'

type ScheduleAction = 'pause' | 'resume' | 'run-now' | 'delete'

interface TaskSchedule {
    id: string
    name: string | null
    type: KanbanScheduleType
    status: KanbanScheduleStatus
    timezone: string
    runAt: string | null
    cronExpression: string | null
    nextRunAt: string | null
    lastRunAt: string | null
    allowConcurrentRuns: boolean
    skipIfTaskRunning: boolean
    catchUpMissedRuns: boolean
}

interface ScheduleFormValues {
    name: string
    type: KanbanScheduleType
    timezone: string
    runAt: string
    cronExpression: string
    allowConcurrentRuns: boolean
    skipIfTaskRunning: boolean
    catchUpMissedRuns: boolean
}

const DEFAULT_SCHEDULE_FORM_VALUES: ScheduleFormValues = {
    name: '',
    type: 'one_time',
    timezone: 'UTC',
    runAt: '',
    cronExpression: '',
    allowConcurrentRuns: false,
    skipIfTaskRunning: true,
    catchUpMissedRuns: false,
}

export function TaskConfigPanel({
    taskId,
    className,
    onSaved,
}: TaskConfigPanelProps) {
    const [dependencySearch, setDependencySearch] = useState('')
    const [schedules, setSchedules] = useState<TaskSchedule[]>([])
    const [schedulesLoading, setSchedulesLoading] = useState(false)
    const [creatingSchedule, setCreatingSchedule] = useState(false)
    const [scheduleActionKey, setScheduleActionKey] = useState<string | null>(null)
    const [scheduleFormValues, setScheduleFormValues] = useState<ScheduleFormValues>(DEFAULT_SCHEDULE_FORM_VALUES)
    const {
        task,
        loading,
        saving,
        error,
        provider,
        modelOptions,
        modelSource,
        modelsLoading,
        formValues,
        selectedDependencies,
        dependencyOptions,
        updateField,
        updateEnvVar,
        addEnvVar,
        removeEnvVar,
        toggleDependency,
        save,
        refreshModels,
    } = useTaskConfigPanel({
        taskId,
        onSaved,
    })

    const promptVariables = useMemo(
        () => extractVariables(formValues.prompt),
        [formValues.prompt]
    )

    const filteredDependencyOptions = useMemo(() => {
        const query = dependencySearch.trim().toLowerCase()
        if (!query) {
            return dependencyOptions
        }

        return dependencyOptions.filter((candidate) => {
            const displayName = (candidate.displayName || '').toLowerCase()
            return candidate.name.toLowerCase().includes(query)
                || displayName.includes(query)
                || candidate.sourcePath.toLowerCase().includes(query)
        })
    }, [dependencyOptions, dependencySearch])

    const selectedModelValue = modelOptions.includes(formValues.model)
        ? formValues.model
        : CUSTOM_MODEL_VALUE

    const handleSave = async () => {
        const wasSaved = await save()
        if (wasSaved) {
            toast.success('Task configuration saved')
            return
        }

        toast.error(error || 'Unable to save task configuration')
    }

    const loadSchedules = useCallback(async () => {
        setSchedulesLoading(true)

        try {
            const response = await fetch(`/api/schedules?taskId=${encodeURIComponent(taskId)}&limit=100`)
            const data = await response.json().catch(() => null) as {
                error?: string
                schedules?: TaskSchedule[]
            } | null

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to fetch schedules')
            }

            setSchedules(Array.isArray(data?.schedules) ? data.schedules : [])
        } catch (fetchError) {
            toast.error(getErrorMessage(fetchError, 'Failed to fetch schedules'))
            setSchedules([])
        } finally {
            setSchedulesLoading(false)
        }
    }, [taskId])

    useEffect(() => {
        void loadSchedules()
    }, [loadSchedules])

    const handleCreateSchedule = async () => {
        if (scheduleFormValues.type === 'one_time') {
            if (!scheduleFormValues.runAt) {
                toast.error('Run date/time is required for one-time schedules')
                return
            }

            const parsedRunAt = new Date(scheduleFormValues.runAt)
            if (Number.isNaN(parsedRunAt.getTime())) {
                toast.error('Run date/time is invalid')
                return
            }
        }

        if (scheduleFormValues.type === 'cron' && !scheduleFormValues.cronExpression.trim()) {
            toast.error('Cron expression is required for cron schedules')
            return
        }

        const payload: Record<string, unknown> = {
            type: scheduleFormValues.type,
            timezone: scheduleFormValues.timezone.trim() || 'UTC',
            taskId,
            allowConcurrentRuns: scheduleFormValues.allowConcurrentRuns,
            skipIfTaskRunning: scheduleFormValues.skipIfTaskRunning,
            catchUpMissedRuns: scheduleFormValues.catchUpMissedRuns,
        }

        const scheduleName = scheduleFormValues.name.trim()
        if (scheduleName) {
            payload.name = scheduleName
        }

        if (scheduleFormValues.type === 'one_time') {
            payload.runAt = new Date(scheduleFormValues.runAt).toISOString()
        } else {
            payload.cronExpression = scheduleFormValues.cronExpression.trim()
        }

        setCreatingSchedule(true)

        try {
            const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json().catch(() => null) as { error?: string } | null

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to create schedule')
            }

            toast.success('Schedule created')
            setScheduleFormValues({ ...DEFAULT_SCHEDULE_FORM_VALUES })
            await loadSchedules()
        } catch (createError) {
            toast.error(getErrorMessage(createError, 'Failed to create schedule'))
        } finally {
            setCreatingSchedule(false)
        }
    }

    const handleScheduleAction = async (scheduleId: string, action: ScheduleAction) => {
        const actionConfig = getScheduleActionConfig(scheduleId, action)
        setScheduleActionKey(`${scheduleId}:${action}`)

        try {
            const response = await fetch(actionConfig.endpoint, {
                method: actionConfig.method,
            })
            const data = await response.json().catch(() => null) as { error?: string } | null

            if (!response.ok) {
                throw new Error(data?.error || actionConfig.errorMessage)
            }

            toast.success(actionConfig.successMessage)
            await loadSchedules()
        } catch (actionError) {
            toast.error(getErrorMessage(actionError, actionConfig.errorMessage))
        } finally {
            setScheduleActionKey(null)
        }
    }

    if (loading) {
        return (
            <Card className={cn('h-fit xl:sticky xl:top-20', className)}>
                <CardContent className="flex min-h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (!task) {
        return (
            <Card className={cn('h-fit xl:sticky xl:top-20', className)}>
                <CardHeader>
                    <CardTitle>Task Configuration</CardTitle>
                    <CardDescription>Select a task card to configure runtime settings.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card className={cn('h-fit xl:sticky xl:top-20', className)}>
            <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Task Configuration</CardTitle>
                        <CardDescription className="truncate">
                            {task.displayName || task.name}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground">{task.sourcePath}</p>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => void handleSave()}
                        disabled={saving}
                    >
                        {saving
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
                {error && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                        {error}
                    </p>
                )}
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="tool-model" className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
                        <TabsTrigger value="tool-model">Tool/Model</TabsTrigger>
                        <TabsTrigger value="prompt-args">Prompt/Arguments</TabsTrigger>
                        <TabsTrigger value="environment-execution">Environment/Execution</TabsTrigger>
                        <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                        <TabsTrigger value="schedules">Schedules</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tool-model" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-tool">Tool</Label>
                            <Select
                                value={formValues.tool}
                                onValueChange={(value) => updateField('tool', value as KanbanTool)}
                            >
                                <SelectTrigger id="task-tool">
                                    <SelectValue placeholder="Select tool" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TASK_TOOL_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {TASK_TOOL_OPTIONS.find((option) => option.value === formValues.tool)?.description}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="task-model-input">Model</Label>
                                {provider && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => void refreshModels()}
                                        disabled={modelsLoading}
                                    >
                                        {modelsLoading
                                            ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                            : <RefreshCw className="mr-1 h-3 w-3" />}
                                        Refresh
                                    </Button>
                                )}
                            </div>

                            {provider && modelOptions.length > 0 && (
                                <Select
                                    value={selectedModelValue}
                                    onValueChange={(value) => {
                                        if (value !== CUSTOM_MODEL_VALUE) {
                                            updateField('model', value)
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose discovered model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={CUSTOM_MODEL_VALUE}>
                                            Custom model value
                                        </SelectItem>
                                        {modelOptions.map((model) => (
                                            <SelectItem key={model} value={model}>
                                                {model}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            <Input
                                id="task-model-input"
                                value={formValues.model}
                                onChange={(event) => updateField('model', event.target.value)}
                                placeholder="Enter model id"
                            />

                            {provider ? (
                                <p className="text-xs text-muted-foreground">
                                    Provider: <span className="font-medium">{provider}</span>
                                    {modelSource ? ` • Source: ${modelSource}` : ''}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    This tool uses a manual model value and skips provider discovery.
                                </p>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="prompt-args" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-prompt">Prompt Template</Label>
                            <Textarea
                                id="task-prompt"
                                value={formValues.prompt}
                                onChange={(event) => updateField('prompt', event.target.value)}
                                placeholder="Use {{variable}} placeholders for runtime substitution..."
                                className="min-h-36"
                            />
                            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                                Template variables use <span className="font-mono">{'{{name}}'}</span> syntax.
                                Keep variable names stable so runtime integrations can provide inputs consistently.
                            </div>
                        </div>

                        {promptVariables.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Detected variables</p>
                                <div className="flex flex-wrap gap-2">
                                    {promptVariables.map((variableName) => (
                                        <Badge key={variableName} variant="secondary" className="font-mono text-xs">
                                            {`{{${variableName}}}`}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        <VariableSubstitutionPreview
                            content={formValues.prompt}
                            variables={promptVariables}
                        />

                        <div className="space-y-2">
                            <Label htmlFor="task-additional-args">Additional Arguments</Label>
                            <Textarea
                                id="task-additional-args"
                                value={formValues.additionalArgs}
                                onChange={(event) => updateField('additionalArgs', event.target.value)}
                                placeholder="--max-output-tokens 2048 --temperature 0.2"
                                className="min-h-24"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="environment-execution" className="space-y-5">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Environment Variables</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addEnvVar}
                                    className="h-7 text-xs"
                                >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {formValues.envVars.map((row) => (
                                    <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                        <Input
                                            placeholder="ENV_KEY"
                                            value={row.key}
                                            onChange={(event) => updateEnvVar(row.id, 'key', event.target.value)}
                                        />
                                        <Input
                                            placeholder="value"
                                            value={row.value}
                                            onChange={(event) => updateEnvVar(row.id, 'value', event.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeEnvVar(row.id)}
                                            aria-label="Remove environment variable row"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="task-timeout">Timeout (seconds)</Label>
                                <Input
                                    id="task-timeout"
                                    type="number"
                                    min={1}
                                    max={3600}
                                    value={formValues.timeout}
                                    onChange={(event) => updateField('timeout', toInteger(event.target.value))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="task-working-directory">Working Directory</Label>
                                <Input
                                    id="task-working-directory"
                                    value={formValues.workingDirectory}
                                    onChange={(event) => updateField('workingDirectory', event.target.value)}
                                    placeholder="/workspace/project"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <p className="text-sm font-medium">Retry on failure</p>
                                <p className="text-xs text-muted-foreground">Automatically queue retries after failure.</p>
                            </div>
                            <Switch
                                checked={formValues.retryOnFail}
                                onCheckedChange={(checked) => updateField('retryOnFail', checked)}
                            />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="task-max-retries">Max Retries</Label>
                                <Input
                                    id="task-max-retries"
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={formValues.maxRetries}
                                    onChange={(event) => updateField('maxRetries', toInteger(event.target.value))}
                                    disabled={!formValues.retryOnFail}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="task-retry-delay">Retry Delay (seconds)</Label>
                                <Input
                                    id="task-retry-delay"
                                    type="number"
                                    min={0}
                                    max={3600}
                                    value={formValues.retryDelay}
                                    onChange={(event) => updateField('retryDelay', toInteger(event.target.value))}
                                    disabled={!formValues.retryOnFail}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="dependencies" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-dependency-search">Find tasks</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="task-dependency-search"
                                    className="pl-8"
                                    value={dependencySearch}
                                    onChange={(event) => setDependencySearch(event.target.value)}
                                    placeholder="Search by name or source path"
                                />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Selected dependencies: {selectedDependencies.length}
                        </p>

                        <ScrollArea className="h-64 rounded-md border">
                            <div className="space-y-1 p-2">
                                {filteredDependencyOptions.length === 0 && (
                                    <p className="p-2 text-xs text-muted-foreground">
                                        No matching dependency candidates.
                                    </p>
                                )}

                                {filteredDependencyOptions.map((candidate) => {
                                    const isSelected = selectedDependencies.includes(candidate.id)

                                    return (
                                        <label
                                            key={candidate.id}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-2 rounded-md border p-2',
                                                isSelected && 'border-primary bg-primary/5'
                                            )}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => toggleDependency(candidate.id, checked === true)}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">
                                                    {candidate.displayName || candidate.name}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {candidate.sourcePath}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px]">
                                                {candidate.column}
                                            </Badge>
                                        </label>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="schedules" className="space-y-4">
                        <div className="space-y-3 rounded-md border p-3">
                            <p className="text-sm font-medium">Create schedule</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="schedule-name">Name (optional)</Label>
                                    <Input
                                        id="schedule-name"
                                        value={scheduleFormValues.name}
                                        onChange={(event) => setScheduleFormValues((current) => ({
                                            ...current,
                                            name: event.target.value,
                                        }))}
                                        placeholder="Nightly summary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="schedule-type">Type</Label>
                                    <Select
                                        value={scheduleFormValues.type}
                                        onValueChange={(value) => setScheduleFormValues((current) => ({
                                            ...current,
                                            type: value as KanbanScheduleType,
                                            runAt: value === 'one_time' ? current.runAt : '',
                                            cronExpression: value === 'cron' ? current.cronExpression : '',
                                        }))}
                                    >
                                        <SelectTrigger id="schedule-type">
                                            <SelectValue placeholder="Select schedule type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="one_time">One-time</SelectItem>
                                            <SelectItem value="cron">Cron</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="schedule-timezone">Timezone</Label>
                                    <Input
                                        id="schedule-timezone"
                                        value={scheduleFormValues.timezone}
                                        onChange={(event) => setScheduleFormValues((current) => ({
                                            ...current,
                                            timezone: event.target.value,
                                        }))}
                                        placeholder="UTC"
                                    />
                                </div>

                                {scheduleFormValues.type === 'one_time' ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="schedule-run-at">Run at</Label>
                                        <Input
                                            id="schedule-run-at"
                                            type="datetime-local"
                                            value={scheduleFormValues.runAt}
                                            onChange={(event) => setScheduleFormValues((current) => ({
                                                ...current,
                                                runAt: event.target.value,
                                            }))}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="schedule-cron-expression">Cron expression</Label>
                                        <Input
                                            id="schedule-cron-expression"
                                            value={scheduleFormValues.cronExpression}
                                            onChange={(event) => setScheduleFormValues((current) => ({
                                                ...current,
                                                cronExpression: event.target.value,
                                            }))}
                                            placeholder="0 * * * *"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-2 md:grid-cols-3">
                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <Label htmlFor="schedule-allow-concurrent" className="text-xs">Allow concurrent runs</Label>
                                    <Switch
                                        id="schedule-allow-concurrent"
                                        checked={scheduleFormValues.allowConcurrentRuns}
                                        onCheckedChange={(checked) => setScheduleFormValues((current) => ({
                                            ...current,
                                            allowConcurrentRuns: checked,
                                        }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <Label htmlFor="schedule-skip-if-running" className="text-xs">Skip if task running</Label>
                                    <Switch
                                        id="schedule-skip-if-running"
                                        checked={scheduleFormValues.skipIfTaskRunning}
                                        onCheckedChange={(checked) => setScheduleFormValues((current) => ({
                                            ...current,
                                            skipIfTaskRunning: checked,
                                        }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <Label htmlFor="schedule-catch-up" className="text-xs">Catch up missed runs</Label>
                                    <Switch
                                        id="schedule-catch-up"
                                        checked={scheduleFormValues.catchUpMissedRuns}
                                        onCheckedChange={(checked) => setScheduleFormValues((current) => ({
                                            ...current,
                                            catchUpMissedRuns: checked,
                                        }))}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleCreateSchedule()}
                                disabled={creatingSchedule || scheduleActionKey !== null}
                            >
                                {creatingSchedule
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <Plus className="mr-2 h-4 w-4" />}
                                Create schedule
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Task schedules</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => void loadSchedules()}
                                    disabled={schedulesLoading || creatingSchedule || scheduleActionKey !== null}
                                >
                                    {schedulesLoading
                                        ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        : <RefreshCw className="mr-1 h-3 w-3" />}
                                    Refresh
                                </Button>
                            </div>

                            {schedulesLoading ? (
                                <div className="flex h-20 items-center justify-center rounded-md border">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : schedules.length === 0 ? (
                                <p className="rounded-md border p-3 text-xs text-muted-foreground">
                                    No schedules configured for this task.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {schedules.map((schedule) => {
                                        const pauseResumeAction: ScheduleAction = schedule.status === 'active'
                                            ? 'pause'
                                            : 'resume'
                                        const rowBusy = Boolean(scheduleActionKey?.startsWith(`${schedule.id}:`))

                                        return (
                                            <div key={schedule.id} className="space-y-2 rounded-md border p-3">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="truncate text-sm font-medium">
                                                                {schedule.name || (schedule.type === 'cron' ? 'Cron schedule' : 'One-time schedule')}
                                                            </p>
                                                            <Badge variant="outline" className="capitalize">
                                                                {schedule.type === 'one_time' ? 'one-time' : 'cron'}
                                                            </Badge>
                                                            <Badge
                                                                variant={schedule.status === 'active' ? 'secondary' : 'outline'}
                                                                className="capitalize"
                                                            >
                                                                {schedule.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Timezone: {schedule.timezone}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => void handleScheduleAction(schedule.id, pauseResumeAction)}
                                                            disabled={rowBusy || creatingSchedule}
                                                        >
                                                            {scheduleActionKey === `${schedule.id}:${pauseResumeAction}`
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : (schedule.status === 'active' ? 'Pause' : 'Resume')}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => void handleScheduleAction(schedule.id, 'run-now')}
                                                            disabled={rowBusy || creatingSchedule}
                                                        >
                                                            {scheduleActionKey === `${schedule.id}:run-now`
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : 'Run now'}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => void handleScheduleAction(schedule.id, 'delete')}
                                                            disabled={rowBusy || creatingSchedule}
                                                            aria-label="Delete schedule"
                                                        >
                                                            {scheduleActionKey === `${schedule.id}:delete`
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1 text-xs text-muted-foreground">
                                                    {schedule.type === 'one_time' ? (
                                                        <p>Run at: {formatScheduleDate(schedule.runAt)}</p>
                                                    ) : (
                                                        <p>
                                                            Cron: <span className="font-mono text-foreground">{schedule.cronExpression || '—'}</span>
                                                        </p>
                                                    )}
                                                    <p>
                                                        Next run: {formatScheduleDate(schedule.nextRunAt)}
                                                        {' • '}
                                                        Last run: {formatScheduleDate(schedule.lastRunAt)}
                                                    </p>
                                                    <p>
                                                        Policies:
                                                        {' '}concurrent {schedule.allowConcurrentRuns ? 'on' : 'off'},
                                                        {' '}skip-if-running {schedule.skipIfTaskRunning ? 'on' : 'off'},
                                                        {' '}catch-up {schedule.catchUpMissedRuns ? 'on' : 'off'}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

function toInteger(value: string): number {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
        return parsed
    }

    return 0
}

function getScheduleActionConfig(scheduleId: string, action: ScheduleAction): {
    endpoint: string
    method: 'POST' | 'DELETE'
    successMessage: string
    errorMessage: string
} {
    switch (action) {
        case 'pause':
            return {
                endpoint: `/api/schedules/${scheduleId}/pause`,
                method: 'POST',
                successMessage: 'Schedule paused',
                errorMessage: 'Failed to pause schedule',
            }
        case 'resume':
            return {
                endpoint: `/api/schedules/${scheduleId}/resume`,
                method: 'POST',
                successMessage: 'Schedule resumed',
                errorMessage: 'Failed to resume schedule',
            }
        case 'run-now':
            return {
                endpoint: `/api/schedules/${scheduleId}/run-now`,
                method: 'POST',
                successMessage: 'Schedule queued to run now',
                errorMessage: 'Failed to run schedule now',
            }
        case 'delete':
            return {
                endpoint: `/api/schedules/${scheduleId}`,
                method: 'DELETE',
                successMessage: 'Schedule deleted',
                errorMessage: 'Failed to delete schedule',
            }
    }
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message
    }

    return fallback
}

function formatScheduleDate(value: string | null): string {
    if (!value) {
        return '—'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return '—'
    }

    return parsed.toLocaleString()
}
