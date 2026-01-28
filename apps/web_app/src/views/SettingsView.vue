<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h5 mb-4">{{ t('navigation.settings') }}</h1>
      </v-col>
    </v-row>

    <!-- 容量情報表示 -->
    <v-row v-if="formattedStorageInfo">
      <v-col cols="12" md="6" lg="4">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-harddisk</v-icon>
            {{ t('settings.storageUsage') }}
          </v-card-title>
          <v-card-text>
            <div class="text-body-2 mb-2">
              <strong>{{ t('settings.plan') }}:</strong> {{ formattedStorageInfo.planLabel }}
            </div>
            <div class="text-body-2 mb-2">
              <strong>{{ t('settings.usedStorage') }}:</strong> {{ formattedStorageInfo.usedStorage }} / {{ formattedStorageInfo.maxStorage }} ({{ formattedStorageInfo.usagePercent }}%)
            </div>
            <div class="text-body-2">
              <strong>{{ t('settings.availableStorage') }}:</strong> {{ formattedStorageInfo.availableStorage }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- プラン情報カード -->
    <v-row v-if="settingsStore.settings">
      <v-col cols="12" md="6" lg="4">
        <v-card variant="outlined" data-testid="plan-info-card">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-credit-card</v-icon>
            {{ t('settings.plan') }}
          </v-card-title>
          <v-card-text>
            <div class="text-body-2 mb-2">
              <strong>{{ t('settings.currentPlan') }}:</strong> {{ settingsStore.settings.planLabel }}
            </div>
            <div class="text-body-2 mb-2">
              <strong>{{ t('settings.maxStorage') }}:</strong> {{ formatFileSize(settingsStore.settings.maxStorageBytes, t) }}
            </div>
            <div class="text-body-2 mb-2">
              <strong>{{ t('settings.maxAccounts') }}:</strong> {{ planMaxAccounts }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              variant="text"
              color="primary"
              @click="navigateToPlanSelection"
              data-testid="change-plan-button"
            >
              {{ t('settings.changePlan') }}
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6" lg="4">
        <v-card variant="outlined" class="settings-card" @click="navigateToAccounts">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-account</v-icon>
            {{ t('account.title') }}
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 text-grey">
              {{ t('settings.accountDescription') }}
            </p>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" color="primary" @click.stop="navigateToAccounts">
              {{ t('common.open') }}
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 法的情報リンク -->
    <v-row>
      <v-col cols="12" md="6" lg="4">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-file-document-outline</v-icon>
            {{ t('settings.legal') }}
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                :title="t('settings.privacyPolicy')"
                prepend-icon="mdi-shield-lock-outline"
                @click="openLegalDocument('privacy', (currentLocale || 'ja') as 'ja' | 'en')"
                class="cursor-pointer"
              />
              <v-list-item
                :title="t('settings.termsOfService')"
                prepend-icon="mdi-file-document-outline"
                @click="openLegalDocument('terms', (currentLocale || 'ja') as 'ja' | 'en')"
                class="cursor-pointer"
              />
              <v-list-item
                v-if="currentLocale === 'ja'"
                :title="t('settings.commercialTransaction')"
                prepend-icon="mdi-currency-usd"
                @click="openLegalDocument('commercial', 'ja')"
                class="cursor-pointer"
              />
              <v-list-item
                v-else
                :title="t('settings.pricingBilling')"
                prepend-icon="mdi-currency-usd"
                @click="openLegalDocument('pricing', 'en')"
                class="cursor-pointer"
              />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- LegalDocumentViewer -->
    <LegalDocumentViewer
      v-model="legalDocumentDialog"
      :document-type="selectedDocumentType"
      :locale="selectedLocale"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settings';
import { formatFileSize } from '@/plugins/i18n';
import LegalDocumentViewer from '@/components/LegalDocumentViewer.vue';
import type { DocumentType, Locale } from '@/services/legalDocument';

const router = useRouter();
const { t, locale } = useI18n();
const settingsStore = useSettingsStore();

// localeをcomputedでラップして確実に文字列として取得
const currentLocale = computed(() => {
  // vue-i18nのlocaleはRef<string>型なので、.valueでアクセス
  return locale.value || 'ja';
});

// LegalDocumentViewerの状態管理
const legalDocumentDialog = ref(false);
const selectedDocumentType = ref<DocumentType>('terms');
const selectedLocale = ref<Locale>('ja');

// 容量情報のフォーマット済み表示
const formattedStorageInfo = computed(() => {
  if (!settingsStore.settings) {
    return null;
  }
  const { planLabel, maxStorageBytes, usedStorageBytes } = settingsStore.settings;
  const availableBytes = maxStorageBytes - usedStorageBytes;
  const usagePercent = maxStorageBytes > 0 ? ((usedStorageBytes / maxStorageBytes) * 100).toFixed(1) : '0.0';
  
  return {
    planLabel,
    usedStorage: formatFileSize(usedStorageBytes, t),
    maxStorage: formatFileSize(maxStorageBytes, t),
    availableStorage: formatFileSize(availableBytes, t),
    usagePercent,
  };
});

// プラン最大アカウント数
const planMaxAccounts = computed(() => {
  return settingsStore.settings?.maxAccounts ?? 1;
});

function navigateToAccounts() {
  router.push({ name: 'account-list' });
}

/**
 * プラン選択画面に遷移する
 */
function navigateToPlanSelection() {
  router.push('/settings/plan');
}

/**
 * 法的文書を開く
 * @param documentType ドキュメントタイプ
 * @param docLocale ロケール
 */
function openLegalDocument(documentType: DocumentType, docLocale: Locale): void {
  selectedDocumentType.value = documentType;
  selectedLocale.value = docLocale;
  legalDocumentDialog.value = true;
}

onMounted(() => {
  settingsStore.startWatching();
});

onUnmounted(() => {
  settingsStore.stopWatching();
});
</script>

<style scoped>
.settings-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.settings-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.cursor-pointer {
  cursor: pointer;
}
</style>
