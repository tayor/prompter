import chokidar, { type FSWatcher as ChokidarWatcher } from 'chokidar'
import { createHash } from 'node:crypto'
import { promises as fs, type Stats } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { emitKanbanRealtimeEvent } from '@/lib/kanban/realtime-events'
import prisma from '@/lib/prisma'

const DEFAULT_WATCH_DIRECTORY = '~/scripts'
const DEFAULT_RECOGNIZED_EXTENSIONS = ['.sh', '.bash', '.py', '.js', '.ts', '.zsh']
const FAST_RECONCILE_INTERVAL_MS = 2_000
const SAFE_RECONCILE_INTERVAL_MS = 2_000
const WATCHER_SETTINGS_KEYS = [
    'kanban-settings',
    'kanban:settings',
    'kanbanSettings',
    'config',
    'settings',
]

type SourceSyncState = 'available' | 'missing'
type SourceEventType = 'add' | 'change' | 'unlink'

interface ScriptWatcherSettings {
    watchDirectory: string
    recognizedExtensions: string[]
}

interface SourceSnapshotEntry {
    mtimeMs: number
    size: number
}

type SourceSnapshot = Map<string, SourceSnapshotEntry>

interface SourceSyncUpdate {
    state: SourceSyncState
    eventType: SourceEventType
    eventAtIso: string
}

export class KanbanScriptWatcherService {
    private activeWatcher: ChokidarWatcher | null = null
    private reconcileInterval: NodeJS.Timeout | null = null
    private sourceSnapshot: SourceSnapshot = new Map()
    private settingsSignature: string | null = null
    private startPromise: Promise<void> | null = null
    private syncQueue: Promise<void> = Promise.resolve()

    public async ensureStarted(): Promise<void> {
        if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
            return
        }

        const settings = await loadWatcherSettings()
        const signature = buildSettingsSignature(settings)

        if (this.startPromise) {
            await this.startPromise
        }

        if (this.settingsSignature === signature && this.isRunning()) {
            return
        }

        this.startPromise = this.start(settings, signature)
            .catch((error) => {
                console.error('Failed to start kanban script watcher:', error)
            })
            .finally(() => {
                this.startPromise = null
            })

        await this.startPromise
    }

    public async stop(): Promise<void> {
        await this.stopInternal()
        this.settingsSignature = null
        this.sourceSnapshot = new Map()
    }

    private isRunning(): boolean {
        return this.activeWatcher !== null || this.reconcileInterval !== null
    }

    private async start(settings: ScriptWatcherSettings, signature: string): Promise<void> {
        await this.stopInternal()
        this.settingsSignature = signature
        this.sourceSnapshot = new Map()

        await this.reconcileDirectoryDiff(settings)

        const watcher = this.createChokidarWatcher(settings)
        if (watcher) {
            await this.waitForWatcherReady(watcher)
        }

        this.activeWatcher = watcher
        this.configureReconcileInterval(
            settings,
            this.activeWatcher ? SAFE_RECONCILE_INTERVAL_MS : FAST_RECONCILE_INTERVAL_MS,
        )
    }

    private async stopInternal(): Promise<void> {
        if (this.reconcileInterval) {
            clearInterval(this.reconcileInterval)
            this.reconcileInterval = null
        }

        if (this.activeWatcher) {
            try {
                await this.activeWatcher.close()
            } catch (error) {
                console.error('Failed to close kanban script watcher:', error)
            } finally {
                this.activeWatcher = null
            }
        }
    }

    private createChokidarWatcher(settings: ScriptWatcherSettings): ChokidarWatcher | null {
        try {
            const watcher = chokidar.watch(settings.watchDirectory, {
                ignoreInitial: true,
                persistent: true,
                awaitWriteFinish: {
                    stabilityThreshold: 150,
                    pollInterval: 50,
                },
                ignored: (candidatePath, stats) => {
                    if (stats?.isDirectory()) {
                        return false
                    }
                    return !isSupportedScriptPath(candidatePath, settings.recognizedExtensions)
                },
            })

            watcher.on('add', (candidatePath) => {
                const sourcePath = normalizeAbsolutePath(candidatePath)
                this.enqueueSync(async () => {
                    await this.syncScriptAddedOrChanged(sourcePath, 'add', settings)
                    const stats = await safeStat(sourcePath)
                    if (stats) {
                        this.sourceSnapshot.set(sourcePath, {
                            mtimeMs: stats.mtimeMs,
                            size: stats.size,
                        })
                    }
                })
            })

            watcher.on('change', (candidatePath) => {
                const sourcePath = normalizeAbsolutePath(candidatePath)
                this.enqueueSync(async () => {
                    await this.syncScriptAddedOrChanged(sourcePath, 'change', settings)
                    const stats = await safeStat(sourcePath)
                    if (stats) {
                        this.sourceSnapshot.set(sourcePath, {
                            mtimeMs: stats.mtimeMs,
                            size: stats.size,
                        })
                    }
                })
            })

            watcher.on('unlink', (candidatePath) => {
                const sourcePath = normalizeAbsolutePath(candidatePath)
                this.enqueueSync(async () => {
                    await this.syncScriptRemoved(sourcePath)
                    this.sourceSnapshot.delete(sourcePath)
                })
            })

            watcher.on('error', (error) => {
                console.error('Kanban script watcher error:', error)
                this.configureReconcileInterval(settings, FAST_RECONCILE_INTERVAL_MS)
            })

            return watcher
        } catch (error) {
            console.error('Chokidar unavailable; falling back to polling reconciliation:', error)
            return null
        }
    }

    private configureReconcileInterval(settings: ScriptWatcherSettings, intervalMs: number): void {
        if (this.reconcileInterval) {
            clearInterval(this.reconcileInterval)
            this.reconcileInterval = null
        }

        this.reconcileInterval = setInterval(() => {
            this.enqueueSync(async () => {
                await this.reconcileDirectoryDiff(settings)
            })
        }, intervalMs)

        this.reconcileInterval.unref?.()
    }

    private async waitForWatcherReady(watcher: ChokidarWatcher): Promise<void> {
        await new Promise<void>((resolve) => {
            let settled = false
            let timeout: NodeJS.Timeout | null = null

            const cleanup = () => {
                if (timeout) {
                    clearTimeout(timeout)
                }
                watcher.off('ready', onReady)
                watcher.off('error', onError)
            }

            const onReady = () => {
                if (settled) {
                    return
                }
                settled = true
                cleanup()
                resolve()
            }

            const onError = (error: unknown) => {
                if (settled) {
                    return
                }
                settled = true
                console.error('Kanban script watcher readiness error:', error)
                cleanup()
                resolve()
            }

            timeout = setTimeout(() => {
                if (settled) {
                    return
                }
                settled = true
                cleanup()
                resolve()
            }, 3_000)

            watcher.on('ready', onReady)
            watcher.on('error', onError)
        })
    }

    private enqueueSync(operation: () => Promise<void>): void {
        this.syncQueue = this.syncQueue
            .then(operation)
            .catch((error) => {
                console.error('Kanban script watcher sync error:', error)
            })
    }

    private async reconcileDirectoryDiff(settings: ScriptWatcherSettings): Promise<void> {
        const nextSnapshot = await captureDirectorySnapshot(settings)
        const previousSnapshot = this.sourceSnapshot

        for (const [sourcePath, nextEntry] of nextSnapshot) {
            const previousEntry = previousSnapshot.get(sourcePath)

            if (!previousEntry) {
                await this.syncScriptAddedOrChanged(sourcePath, 'add', settings)
                continue
            }

            if (
                previousEntry.mtimeMs !== nextEntry.mtimeMs
                || previousEntry.size !== nextEntry.size
            ) {
                await this.syncScriptAddedOrChanged(sourcePath, 'change', settings)
            }
        }

        for (const sourcePath of previousSnapshot.keys()) {
            if (!nextSnapshot.has(sourcePath)) {
                await this.syncScriptRemoved(sourcePath)
            }
        }

        await this.markMissingSources(settings, new Set(nextSnapshot.keys()))
        this.sourceSnapshot = nextSnapshot
    }

    private async syncScriptAddedOrChanged(
        sourcePath: string,
        eventType: Extract<SourceEventType, 'add' | 'change'>,
        settings: ScriptWatcherSettings,
    ): Promise<void> {
        if (!isSupportedScriptPath(sourcePath, settings.recognizedExtensions)) {
            return
        }

        const sourceHash = await computeSourceHash(sourcePath)
        if (!sourceHash) {
            await this.syncScriptRemoved(sourcePath)
            return
        }

        const existingTask = await prisma.kanbanTask.findFirst({
            where: { sourcePath },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                config: true,
            },
        })

        const sourceSyncUpdate: SourceSyncUpdate = {
            state: 'available',
            eventType,
            eventAtIso: new Date().toISOString(),
        }

        if (!existingTask) {
            const position = await getNextBacklogPosition()
            const createdTask = await prisma.kanbanTask.create({
                data: {
                    name: createTaskNameFromPath(sourcePath),
                    displayName: createDisplayNameFromPath(sourcePath, settings.watchDirectory),
                    sourcePath,
                    sourceHash,
                    column: 'backlog',
                    position,
                    config: mergeSourceSyncMetadata('{}', sourceSyncUpdate),
                    dependencies: '[]',
                },
            })
            emitScriptChangedEvent(eventType, sourcePath, createdTask.id)
            return
        }

        await prisma.kanbanTask.update({
            where: { id: existingTask.id },
            data: {
                sourceHash,
                config: mergeSourceSyncMetadata(existingTask.config, sourceSyncUpdate),
            },
        })
        emitScriptChangedEvent(eventType, sourcePath, existingTask.id)
    }

    private async syncScriptRemoved(sourcePath: string): Promise<void> {
        const tasks = await prisma.kanbanTask.findMany({
            where: { sourcePath },
            select: {
                id: true,
                sourceHash: true,
                config: true,
            },
        })

        if (tasks.length === 0) {
            return
        }

        const sourceSyncUpdate: SourceSyncUpdate = {
            state: 'missing',
            eventType: 'unlink',
            eventAtIso: new Date().toISOString(),
        }

        for (const task of tasks) {
            if (task.sourceHash === null && readSourceSyncState(task.config) === 'missing') {
                continue
            }

            await prisma.kanbanTask.update({
                where: { id: task.id },
                data: {
                    sourceHash: null,
                    config: mergeSourceSyncMetadata(task.config, sourceSyncUpdate),
                },
            })
            emitScriptChangedEvent('unlink', sourcePath, task.id)
        }
    }

    private async markMissingSources(
        settings: ScriptWatcherSettings,
        existingSourcePaths: Set<string>,
    ): Promise<void> {
        const tasks = await prisma.kanbanTask.findMany({
            where: {
                OR: [
                    { sourcePath: settings.watchDirectory },
                    { sourcePath: { startsWith: `${settings.watchDirectory}${path.sep}` } },
                ],
            },
            select: {
                id: true,
                sourcePath: true,
                sourceHash: true,
                config: true,
            },
        })

        for (const task of tasks) {
            const normalizedTaskPath = normalizeAbsolutePath(task.sourcePath)
            if (existingSourcePaths.has(normalizedTaskPath)) {
                continue
            }

            if (task.sourceHash === null && readSourceSyncState(task.config) === 'missing') {
                continue
            }

            await prisma.kanbanTask.update({
                where: { id: task.id },
                data: {
                    sourceHash: null,
                    config: mergeSourceSyncMetadata(task.config, {
                        state: 'missing',
                        eventType: 'unlink',
                        eventAtIso: new Date().toISOString(),
                    }),
                },
            })
            emitScriptChangedEvent('unlink', normalizedTaskPath, task.id)
        }
    }
}

function emitScriptChangedEvent(eventType: SourceEventType, sourcePath: string, taskId: string): void {
    emitKanbanRealtimeEvent({
        type: 'script:changed',
        taskId,
        payload: {
            eventType,
            sourcePath,
            changedAt: new Date().toISOString(),
        },
    })
}

async function loadWatcherSettings(): Promise<ScriptWatcherSettings> {
    const configRows = await prisma.kanbanAppConfig.findMany({
        select: {
            key: true,
            value: true,
        },
    })

    const rowByKey = new Map(configRows.map((row) => [row.key, row.value]))
    const settingsObject = extractSettingsObject(rowByKey)

    const watchDirectory = normalizeAbsolutePath(
        expandHomeDirectory(
            readString(settingsObject.watchDirectory)
            ?? readStringFromSerializedValue(rowByKey.get('watchDirectory'))
            ?? process.env.KANBAN_WATCH_DIRECTORY
            ?? DEFAULT_WATCH_DIRECTORY,
        ),
    )

    const recognizedExtensions = normalizeExtensions(
        readStringArray(settingsObject.recognizedExtensions)
        ?? readStringArrayFromSerializedValue(rowByKey.get('recognizedExtensions'))
        ?? readStringArrayFromSerializedValue(process.env.KANBAN_RECOGNIZED_EXTENSIONS)
        ?? DEFAULT_RECOGNIZED_EXTENSIONS,
    )

    return {
        watchDirectory,
        recognizedExtensions,
    }
}

function extractSettingsObject(rowByKey: Map<string, string>): Record<string, unknown> {
    for (const key of WATCHER_SETTINGS_KEYS) {
        const rawValue = rowByKey.get(key)
        if (!rawValue) {
            continue
        }

        const parsed = parseJsonValue(rawValue)
        if (isPlainObject(parsed)) {
            return parsed
        }
    }

    return {}
}

function parseJsonValue(rawValue: string): unknown {
    try {
        return JSON.parse(rawValue)
    } catch {
        return rawValue
    }
}

function readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

function readStringFromSerializedValue(rawValue: string | undefined): string | undefined {
    if (!rawValue) {
        return undefined
    }

    const parsed = parseJsonValue(rawValue)
    if (typeof parsed === 'string') {
        return readString(parsed)
    }

    return readString(rawValue)
}

function readStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined
    }

    const normalizedValues = value
        .filter((candidate): candidate is string => typeof candidate === 'string')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)

    return normalizedValues.length > 0 ? normalizedValues : undefined
}

function readStringArrayFromSerializedValue(rawValue: string | undefined): string[] | undefined {
    if (!rawValue) {
        return undefined
    }

    const parsed = parseJsonValue(rawValue)
    if (Array.isArray(parsed)) {
        return readStringArray(parsed)
    }

    const csvValues = rawValue
        .split(',')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0)

    return csvValues.length > 0 ? csvValues : undefined
}

function normalizeExtensions(extensions: string[]): string[] {
    const normalized = new Set<string>()

    for (const candidate of extensions) {
        const trimmedCandidate = candidate.trim().toLowerCase()
        if (trimmedCandidate.length === 0) {
            continue
        }

        const extension = trimmedCandidate.startsWith('.') ? trimmedCandidate : `.${trimmedCandidate}`
        if (!/^\.[a-z0-9]+$/i.test(extension)) {
            continue
        }

        normalized.add(extension)
    }

    if (normalized.size === 0) {
        return [...DEFAULT_RECOGNIZED_EXTENSIONS]
    }

    return Array.from(normalized)
}

function buildSettingsSignature(settings: ScriptWatcherSettings): string {
    const extensionSignature = [...settings.recognizedExtensions].sort().join(',')
    return `${settings.watchDirectory}|${extensionSignature}`
}

async function captureDirectorySnapshot(settings: ScriptWatcherSettings): Promise<SourceSnapshot> {
    const snapshot: SourceSnapshot = new Map()
    await collectDirectorySnapshot(settings.watchDirectory, settings.recognizedExtensions, snapshot)
    return snapshot
}

async function collectDirectorySnapshot(
    directoryPath: string,
    recognizedExtensions: string[],
    snapshot: SourceSnapshot,
): Promise<void> {
    let entries
    try {
        entries = await fs.readdir(directoryPath, { withFileTypes: true })
    } catch (error) {
        if (isNotFoundError(error)) {
            return
        }
        throw error
    }

    for (const entry of entries) {
        const fullPath = normalizeAbsolutePath(path.join(directoryPath, entry.name))

        if (entry.isDirectory()) {
            await collectDirectorySnapshot(fullPath, recognizedExtensions, snapshot)
            continue
        }

        if (!entry.isFile() || !isSupportedScriptPath(fullPath, recognizedExtensions)) {
            continue
        }

        const fileStats = await safeStat(fullPath)
        if (!fileStats) {
            continue
        }

        snapshot.set(fullPath, {
            mtimeMs: fileStats.mtimeMs,
            size: fileStats.size,
        })
    }
}

async function safeStat(targetPath: string): Promise<Stats | null> {
    try {
        return await fs.stat(targetPath)
    } catch (error) {
        if (isNotFoundError(error)) {
            return null
        }
        throw error
    }
}

async function computeSourceHash(sourcePath: string): Promise<string | null> {
    try {
        const sourceContent = await fs.readFile(sourcePath)
        return createHash('sha256').update(sourceContent).digest('hex')
    } catch (error) {
        if (isNotFoundError(error)) {
            return null
        }
        throw error
    }
}

function isSupportedScriptPath(sourcePath: string, recognizedExtensions: string[]): boolean {
    const extension = path.extname(sourcePath).toLowerCase()
    return recognizedExtensions.includes(extension)
}

async function getNextBacklogPosition(): Promise<number> {
    const maxPositionTask = await prisma.kanbanTask.findFirst({
        where: { column: 'backlog' },
        orderBy: { position: 'desc' },
        select: { position: true },
    })

    return (maxPositionTask?.position ?? -1) + 1
}

function createTaskNameFromPath(sourcePath: string): string {
    return path.parse(sourcePath).name
}

function createDisplayNameFromPath(sourcePath: string, watchDirectory: string): string {
    const relativePath = path.relative(watchDirectory, sourcePath)
    if (relativePath.startsWith('..') || relativePath.length === 0) {
        return path.basename(sourcePath)
    }

    return relativePath
}

function mergeSourceSyncMetadata(rawConfig: string, update: SourceSyncUpdate): string {
    const parsedConfig = readConfigObject(rawConfig)
    const sourceSync = isPlainObject(parsedConfig.sourceSync) ? { ...parsedConfig.sourceSync } : {}

    sourceSync.state = update.state
    sourceSync.lastEvent = update.eventType
    sourceSync.lastEventAt = update.eventAtIso

    if (update.state === 'missing') {
        if (typeof sourceSync.missingSince !== 'string') {
            sourceSync.missingSince = update.eventAtIso
        }
    } else {
        delete sourceSync.missingSince
    }

    parsedConfig.sourceSync = sourceSync
    return JSON.stringify(parsedConfig)
}

function readSourceSyncState(rawConfig: string): SourceSyncState | null {
    const parsedConfig = readConfigObject(rawConfig)
    if (!isPlainObject(parsedConfig.sourceSync)) {
        return null
    }

    const state = parsedConfig.sourceSync.state
    if (state === 'available' || state === 'missing') {
        return state
    }

    return null
}

function readConfigObject(rawConfig: string): Record<string, unknown> {
    const parsed = parseJsonValue(rawConfig)
    if (isPlainObject(parsed)) {
        return { ...parsed }
    }
    return {}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNotFoundError(error: unknown): boolean {
    return error instanceof Error
        && 'code' in error
        && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function normalizeAbsolutePath(candidatePath: string): string {
    return path.resolve(candidatePath)
}

function expandHomeDirectory(candidatePath: string): string {
    if (!candidatePath.startsWith('~')) {
        return candidatePath
    }

    if (candidatePath === '~') {
        return homedir()
    }

    if (candidatePath.startsWith('~/')) {
        return path.join(homedir(), candidatePath.slice(2))
    }

    return candidatePath
}

const globalForKanbanScriptWatcher = globalThis as unknown as {
    kanbanScriptWatcher: KanbanScriptWatcherService | undefined
}

export const kanbanScriptWatcher = globalForKanbanScriptWatcher.kanbanScriptWatcher
    ?? new KanbanScriptWatcherService()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanScriptWatcher.kanbanScriptWatcher = kanbanScriptWatcher
}

export async function ensureKanbanScriptWatcherStarted(): Promise<void> {
    await kanbanScriptWatcher.ensureStarted()
}
