#!/usr/bin/env node
/**
 * 将 bodySaver（build/homePage + build/homePageSEO）与 geekkawaWeb（dist）
 * 镜像同步到 webStatic/。路径默认兄弟目录，可用环境变量覆盖。
 *
 * 用法见 deploy/README.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(scriptDir, '..')

const env = process.env

/** @type {Record<string, string>} */
const defaults = {
  SYNC_BODYSAVER_ROOT: path.resolve(serverRoot, '../bodySaver'),
  SYNC_GEEKKAWA_WEB_ROOT: path.resolve(serverRoot, '../geekkawaWeb'),
  WEB_STATIC_DIR: path.join(serverRoot, 'webStatic'),
}

function resolveRoot(key) {
  return path.resolve(env[key] ?? defaults[key])
}

const bodySaverRoot = resolveRoot('SYNC_BODYSAVER_ROOT')
const geekkawaWebRoot = resolveRoot('SYNC_GEEKKAWA_WEB_ROOT')
const webStaticDir = path.resolve(env.WEB_STATIC_DIR ?? defaults.WEB_STATIC_DIR)
const ltcTarget = path.join(webStaticDir, 'leavetheChairHomepage')
const ltcSeoFragment = path.join(webStaticDir, '_seoFragments', 'leavethechair')
const toolSeoFragment = path.join(webStaticDir, '_seoFragments', 'tool')
const webTarget = path.join(webStaticDir, 'geekkawaWeb')

const buildHomeDir = path.join(bodySaverRoot, 'build', 'homePage')
const buildSeoDir = path.join(bodySaverRoot, 'build', 'homePageSEO')
const geekkawaDist = path.join(geekkawaWebRoot, 'dist')

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))

const buildHome = flags.has('--build-home') || flags.has('--build')
const buildWeb = flags.has('--build-web') || flags.has('--build')
const hashHomeAssets = flags.has('--hash-home-assets')
const homeOnly = flags.has('--home-only')
const webOnly = flags.has('--web-only')
const syncHome = !webOnly
const syncWeb = !homeOnly
const skipSeo = flags.has('--skip-seo')

function fail(message, hints = []) {
  console.error(`\n[sync-web-static] 错误: ${message}`)
  for (const h of hints) console.error(`  → ${h}`)
  console.error('')
  process.exit(1)
}

function info(message) {
  console.log(`[sync-web-static] ${message}`)
}

/**
 * @param {string} dir
 * @param {string} label
 */
function assertDir(dir, label) {
  if (!fs.existsSync(dir)) {
    fail(`找不到 ${label}`, [
      `期望路径: ${dir}`,
      `可设置环境变量覆盖，例如: SYNC_BODYSAVER_ROOT=${bodySaverRoot}`,
    ])
  }
  const stat = fs.statSync(dir)
  if (!stat.isDirectory()) {
    fail(`${label} 不是目录: ${dir}`)
  }
}

/**
 * @param {string} cwd
 * @param {string} npmScript
 * @param {string} label
 */
function runNpmScript(cwd, npmScript, label) {
  assertDir(cwd, label)
  info(`执行: (cd ${cwd} && npm run ${npmScript})`)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['run', npmScript], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.error) {
    fail(`无法启动 npm: ${result.error.message}`, [
      `确认已安装 Node/npm，且目录存在: ${cwd}`,
    ])
  }
  if (result.status !== 0) {
    fail(`命令失败: npm run ${npmScript}`, [
      `工作目录: ${cwd}`,
      `退出码: ${result.status ?? 'unknown'}`,
    ])
  }
}

/**
 * @param {string} dir
 */
async function emptyDirKeepGitkeep(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
  const entries = await fs.promises.readdir(dir)
  await Promise.all(
    entries.map(async (name) => {
      if (name === '.gitkeep') return
      await fs.promises.rm(path.join(dir, name), { recursive: true, force: true })
    }),
  )
}

/**
 * @param {string} src
 * @param {string} dest
 */
async function copyDirContents(src, dest) {
  assertDir(src, `源目录 ${src}`)
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  await fs.promises.mkdir(dest, { recursive: true })
  for (const ent of entries) {
    const from = path.join(src, ent.name)
    const to = path.join(dest, ent.name)
    if (ent.isDirectory()) {
      await fs.promises.cp(from, to, { recursive: true, force: true })
    } else if (ent.isFile()) {
      await fs.promises.copyFile(from, to)
    }
  }
}

async function syncLeaveTheChairHomepage() {
  assertDir(buildHomeDir, 'bodySaver build/homePage')
  assertDir(buildSeoDir, 'bodySaver build/homePageSEO')

  info(`清空并写入 ${ltcTarget}`)
  await emptyDirKeepGitkeep(ltcTarget)
  await copyDirContents(buildHomeDir, ltcTarget)
  info(`已同步 LeaveTheChair 页面 → webStatic/leavetheChairHomepage/（URL /leavethechair/homepage/）`)

  info(`写入 LTC SEO fragment → _seoFragments/leavethechair/`)
  await emptyDirKeepGitkeep(ltcSeoFragment)
  const seoSitemap = path.join(buildSeoDir, 'sitemap.xml')
  if (fs.existsSync(seoSitemap)) {
    await fs.promises.copyFile(seoSitemap, path.join(ltcSeoFragment, 'sitemap.xml'))
  } else {
    fail('bodySaver build/homePageSEO/sitemap.xml 不存在')
  }
}

async function syncGeekkawaWeb() {
  assertDir(geekkawaDist, 'geekkawaWeb dist')

  info(`清空并写入 ${webTarget}`)
  await emptyDirKeepGitkeep(webTarget)
  await copyDirContents(geekkawaDist, webTarget)
  info(`已同步工具站 → webStatic/geekkawaWeb/`)

  const distSitemap = path.join(geekkawaDist, 'sitemap.xml')
  if (fs.existsSync(distSitemap)) {
    await fs.promises.mkdir(toolSeoFragment, { recursive: true })
    await fs.promises.copyFile(distSitemap, path.join(toolSeoFragment, 'sitemap.xml'))
    info(`工具站 sitemap fragment → _seoFragments/tool/sitemap.xml`)
  }
}

function runBuildSeo() {
  info('执行 npm run build:seo')
  runNpmScript(serverRoot, 'build:seo', 'geekkawaServer')
}

function printHelp() {
  console.log(`
用法: node scripts/sync-web-static.mjs [选项]

选项:
  --build-home          在 bodySaver 执行 build:home（不含 hash:home-assets）
  --hash-home-assets      在 bodySaver 执行 hash:home-assets（需已有 build/homePage）
  --build-web             在 geekkawaWeb 执行 build
  --build                 等同 --build-home --build-web
  --home-only             仅同步 LeaveTheChair 到 webStatic/leavetheChairHomepage
  --web-only              仅同步工具站到 webStatic/geekkawaWeb
  --skip-seo              同步后不执行 build:seo
  -h, --help              显示帮助

默认: 不 build，仅镜像复制（目录须已存在）。

环境变量:
  SYNC_BODYSAVER_ROOT     默认 ${defaults.SYNC_BODYSAVER_ROOT}
  SYNC_GEEKKAWA_WEB_ROOT  默认 ${defaults.SYNC_GEEKKAWA_WEB_ROOT}
  WEB_STATIC_DIR          默认 ${defaults.WEB_STATIC_DIR}

示例:
  npm run sync:web-static -- --build-home
  npm run sync:web-static -- --build-home --hash-home-assets
  npm run sync:web-static:release
`)
}

async function main() {
  if (flags.has('--help') || flags.has('-h')) {
    printHelp()
    return
  }

  if (!fs.existsSync(bodySaverRoot) && (buildHome || hashHomeAssets || syncHome)) {
    fail('找不到 bodySaver 仓库', [
      `当前解析路径: ${bodySaverRoot}`,
      `设置: SYNC_BODYSAVER_ROOT=/你的/bodySaver 路径`,
    ])
  }

  if (!fs.existsSync(geekkawaWebRoot) && (buildWeb || syncWeb)) {
    fail('找不到 geekkawaWeb 仓库', [
      `当前解析路径: ${geekkawaWebRoot}`,
      `设置: SYNC_GEEKKAWA_WEB_ROOT=/你的/geekkawaWeb 路径`,
    ])
  }

  if (buildHome) {
    runNpmScript(bodySaverRoot, 'build:home', 'bodySaver')
  }

  if (hashHomeAssets) {
    if (!fs.existsSync(buildHomeDir)) {
      fail('无法 hash:home-assets：build/homePage 不存在', [
        '请先执行: npm run sync:web-static -- --build-home',
        `或于 bodySaver 目录运行: npm run build:home`,
      ])
    }
    runNpmScript(bodySaverRoot, 'hash:home-assets', 'bodySaver')
  }

  if (buildWeb) {
    runNpmScript(geekkawaWebRoot, 'build', 'geekkawaWeb')
  }

  if (syncHome) {
    await syncLeaveTheChairHomepage()
  }

  if (syncWeb) {
    await syncGeekkawaWeb()
  }

  if (!skipSeo && (syncHome || syncWeb)) {
    runBuildSeo()
  }

  info('完成。可启动 Server: npm run dev')
}

main().catch((err) => {
  console.error('\n[sync-web-static] 未预期的错误:', err)
  process.exit(1)
})
