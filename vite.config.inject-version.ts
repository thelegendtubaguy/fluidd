import child_process from 'child_process'
import fs from 'fs'
import path from 'path'
import packageJson from './package.json' with { type: 'json' }

import type { Plugin } from 'vite'

// Fork builds are identified by the commit they were built from, matching the footer and release tag: v1.37.7-tltg-<hash>.
// The hash length is fixed so shallow CI checkouts and full clones agree.
const gitHash = () => child_process
  .execSync('git rev-parse --short=7 HEAD')
  .toString()
  .trim()

const buildVersion = () => `v${packageJson.version}-${gitHash()}`

const writeVersionFile = async () => {
  const versionFile = await fs.promises.open(path.resolve(import.meta.dirname, 'dist/.version'), 'w')

  await versionFile.writeFile(buildVersion())

  await versionFile.close()
}

const writeReleaseInfoFile = async () => {
  const releaseInfoFile = await fs.promises.open(path.resolve(import.meta.dirname, 'dist/release_info.json'), 'w')

  await releaseInfoFile.writeFile(JSON.stringify({
    project_name: 'fluidd',
    // Fork builds update from the fork's releases.
    project_owner: 'thelegendtubaguy',
    version: buildVersion()
  }))

  await releaseInfoFile.close()
}

const vitePluginInjectVersion = (): Plugin => {
  return {
    name: 'version',
    config: () => {
      const git_hash = gitHash()

      return {
        define: {
          'import.meta.env.VERSION': JSON.stringify(packageJson.version),
          'import.meta.env.HASH': JSON.stringify(git_hash),
          'import.meta.env.BUILD_VERSION': JSON.stringify(buildVersion())
        }
      }
    },
    writeBundle: () => {
      setImmediate(async () => {
        await writeVersionFile()
        await writeReleaseInfoFile()
      })
    }
  }
}

export default vitePluginInjectVersion
