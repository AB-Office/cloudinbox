<template>
  <v-card class="mail-body" variant="outlined">
    <v-card-text>
      <!-- HTML形式の本文を優先的に表示 -->
      <div v-if="sanitizedHtml" v-html="sanitizedHtml" class="mail-body-content"></div>
      <!-- HTML形式がない場合はテキスト形式を表示 -->
      <div v-else-if="decryptedBody?.bodyText" class="mail-body-content">
        <pre class="text-body-2">{{ decryptedBody.bodyText }}</pre>
      </div>
      <!-- 本文がない場合 -->
      <div v-else class="text-body-2 text-grey text-center pa-4">
        {{ t('mail.noBody') }}
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DOMPurify from 'dompurify';
import type { DecryptedMailBody } from '@/types/mail';

interface Props {
  decryptedBody?: DecryptedMailBody | null;
}

const props = defineProps<Props>();

const { t } = useI18n();

/**
 * HTMLコンテンツをサニタイズする（XSS対策）
 */
const sanitizedHtml = computed(() => {
  if (!props.decryptedBody?.bodyHtml) {
    return null;
  }

  // DOMPurifyを使用してHTMLをサニタイズ
  // メール本文として必要なタグや属性のみを許可
  const sanitized = DOMPurify.sanitize(props.decryptedBody.bodyHtml, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'pre',
      'code',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'style', 'class'],
    ALLOW_DATA_ATTR: false,
  });

  // 外部リンクに安全な属性を追加（XSS対策）
  // DOMPurifyがサニタイズしたHTMLを再度処理
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitized;
  const links = tempDiv.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return tempDiv.innerHTML;
});
</script>

<style scoped>
.mail-body {
  margin-bottom: 16px;
}

.mail-body-content {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

/* メール本文内のHTMLコンテンツのスタイリング */
.mail-body-content :deep(p) {
  margin-bottom: 1em;
  line-height: 1.6;
}

.mail-body-content :deep(pre) {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  background-color: rgba(var(--v-theme-surface), 0.5);
  padding: 0.5em;
  border-radius: 4px;
}

.mail-body-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.mail-body-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.mail-body-content :deep(a:hover) {
  text-decoration: underline;
}

.mail-body-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
}

.mail-body-content :deep(th),
.mail-body-content :deep(td) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 0.5em;
}
</style>
