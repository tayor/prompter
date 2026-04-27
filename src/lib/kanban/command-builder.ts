import path from 'node:path'
import type { ParsedKanbanTask } from '@/lib/kanban/types'

const MAX_COMMAND_LENGTH = 512
const MAX_ARGUMENT_LENGTH = 8_192
const MAX_ARGUMENT_COUNT = 128
const MAX_ARGUMENT_STRING_LENGTH = 24_000
const MAX_ENV_VAR_KEY_LENGTH = 128
const MAX_ENV_VAR_VALUE_LENGTH = 8_192
const MAX_MODEL_LENGTH = 256
const MAX_PROMPT_LENGTH = 20_000

export interface BuiltKanbanCommand {
    command: string
    args: string[]
    cwd: string
    env: NodeJS.ProcessEnv
    stdinFilePath?: string
    displayCommand: string
}

export function buildKanbanCommand(task: ParsedKanbanTask): BuiltKanbanCommand {
    const sourcePath = path.resolve(task.sourcePath)
    const cwd = task.config.workingDirectory
        ? path.resolve(task.config.workingDirectory)
        : path.dirname(sourcePath)

    assertNoNullByte(sourcePath, 'sourcePath')
    assertNoNullByte(cwd, 'workingDirectory')
    assertBoundedLength(sourcePath, 'sourcePath', MAX_ARGUMENT_LENGTH)
    assertBoundedLength(cwd, 'workingDirectory', MAX_ARGUMENT_LENGTH)

    const env = buildCommandEnvironment(task.config.envVars)

    const tool = normalizeToolMode(task.config.tool)
    const prompt = task.config.prompt ?? ''
    const model = task.config.model

    assertBoundedLength(prompt, 'prompt', MAX_PROMPT_LENGTH)
    assertBoundedLength(model, 'model', MAX_MODEL_LENGTH)

    const additionalArgs = parseArgumentString(task.config.additionalArgs)

    switch (tool) {
        case 'claude-cli': {
            ensureRequired(model, 'model', tool)
            const args = [
                '-m',
                model,
                '-p',
                prompt,
                '--output-format',
                'json',
                sourcePath,
                ...additionalArgs,
            ]
            return createCommand('claude', args, cwd, env)
        }

        case 'codex-cli': {
            ensureRequired(model, 'model', tool)
            const args = [
                '--model',
                model,
                '--prompt',
                prompt,
                sourcePath,
                ...additionalArgs,
            ]
            return createCommand('codex', args, cwd, env)
        }

        case 'ollama': {
            ensureRequired(model, 'model', tool)
            const args = ['run', model, prompt, ...additionalArgs]
            return createCommand('ollama', args, cwd, env, sourcePath)
        }

        case 'custom-bash': {
            env.TASK_PROMPT = prompt
            const args = [sourcePath, ...additionalArgs]
            return createCommand('bash', args, cwd, env)
        }

        case 'custom-command': {
            const commandInput = task.config.customCommand ?? task.config.additionalArgs
            const commandTokens = parseArgumentString(commandInput)
            if (commandTokens.length === 0) {
                throw new Error('custom-command requires a command string')
            }

            const [command, ...args] = commandTokens
            return createCommand(command, args, cwd, env)
        }
    }
}

export function parseArgumentString(rawArgs: string | undefined): string[] {
    if (!rawArgs) {
        return []
    }

    assertNoNullByte(rawArgs, 'additionalArgs')
    assertBoundedLength(rawArgs, 'additionalArgs', MAX_ARGUMENT_STRING_LENGTH)

    const tokens: string[] = []
    let current = ''
    let quote: '"' | '\'' | null = null
    let escaping = false

    for (let index = 0; index < rawArgs.length; index += 1) {
        const character = rawArgs[index]

        if (escaping) {
            current += character
            escaping = false
            continue
        }

        if (character === '\\') {
            escaping = true
            continue
        }

        if (quote) {
            if (character === quote) {
                quote = null
            } else {
                current += character
            }
            continue
        }

        if (character === '"' || character === '\'') {
            quote = character
            continue
        }

        if (character.trim().length === 0) {
            if (current.length > 0) {
                tokens.push(current)
                current = ''
                assertBoundedTokenCount(tokens)
            }
            continue
        }

        current += character
    }

    if (escaping) {
        current += '\\'
    }

    if (quote) {
        throw new Error(`Unclosed quote in argument string: ${rawArgs}`)
    }

    if (current.length > 0) {
        tokens.push(current)
    }

    assertBoundedTokenCount(tokens)

    for (const token of tokens) {
        assertNoNullByte(token, 'argument')
        assertBoundedLength(token, 'argument', MAX_ARGUMENT_LENGTH)
    }

    return tokens
}

function createCommand(
    command: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    stdinFilePath?: string,
): BuiltKanbanCommand {
    if (command.trim().length === 0) {
        throw new Error('Command cannot be empty')
    }

    assertNoNullByte(command, 'command')
    assertBoundedLength(command, 'command', MAX_COMMAND_LENGTH)
    assertBoundedTokenCount(args)

    for (const arg of args) {
        assertNoNullByte(arg, 'argument')
        assertBoundedLength(arg, 'argument', MAX_ARGUMENT_LENGTH)
    }

    return {
        command,
        args,
        cwd,
        env,
        stdinFilePath,
        displayCommand: formatDisplayCommand(command, args, stdinFilePath),
    }
}

function ensureRequired(value: string, field: string, tool: string): void {
    if (value.trim().length > 0) {
        return
    }

    throw new Error(`${tool} requires ${field}`)
}

function normalizeToolMode(tool: ParsedKanbanTask['config']['tool']): Exclude<ParsedKanbanTask['config']['tool'], 'custom'> {
    if (tool === 'custom') {
        return 'custom-command'
    }

    return tool
}

function formatDisplayCommand(command: string, args: string[], stdinFilePath?: string): string {
    const display = [quoteForDisplay(command), ...args.map(quoteForDisplay)].join(' ')

    if (!stdinFilePath) {
        return display
    }

    return `${display} < ${quoteForDisplay(stdinFilePath)}`
}

function quoteForDisplay(value: string): string {
    if (value.length === 0) {
        return "''"
    }

    if (/^[\w./:@-]+$/.test(value)) {
        return value
    }

    const escaped = value.replace(/'/g, `'\\''`)
    return `'${escaped}'`
}

function assertNoNullByte(value: string, field: string): void {
    if (!value.includes('\u0000')) {
        return
    }

    throw new Error(`${field} cannot contain null bytes`)
}

function assertBoundedLength(value: string, field: string, maxLength: number): void {
    if (value.length <= maxLength) {
        return
    }

    throw new Error(`${field} exceeds max length (${maxLength})`)
}

function assertBoundedTokenCount(tokens: string[]): void {
    if (tokens.length <= MAX_ARGUMENT_COUNT) {
        return
    }

    throw new Error(`Too many command arguments (max ${MAX_ARGUMENT_COUNT})`)
}

function buildCommandEnvironment(taskEnv: Record<string, string>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
    }

    for (const [key, value] of Object.entries(taskEnv)) {
        const normalizedKey = key.trim()
        if (!isValidEnvironmentVariableKey(normalizedKey)) {
            throw new Error(`Invalid environment variable key: ${key}`)
        }

        assertNoNullByte(value, `env var ${normalizedKey}`)
        assertBoundedLength(value, `env var ${normalizedKey}`, MAX_ENV_VAR_VALUE_LENGTH)
        env[normalizedKey] = value
    }

    return env
}

function isValidEnvironmentVariableKey(value: string): boolean {
    if (value.length === 0 || value.length > MAX_ENV_VAR_KEY_LENGTH) {
        return false
    }

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}
