import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface PackageJsonShape {
  name?: string
  version?: string
}

function readPackageInfo(): PackageJsonShape {
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    return JSON.parse(raw) as PackageJsonShape
  } catch (error) {
    console.error('[version route] failed to read package.json:', error)
    return {}
  }
}

export async function GET() {
  const pkg = readPackageInfo()

  return NextResponse.json({
    app_name: pkg.name ?? 'birliy-kassa',
    app_version: pkg.version ?? 'unknown',
    node_env: process.env.NODE_ENV ?? 'unknown',
    deployment: {
      environment: process.env.VERCEL_ENV ?? null,
      url: process.env.VERCEL_URL ?? null,
      git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      git_commit_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    features: {
      kitchen_role: true,
      item_level_kitchen_flow: true,
      dashboard: true,
    },
  })
}
