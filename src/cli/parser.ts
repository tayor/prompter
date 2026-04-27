import { OUTPUT_FORMATS, type CliGlobalOptions, type OutputFormat } from './constants'
import { validationError } from './errors'
import { parseOutputFormat } from './output'

export interface ParsedCliInput {
    commandName: string
    commandArgs: string[]
    globalOptions: CliGlobalOptions
}

export function parseCliInput(argv: string[]): ParsedCliInput {
    const globalOptions: CliGlobalOptions = {
        json: false,
        quiet: false,
    }
    const commandArgs: string[] = []
    let commandName: string | undefined
    let index = 0

    while (index < argv.length) {
        const token = argv[index]

        if (token === '--') {
            if (!commandName) {
                commandName = argv[index + 1] || 'help'
                commandArgs.push(...argv.slice(index + 2))
            } else {
                commandArgs.push(...argv.slice(index + 1))
            }
            break
        }

        const consumed = consumeGlobalOption(argv, index, globalOptions)
        if (consumed > 0) {
            index += consumed
            continue
        }

        if (!commandName && (token === '-h' || token === '--help')) {
            commandName = 'help'
            index += 1
            continue
        }

        if (!commandName && (token === '-v' || token === '--version')) {
            commandName = 'version'
            index += 1
            continue
        }

        if (!commandName) {
            if (token.startsWith('-')) {
                throw validationError(`Unknown global option "${token}".`)
            }

            commandName = token
            index += 1
            continue
        }

        commandArgs.push(token)
        index += 1
    }

    return {
        commandName: commandName || 'help',
        commandArgs,
        globalOptions,
    }
}

export function detectOutputFormatFromArgv(argv: string[]): OutputFormat {
    if (argv.includes('--json')) {
        return 'json'
    }

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index]
        if (token.startsWith('--output=')) {
            const candidate = token.slice('--output='.length).toLowerCase()
            if (isOutputFormat(candidate)) {
                return candidate
            }
        }

        if (token === '--output') {
            const candidate = (argv[index + 1] ?? '').toLowerCase()
            if (isOutputFormat(candidate)) {
                return candidate
            }
        }
    }

    return 'table'
}

function consumeGlobalOption(
    argv: string[],
    index: number,
    globalOptions: CliGlobalOptions
): number {
    const token = argv[index]

    if (token === '--json') {
        globalOptions.json = true
        return 1
    }

    if (token === '--quiet') {
        globalOptions.quiet = true
        return 1
    }

    if (token.startsWith('--output=')) {
        const outputValue = token.slice('--output='.length)
        if (!outputValue) {
            throw validationError(`Option "${token}" requires a value.`)
        }

        globalOptions.output = parseOutputFormat(outputValue)
        return 1
    }

    if (token === '--output') {
        const outputValue = argv[index + 1]
        if (!outputValue) {
            throw validationError('Option "--output" requires one of: table, json, raw.')
        }

        globalOptions.output = parseOutputFormat(outputValue)
        return 2
    }

    return 0
}

function isOutputFormat(value: string): value is OutputFormat {
    return OUTPUT_FORMATS.includes(value as OutputFormat)
}
