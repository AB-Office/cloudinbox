import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { settingsService } from '@/services/settings';
import type { SettingsData } from '@/types/settings';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let unwatchSettings: (() => void) | null = null;

  // 使用可能容量を計算
  const availableStorageBytes = computed(() => {
    if (!settings.value) return 0;
    return Math.max(0, settings.value.maxStorageBytes - settings.value.usedStorageBytes);
  });

  /**
   * 設定データを読み込む
   */
  async function loadSettings() {
    isLoading.value = true;
    error.value = null;
    try {
      settings.value = await settingsService.loadSettings();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      error.value = errorMessage;
      console.error('Failed to load settings:', e);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 設定データをリアルタイムで監視開始
   */
  function startWatching() {
    if (unwatchSettings) {
      // 既に監視中の場合、停止してから再開
      stopWatching();
    }

    try {
      unwatchSettings = settingsService.watchSettings(data => {
        settings.value = data;
        error.value = null;
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      error.value = errorMessage;
      console.error('Failed to start watching settings:', e);
    }
  }

  /**
   * 設定データの監視を停止
   */
  function stopWatching() {
    if (unwatchSettings) {
      unwatchSettings();
      unwatchSettings = null;
    }
  }

  return {
    settings,
    isLoading,
    error,
    availableStorageBytes,
    loadSettings,
    startWatching,
    stopWatching,
  };
});

