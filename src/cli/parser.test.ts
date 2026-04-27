import assert from 'node:assert/strict'
import test from 'node:test'
import { CliError } from '@/cli/errors'
import { detectOutputFormatFromArgv, parseCliInput } from '@/cli/parser'

test('parseCliInput parses command and global options in argv order', () => {
    const parsed = parseCliInput(['prompt', 'list', '--output=raw', '--quiet'])

    assert.equal(parsed.commandName, 'prompt')
    assert.deepEqual(parsed.commandArgs, ['list'])
    assert.equal(parsed.globalOptions.output, 'raw')
    assert.equal(parsed.globalOptions.quiet, true)
    assert.equal(parsed.globalOptions.json, false)
})

test('parseCliInput rejects unknown global options before command', () => {
    assert.throws(
        () => parseCliInput(['--unknown-option']),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Unknown global option')
    )
})

test('detectOutputFormatFromArgv prioritizes --json over --output', () => {
    const outputFormat = detectOutputFormatFromArgv(['prompt', 'list', '--output=raw', '--json'])
    assert.equal(outputFormat, 'json')
})

test('parseCliInput supports kanban command groups with global flags', () => {
    const parsed = parseCliInput(['--quiet', 'task', 'list', '--column', 'queued'])

    assert.equal(parsed.commandName, 'task')
    assert.deepEqual(parsed.commandArgs, ['list', '--column', 'queued'])
    assert.equal(parsed.globalOptions.quiet, true)
})

test('parseCliInput supports schedule command group and output flags', () => {
    const parsed = parseCliInput(['--output', 'json', 'schedule', 'list', '--status', 'active'])

    assert.equal(parsed.commandName, 'schedule')
    assert.deepEqual(parsed.commandArgs, ['list', '--status', 'active'])
    assert.equal(parsed.globalOptions.output, 'json')
})
