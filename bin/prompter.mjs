#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createAliasBridges } from './create-alias-bridges.mjs'

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const packageRoot = path.resolve(currentDirectory, '..')
const cliEntryPath = path.resolve(packageRoot, 'src/cli/index.ts')
const tsconfigPath = path.resolve(packageRoot, 'tsconfig.json')
const projectRoot = process.cwd()
const require = createRequire(import.meta.url)

createAliasBridges(packageRoot)

let tsxCliPath = null
try {
    tsxCliPath = require.resolve('tsx/dist/cli.mjs')
} catch {
    tsxCliPath = null
}

const hasLocalTsx = Boolean(tsxCliPath && fs.existsSync(tsxCliPath))
const command = hasLocalTsx ? process.execPath : 'tsx'
const commandArgs = hasLocalTsx
    ? [tsxCliPath, '--tsconfig', tsconfigPath, cliEntryPath, ...process.argv.slice(2)]
    : ['--tsconfig', tsconfigPath, cliEntryPath, ...process.argv.slice(2)]

const child = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: packageRoot,
    env: {
        ...process.env,
        PROMPTER_PROJECT_ROOT: projectRoot,
    },
})

if (child.error) {
    const hint = hasLocalTsx ? '' : ' Ensure the package dependencies were installed correctly.'
    process.stderr.write(`Error: failed to start CLI: ${child.error.message}${hint}\n`)
    process.exit(1)
}

process.exit(child.status ?? 1)
