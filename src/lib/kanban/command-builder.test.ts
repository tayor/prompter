import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildKanbanCommand, parseArgumentString } from '@/lib/kanban/command-builder'
import type { ParsedKanbanTask } from '@/lib/kanban/types'

function makeTask(overrides: Partial<ParsedKanbanTask> = {}): ParsedKanbanTask {
    return {
        id: 'test-task-1',
        name: 'Test Task',
        displayName: null,
        description: null,
        sourcePath: '/tmp/test-script.sh',
        sourceHash: null,
        column: 'queued',
        position: 0,
        tags: [],
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        config: {
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            prompt: 'test prompt',
            envVars: {},
            timeout: 300,
            retryOnFail: false,
            maxRetries: 0,
            retryDelay: 0,
        },
        ...overrides,
    }
}

describe('buildKanbanCommand', () => {
    it('builds claude-cli command with correct args', () => {
        const task = makeTask()
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'claude')
        assert.ok(cmd.args.includes('-m'))
        assert.ok(cmd.args.includes('claude-sonnet-4'))
        assert.ok(cmd.args.includes('-p'))
        assert.ok(cmd.args.includes('test prompt'))
        assert.ok(cmd.args.includes('--output-format'))
        assert.ok(cmd.args.includes('json'))
        assert.ok(cmd.args.includes('/tmp/test-script.sh'))
    })

    it('builds codex-cli command with correct args', () => {
        const task = makeTask({
            config: {
                tool: 'codex-cli',
                model: 'gpt-4',
                prompt: 'codex prompt',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'codex')
        assert.ok(cmd.args.includes('--model'))
        assert.ok(cmd.args.includes('gpt-4'))
        assert.ok(cmd.args.includes('--prompt'))
    })

    it('builds ollama command with stdin file path', () => {
        const task = makeTask({
            config: {
                tool: 'ollama',
                model: 'llama3',
                prompt: 'ollama prompt',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'ollama')
        assert.ok(cmd.args.includes('run'))
        assert.ok(cmd.args.includes('llama3'))
        assert.equal(cmd.stdinFilePath, '/tmp/test-script.sh')
    })

    it('builds custom-bash command with TASK_PROMPT env var', () => {
        const task = makeTask({
            config: {
                tool: 'custom-bash',
                model: 'none',
                prompt: 'my bash prompt',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'bash')
        assert.ok(cmd.args.includes('/tmp/test-script.sh'))
        assert.equal(cmd.env.TASK_PROMPT, 'my bash prompt')
    })

    it('builds custom-command from customCommand field', () => {
        const task = makeTask({
            config: {
                tool: 'custom-command',
                model: 'none',
                customCommand: 'python3 -c "print(1)"',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'python3')
        assert.ok(cmd.args.includes('-c'))
        assert.ok(cmd.args.includes('print(1)'))
    })

    it('normalizes custom tool to custom-command', () => {
        const task = makeTask({
            config: {
                tool: 'custom',
                model: 'none',
                customCommand: 'echo hello',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.command, 'echo')
        assert.deepEqual(cmd.args, ['hello'])
    })

    it('rejects null bytes in source path', () => {
        const task = makeTask({ sourcePath: '/tmp/test\0evil.sh' })
        assert.throws(() => buildKanbanCommand(task), /null bytes/)
    })

    it('includes custom env vars in environment', () => {
        const task = makeTask({
            config: {
                tool: 'claude-cli',
                model: 'claude-sonnet-4',
                envVars: { MY_VAR: 'my_value' },
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        const cmd = buildKanbanCommand(task)
        assert.equal(cmd.env.MY_VAR, 'my_value')
    })

    it('rejects invalid env var keys', () => {
        const task = makeTask({
            config: {
                tool: 'claude-cli',
                model: 'claude-sonnet-4',
                envVars: { '1BAD_KEY': 'value' },
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        assert.throws(() => buildKanbanCommand(task), /Invalid environment variable key/)
    })

    it('rejects empty model for claude-cli', () => {
        const task = makeTask({
            config: {
                tool: 'claude-cli',
                model: '  ',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        assert.throws(() => buildKanbanCommand(task), /requires model/)
    })

    it('custom-command throws on empty command string', () => {
        const task = makeTask({
            config: {
                tool: 'custom-command',
                model: 'none',
                customCommand: '',
                envVars: {},
                timeout: 300,
                retryOnFail: false,
                maxRetries: 0,
                retryDelay: 0,
            },
        })
        assert.throws(() => buildKanbanCommand(task), /requires a command string/)
    })

    it('generates a display command string', () => {
        const task = makeTask()
        const cmd = buildKanbanCommand(task)
        assert.ok(cmd.displayCommand.length > 0)
        assert.ok(cmd.displayCommand.includes('claude'))
    })
})

describe('parseArgumentString', () => {
    it('returns empty array for undefined input', () => {
        assert.deepEqual(parseArgumentString(undefined), [])
    })

    it('returns empty array for empty string', () => {
        assert.deepEqual(parseArgumentString(''), [])
    })

    it('splits simple space-separated args', () => {
        assert.deepEqual(parseArgumentString('--flag value'), ['--flag', 'value'])
    })

    it('handles double-quoted strings', () => {
        assert.deepEqual(parseArgumentString('--msg "hello world"'), ['--msg', 'hello world'])
    })

    it('handles single-quoted strings', () => {
        assert.deepEqual(parseArgumentString("--msg 'hello world'"), ['--msg', 'hello world'])
    })

    it('handles escaped characters', () => {
        assert.deepEqual(parseArgumentString('a\\ b'), ['a b'])
    })

    it('rejects unclosed quotes', () => {
        assert.throws(() => parseArgumentString('"unclosed'), /Unclosed quote/)
    })

    it('rejects null bytes', () => {
        assert.throws(() => parseArgumentString('test\0evil'), /null bytes/)
    })

    it('handles trailing backslash', () => {
        const result = parseArgumentString('test\\')
        assert.deepEqual(result, ['test\\'])
    })

    it('handles multiple whitespace between args', () => {
        assert.deepEqual(parseArgumentString('a   b   c'), ['a', 'b', 'c'])
    })
})
