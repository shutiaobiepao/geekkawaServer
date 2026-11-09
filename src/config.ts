import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? '3000'),
  webStaticDir: path.resolve(
    repoRoot,
    process.env.WEB_STATIC_DIR ?? 'webStatic',
  ),
  /** LeaveTheChair 落地页（仅 /leavethechair/homepage/） */
  leavetheChairHomepageDir: 'leavetheChairHomepage',
  /** GeekKawa 品牌站根 / */
  geekkawaHomeDir: 'geekkawaHome',
  geekkawaWebDir: 'geekkawaWeb',
  /** 组装后的站根 SEO 产物（/robots.txt、/sitemap.xml 等） */
  rootSeoDir: '.root-seo',
  seoFragmentsDir: '_seoFragments',
  siteOrigin: process.env.SITE_ORIGIN ?? 'https://geekkawa.com',
  leavetheChairHomePath: '/leavethechair/homepage/',
} as const

export function webStaticPath(...segments: string[]): string {
  return path.join(config.webStaticDir, ...segments)
}
