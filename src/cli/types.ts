import type { CliBootstrapConfig } from './bootstrap'
import type { ResolvedCliGlobalOptions } from './constants'

export interface CliCommandContext {
    args: string[]
    options: ResolvedCliGlobalOptions
    bootstrap?: CliBootstrapConfig
}

export interface CliCommandResult {
    data?: unknown
    raw?: string
    message?: string
}

export interface CliCommand {
    name: string
    description: string
    requiresBootstrap?: boolean
    run(context: CliCommandContext): Promise<CliCommandResult> | CliCommandResult
}
