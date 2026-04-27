import { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_LOG_PREVIEW_LINES = 50
const DEFAULT_LOG_PREVIEW_MAX_BYTES = 256 * 1024
const MAX_LOG_PREVIEW_LINES = 1_000
const MAX_LOG_PREVIEW_MAX_BYTES = 4 * 1024 * 1024
const MAX_LOG_FILE_REFERENCE_LENGTH = 255
const MAX_LOG_FILE_TOKEN_LENGTH = 80
const MAX_LOG_DIRECTORY_PATH_LENGTH = 4_096
const LOG_FILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.log$/
const DEFAULT_KANBAN_LOG_DIRECTORY = path.join(os.homedir(), '.kanban-tasks', 'logs')

export type KanbanLogStream = 'stdout' | 'stderr'

export interface CreatedExecutionLogFile {
    logFile: string
    absolutePath: string
}

interface LogPreviewOptions {
    lines?: number
    maxBytes?: number
}

export function getKanbanLogDirectory(): string {
    const configuredDirectory = process.env.KANBAN_LOG_DIR?.trim()
    const directory = configuredDirectory && configuredDirectory.length > 0
        ? path.resolve(configuredDirectory)
        : DEFAULT_KANBAN_LOG_DIRECTORY

    assertNoNullByte(directory, 'KANBAN_LOG_DIR')
    assertBoundedLength(directory, 'KANBAN_LOG_DIR', MAX_LOG_DIRECTORY_PATH_LENGTH)

    return directory
}

export async function createExecutionLogFile(
    executionId: string,
    createdAt: Date = new Date(),
): Promise<CreatedExecutionLogFile> {
    const directory = getKanbanLogDirectory()
    const safeExecutionId = sanitizeFileToken(executionId)
    const timestamp = createdAt.toISOString().replace(/[:.]/g, '-')
    const fileName = `${timestamp}-${safeExecutionId}.log`

    if (!isValidLogFileName(fileName)) {
        throw new Error('Unsafe execution log path')
    }

    const absolutePath = path.resolve(directory, fileName)

    if (!isPathWithinDirectory(directory, absolutePath)) {
        throw new Error('Unsafe execution log path')
    }

    await fsPromises.mkdir(directory, { recursive: true })
    await fsPromises.appendFile(absolutePath, '')

    return {
        logFile: fileName,
        absolutePath,
    }
}

export async function appendExecutionLogChunk(
    logFile: string,
    stream: KanbanLogStream,
    chunk: string,
    timestamp: Date = new Date(),
): Promise<void> {
    if (chunk.length === 0) {
        return
    }

    const absolutePath = resolveExecutionLogFilePath(logFile)
    const renderedChunk = formatExecutionLogChunk(stream, chunk, timestamp)
    await fsPromises.appendFile(absolutePath, renderedChunk, 'utf8')
}

export async function getExecutionLogPreview(
    logFile: string | null | undefined,
    options: LogPreviewOptions = {},
): Promise<string | null> {
    if (!logFile) {
        return null
    }

    const lines = coerceBoundedPositiveInteger(
        options.lines,
        DEFAULT_LOG_PREVIEW_LINES,
        MAX_LOG_PREVIEW_LINES,
    )
    const maxBytes = coerceBoundedPositiveInteger(
        options.maxBytes,
        DEFAULT_LOG_PREVIEW_MAX_BYTES,
        MAX_LOG_PREVIEW_MAX_BYTES,
    )

    try {
        const absolutePath = resolveExecutionLogFilePath(logFile)
        const stats = await fsPromises.stat(absolutePath)

        if (!stats.isFile()) {
            return null
        }

        const bytesToRead = Math.min(stats.size, maxBytes)
        if (bytesToRead <= 0) {
            return ''
        }

        const handle = await fsPromises.open(absolutePath, 'r')
        try {
            const buffer = Buffer.alloc(bytesToRead)
            const offset = Math.max(stats.size - bytesToRead, 0)

            await handle.read(buffer, 0, bytesToRead, offset)

            const content = buffer.toString('utf8')
            const allLines = content
                .split(/\r?\n/)
                .filter((line, index, source) => !(index === source.length - 1 && line.length === 0))

            return allLines.slice(-lines).join('\n')
        } finally {
            await handle.close()
        }
    } catch {
        return null
    }
}

export function resolveExecutionLogFilePath(logFile: string): string {
    const normalizedLogFile = logFile.trim()
    if (normalizedLogFile.length === 0) {
        throw new Error('Log file path is required')
    }

    assertNoNullByte(normalizedLogFile, 'logFile')
    assertBoundedLength(normalizedLogFile, 'logFile', MAX_LOG_FILE_REFERENCE_LENGTH)

    const baseDirectory = getKanbanLogDirectory()
    const absolutePath = path.isAbsolute(normalizedLogFile)
        ? path.resolve(normalizedLogFile)
        : path.resolve(baseDirectory, normalizedLogFile)

    if (!isPathWithinDirectory(baseDirectory, absolutePath)) {
        throw new Error('Unsafe log file path')
    }

    const relativePath = path.relative(baseDirectory, absolutePath)
    const fileName = path.basename(relativePath)
    if (relativePath !== fileName || !isValidLogFileName(fileName)) {
        throw new Error('Unsafe log file path')
    }

    return path.resolve(baseDirectory, fileName)
}

function sanitizeFileToken(value: string): string {
    const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '').trim().slice(0, MAX_LOG_FILE_TOKEN_LENGTH)
    return sanitized.length > 0 ? sanitized : 'execution'
}

function formatExecutionLogChunk(stream: KanbanLogStream, chunk: string, timestamp: Date): string {
    const prefix = `[${timestamp.toISOString()}] [${stream}] `
    const normalizedChunk = chunk.replace(/\r\n/g, '\n')
    const segments = normalizedChunk.split('\n')

    const rendered = segments.map((segment, index) => {
        const isTrailingEmptySegment = index === segments.length - 1 && segment.length === 0
        if (isTrailingEmptySegment) {
            return ''
        }

        return `${prefix}${segment}`
    }).join('\n')

    return rendered.endsWith('\n') ? rendered : `${rendered}\n`
}

function isPathWithinDirectory(directory: string, absolutePath: string): boolean {
    const relativePath = path.relative(path.resolve(directory), path.resolve(absolutePath))
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function assertNoNullByte(value: string, field: string): void {
    if (value.includes('\u0000')) {
        throw new Error(`${field} cannot contain null bytes`)
    }
}

function assertBoundedLength(value: string, field: string, maxLength: number): void {
    if (value.length <= maxLength) {
        return
    }

    throw new Error(`${field} exceeds max length (${maxLength})`)
}

function coerceBoundedPositiveInteger(value: number | undefined, fallback: number, max: number): number {
    if (value === undefined || !Number.isFinite(value)) {
        return fallback
    }

    const rounded = Math.round(value)
    if (rounded < 1) {
        return 1
    }

    if (rounded > max) {
        return max
    }

    return rounded
}

function isValidLogFileName(value: string): boolean {
    return value.length > 0
        && value.length <= MAX_LOG_FILE_REFERENCE_LENGTH
        && LOG_FILE_NAME_PATTERN.test(value)
}
