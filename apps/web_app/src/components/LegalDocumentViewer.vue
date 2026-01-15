<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="900px" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <span class="text-h6">{{ title }}</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" aria-label="Close"></v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pa-4">
        <!-- ローディング状態 -->
        <div v-if="loading" class="text-center pa-8">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <p class="mt-4 text-body-2">Loading...</p>
        </div>

        <!-- エラー状態 -->
        <div v-else-if="error" class="text-center pa-8">
          <v-icon color="error" size="48" class="mb-4">mdi-alert-circle</v-icon>
          <p class="text-h6 mb-2">Error</p>
          <p class="text-body-2 text-grey">{{ error }}</p>
          <v-btn color="primary" class="mt-4" @click="loadDocument">Retry</v-btn>
        </div>

        <!-- コンテンツ表示 -->
        <div v-else-if="htmlContent" class="legal-document-content" v-html="htmlContent"></div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="$emit('update:modelValue', false)">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getDocument, type DocumentType, type Locale } from '@/services/legalDocument';

interface Props {
  documentType: DocumentType;
  locale: Locale;
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const markdownContent = ref<string | null>(null);
const htmlContent = ref<string | null>(null);

const title = computed(() => {
  const titles: Record<string, Record<string, string>> = {
    terms: { ja: '利用規約', en: 'Terms of Service' },
    privacy: { ja: 'プライバシーポリシー', en: 'Privacy Policy' },
    commercial: { ja: '特定商取引法に基づく表記', en: 'Commercial Transaction' },
    pricing: { ja: 'Pricing / Billing', en: 'Pricing / Billing' },
  };
  return titles[props.documentType]?.[props.locale] || 'Legal Document';
});

/**
 * MarkdownをHTMLに変換し、サニタイズする
 */
function convertMarkdownToHtml(markdown: string): string {
  // markedでMarkdownをHTMLに変換
  const html = marked(markdown);

  // DOMPurifyでサニタイズ（XSS対策）
  const sanitized = DOMPurify.sanitize(html, {
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

  return sanitized;
}

/**
 * Storageから法的文書を取得
 */
async function loadDocument(): Promise<void> {
  loading.value = true;
  error.value = null;
  markdownContent.value = null;
  htmlContent.value = null;

  try {
    const content = await getDocument(props.documentType, props.locale);
    markdownContent.value = content;
    htmlContent.value = convertMarkdownToHtml(content);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load document';
    console.error('Error loading legal document:', err);
  } finally {
    loading.value = false;
  }
}

// ダイアログが開かれたときに文書を読み込む
watch(
  () => props.modelValue,
  newValue => {
    if (newValue) {
      loadDocument();
    }
  }
);

// コンポーネントがマウントされたときに、既に開いている場合は読み込む
onMounted(() => {
  if (props.modelValue) {
    loadDocument();
  }
});
</script>

<style scoped>
.legal-document-content {
  max-width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  line-height: 1.6;
}

/* Markdownコンテンツのスタイリング */
.legal-document-content :deep(h1),
.legal-document-content :deep(h2),
.legal-document-content :deep(h3) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.legal-document-content :deep(h1) {
  font-size: 1.75rem;
  border-bottom: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-bottom: 0.5em;
}

.legal-document-content :deep(h2) {
  font-size: 1.5rem;
}

.legal-document-content :deep(h3) {
  font-size: 1.25rem;
}

.legal-document-content :deep(p) {
  margin-bottom: 1em;
}

.legal-document-content :deep(ul),
.legal-document-content :deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

.legal-document-content :deep(li) {
  margin-bottom: 0.5em;
}

.legal-document-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.legal-document-content :deep(a:hover) {
  text-decoration: underline;
}

.legal-document-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
}

.legal-document-content :deep(th),
.legal-document-content :deep(td) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 0.5em;
  text-align: left;
}

.legal-document-content :deep(blockquote) {
  border-left: 4px solid rgb(var(--v-theme-primary));
  padding-left: 1em;
  margin-left: 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.legal-document-content :deep(code) {
  background-color: rgba(var(--v-theme-surface), 0.5);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
}

.legal-document-content :deep(pre) {
  background-color: rgba(var(--v-theme-surface), 0.5);
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
}

.legal-document-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
</style>

