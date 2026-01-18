<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title class="text-h5 pa-6">
            {{ t('legal.consent.title', {}, { default: '利用規約・プライバシーポリシーへの同意' }) }}
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text class="pa-6">
            <!-- 再確認の場合のメッセージ -->
            <v-alert
              v-if="isReconsent"
              type="info"
              variant="tonal"
              class="mb-6"
              closable
            >
              {{ t('legal.consent.reconsentMessage', {}, { default: '法的文書が更新されました。最新版に同意してください。' }) }}
            </v-alert>

            <!-- エラーメッセージ -->
            <v-alert v-if="error" type="error" variant="tonal" class="mb-6" closable @click:close="error = null">
              {{ error }}
            </v-alert>

            <!-- 説明文 -->
            <p class="text-body-1 mb-6">
              {{ t('legal.consent.description', {}, { default: 'CloudInboxをご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。以下のチェックボックスにチェックを入れて同意してください。' }) }}
            </p>

            <!-- チェックボックス -->
            <div class="mb-6">
              <v-checkbox
                v-model="termsChecked"
                :label="t('legal.consent.agreeTerms', {}, { default: '利用規約に同意する' })"
                density="comfortable"
                hide-details
                class="mb-2"
              >
                <template #label>
                  <span>
                    {{ t('legal.consent.agreeTerms', {}, { default: '利用規約に同意する' }) }}
                    <v-btn
                      variant="text"
                      size="small"
                      color="primary"
                      class="ml-2"
                      @click="openDocument('terms')"
                    >
                      {{ t('legal.consent.view', {}, { default: '表示' }) }}
                    </v-btn>
                  </span>
                </template>
              </v-checkbox>

              <v-checkbox
                v-model="privacyChecked"
                :label="t('legal.consent.agreePrivacy', {}, { default: 'プライバシーポリシーに同意する' })"
                density="comfortable"
                hide-details
              >
                <template #label>
                  <span>
                    {{ t('legal.consent.agreePrivacy', {}, { default: 'プライバシーポリシーに同意する' }) }}
                    <v-btn
                      variant="text"
                      size="small"
                      color="primary"
                      class="ml-2"
                      @click="openDocument('privacy')"
                    >
                      {{ t('legal.consent.view', {}, { default: '表示' }) }}
                    </v-btn>
                  </span>
                </template>
              </v-checkbox>
            </div>
          </v-card-text>

          <v-divider></v-divider>

          <v-card-actions class="pa-6">
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              size="large"
              :loading="isLoading"
              :disabled="!canSubmit || isLoading"
              @click="handleConsent"
            >
              {{ t('legal.consent.submit', {}, { default: '同意する' }) }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 法的文書表示ダイアログ -->
    <LegalDocumentViewer
      v-model="documentDialog"
      :document-type="selectedDocumentType"
      :locale="currentLocale"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useConsentStore } from '@/stores/consent';
import { getDocumentMetadata, type Locale } from '@/services/legalDocument';
import LegalDocumentViewer from '@/components/LegalDocumentViewer.vue';

const router = useRouter();
const { t, locale } = useI18n();
const consentStore = useConsentStore();

// 現在のロケールを取得
const currentLocale = computed<Locale>(() => {
  const lang = locale.value || 'ja';
  return (lang === 'en' ? 'en' : 'ja') as Locale;
});

// チェックボックスの状態
const termsChecked = ref(false);
const privacyChecked = ref(false);

// ローディング状態とエラー状態
const isLoading = computed(() => consentStore.isLoading);
const error = ref<string | null>(null);

// 文書バージョン
const termsVersion = ref<string | null>(null);
const privacyVersion = ref<string | null>(null);

// 再確認かどうか
const isReconsent = computed(() => consentStore.needsReconsent);

// 提出可能かどうか
const canSubmit = computed(() => termsChecked.value && privacyChecked.value);

// 法的文書表示ダイアログ
const documentDialog = ref(false);
const selectedDocumentType = ref<'terms' | 'privacy'>('terms');

/**
 * 法的文書を開く
 */
function openDocument(type: 'terms' | 'privacy'): void {
  selectedDocumentType.value = type;
  documentDialog.value = true;
}

/**
 * 同意を送信する
 */
async function handleConsent(): Promise<void> {
  if (!canSubmit.value || isLoading.value) {
    return;
  }

  error.value = null;

  try {
    // メタデータを取得してバージョンを確定
    if (!termsVersion.value || !privacyVersion.value) {
      termsVersion.value = await getDocumentMetadata('terms', currentLocale.value);
      privacyVersion.value = await getDocumentMetadata('privacy', currentLocale.value);
    }

    // 同意を保存
    await consentStore.saveConsent(termsVersion.value, privacyVersion.value);

    // メイン画面にリダイレクト
    router.push({ path: '/' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    error.value = t('legal.consent.saveError', { message }, { default: `同意の保存に失敗しました: ${message}` });
    console.error('Failed to save consent:', e);
  }
}

/**
 * コンポーネントマウント時にメタデータを取得
 */
onMounted(async () => {
  try {
    // 文書のメタデータを取得（同意時に使用）
    termsVersion.value = await getDocumentMetadata('terms', currentLocale.value);
    privacyVersion.value = await getDocumentMetadata('privacy', currentLocale.value);
  } catch (e) {
    console.warn('Failed to fetch document metadata:', e);
    // メタデータ取得エラーは警告のみ（同意時にもう一度取得を試みる）
  }
});
</script>

<style scoped>
/* 必要に応じてスタイルを追加 */
</style>

