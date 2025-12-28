<template>
  <v-container class="fill-height" fluid>
    <v-card class="fill-height">
      <v-card-text class="text-center text--secondary">
        <p>{{ t('mail.selectMessage') }}</p>
        <p class="text-caption">MailDetailPanel will be implemented in task 7.5</p>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.fill-height {
  height: 100%;
}
</style>

