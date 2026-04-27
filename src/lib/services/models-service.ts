import { spawn } from 'node:child_process'
import { CLAUDE_FALLBACK_MODELS } from '@/lib/model-defaults'
import type { KanbanModelProvider } from '@/lib/validators'

export type ModelDiscoverySource = 'cli' | 'fallback'

export interface KanbanModelDiscoveryPayload {
    provider: KanbanModelProvider
    models: string[]
    options: Array<{ value: string; label: string }>
    source: ModelDiscoverySource
}

interface ModelDiscoveryOptions {
    refresh?: boolean
}

interface CommandResult {
    success: boolean
    stdout: string
}

const COMMAND_TIMEOUT_MS = 2500
const MAX_OUTPUT_LENGTH = 64_000
const MODEL_CACHE_TTL_MS = 30_000
const MODEL_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const NON_MODEL_TOKENS = new Set([
    'available',
    'command',
    'commands',
    'error',
    'failed',
    'id',
    'model',
    'models',
    'name',
    'usage',
])

const CODEX_FALLBACK_MODELS = [
    'gpt-4',
    'gpt-4-turbo',
    'o1-mini',
]

const modelCache = new Map<KanbanModelProvider, { expiresAt: number; payload: KanbanModelDiscoveryPayload }>()

export async function discoverKanbanModels(
    provider: KanbanModelProvider,
    options: ModelDiscoveryOptions = {},
): Promise<KanbanModelDiscoveryPayload> {
    const refresh = options.refresh ?? false

    if (!refresh) {
        const cached = modelCache.get(provider)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.payload
        }
    }

    const discovered = await discoverModels(provider)
    const payload = createPayload(provider, discovered.models, discovered.source)

    modelCache.set(provider, {
        expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
        payload,
    })

    return payload
}

async function discoverModels(
    provider: KanbanModelProvider,
): Promise<{ models: string[]; source: ModelDiscoverySource }> {
    switch (provider) {
        case 'claude': {
            const models = await discoverFromCommand('claude', ['--list-models'], parseGenericModels)
            if (models.length > 0) {
                return { models, source: 'cli' }
            }
            return { models: CLAUDE_FALLBACK_MODELS, source: 'fallback' }
        }
        case 'codex': {
            const models = await discoverFromCommand('codex', ['--list-models'], parseGenericModels)
            if (models.length > 0) {
                return { models, source: 'cli' }
            }
            return { models: CODEX_FALLBACK_MODELS, source: 'fallback' }
        }
        case 'ollama': {
            const models = await discoverFromCommand('ollama', ['list'], parseOllamaModels)
            if (models.length > 0) {
                return { models, source: 'cli' }
            }
            return { models: [], source: 'fallback' }
        }
    }
}

async function discoverFromCommand(
    command: string,
    args: string[],
    parser: (output: string) => string[],
): Promise<string[]> {
    const result = await runSafeCommand(command, args)
    if (!result.success) {
        return []
    }

    return parser(result.stdout)
}

async function runSafeCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
        let stdout = ''
        let timeoutReached = false

        const child = spawn(command, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'ignore'],
        })

        const timeout = setTimeout(() => {
            timeoutReached = true
            child.kill('SIGTERM')
        }, COMMAND_TIMEOUT_MS)

        child.stdout.on('data', (chunk) => {
            if (stdout.length >= MAX_OUTPUT_LENGTH) {
                return
            }

            const text = typeof chunk === 'string'
                ? chunk
                : chunk.toString('utf8')

            stdout += text

            if (stdout.length > MAX_OUTPUT_LENGTH) {
                stdout = stdout.slice(0, MAX_OUTPUT_LENGTH)
            }
        })

        child.on('error', () => {
            clearTimeout(timeout)
            resolve({ success: false, stdout: '' })
        })

        child.on('close', (code) => {
            clearTimeout(timeout)
            resolve({
                success: code === 0 && !timeoutReached,
                stdout,
            })
        })
    })
}

function parseGenericModels(output: string): string[] {
    const jsonModels = parseJsonModels(output)
    if (jsonModels.length > 0) {
        return normalizeModels(jsonModels)
    }

    const lineModels = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*]\s*/, ''))
        .map((line) => line.split(/\s+/)[0] ?? '')

    return normalizeModels(lineModels)
}

function parseOllamaModels(output: string): string[] {
    const jsonModels = parseJsonModels(output)
    if (jsonModels.length > 0) {
        return normalizeModels(jsonModels)
    }

    const lineModels = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^name\s+id\s+size\s+modified/i.test(line))
        .map((line) => line.split(/\s+/)[0] ?? '')

    return normalizeModels(lineModels)
}

function parseJsonModels(output: string): string[] {
    const text = output.trim()
    if (!text) {
        return []
    }

    try {
        const parsed: unknown = JSON.parse(text)
        return extractModelValues(parsed)
    } catch {
        return []
    }
}

function extractModelValues(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value]
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => extractModelValues(entry))
    }

    if (!value || typeof value !== 'object') {
        return []
    }

    const record = value as Record<string, unknown>
    const directKeys = ['id', 'model', 'name', 'value']
    const nestedKeys = ['models', 'items', 'data']

    return [
        ...directKeys.flatMap((key) => extractModelValues(record[key])),
        ...nestedKeys.flatMap((key) => extractModelValues(record[key])),
    ]
}

function normalizeModels(models: string[]): string[] {
    const seen = new Set<string>()
    const normalized: string[] = []

    for (const model of models) {
        const candidate = model
            .trim()
            .replace(/^['"`]+/, '')
            .replace(/['"`,]+$/, '')

        if (!candidate) {
            continue
        }

        if (NON_MODEL_TOKENS.has(candidate.toLowerCase())) {
            continue
        }

        if (!MODEL_TOKEN_PATTERN.test(candidate)) {
            continue
        }

        if (seen.has(candidate)) {
            continue
        }

        seen.add(candidate)
        normalized.push(candidate)
    }

    return normalized
}

function createPayload(
    provider: KanbanModelProvider,
    models: string[],
    source: ModelDiscoverySource,
): KanbanModelDiscoveryPayload {
    return {
        provider,
        models,
        options: models.map((model) => ({
            value: model,
            label: model,
        })),
        source,
    }
}
