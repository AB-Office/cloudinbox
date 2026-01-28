<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="4">
            <v-card class="elevation-12">
              <v-card-title class="text-h5 text-center pa-6">
                {{ $t('auth.appTitle') }}
              </v-card-title>
              <v-card-text>
                <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
                  {{ errorMessage }}
                </v-alert>
                <div class="text-center">
                  <v-btn
                    v-if="!authStore.isLoading"
                    color="primary"
                    size="large"
                    block
                    @click="handleSignIn"
                  >
                    <v-icon start>mdi-google</v-icon>
                    {{ $t('auth.loginWithGoogle') }}
                  </v-btn>
                  <v-progress-circular
                    v-else
                    indeterminate
                    color="primary"
                    class="mb-4"
                  ></v-progress-circular>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();

const errorMessage = ref<string | null>(null);

/**
 * Google Sign-Inを実行
 */
async function handleSignIn() {
  errorMessage.value = null;
  try {
    await authStore.signInWithGoogle();
    // 認証成功後、watchが自動的にリダイレクトするため、ここでのリダイレクトは不要
  } catch (error: unknown) {
    // ログインキャンセル時はエラーメッセージを表示しない
    if (error instanceof Error && error.message === 'Login cancelled') {
      errorMessage.value = null;
      return;
    }
    // その他のエラーは表示
    errorMessage.value = t('auth.loginFailed');
    console.error('Login error:', error);
  }
}

/**
 * 認証状態を監視して、認証済みの場合はメール一覧にリダイレクト
 */
watch(
  () => authStore.isAuthenticated,
  isAuthenticated => {
    if (isAuthenticated) {
      router.push('/');
    }
  }
);

onMounted(() => {
  // 既に認証済みの場合はリダイレクト
  if (authStore.isAuthenticated) {
    router.push('/');
  }
});
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
