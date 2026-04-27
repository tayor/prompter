import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { getCliProjectRoot } from './bootstrap'
import { validationError } from './errors'

export interface ParsedCommandArgs {
    positionals: string[]
    options: Record<string, string[]>
    flags: Set<string>
}

export function parseCommandArgs(args: string[]): ParsedCommandArgs {
    const positionals: string[] = []
    const options: Record<string, string[]> = {}
    const flags = new Set<string>()

    let index = 0

    while (index < args.length) {
        const token = args[index]

        if (token === '--') {
            positionals.push(...args.slice(index + 1))
            break
        }

        if (!token.startsWith('--')) {
            positionals.push(token)
            index += 1
            continue
        }

        const tokenBody = token.slice(2)
        if (!tokenBody) {
            throw validationError('Invalid option "--".')
        }

        const equalsIndex = tokenBody.indexOf('=')
        if (equalsIndex >= 0) {
            const optionName = normalizeOptionName(tokenBody.slice(0, equalsIndex))
            const optionValue = tokenBody.slice(equalsIndex + 1)
            addOptionValue(options, optionName, optionValue)
            index += 1
            continue
        }

        if (tokenBody.startsWith('no-')) {
            const negativeOptionName = normalizeOptionName(tokenBody.slice('no-'.length))
            addOptionValue(options, negativeOptionName, 'false')
            index += 1
            continue
        }

        const optionName = normalizeOptionName(tokenBody)
        const nextToken = args[index + 1]
        if (nextToken !== undefined && !nextToken.startsWith('--')) {
            addOptionValue(options, optionName, nextToken)
            index += 2
            continue
        }

        flags.add(optionName)
        index += 1
    }

    return {
        positionals,
        options,
        flags,
    }
}

export function hasFlag(parsedArgs: ParsedCommandArgs, optionName: string): boolean {
    return parsedArgs.flags.has(normalizeOptionName(optionName))
}

export function getOptionValue(parsedArgs: ParsedCommandArgs, optionName: string): string | undefined {
    const optionValues = parsedArgs.options[normalizeOptionName(optionName)]
    if (!optionValues || optionValues.length === 0) {
        return undefined
    }

    return optionValues[optionValues.length - 1]
}

export function getOptionValues(parsedArgs: ParsedCommandArgs, optionName: string): string[] {
    return parsedArgs.options[normalizeOptionName(optionName)] ?? []
}

export function requirePositional(
    parsedArgs: ParsedCommandArgs,
    index: number,
    label: string
): string {
    const value = parsedArgs.positionals[index]
    if (!value) {
        throw validationError(`Missing required ${label}.`)
    }

    return value
}

export function parseBooleanOption(parsedArgs: ParsedCommandArgs, optionName: string): boolean | undefined {
    const optionValue = getOptionValue(parsedArgs, optionName)
    if (optionValue !== undefined) {
        const normalizedValue = optionValue.trim().toLowerCase()
        if (['true', '1', 'yes', 'y', 'on'].includes(normalizedValue)) {
            return true
        }
        if (['false', '0', 'no', 'n', 'off'].includes(normalizedValue)) {
            return false
        }

        throw validationError(`Option "--${optionName}" must be true or false.`)
    }

    if (hasFlag(parsedArgs, optionName)) {
        return true
    }

    return undefined
}

export function parseIntegerOption(
    parsedArgs: ParsedCommandArgs,
    optionName: string
): number | undefined {
    const optionValue = getOptionValue(parsedArgs, optionName)
    if (optionValue === undefined) {
        return undefined
    }

    const normalizedValue = optionValue.trim()
    if (!/^[+-]?\d+$/.test(normalizedValue)) {
        throw validationError(`Option "--${optionName}" must be an integer.`)
    }

    const parsedInteger = Number.parseInt(normalizedValue, 10)
    if (!Number.isSafeInteger(parsedInteger)) {
        throw validationError(`Option "--${optionName}" must be a safe integer.`)
    }

    return parsedInteger
}

export function readDataPayload(parsedArgs: ParsedCommandArgs): unknown {
    const inlineData = getOptionValue(parsedArgs, 'data')
    const fileData = getOptionValue(parsedArgs, 'file')

    if (inlineData && fileData) {
        throw validationError('Provide only one of --data or --file.')
    }

    if (!inlineData && !fileData) {
        throw validationError('Provide payload with --data <json> or --file <path>.')
    }

    if (inlineData) {
        return parseJsonValue(inlineData, '--data')
    }

    return readStructuredDataFile(fileData as string)
}

export function readStructuredDataFile(filePathInput: string, format?: 'json' | 'yaml'): unknown {
    const absolutePath = path.resolve(getCliProjectRoot(), filePathInput)
    let contents: string

    try {
        contents = fs.readFileSync(absolutePath, 'utf8')
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw validationError(`File not found: ${absolutePath}`)
        }
        throw error
    }

    const inferredFormat = format
        ?? (absolutePath.endsWith('.yaml') || absolutePath.endsWith('.yml') ? 'yaml' : 'json')

    if (inferredFormat === 'yaml') {
        try {
            const parsed = yaml.load(contents)
            if (parsed === undefined) {
                throw validationError(`File "${absolutePath}" is empty.`)
            }
            return parsed
        } catch (error) {
            if (error instanceof Error && error.name === 'CliError') {
                throw error
            }
            throw validationError(`Failed to parse YAML in "${absolutePath}".`)
        }
    }

    return parseJsonValue(contents, absolutePath)
}

export function parseJsonValue<T>(rawValue: string, sourceLabel: string): T {
    try {
        return JSON.parse(rawValue) as T
    } catch {
        throw validationError(`Failed to parse JSON from ${sourceLabel}.`)
    }
}

export function splitCsvValues(values: string[]): string[] {
    return values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
}

function addOptionValue(
    options: Record<string, string[]>,
    optionName: string,
    optionValue: string
) {
    if (!options[optionName]) {
        options[optionName] = []
    }
    options[optionName].push(optionValue)
}

function normalizeOptionName(optionName: string): string {
    const normalizedOptionName = optionName
        .replace(/^-+/, '')
        .trim()
        .replace(/-([a-z])/g, (_, character: string) => character.toUpperCase())

    if (!normalizedOptionName) {
        throw validationError('Option name must not be empty.')
    }

    return normalizedOptionName
}
