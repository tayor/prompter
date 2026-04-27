import fs from 'node:fs'
import path from 'node:path'

const ALIAS_TARGETS = ['app', 'cli', 'components', 'hooks', 'lib', 'stores']

export function createAliasBridges(packageRoot) {
    const nodeModulesDirectory = path.resolve(packageRoot, 'node_modules')
    const scopedAliasDirectory = path.resolve(nodeModulesDirectory, '@')

    fs.mkdirSync(scopedAliasDirectory, { recursive: true })

    for (const target of ALIAS_TARGETS) {
        const sourcePath = path.resolve(packageRoot, 'src', target)
        const aliasPath = path.resolve(scopedAliasDirectory, target)

        if (!fs.existsSync(sourcePath)) {
            continue
        }

        try {
            const existing = fs.lstatSync(aliasPath)
            if (existing.isSymbolicLink() || existing.isDirectory()) {
                fs.rmSync(aliasPath, { recursive: true, force: true })
            } else {
                continue
            }
        } catch {
            // No existing alias bridge.
        }

        fs.symlinkSync(sourcePath, aliasPath, process.platform === 'win32' ? 'junction' : 'dir')
    }
}
