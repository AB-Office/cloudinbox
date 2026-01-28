<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <v-btn
            icon
            variant="text"
            @click="handleBack"
            data-testid="back-button"
            class="mr-2"
          >
            <v-icon>mdi-arrow-left</v-icon>
          </v-btn>
          <h1 class="text-h5">{{ t('plan.title') }}</h1>
        </div>
      </v-col>
    </v-row>

    <!-- アップグレード促進バナー -->
    <v-row v-if="showUpgradeBanner">
      <v-col cols="12">
        <v-alert type="warning" variant="tonal" class="mb-4">
          <v-alert-title>{{ t('plan.upgradeRequired') }}</v-alert-title>
          <div class="mt-2">
            <p>{{ t('plan.upgradeMessage') }}</p>
            <div class="mt-2">
              <strong>{{ t('settings.currentPlan') }}:</strong> {{ currentPlanLabel }}
              <br />
              <strong>{{ t('settings.maxAccounts') }}:</strong> {{ currentMaxAccounts }}
              <br />
              <strong>{{ t('settings.maxStorage') }}:</strong> {{ currentMaxStorage }}
            </div>
            <div class="mt-2" v-if="standardPlan">
              <strong>{{ t('plan.upgradeTo') }}:</strong> {{ standardPlan.label }}
              <br />
              <strong>{{ t('settings.maxAccounts') }}:</strong> {{ standardPlan.maxAccounts }}
              <br />
              <strong>{{ t('settings.maxStorage') }}:</strong> {{ formatStorage(standardPlan.maxStorageBytes) }}
            </div>
          </div>
        </v-alert>
      </v-col>
    </v-row>

    <!-- プランカード一覧 -->
    <v-row>
      <v-col
        v-for="plan in plans"
        :key="plan.id"
        cols="12"
        md="6"
        :data-testid="`plan-${plan.id}`"
      >
        <v-card variant="outlined" :class="{ 'border-primary': plan.id === currentPlanId }">
          <v-card-title class="d-flex align-center">
            <span>{{ plan.label }}</span>
            <v-chip
              v-if="plan.id === currentPlanId"
              color="primary"
              size="small"
              class="ml-2"
            >
              {{ t('plan.currentPlan') }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <div class="text-h4 mb-4">{{ plan.priceLabel }}</div>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>{{ t('settings.maxStorage') }}</v-list-item-title>
                <v-list-item-subtitle>{{ formatStorage(plan.maxStorageBytes) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>{{ t('settings.maxAccounts') }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ plan.maxAccounts === 1 ? '1 ' + t('account.title') : plan.maxAccounts + ' ' + t('account.title') }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-for="feature in plan.features" :key="feature">
                <v-list-item-title>{{ feature }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
          <v-card-actions>
            <v-btn
              :color="plan.id === 'standard' && showUpgradeBanner ? 'primary' : 'default'"
              :variant="plan.id === 'standard' && showUpgradeBanner ? 'flat' : 'outlined'"
              :loading="isLoading"
              :disabled="isLoading || plan.id === currentPlanId"
              @click="handlePlanChange(plan.id)"
              :data-testid="`change-plan-${plan.id}`"
              block
            >
              {{
                plan.id === 'standard' && showUpgradeBanner
                  ? t('plan.upgradeNow')
                  : t('plan.changePlan')
              }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- ローディング表示 -->
    <v-overlay v-model="isLoading" class="align-center justify-center" persistent>
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <div class="mt-4">{{ t('common.loading') }}</div>
    </v-overlay>

    <!-- スナックバー（成功・エラー表示用） -->
    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="5000" location="bottom">
      {{ snackbarText }}
      <template #actions>
        <v-btn variant="text" @click="snackbar = false">{{ t('common.close') }}</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/stores/settings';
import { createCheckoutSession } from '@/services/subscription';
import { useSnackbar } from '@/composables/useSnackbar';
import { formatFileSize } from '@/plugins/i18n';
import type { Plan } from '@/types/subscription';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const settingsStore = useSettingsStore();
const { snackbar, snackbarText, snackbarColor, showError, showSuccess, showInfo } = useSnackbar();

// 現在のロケール
const currentLocale = computed(() => (locale.value || 'ja') as 'ja' | 'en');

// 状態
const plans = ref<Plan[]>([]);
const isLoading = ref(false);
const showUpgradeBanner = computed(() => route.query.upgrade === 'true');

// 現在のプランID
const currentPlanId = computed(() => {
  const planLabel = settingsStore.settings?.planLabel || 'Free';
  return planLabel.toLowerCase() === 'standard' ? 'standard' : 'free';
});

// 現在のプラン情報
const currentPlanLabel = computed(() => settingsStore.settings?.planLabel || 'Free');
const currentMaxAccounts = computed(() => {
  const plan = plans.value.find(p => p.id === currentPlanId.value);
  return plan?.maxAccounts || 1;
});
const currentMaxStorage = computed(() => {
  const plan = plans.value.find(p => p.id === currentPlanId.value);
  return plan ? formatStorage(plan.maxStorageBytes) : '2GB';
});

// Standardプラン
const standardPlan = computed(() => plans.value.find(p => p.id === 'standard'));

/**
 * ストレージ容量をフォーマット
 */
function formatStorage(bytes: number): string {
  return formatFileSize(bytes, t);
}

/**
 * プラン一覧を読み込む
 */
function loadPlans(): void {
  const localeValue = currentLocale.value;
  const currency = localeValue === 'ja' ? 'JPY' : 'USD';

  plans.value = [
    {
      id: 'free',
      label: 'Free',
      price: 0,
      priceLabel: t('plan.free'),
      currency,
      maxStorageBytes: 2147483648, // 2GB
      maxAccounts: 1,
      features: [
        t('plan.feature.basicStorage'),
        t('plan.feature.singleAccount'),
        t('plan.feature.emailSupport'),
      ],
    },
    {
      id: 'standard',
      label: 'Standard',
      price: localeValue === 'ja' ? 500 : 5,
      priceLabel: localeValue === 'ja' ? '¥500/月' : '$5/month',
      currency,
      maxStorageBytes: 53687091200, // 50GB
      maxAccounts: 10,
      features: [
        t('plan.feature.largeStorage'),
        t('plan.feature.multipleAccounts'),
        t('plan.feature.prioritySupport'),
        t('plan.feature.advancedFeatures'),
      ],
    },
  ];
}

/**
 * プラン変更処理
 */
async function handlePlanChange(planId: 'free' | 'standard'): Promise<void> {
  isLoading.value = true;
  try {
    await createCheckoutSession(planId, currentLocale.value);
  } catch (error) {
    showError(error);
  } finally {
    isLoading.value = false;
  }
}

/**
 * 設定画面に戻る
 */
function handleBack(): void {
  router.push('/settings');
}

// マウント時の処理
onMounted(() => {
  loadPlans();

  // 成功/キャンセルメッセージの表示（nextTickで確実にroute.queryが取得できるようにする）
  nextTick(() => {
    if (route.query.success === 'true') {
      showSuccess(t('plan.success'));
    } else if (route.query.canceled === 'true') {
      showInfo(t('plan.canceled'));
    }
  });
});
</script>

<style scoped>
.border-primary {
  border: 2px solid rgb(var(--v-theme-primary));
}
</style>

