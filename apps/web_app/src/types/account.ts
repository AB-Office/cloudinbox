import { Timestamp } from 'firebase/firestore';

/**
 * メールアカウント設定フォームのデータ
 */
export interface AccountFormData {
  label: string;
  email: string;
  pop3Host: string;
  pop3Port: number;
  pop3Username: string;
  pop3Password: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
}

/**
 * POP3S/SMTP接続テスト結果
 */
export interface AccountTestResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * POP3設定
 */
export interface Pop3Config {
  host: string;
  port: number;
  useSsl: boolean;
  userName: string;
  passwordEnc?: string | null; // 暗号化済みパスワード
}

/**
 * SMTP設定
 */
export interface SmtpConfig {
  host: string;
  port: number;
  useSsl: boolean;
  userName: string;
  passwordEnc?: string | null; // 暗号化済みパスワード
}

/**
 * メールアカウント
 */
export interface MailAccount {
  id?: string; // FirestoreドキュメントID（オプショナル）
  label: string;
  email: string;
  pop3: Pop3Config;
  smtp?: SmtpConfig;
  status: 'active' | 'inactive' | 'error' | 'disabled';
  deletedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

