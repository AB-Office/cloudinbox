#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import { join, dirname, extname, relative } from 'path';

// dist内のすべての.mdファイルを削除する関数
function removeMdFiles(dir) {
  if (!existsSync(dir)) {
    return;
  }

  const items = readdirSync(dir);

  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      // ディレクトリの場合は再帰的に処理
      removeMdFiles(itemPath);
    } else if (extname(item) === '.md') {
      // .mdファイルの場合は削除
      unlinkSync(itemPath);
      console.log(`✓ Removed ${relative(distPath, itemPath)}`);
    }
  }
}
import { marked } from 'marked';

const distPath = join(process.cwd(), 'dist');
const mailDirPath = join(distPath, 'mail');
const publicIndexPath = join(process.cwd(), 'public', 'index.html');
const distIndexPath = join(distPath, 'index.html');

// Viteが生成したindex.html（dist/mail/index.html）のファビコン参照を修正
const mailIndexPath = join(mailDirPath, 'index.html');
if (existsSync(mailIndexPath)) {
  // ファビコンの参照を /favicon.png に変更
  let indexContent = readFileSync(mailIndexPath, 'utf-8');
  indexContent = indexContent.replace(/href="\/mail\/favicon\.png"/g, 'href="/favicon.png"');
  writeFileSync(mailIndexPath, indexContent, 'utf-8');
  console.log('✓ Updated favicon path in dist/mail/index.html');
}

// public/ ディレクトリ内のファイルを処理（index.html を除く）
const publicDirPath = join(process.cwd(), 'public');

function processPublicDir(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    return;
  }

  const items = readdirSync(srcDir);

  for (const item of items) {
    // index.html は後で処理するのでスキップ
    if (item === 'index.html') {
      continue;
    }

    const srcPath = join(srcDir, item);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      // ディレクトリの場合は再帰的に処理
      const destSubDir = join(destDir, item);
      if (!existsSync(destSubDir)) {
        mkdirSync(destSubDir, { recursive: true });
      }
      processPublicDir(srcPath, destSubDir);
    } else {
      // ファイルの場合
      const ext = extname(item);
      const destPath = join(destDir, item);

      // ディレクトリが存在しない場合は作成
      const destDirPath = dirname(destPath);
      if (!existsSync(destDirPath)) {
        mkdirSync(destDirPath, { recursive: true });
      }

      if (ext === '.md') {
        // Markdown → HTML に変換
        const mdContent = readFileSync(srcPath, 'utf-8');
        const htmlBody = marked(mdContent);

        // タイトルを抽出（最初の行の# タイトルから）
        const titleMatch = mdContent.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : item.replace(/\.md$/, '');

        // 言語を判定（_en.mdの場合は英語）
        const isEnglish = item.includes('_en.md');
        const lang = isEnglish ? 'en' : 'ja';

        // 完全なHTMLドキュメントを作成
        const htmlContent = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/css/style.css">
  <title>${title} - CloudInbox</title>
</head>
<body>
  <header>
    <nav>
      <a href="/${isEnglish ? 'index_en.html' : 'index.html'}" class="logo">CloudInbox</a>
      <ul class="nav-links">
        <li><a href="/${isEnglish ? 'index_en.html' : 'index.html'}#how">${isEnglish ? 'How it Works' : '仕組み'}</a></li>
        <li><a href="/${isEnglish ? 'index_en.html' : 'index.html'}#security">${isEnglish ? 'Security' : '安全性'}</a></li>
        <li><a href="/${isEnglish ? 'index_en.html' : 'index.html'}#pricing">${isEnglish ? 'Plans' : 'プラン'}</a></li>
        <li><a href="/${isEnglish ? 'index_en.html' : 'index.html'}#faq">FAQ</a></li>
        <li><a href="/mail/" class="btn btn-primary" style="padding: 8px 16px; background: #1976d2; color: white; border-radius: 4px; text-decoration: none;">${isEnglish ? 'Login' : 'ログイン'}</a></li>
        <li><a href="/${isEnglish ? 'index.html' : 'index_en.html'}" style="font-size: 0.9rem;">${isEnglish ? '日本語' : 'English'}</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <div class="container" style="padding: 2rem 20px; max-width: 900px;">
      ${htmlBody}
    </div>
  </main>

  <footer>
    <div class="footer-content">
      <ul class="footer-links">
        <li><a href="/${isEnglish ? 'privacy_en.html' : 'privacy.html'}">${isEnglish ? 'Privacy Policy' : 'プライバシーポリシー'}</a></li>
        <li><a href="/${isEnglish ? 'terms_en.html' : 'terms.html'}">${isEnglish ? 'Terms of Service' : '利用規約'}</a></li>
        ${isEnglish ? '<li><a href="/pricing.html">Pricing / Billing</a></li>' : '<li><a href="/commercial.html">特定商取引法に基づく表記</a></li>'}
        <li><a href="/${isEnglish ? 'contact_en.html' : 'contact.html'}">${isEnglish ? 'Contact' : 'お問い合わせ'}</a></li>
      </ul>
      <div class="footer-copyright">© CloudInbox</div>
    </div>
  </footer>
</body>
</html>`;

        const htmlFileName = item.replace(/\.md$/, '.html');
        const htmlPath = join(destDir, htmlFileName);
        writeFileSync(htmlPath, htmlContent, 'utf-8');
        console.log(
          `✓ Converted ${relative(publicDirPath, srcPath)} → ${relative(distPath, htmlPath)}`
        );
      } else {
        // それ以外はそのままコピー
        copyFileSync(srcPath, destPath);
        console.log(
          `✓ Copied ${relative(publicDirPath, srcPath)} → ${relative(distPath, destPath)}`
        );
      }
    }
  }
}

// public/ ディレクトリ内のファイルを処理（index.html を除く）
processPublicDir(publicDirPath, distPath);

// public/index.html（LP用）をdist/index.htmlにコピー（Viteが生成したindex.htmlを上書き）
if (existsSync(publicIndexPath)) {
  copyFileSync(publicIndexPath, distIndexPath);
  console.log('✓ Copied LP index.html to dist/');
}

// dist内のすべての.mdファイルを削除（Viteが自動的にコピーしたものも含む）
removeMdFiles(distPath);
