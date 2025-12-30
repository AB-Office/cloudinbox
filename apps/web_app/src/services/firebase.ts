// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import devConfig from '../config/firebase-config-dev.json';
import prodConfig from '../config/firebase-config-prod.json';

// 環境変数またはビルド時の設定に基づいて適切な設定を読み込む
// 本番環境の場合は環境変数 FIREBASE_ENV=production を設定する
const isProduction =
  import.meta.env.MODE === 'production' || import.meta.env.VITE_FIREBASE_ENV === 'production';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = isProduction
  ? (prodConfig as FirebaseOptions)
  : (devConfig as FirebaseOptions);

// Initialize Firebase
export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null =
  typeof window !== 'undefined' ? getAnalytics(firebaseApp) : null;

export default firebaseApp;
