/**
 * DEK（Data Encryption Key）生成・管理モジュール
 * 
 * ユーザーごとのDEKを生成し、KMSでwrapしてSecret Managerに保存する
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { randomBytes } from 'node:crypto';
import * as kms from './kms';

/**
 * Secret Managerクライアントのシングルトンインスタンス
 */
let secretClient: SecretManagerServiceClient | null = null;

/**
 * Secret Managerクライアントを取得する
 */
function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

/**
 * Secret Managerクライアントをリセットする（テスト用）
 */
export function resetClient(): void {
  secretClient = null;
}

/**
 * プロジェクトIDを取得する
 */
function getProjectId(): string {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT environment variable is not set');
  }
  return projectId;
}

/**
 * DEKのシークレット名を取得する
 */
function getSecretName(uid: string): string {
  return `dek-${uid}`;
}

/**
 * DEKのメモリキャッシュ（関数実行中のみ有効）
 */
const dekCache = new Map<string, Buffer>();

/**
 * ユーザー専用のDEKを生成し、KMSでwrapしてSecret Managerに保存する
 * 
 * @param uid - ユーザーID
 * @throws 既にDEKが存在する場合はエラーを投げる
 */
export async function createDataKeyForUser(uid: string): Promise<void> {
  const client = getSecretClient();
  const projectId = getProjectId();
  const secretName = getSecretName(uid);
  const parent = `projects/${projectId}`;

  // 既にDEKが存在するかチェック
  try {
    const [secret] = await client.getSecret({
      name: `${parent}/secrets/${secretName}`,
    });
    if (secret) {
      throw new Error(`Data key already exists for user: ${uid}`);
    }
  } catch (error: any) {
    // 404エラー（存在しない）の場合は続行
    if (error.code !== 5) { // NOT_FOUND
      throw error;
    }
  }

  // 32バイト（256ビット）のDEKを生成
  const dek = randomBytes(32);

  // KMSでwrap
  const wrappedDek = await kms.wrapKey(dek);

  // Secret Managerに保存
  try {
    // シークレットを作成
    await client.createSecret({
      parent,
      secretId: secretName,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });
  } catch (error: any) {
    // 既に存在する場合は無視（競合状態の可能性）
    if (error.code !== 6) { // ALREADY_EXISTS
      throw error;
    }
  }

  // バージョンを追加
  await client.addSecretVersion({
    parent: `${parent}/secrets/${secretName}`,
    payload: {
      data: wrappedDek,
    },
  });
}

/**
 * ユーザーのDEKを取得する（キャッシュ付き）
 * 
 * @param uid - ユーザーID
 * @returns DEK（Buffer）
 */
export async function getDataKey(uid: string): Promise<Buffer> {
  // キャッシュをチェック
  if (dekCache.has(uid)) {
    return dekCache.get(uid)!;
  }

  const client = getSecretClient();
  const projectId = getProjectId();
  const secretName = getSecretName(uid);
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  // Secret Managerから取得
  const [version] = await client.accessSecretVersion({
    name,
  });

  if (!version.payload || !version.payload.data) {
    throw new Error(`Data key not found for user: ${uid}`);
  }

  const wrappedDek = Buffer.from(version.payload.data as Uint8Array);

  // KMSでunwrap
  const dek = await kms.unwrapKey(wrappedDek);

  // キャッシュに保存
  dekCache.set(uid, dek);

  return dek;
}

/**
 * キャッシュをクリアする（テスト用）
 */
export function clearCache(): void {
  dekCache.clear();
}

