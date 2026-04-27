import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    createExecutionLogFile,
    appendExecutionLogChunk,
    getExecutionLogPreview,
    resolveExecutionLogFilePath,
    getKanbanLogDirectory,
} from '@/lib/kanban/log-storage'

let testDir: string

before(async () => {
    testDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'log-test-'))
    process.env.KANBAN_LOG_DIR = testDir
})

after(async () => {
    delete process.env.KANBAN_LOG_DIR
    await fsPromises.rm(testDir, { recursive: true, force: true })
})

describe('getKanbanLogDirectory', () => {
    it('returns KANBAN_LOG_DIR when set', () => {
        const dir = getKanbanLogDirectory()
        assert.equal(dir, path.resolve(testDir))
    })
})

describe('createExecutionLogFile', () => {
    it('creates a log file and returns logFile and absolutePath', async () => {
        const result = await createExecutionLogFile('exec-123', new Date('2026-04-15T10:30:00.000Z'))
        assert.ok(result.logFile.endsWith('.log'))
        assert.ok(result.logFile.includes('exec-123'))
        assert.ok(result.absolutePath.startsWith(testDir))

        const stat = await fsPromises.stat(result.absolutePath)
        assert.ok(stat.isFile())
    })

    it('sanitizes special characters in execution ID', async () => {
        const result = await createExecutionLogFile('../../../etc/passwd', new Date('2026-04-15T10:30:00.000Z'))
        assert.ok(result.logFile.includes('etcpasswd'))
        assert.ok(!result.logFile.includes('..'))
    })
})

describe('appendExecutionLogChunk', () => {
    it('appends formatted chunks to log file', async () => {
        const { logFile, absolutePath } = await createExecutionLogFile('append-test', new Date('2026-04-15T11:00:00.000Z'))
        const timestamp = new Date('2026-04-15T11:01:00.000Z')

        await appendExecutionLogChunk(logFile, 'stdout', 'Hello world', timestamp)
        await appendExecutionLogChunk(logFile, 'stderr', 'Error line', timestamp)

        const content = await fsPromises.readFile(absolutePath, 'utf8')
        assert.ok(content.includes('[stdout]'))
        assert.ok(content.includes('Hello world'))
        assert.ok(content.includes('[stderr]'))
        assert.ok(content.includes('Error line'))
    })

    it('skips empty chunks', async () => {
        const { logFile, absolutePath } = await createExecutionLogFile('empty-chunk', new Date('2026-04-15T11:00:00.000Z'))

        await appendExecutionLogChunk(logFile, 'stdout', '', new Date())

        const content = await fsPromises.readFile(absolutePath, 'utf8')
        assert.equal(content, '')
    })
})

describe('getExecutionLogPreview', () => {
    it('returns null for null/undefined log file', async () => {
        assert.equal(await getExecutionLogPreview(null), null)
        assert.equal(await getExecutionLogPreview(undefined), null)
    })

    it('returns tail of log file content', async () => {
        const { logFile } = await createExecutionLogFile('preview-test', new Date('2026-04-15T12:00:00.000Z'))
        const timestamp = new Date('2026-04-15T12:01:00.000Z')

        for (let i = 0; i < 10; i++) {
            await appendExecutionLogChunk(logFile, 'stdout', `Line ${i}`, timestamp)
        }

        const preview = await getExecutionLogPreview(logFile, { lines: 3 })
        assert.ok(preview !== null)
        const lines = preview.split('\n')
        assert.equal(lines.length, 3)
    })

    it('returns null for non-existent log file', async () => {
        const preview = await getExecutionLogPreview('nonexistent-file.log')
        assert.equal(preview, null)
    })
})

describe('resolveExecutionLogFilePath', () => {
    it('resolves relative log file to absolute path', () => {
        const absolutePath = resolveExecutionLogFilePath('test-file.log')
        assert.ok(path.isAbsolute(absolutePath))
        assert.ok(absolutePath.endsWith('test-file.log'))
    })

    it('rejects empty log file path', () => {
        assert.throws(() => resolveExecutionLogFilePath(''), /Log file path is required/)
    })

    it('rejects null bytes in log file', () => {
        assert.throws(() => resolveExecutionLogFilePath('file\x00.log'), /null bytes/)
    })

    it('rejects path traversal attempts', () => {
        assert.throws(() => resolveExecutionLogFilePath('../../../etc/passwd'))
    })
})
