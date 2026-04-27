import {
    OUTPUT_FORMATS,
    type CliGlobalOptions,
    type OutputFormat,
    type ResolvedCliGlobalOptions,
} from './constants'
import type { CliError } from './errors'
import { validationError } from './errors'

export function parseOutputFormat(value: string): OutputFormat {
    const normalizedValue = value.trim().toLowerCase()
    if (isOutputFormat(normalizedValue)) {
        return normalizedValue
    }

    throw validationError(
        `Invalid output format "${value}". Expected one of: ${OUTPUT_FORMATS.join(', ')}.`
    )
}

export function resolveGlobalOptions(options: CliGlobalOptions): ResolvedCliGlobalOptions {
    return {
        ...options,
        output: resolveOutputFormat(options),
    }
}

export function resolveOutputFormat(options: CliGlobalOptions): OutputFormat {
    if (options.json) {
        return 'json'
    }

    return options.output ?? 'table'
}

export function writeCommandOutput(output: unknown, format: OutputFormat) {
    if (output === undefined) {
        return
    }

    const renderedOutput = formatOutput(output, format)
    if (renderedOutput.length === 0) {
        return
    }

    if (renderedOutput.endsWith('\n')) {
        process.stdout.write(renderedOutput)
        return
    }

    process.stdout.write(`${renderedOutput}\n`)
}

export function writeCliError(error: CliError, format: OutputFormat) {
    if (format === 'json') {
        const errorPayload: Record<string, unknown> = {
            error: error.kind,
            message: error.message,
            exitCode: error.exitCode,
        }

        if (error.details !== undefined) {
            errorPayload.details = error.details
        }

        writeCommandOutput(errorPayload, 'json')
        return
    }

    process.stderr.write(`Error: ${error.message}\n`)
}

export function writeMessage(message: string, quiet: boolean) {
    if (quiet) {
        return
    }

    process.stderr.write(`${message}\n`)
}

function formatOutput(output: unknown, format: OutputFormat): string {
    switch (format) {
        case 'json':
            return JSON.stringify(output, null, 2)
        case 'raw':
            return formatRawOutput(output)
        case 'table':
            return formatTableOutput(output)
    }
}

function formatRawOutput(output: unknown): string {
    if (typeof output === 'string') {
        return output
    }

    if (output === undefined || output === null) {
        return ''
    }

    if (typeof output === 'object') {
        return JSON.stringify(output, null, 2)
    }

    return String(output)
}

function formatTableOutput(output: unknown): string {
    if (typeof output === 'string') {
        return output
    }

    if (Array.isArray(output)) {
        if (output.length === 0) {
            return '(no rows)'
        }

        if (output.every((value) => isRecord(value))) {
            return renderTable(output as Array<Record<string, unknown>>)
        }

        return output.map((value) => formatCell(value)).join('\n')
    }

    if (isRecord(output)) {
        const rows = Object.entries(output).map(([key, value]) => ({ key, value }))
        return renderTable(rows)
    }

    if (output === undefined || output === null) {
        return ''
    }

    return String(output)
}

function renderTable(rows: Array<Record<string, unknown>>): string {
    const headers = collectHeaders(rows)
    const renderedRows = rows.map((row) => headers.map((header) => formatCell(row[header])))
    const widths = headers.map((header, index) =>
        Math.max(header.length, ...renderedRows.map((row) => row[index].length))
    )

    const renderedHeader = headers.map((header, index) => header.padEnd(widths[index])).join('  ')
    const renderedDivider = widths.map((width) => '-'.repeat(width)).join('  ')
    const renderedBody = renderedRows.map((row) =>
        row.map((cell, index) => cell.padEnd(widths[index])).join('  ')
    )

    return [renderedHeader, renderedDivider, ...renderedBody].join('\n')
}

function collectHeaders(rows: Array<Record<string, unknown>>): string[] {
    const headers: string[] = []

    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!headers.includes(key)) {
                headers.push(key)
            }
        }
    }

    return headers
}

function formatCell(value: unknown): string {
    if (value === undefined || value === null) {
        return ''
    }

    if (typeof value === 'string') {
        return value
    }

    if (typeof value === 'object') {
        return JSON.stringify(value)
    }

    return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOutputFormat(value: string): value is OutputFormat {
    return OUTPUT_FORMATS.includes(value as OutputFormat)
}
