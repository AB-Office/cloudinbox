import { FirebaseApp } from 'firebase/app';
import { Analytics } from 'firebase/analytics';
import { User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Functions } from 'firebase/functions';
import { FirebaseStorage } from 'firebase/storage';

/**
 * Firebase サービスの型定義
 */
export interface FirebaseServices {
  app: FirebaseApp;
  auth: {
    currentUser: User | null;
  };
  firestore: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
  analytics: Analytics | null;
}
