<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1 class="text-h4">{{ t('account.title') }}</h1>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="handleAdd">
            {{ t('account.add') }}
          </v-btn>
        </div>

        <!-- エラーメッセージ -->
        <v-alert v-if="accountStore.error" type="error" variant="tonal" class="mb-4" closable>
          {{ accountStore.error }}
        </v-alert>

        <!-- ローディング状態 -->
        <div v-if="accountStore.isLoading" class="d-flex justify-center pa-4">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>

        <!-- アカウント一覧 -->
        <div v-else>
          <!-- アクティブなアカウント -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">{{ t('account.activeAccounts') }}</v-card-title>
            <v-card-text>
              <v-list v-if="activeAccounts.length > 0">
                <v-list-item
                  v-for="account in activeAccounts"
                  :key="account.id"
                  :title="account.label"
                  :subtitle="account.email"
                >
                  <template #prepend>
                    <v-icon>mdi-email</v-icon>
                  </template>

                  <template #append>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      @click="handleEdit(account.id!)"
                      class="mr-2"
                    >
                      <v-icon>mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="error"
                      @click="handleDelete(account.id!)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
              <div v-else class="text-center pa-4 text-grey">
                {{ t('account.noAccounts') }}
              </div>
            </v-card-text>
          </v-card>

          <!-- 削除済みアカウント -->
          <v-card v-if="deletedAccounts.length > 0">
            <v-card-title class="text-h6">{{ t('account.deletedAccounts') }}</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item
                  v-for="account in deletedAccounts"
                  :key="account.id"
                  :title="account.label"
                  :subtitle="account.email"
                >
                  <template #prepend>
                    <v-icon color="grey">mdi-email-outline</v-icon>
                  </template>

                  <template #append>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="success"
                      @click="handleRestore(account.id!)"
                      class="mr-2"
                    >
                      <v-icon>mdi-restore</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      color="error"
                      @click="handlePermanentlyDelete(account.id!)"
                    >
                      <v-icon>mdi-delete-forever</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <!-- 削除確認ダイアログ -->
    <v-dialog v-model="deleteDialog.show" max-width="500">
      <v-card>
        <v-card-title>{{ t('account.delete') }}</v-card-title>
        <v-card-text>{{ t('account.confirmDelete') }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog.show = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" @click="confirmDelete">{{ t('account.delete') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 完全削除確認ダイアログ -->
    <v-dialog v-model="permanentlyDeleteDialog.show" max-width="500">
      <v-card>
        <v-card-title>{{ t('account.permanentlyDelete') }}</v-card-title>
        <v-card-text>{{ t('account.confirmPermanentlyDelete') }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="permanentlyDeleteDialog.show = false">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="error" @click="confirmPermanentlyDelete">
            {{ t('account.permanentlyDelete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 復元確認ダイアログ -->
    <v-dialog v-model="restoreDialog.show" max-width="500">
      <v-card>
        <v-card-title>{{ t('account.restore') }}</v-card-title>
        <v-card-text>{{ t('account.confirmRestore') }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="restoreDialog.show = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="success" @click="confirmRestore">{{ t('account.restore') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAccountStore } from '@/stores/account';

const router = useRouter();
const { t } = useI18n();
const accountStore = useAccountStore();

// アカウント一覧を分類
const activeAccounts = computed(() =>
  accountStore.accounts.filter(account => account.status === 'active')
);
const deletedAccounts = computed(() =>
  accountStore.accounts.filter(account => account.status === 'inactive')
);

// ダイアログ状態
const deleteDialog = ref({ show: false, accountId: '' as string | null });
const permanentlyDeleteDialog = ref({ show: false, accountId: '' as string | null });
const restoreDialog = ref({ show: false, accountId: '' as string | null });

/**
 * アカウント追加
 */
function handleAdd() {
  router.push('/settings/accounts/new');
}

/**
 * アカウント編集
 */
function handleEdit(accountId: string) {
  router.push(`/settings/accounts/${accountId}`);
}

/**
 * アカウント削除（確認ダイアログ表示）
 */
function handleDelete(accountId: string) {
  deleteDialog.value = { show: true, accountId };
}

/**
 * 削除確認
 */
async function confirmDelete() {
  if (!deleteDialog.value.accountId) return;

  try {
    await accountStore.deleteAccount(deleteDialog.value.accountId);
    deleteDialog.value = { show: false, accountId: null };
  } catch (error) {
    // エラーはストアで管理されているため、ここではダイアログを閉じるだけ
    console.error('Failed to delete account:', error);
  }
}

/**
 * 完全削除（確認ダイアログ表示）
 */
function handlePermanentlyDelete(accountId: string) {
  permanentlyDeleteDialog.value = { show: true, accountId };
}

/**
 * 完全削除確認
 */
async function confirmPermanentlyDelete() {
  if (!permanentlyDeleteDialog.value.accountId) return;

  try {
    await accountStore.permanentlyDeleteAccount(permanentlyDeleteDialog.value.accountId);
    permanentlyDeleteDialog.value = { show: false, accountId: null };
  } catch (error) {
    // エラーはストアで管理されているため、ここではダイアログを閉じるだけ
    console.error('Failed to permanently delete account:', error);
  }
}

/**
 * 復元（確認ダイアログ表示）
 */
function handleRestore(accountId: string) {
  restoreDialog.value = { show: true, accountId };
}

/**
 * 復元確認
 */
async function confirmRestore() {
  if (!restoreDialog.value.accountId) return;

  try {
    await accountStore.restoreAccount(restoreDialog.value.accountId);
    restoreDialog.value = { show: false, accountId: null };
  } catch (error) {
    // エラーはストアで管理されているため、ここではダイアログを閉じるだけ
    console.error('Failed to restore account:', error);
  }
}

/**
 * 初期データ読み込み
 */
onMounted(async () => {
  // 削除済みアカウントも含めて取得
  await accountStore.fetchAccounts(true);
});
</script>

<style scoped></style>
