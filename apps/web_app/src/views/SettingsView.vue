<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h5 mb-4">{{ t('navigation.settings') }}</h1>
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
  </v-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();

function navigateToAccounts() {
  router.push({ name: 'account-list' });
}
</script>

<style scoped>
.settings-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.settings-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
</style>
