#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapCliEnvironment } from './bootstrap'
import { coreDomainCommands } from './commands'
import { EXIT_CODE, type ResolvedCliGlobalOptions } from './constants'
import { toCliError, validationError } from './errors'
import { detectOutputFormatFromArgv, parseCliInput, type ParsedCliInput } from './parser'
import { resolveGlobalOptions, writeCliError, writeCommandOutput, writeMessage } from './output'
import type { CliCommand } from './types'

const commands: CliCommand[] = [
    {
        name: 'help',
        description: 'Show usage and available commands',
        requiresBootstrap: false,
        run() {
            return {
                raw: formatHelpText(),
                data: {
                    usage: 'prompter [global-options] <command> [args]',
                    commands: commands.map((command) => ({
                        name: command.name,
                        description: command.description,
                    })),
                },
            }
        },
    },
    {
        name: 'version',
        description: 'Show CLI version',
        requiresBootstrap: false,
        run() {
            const version = readPackageVersion()
            return {
                raw: version,
                data: { version },
            }
        },
    },
    {
        name: 'doctor',
        description: 'Validate runtime and database startup checks',
        run(context) {
            if (!context.bootstrap) {
                throw validationError('CLI bootstrap state is unavailable.')
            }

            const readinessPayload = {
                status: 'ok',
                projectRoot: context.bootstrap.projectRoot,
                nodeVersion: context.bootstrap.nodeVersion,
                databaseUrl: context.bootstrap.databaseUrl,
                databasePath: context.bootstrap.databasePath ?? '(non-file database)',
            }

            return {
                raw: [
                    'Environment checks passed.',
                    `Project root: ${readinessPayload.projectRoot}`,
                    `Node version: ${readinessPayload.nodeVersion}`,
                    `Database URL: ${readinessPayload.databaseUrl}`,
                    `Database path: ${readinessPayload.databasePath}`,
                ].join('\n'),
                data: readinessPayload,
                message: 'Environment checks passed.',
            }
        },
    },
    ...coreDomainCommands,
]

const commandMap = new Map(commands.map((command) => [command.name, command]))

async function main() {
    const argv = process.argv.slice(2)
    let outputFormat = detectOutputFormatFromArgv(argv)

    try {
        const parsedInput = parseCliInput(argv)
        const options = resolveGlobalOptions(parsedInput.globalOptions)
        outputFormat = options.output

        const exitCode = await executeParsedInput(parsedInput, options)
        process.exitCode = exitCode
    } catch (error) {
        const cliError = toCliError(error)
        writeCliError(cliError, outputFormat)
        process.exitCode = cliError.exitCode
    }
}

async function executeParsedInput(
    parsedInput: ParsedCliInput,
    options: ResolvedCliGlobalOptions
): Promise<number> {
    const command = commandMap.get(parsedInput.commandName)
    if (!command) {
        throw validationError(
            `Unknown command "${parsedInput.commandName}". Run "prompter help" for usage.`
        )
    }

    const bootstrap = command.requiresBootstrap === false ? undefined : bootstrapCliEnvironment()
    const result = await command.run({
        args: parsedInput.commandArgs,
        options,
        bootstrap,
    })

    if (result.message) {
        writeMessage(result.message, options.quiet)
    }

    const outputPayload = options.output === 'json' ? (result.data ?? result.raw) : (result.raw ?? result.data)
    if (outputPayload !== undefined) {
        writeCommandOutput(outputPayload, options.output)
    }

    return EXIT_CODE.SUCCESS
}

function readPackageVersion(): string {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
    const packagePath = path.resolve(currentDirectory, '../../package.json')
    try {
        const parsedPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string }
        return parsedPackage.version ?? '0.0.0'
    } catch {
        return '0.0.0'
    }
}

function formatHelpText(): string {
    const nameWidth = Math.max(...commands.map((command) => command.name.length))

    return [
        'Prompter CLI',
        '',
        'Usage:',
        '  prompter [global-options] <command> [args]',
        '',
        'Commands:',
        ...commands.map((command) => `  ${command.name.padEnd(nameWidth)}  ${command.description}`),
        '',
        'Global options:',
        '  --json                   Force JSON output (highest precedence)',
        '  --quiet                  Suppress non-error stderr messages',
        '  --output <table|json|raw>  Set output format when --json is not set',
        '  -h, --help               Show help',
        '  -v, --version            Show version',
    ].join('\n')
}

void main()
