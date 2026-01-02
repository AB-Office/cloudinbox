import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from './firebase';
import type { SettingsData } from '@/types/settings';

const db = getFirestore(firebaseApp);

/**
 * 設定データを取得する
 */
export async function loadSettings(): Promise<SettingsData> {
  const auth = getAuth(firebaseApp);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User not authenticated');

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('User document not found');
  }

  const data = userSnap.data();
  const plan = data.plan || {};
  const usage = data.usage || {};

  return {
    planLabel: plan.label || 'Free',
    maxStorageBytes: plan.maxStorageBytes ?? 2147483648, // デフォルト2GB
    usedStorageBytes: usage.storageBytes ?? 0,
  };
}

/**
 * 設定データをリアルタイムで監視する
 * @param callback データ更新時に呼ばれるコールバック関数
 * @returns 監視を停止する関数
 */
export function watchSettings(callback: (data: SettingsData) => void): () => void {
  const auth = getAuth(firebaseApp);
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User not authenticated');
  }

  const userRef = doc(db, 'users', uid);

  return onSnapshot(
    userRef,
    snapshot => {
      if (!snapshot.exists()) {
        // ドキュメントが存在しない場合は、デフォルト値を返す
        callback({
          planLabel: 'Free',
          maxStorageBytes: 2147483648, // デフォルト2GB
          usedStorageBytes: 0,
        });
        return;
      }

      const data = snapshot.data();
      const plan = data.plan || {};
      const usage = data.usage || {};

      callback({
        planLabel: plan.label || 'Free',
        maxStorageBytes: plan.maxStorageBytes ?? 2147483648, // デフォルト2GB
        usedStorageBytes: usage.storageBytes ?? 0,
      });
    },
    error => {
      console.error('Error watching settings:', error);
    }
  );
}

export const settingsService = {
  loadSettings,
  watchSettings,
};
