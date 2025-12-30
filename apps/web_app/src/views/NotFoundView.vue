<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card>
          <v-card-title class="text-h4 text-center pa-6">
            {{ t('common.notFound.title') }}
          </v-card-title>
          <v-card-text class="text-center pa-6">
            <p class="text-h6 mb-4">{{ t('common.notFound.heading') }}</p>
            <p class="text-body-1 mb-6">{{ t('common.notFound.message') }}</p>
            <v-btn color="primary" @click="$router.push('/')">
              {{ t('common.notFound.backToHome') }}
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
