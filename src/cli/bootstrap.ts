import fs from 'node:fs'
import path from 'node:path'
import { conflictError, notFoundError, validationError } from './errors'

const DEFAULT_DATABASE_URL = 'file:./prompter.db'
const MIN_NODE_MAJOR_VERSION = 18

export function getCliProjectRoot(): string {
    return process.env.PROMPTER_PROJECT_ROOT || process.cwd()
}

export interface CliBootstrapConfig {
    projectRoot: string
    databaseUrl: string
    databasePath: string | null
    nodeVersion: string
}

export function bootstrapCliEnvironment(cwd = getCliProjectRoot()): CliBootstrapConfig {
    ensureNodeVersion()
    ensureProjectAssumptions(cwd)

    const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL)
    const databasePath = resolveDatabasePath(databaseUrl, cwd)

    if (databasePath) {
        ensureDatabaseAccess(databasePath)
    }

    return {
        projectRoot: cwd,
        databaseUrl,
        databasePath,
        nodeVersion: process.version,
    }
}

function ensureNodeVersion() {
    const majorVersion = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
    if (!Number.isFinite(majorVersion) || majorVersion < MIN_NODE_MAJOR_VERSION) {
        throw validationError(
            `Node.js ${MIN_NODE_MAJOR_VERSION}+ is required, found ${process.version}.`
        )
    }
}

function ensureProjectAssumptions(cwd: string) {
    const packagePath = path.resolve(cwd, 'package.json')
    const prismaSchemaPath = path.resolve(cwd, 'prisma/schema.prisma')

    if (!fs.existsSync(packagePath) || !fs.existsSync(prismaSchemaPath)) {
        throw validationError(
            'Run this CLI from the Prompter project root (package.json and prisma/schema.prisma are required).'
        )
    }
}

function resolveDatabaseUrl(candidate: string | undefined): string {
    const databaseUrl = candidate?.trim() || DEFAULT_DATABASE_URL
    if (databaseUrl.length === 0) {
        throw validationError('DATABASE_URL must not be empty.')
    }

    if (!isSupportedDatabaseUrl(databaseUrl)) {
        throw validationError(
            `Unsupported DATABASE_URL "${databaseUrl}". Expected file:, libsql://, http://, or https://.`
        )
    }

    return databaseUrl
}

function isSupportedDatabaseUrl(databaseUrl: string): boolean {
    return (
        databaseUrl.startsWith('file:')
        || databaseUrl.startsWith('libsql://')
        || databaseUrl.startsWith('http://')
        || databaseUrl.startsWith('https://')
    )
}

function resolveDatabasePath(databaseUrl: string, cwd: string): string | null {
    if (!databaseUrl.startsWith('file:')) {
        return null
    }

    const filePath = databaseUrl.slice('file:'.length).split('?')[0]
    if (filePath.length === 0 || filePath === ':memory:') {
        return null
    }

    if (path.isAbsolute(filePath)) {
        return filePath
    }

    return path.resolve(cwd, filePath)
}

function ensureDatabaseAccess(databasePath: string) {
    const databaseDirectory = path.dirname(databasePath)

    if (!fs.existsSync(databaseDirectory)) {
        throw notFoundError(`Database directory not found: ${databaseDirectory}`)
    }

    try {
        fs.accessSync(databaseDirectory, fs.constants.R_OK | fs.constants.W_OK)
    } catch {
        throw conflictError(`Database directory is not readable and writable: ${databaseDirectory}`)
    }

    if (!fs.existsSync(databasePath)) {
        throw notFoundError(
            `Database file not found at ${databasePath}. Run "npm run db:init" first.`
        )
    }

    try {
        fs.accessSync(databasePath, fs.constants.R_OK | fs.constants.W_OK)
    } catch {
        throw conflictError(`Database file is not readable and writable: ${databasePath}`)
    }
}
