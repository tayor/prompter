import assert from 'node:assert/strict'
import test from 'node:test'
import {
    getOptionValue,
    hasFlag,
    parseBooleanOption,
    parseCommandArgs,
    parseIntegerOption,
    readDataPayload,
    splitCsvValues,
} from '@/cli/command-args'

test('parseCommandArgs separates positionals, options, and flags', () => {
    const parsed = parseCommandArgs(['list', '--limit', '10', '--quiet'])

    assert.deepEqual(parsed.positionals, ['list'])
    assert.equal(getOptionValue(parsed, 'limit'), '10')
    assert.equal(hasFlag(parsed, 'quiet'), true)
})

test('parseCommandArgs supports --no-* boolean options', () => {
    const parsed = parseCommandArgs(['data', '--no-prompts'])
    assert.equal(parseBooleanOption(parsed, 'prompts'), false)
})

test('readDataPayload parses --data JSON payloads', () => {
    const parsed = parseCommandArgs(['create', '--data', '{"name":"Tag 1","color":"#fff"}'])
    const payload = readDataPayload(parsed) as Record<string, string>

    assert.equal(payload.name, 'Tag 1')
    assert.equal(payload.color, '#fff')
})

test('parseIntegerOption parses integer command options', () => {
    const parsed = parseCommandArgs(['list', '--limit=25'])
    assert.equal(parseIntegerOption(parsed, 'limit'), 25)
})

test('parseIntegerOption rejects non-integer option values', () => {
    const decimal = parseCommandArgs(['list', '--limit=2.5'])
    assert.throws(() => parseIntegerOption(decimal, 'limit'))

    const suffix = parseCommandArgs(['list', '--limit=25items'])
    assert.throws(() => parseIntegerOption(suffix, 'limit'))
})

test('parseIntegerOption rejects unsafe integers', () => {
    const unsafe = parseCommandArgs(['list', `--limit=${Number.MAX_SAFE_INTEGER + 1}`])
    assert.throws(() => parseIntegerOption(unsafe, 'limit'))
})

test('splitCsvValues expands comma-delimited values', () => {
    assert.deepEqual(splitCsvValues(['a,b', ' c ', 'd,e']), ['a', 'b', 'c', 'd', 'e'])
})
