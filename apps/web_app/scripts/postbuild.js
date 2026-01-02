#!/usr/bin/env node

import { existsSync, mkdirSync, renameSync, copyFileSync } from 'fs';
import { join } from 'path';

const distPath = join(process.cwd(), 'dist');
const mailDirPath = join(distPath, 'mail');
const publicIndexPath = join(process.cwd(), 'public', 'index.html');
const distIndexPath = join(distPath, 'index.html');

// dist/mailディレクトリを作成
if (!existsSync(mailDirPath)) {
  mkdirSync(mailDirPath, { recursive: true });
}

// Viteが生成したindex.htmlとassetsをdist/mail/に移動
const viteIndexPath = join(distPath, 'index.html');
const mailIndexPath = join(mailDirPath, 'index.html');
const assetsPath = join(distPath, 'assets');
const mailAssetsPath = join(mailDirPath, 'assets');

if (existsSync(viteIndexPath)) {
  renameSync(viteIndexPath, mailIndexPath);
  console.log('✓ Moved Web app index.html to dist/mail/');
}

if (existsSync(assetsPath)) {
  renameSync(assetsPath, mailAssetsPath);
  console.log('✓ Moved assets to dist/mail/');
}

// public/index.html（LP用）をdist/index.htmlにコピー
if (existsSync(publicIndexPath)) {
  copyFileSync(publicIndexPath, distIndexPath);
  console.log('✓ Copied LP index.html to dist/');
}

