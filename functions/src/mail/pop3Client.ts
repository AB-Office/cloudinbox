/**
 * POP3S接続クライアント
 * 
 * SSL/TLSを使用したPOP3S接続と認証テストを実行する
 */

import * as tls from 'tls';
import * as functions from 'firebase-functions';

/**
 * POP3S接続テストの結果
 */
export interface Pop3TestResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * POP3S接続をテストする
 * 
 * @param host - POP3Sサーバーのホスト名
 * @param port - POP3Sサーバーのポート番号（通常995）
 * @param useSsl - SSL/TLSを使用するか（必須: true）
 * @param userName - ユーザー名
 * @param password - パスワード（平文）
 * @returns 接続テスト結果
 */
export async function testPop3Connection(
  host: string,
  port: number,
  useSsl: boolean,
  userName: string,
  password: string
): Promise<Pop3TestResult> {
  if (!useSsl) {
    return {
      success: false,
      errorMessage: 'SSL/TLS is required for POP3 connections',
    };
  }

  functions.logger.info(`testPop3Connection: Connecting to ${host}:${port}`);

  return new Promise((resolve) => {
    const timeout = 10000; // 10秒のタイムアウト
    let socket: tls.TLSSocket | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = null;
    }
    const cleanup = () => {
      clearTimer();
      if (socket) {
        socket.removeListener('error', onError);
        socket.removeListener('data', onData);
        socket.removeListener('end', onEnd);
        socket.removeListener('close', onClose);
        socket.destroy();
        socket = null;
      }
    };

    const onError = (error: Error) => {
      functions.logger.error(`testPop3Connection error for ${host}:${port}:`, error);
      cleanup();
      resolve({ success: false, errorMessage: error.message || 'Connection failed' });
    };

    const onTimeout = () => {
      cleanup();
      resolve({success: false, errorMessage: 'Connection timeout'});
    };

    const onEnd = () => cleanup();
    const onClose = () => cleanup();
    
    let responseBuffer = '';
    let authState: 'greeting' | 'user' | 'pass' | 'done' = 'greeting';

    const onData = (data: Buffer) => {
      responseBuffer += data.toString();

      let idx: number = 0;
      while((idx = responseBuffer.indexOf('\r\n')) !== -1) {
        const line = responseBuffer.substring(0, idx).trim();
        responseBuffer = responseBuffer.substring(idx + 2);
        
        if (authState === 'greeting') {
          // 初期応答（+OK greeting message）
          if (line.startsWith('+OK')) {
            socket!.write(`USER ${userName}\r\n`);
            authState = 'user';
          } else if (line.startsWith('-ERR')) {           
            cleanup();
            resolve({success: false, errorMessage: line.substring(4).trim() || 'Server error'});
            return;
          }
        } else if (authState === 'user') {
          // USERコマンドの応答
          if (line.startsWith('+OK')) {
            // PASSコマンドを送信
            socket!.write(`PASS ${password}\r\n`);
            authState = 'pass';
          } else if (line.startsWith('-ERR')) {
            cleanup();
            resolve({success: false, errorMessage: line.substring(4).trim() || 'User authentication failed'});
            return;
          }
        } else if (authState === 'pass') {
          // PASSコマンドの応答
          if (line.startsWith('+OK')) {
          // 認証成功
            functions.logger.info(`testPop3Connection: Authentication successful for ${host}:${port}`);
            authState = 'done';
            cleanup();
            resolve({ success: true });
          } else if (line.startsWith('-ERR')) {
            cleanup();
            resolve({success: false, errorMessage: line.substring(4).trim() || 'Password authentication failed'});
            return;
          }
        }
      }
    };

    try {
      // SSL/TLS接続を確立
      socket = tls.connect(
        { host, port, rejectUnauthorized: true },
        () => {
          if (!socket) {
            resolve({success: false, errorMessage: 'Socket is null'});
            return;
          }

          functions.logger.info(`testPop3Connection: TLS connection established to ${host}:${port}`);

          socket.on('data', onData);
          socket.on('end', onEnd);
          socket.on('close', onClose);
          socket.setEncoding('utf8');

          // タイムアウトを設定
          timeoutId = setTimeout(onTimeout, timeout);
        }
      );
      // 接続確立前のエラー（DNS解決エラーなど）をキャッチ
      socket.on('error', onError);
    } catch (error: any) {
      cleanup();
      resolve({
        success: false,
        errorMessage: error.message || 'Connection failed',
      });
    }
  });
}

