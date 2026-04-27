#!/usr/bin/env node

import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createAliasBridges } from './create-alias-bridges.mjs'

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const packageRoot = path.resolve(currentDirectory, '..')

runPrismaGenerate()
createAliasBridges(packageRoot)

function runPrismaGenerate() {
    const prismaCommand = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
    const child = spawnSync(prismaCommand, ['generate', '--schema', './prisma/schema.prisma'], {
        cwd: packageRoot,
        stdio: 'inherit',
        env: process.env,
    })

    if (child.error) {
        process.stderr.write(`Error: failed to run prisma generate: ${child.error.message}\n`)
        process.exit(child.status ?? 1)
    }

    if ((child.status ?? 0) !== 0) {
        process.exit(child.status ?? 1)
    }
}
