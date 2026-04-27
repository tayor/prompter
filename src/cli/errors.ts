import { EXIT_CODE, type ExitCode } from './constants'

export type CliErrorKind = 'validation' | 'not_found' | 'conflict' | 'unexpected'

export class CliError extends Error {
    readonly exitCode: ExitCode
    readonly kind: CliErrorKind
    readonly details?: unknown

    constructor(message: string, exitCode: ExitCode, kind: CliErrorKind, details?: unknown) {
        super(message)
        this.name = 'CliError'
        this.exitCode = exitCode
        this.kind = kind
        this.details = details
    }
}

export function validationError(message: string, details?: unknown): CliError {
    return new CliError(message, EXIT_CODE.VALIDATION, 'validation', details)
}

export function notFoundError(message: string, details?: unknown): CliError {
    return new CliError(message, EXIT_CODE.NOT_FOUND, 'not_found', details)
}

export function conflictError(message: string, details?: unknown): CliError {
    return new CliError(message, EXIT_CODE.CONFLICT, 'conflict', details)
}

export function unexpectedError(message: string, details?: unknown): CliError {
    return new CliError(message, EXIT_CODE.UNEXPECTED, 'unexpected', details)
}

export function toCliError(error: unknown): CliError {
    if (error instanceof CliError) {
        return error
    }

    if (error instanceof Error) {
        return unexpectedError(error.message)
    }

    return unexpectedError('Unexpected CLI failure')
}
