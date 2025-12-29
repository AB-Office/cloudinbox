<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title>
            <div class="d-flex align-center">
              <v-btn icon variant="text" @click="handleBack" class="mr-2">
                <v-icon>mdi-arrow-left</v-icon>
              </v-btn>
              <span>{{ isEditMode ? t('account.updateAccount') : t('account.createAccount') }}</span>
            </div>
          </v-card-title>

          <v-card-text>
            <!-- エラーメッセージ -->
            <v-alert v-if="accountStore.error" type="error" variant="tonal" class="mb-4" closable>
              {{ accountStore.error }}
            </v-alert>

            <v-form ref="formRef" v-model="formValid">
              <!-- 基本情報 -->
              <v-text-field
                v-model="formData.label"
                :label="t('account.label')"
                :rules="[rules.required(t('account.labelRequired'))]"
                required
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-model="formData.email"
                :label="t('account.email')"
                type="email"
                :rules="[
                  rules.required(t('account.emailRequired')),
                  rules.email(t('account.emailInvalid')),
                ]"
                required
                class="mb-2"
              ></v-text-field>

              <v-divider class="my-4"></v-divider>

              <!-- POP3設定 -->
              <h3 class="text-h6 mb-4">{{ t('account.pop3Settings') }}</h3>

              <v-text-field
                v-model="formData.pop3Host"
                :label="t('account.host')"
                :rules="[rules.required(t('account.hostRequired'))]"
                required
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-model.number="formData.pop3Port"
                :label="t('account.port')"
                type="number"
                :rules="[
                  rules.required(t('account.portRequired')),
                  rules.port(t('account.portInvalid')),
                ]"
                required
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-model="formData.pop3Username"
                :label="t('account.username')"
                :rules="[rules.required(t('account.usernameRequired'))]"
                required
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-model="formData.pop3Password"
                :label="t('account.password')"
                type="password"
                :rules="[rules.required(t('account.passwordRequired'))]"
                :hint="isEditMode ? t('account.passwordHint') : undefined"
                required
                class="mb-2"
              ></v-text-field>

              <v-alert type="info" variant="tonal" class="mb-4">
                {{ t('account.sslRequired') }}
              </v-alert>

              <v-btn
                color="primary"
                variant="outlined"
                :loading="accountStore.isTesting && testProtocol === 'pop3'"
                :disabled="!canTestPop3"
                @click="handleTestConnection('pop3')"
                class="mb-4"
              >
                <v-icon start>mdi-connection</v-icon>
                {{ t('account.testPop3') }}
              </v-btn>

              <!-- POP3接続テスト結果 -->
              <v-alert
                v-if="pop3TestResult"
                :type="pop3TestResult.success ? 'success' : 'error'"
                variant="tonal"
                class="mb-4"
              >
                {{ pop3TestResult.success ? t('account.testSuccess') : t('account.testFailed') }}
                <div v-if="pop3TestResult.errorMessage" class="mt-1 text-caption">
                  {{ pop3TestResult.errorMessage }}
                </div>
              </v-alert>

              <v-divider class="my-4"></v-divider>

              <!-- SMTP設定（オプション） -->
              <h3 class="text-h6 mb-4">{{ t('account.smtpSettings') }}</h3>

              <v-text-field
                v-model="formData.smtpHost"
                :label="t('account.host')"
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-if="formData.smtpHost"
                v-model.number="formData.smtpPort"
                :label="t('account.port')"
                type="number"
                :rules="formData.smtpHost ? [rules.port(t('account.portInvalid'))] : []"
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-if="formData.smtpHost"
                v-model="formData.smtpUsername"
                :label="t('account.username')"
                class="mb-2"
              ></v-text-field>

              <v-text-field
                v-if="formData.smtpHost"
                v-model="formData.smtpPassword"
                :label="t('account.password')"
                type="password"
                :hint="isEditMode ? t('account.passwordHint') : undefined"
                class="mb-2"
              ></v-text-field>

              <v-alert v-if="formData.smtpHost" type="info" variant="tonal" class="mb-4">
                {{ t('account.sslRequired') }}
              </v-alert>

              <v-btn
                v-if="formData.smtpHost"
                color="primary"
                variant="outlined"
                :loading="accountStore.isTesting && testProtocol === 'smtp'"
                :disabled="!canTestSmtp"
                @click="handleTestConnection('smtp')"
                class="mb-4"
              >
                <v-icon start>mdi-connection</v-icon>
                {{ t('account.testSmtp') }}
              </v-btn>

              <!-- SMTP接続テスト結果 -->
              <v-alert
                v-if="smtpTestResult"
                :type="smtpTestResult.success ? 'success' : 'error'"
                variant="tonal"
                class="mb-4"
              >
                {{ smtpTestResult.success ? t('account.testSuccess') : t('account.testFailed') }}
                <div v-if="smtpTestResult.errorMessage" class="mt-1 text-caption">
                  {{ smtpTestResult.errorMessage }}
                </div>
              </v-alert>
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="handleBack">{{ t('account.cancel') }}</v-btn>
            <v-btn
              color="primary"
              :loading="accountStore.isLoading"
              :disabled="!formValid || accountStore.isLoading"
              @click="handleSave"
            >
              {{ t('account.save') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAccountStore } from '@/stores/account';
import type { AccountFormData, AccountTestResult } from '@/types/account';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const accountStore = useAccountStore();

const formRef = ref();
const formValid = ref(false);
const isEditMode = computed(() => !!route.params.accountId);

// フォームデータ
const formData = ref<AccountFormData>({
  label: '',
  email: '',
  pop3Host: '',
  pop3Port: 995,
  pop3Username: '',
  pop3Password: '',
  smtpHost: '',
  smtpPort: 465,
  smtpUsername: '',
  smtpPassword: '',
});

// テスト結果
const pop3TestResult = ref<AccountTestResult | null>(null);
const smtpTestResult = ref<AccountTestResult | null>(null);
const testProtocol = ref<'pop3' | 'smtp' | null>(null);

// バリデーションルール
const rules = {
  required: (message: string) => (v: unknown) => !!v || message,
  email: (message: string) => (v: string) => {
    if (!v) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(v) || message;
  },
  port: (message: string) => (v: number) => {
    if (!v) return true;
    return (v >= 1 && v <= 65535) || message;
  },
};

// 接続テストが可能かどうか
const canTestPop3 = computed(() => {
  return !!(
    formData.value.pop3Host &&
    formData.value.pop3Port &&
    formData.value.pop3Username &&
    formData.value.pop3Password
  );
});

const canTestSmtp = computed(() => {
  return !!(
    formData.value.smtpHost &&
    formData.value.smtpPort &&
    formData.value.smtpUsername &&
    formData.value.smtpPassword
  );
});

/**
 * 接続テストを実行する
 */
async function handleTestConnection(protocol: 'pop3' | 'smtp') {
  testProtocol.value = protocol;

  try {
    await accountStore.testConnection(
      protocol,
      formData.value,
      isEditMode.value ? (route.params.accountId as string) : undefined
    );

    if (protocol === 'pop3') {
      pop3TestResult.value = accountStore.testResult;
    } else {
      smtpTestResult.value = accountStore.testResult;
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    if (protocol === 'pop3') {
      pop3TestResult.value = {
        success: false,
        errorMessage: accountStore.error || 'Unknown error',
      };
    } else {
      smtpTestResult.value = {
        success: false,
        errorMessage: accountStore.error || 'Unknown error',
      };
    }
  } finally {
    testProtocol.value = null;
  }
}

/**
 * 保存処理
 */
async function handleSave() {
  if (!formRef.value) return;

  const { valid } = await formRef.value.validate();
  if (!valid) return;

  try {
    if (isEditMode.value) {
      await accountStore.updateAccount(route.params.accountId as string, formData.value);
    } else {
      await accountStore.createAccount(formData.value);
    }
    // 成功後、アカウント一覧に戻る
    router.push('/settings/accounts');
  } catch (error) {
    // エラーはストアで管理されているため、ここでは処理しない
    console.error('Failed to save account:', error);
  }
}

/**
 * 戻る処理
 */
function handleBack() {
  router.push('/settings/accounts');
}

/**
 * 編集モード時の既存データ読み込み
 */
async function loadAccount() {
  if (!isEditMode.value) return;

  const accountId = route.params.accountId as string;
  await accountStore.fetchAccount(accountId);

  if (accountStore.currentAccount) {
    const account = accountStore.currentAccount;
    formData.value = {
      label: account.label,
      email: account.email,
      pop3Host: account.pop3.host,
      pop3Port: account.pop3.port,
      pop3Username: account.pop3.userName,
      pop3Password: '', // 編集時は空のまま
      smtpHost: account.smtp?.host || '',
      smtpPort: account.smtp?.port || 465,
      smtpUsername: account.smtp?.userName || '',
      smtpPassword: '', // 編集時は空のまま
    };
  }
}

// ルートパラメータの変更を監視
watch(
  () => route.params.accountId,
  () => {
    loadAccount();
  },
  { immediate: true }
);

onMounted(() => {
  loadAccount();
});
</script>

<style scoped></style>
