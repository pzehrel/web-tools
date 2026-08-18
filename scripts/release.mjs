#!/usr/bin/env node
/**
 * 发布脚本：生成日期版本 tag（CalVer）并推送，触发 GitHub Actions 生产部署。
 * 格式：v2026.08.18；同一天多次发布自动追加序号 v2026.08.18.1、.2 …
 * 用法：pnpm release
 */
import { execSync } from 'node:child_process'
import process from 'node:process'

const run = cmd => execSync(cmd, { encoding: 'utf8' }).trim()

// 有未提交的改动时不发版，避免 tag 指向的内容与工作区不一致
if (run('git status --porcelain')) {
  console.error('✗ 工作区有未提交的改动，请先提交再发版')
  process.exit(1)
}

const now = new Date()
const pad = n => String(n).padStart(2, '0')
const base = `v${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`

const tags = run('git tag -l').split('\n').filter(Boolean)
let tag = base
for (let i = 1; tags.includes(tag); i++)
  tag = `${base}.${i}`

execSync(`git tag ${tag}`, { stdio: 'inherit' })
execSync(`git push origin ${tag}`, { stdio: 'inherit' })
console.log(`✓ 已发布 ${tag}，生产部署将由 GitHub Actions 完成`)
