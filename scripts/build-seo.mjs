#!/usr/bin/env node
/**
 * 组装站根 SEO：seo/ + webStatic/_seoFragments/* → webStatic/.root-seo/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(scriptDir, '..')
const webStatic = path.resolve(
  process.env.WEB_STATIC_DIR ?? path.join(serverRoot, 'webStatic'),
)
const seoSrc = path.join(serverRoot, 'seo')
const fragmentsDir = path.join(webStatic, '_seoFragments')
const outDir = path.join(webStatic, '.root-seo')

const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://geekkawa.com').replace(
  /\/$/,
  '',
)

/** @type {{ id: string, file: string }[]} */
const childSitemaps = []

function fail(msg) {
  console.error(`[build:seo] 错误: ${msg}`)
  process.exit(1)
}

function info(msg) {
  console.log(`[build:seo] ${msg}`)
}

async function emptyDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
  const entries = await fs.promises.readdir(dir)
  await Promise.all(
    entries.map((name) =>
      fs.promises.rm(path.join(dir, name), { recursive: true, force: true }),
    ),
  )
}

async function copyFileRequired(from, to) {
  if (!fs.existsSync(from)) fail(`找不到文件: ${from}`)
  await fs.promises.mkdir(path.dirname(to), { recursive: true })
  await fs.promises.copyFile(from, to)
}

/** 仓库内固定子 sitemap（如 sitemap-geekkawa.xml） */
async function copyBundledChildSitemaps() {
  const entries = await fs.promises.readdir(seoSrc)
  for (const name of entries) {
    const m = /^sitemap-(.+)\.xml$/i.exec(name)
    if (!m) continue
    const id = m[1].toLowerCase()
    const dest = `sitemap-${id}.xml`
    await copyFileRequired(path.join(seoSrc, name), path.join(outDir, dest))
    childSitemaps.push({ id, file: dest })
    info(`子 sitemap: ${dest}（来自 seo/${name}）`)
  }
}

/** _seoFragments/<name>/sitemap.xml → sitemap-<name>.xml */
async function copyFragments() {
  if (!fs.existsSync(fragmentsDir)) {
    info(`无 _seoFragments，跳过`)
    return
  }
  const names = await fs.promises.readdir(fragmentsDir)
  for (const name of names) {
    const id = name.toLowerCase()
    const src = path.join(fragmentsDir, name, 'sitemap.xml')
    if (!fs.existsSync(src)) continue
    const dest = `sitemap-${id}.xml`
    if (childSitemaps.some((c) => c.id === id)) {
      info(`跳过 fragment ${name}：与 seo/ 子 sitemap 重名`)
      continue
    }
    await fs.promises.copyFile(src, path.join(outDir, dest))
    childSitemaps.push({ id, file: dest })
    info(`子 sitemap: ${dest}（来自 _seoFragments/${name}/）`)
  }
}

async function writeSitemapIndex() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]
  for (const { file } of childSitemaps) {
    lines.push('  <sitemap>')
    lines.push(`    <loc>${SITE_ORIGIN}/${file}</loc>`)
    lines.push('  </sitemap>')
  }
  lines.push('</sitemapindex>')
  lines.push('')
  await fs.promises.writeFile(
    path.join(outDir, 'sitemap.xml'),
    lines.join('\n'),
    'utf8',
  )
}

async function main() {
  if (!fs.existsSync(seoSrc)) fail(`缺少目录 seo/：${seoSrc}`)

  await emptyDir(outDir)
  await copyFileRequired(
    path.join(seoSrc, 'robots.txt'),
    path.join(outDir, 'robots.txt'),
  )
  await copyFileRequired(
    path.join(seoSrc, 'llms.txt'),
    path.join(outDir, 'llms.txt'),
  )

  childSitemaps.length = 0
  await copyBundledChildSitemaps()
  await copyFragments()

  if (childSitemaps.length === 0) {
    fail('没有子 sitemap，请提供 seo/sitemap-*.xml 或 _seoFragments/*/sitemap.xml')
  }

  await writeSitemapIndex()
  info(`完成 → ${outDir}`)
}

main().catch((err) => {
  console.error('[build:seo] 未预期错误:', err)
  process.exit(1)
})
