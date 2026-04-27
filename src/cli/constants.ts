export const EXIT_CODE = {
    SUCCESS: 0,
    UNEXPECTED: 1,
    VALIDATION: 2,
    NOT_FOUND: 3,
    CONFLICT: 4,
} as const

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE]

export const OUTPUT_FORMATS = ['table', 'json', 'raw'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export interface CliGlobalOptions {
    json: boolean
    quiet: boolean
    output?: OutputFormat
}

export interface ResolvedCliGlobalOptions extends CliGlobalOptions {
    output: OutputFormat
}
