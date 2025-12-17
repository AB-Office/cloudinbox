/**
 * POP3S接続クライアント
 * 
 * SSL/TLSを使用したPOP3S接続とメール取得機能を提供
 * 自動受信と手動受信の両方で再利用可能
 */

import * as tls from 'tls';

/**
 * メール一覧のアイテム
 */
export interface MailListItem {
  number: number;
  size: number;
}

/**
 * POP3S接続クライアントクラス
 */
export class Pop3sClient {
  private socket: tls.TLSSocket | null = null;
  private responseBuffer: string = '';
  private responseResolvers: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private commandId: number = 0;

  constructor(
    private host: string,
    private port: number,
    private userName: string,
    private password: string,
    private useSsl: boolean = true
  ) {
    if (!useSsl) {
      throw new Error('SSL/TLS is required for POP3 connections');
    }
  }

  /**
   * POP3Sサーバーに接続し、認証する
   */
  async connect(): Promise<void> {
    if (!this.useSsl) {
      throw new Error('SSL/TLS is required for POP3 connections');
    }

    return new Promise((resolve, reject) => {
      const timeout = 30000; // 30秒のタイムアウト
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      try {
        this.socket = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: true, // 証明書検証を有効化
          },
          () => {
            if (!this.socket) {
              cleanup();
              reject(new Error('Socket is null'));
              return;
            }

            this.socket.setEncoding('utf8');
            this.setupDataHandler();

            // 初期応答を待つ
            this.waitForResponse('greeting')
              .then((response) => {
                if (!response.startsWith('+OK')) {
                  cleanup();
                  reject(new Error(`Unexpected greeting: ${response}`));
                  return;
                }

                // USERコマンドを送信
                this.sendCommand('USER', this.userName)
                  .then((userResponse) => {
                    if (!userResponse.startsWith('+OK')) {
                      cleanup();
                      reject(new Error(`USER command failed: ${userResponse}`));
                      return;
                    }

                    // PASSコマンドを送信
                    this.sendCommand('PASS', this.password)
                      .then((passResponse) => {
                        if (!passResponse.startsWith('+OK')) {
                          cleanup();
                          reject(new Error(`PASS command failed: ${passResponse}`));
                          return;
                        }

                        cleanup();
                        resolve();
                      })
                      .catch(reject);
                  })
                  .catch(reject);
              })
              .catch(reject);
          }
        );

      this.socket.on('error', (error: Error) => {
        cleanup();
        reject(error);
      });

        timeoutId = setTimeout(() => {
          cleanup();
          if (this.socket) {
            this.socket.destroy();
          }
          reject(new Error('Connection timeout'));
        }, timeout);
      } catch (error: any) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * メール一覧を取得する（LISTコマンド）
   */
  async listMessages(): Promise<MailListItem[]> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const response = await this.sendCommand('LIST');
    
    if (!response.startsWith('+OK')) {
      throw new Error(`LIST command failed: ${response}`);
    }

    // マルチライン応答を取得
    const lines = await this.readMultilineResponse();
    
    const messages: MailListItem[] = [];
    for (const line of lines) {
      if (line === '.' || line.trim() === '') {
        continue;
      }
      
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const number = parseInt(parts[0], 10);
        const size = parseInt(parts[1], 10);
        if (!isNaN(number) && !isNaN(size)) {
          messages.push({ number, size });
        }
      }
    }

    return messages;
  }

  /**
   * メール本文を取得する（RETRコマンド）
   */
  async retrieveMessage(messageNumber: number): Promise<string> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const response = await this.sendCommand('RETR', messageNumber.toString());
    
    if (!response.startsWith('+OK')) {
      throw new Error(`RETR command failed: ${response}`);
    }

    // マルチライン応答を取得
    const lines = await this.readMultilineResponse();
    
    return lines.join('\r\n');
  }

  /**
   * メールを削除する（DELEコマンド）
   */
  async deleteMessage(messageNumber: number): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const response = await this.sendCommand('DELE', messageNumber.toString());
    
    if (!response.startsWith('+OK')) {
      throw new Error(`DELE command failed: ${response}`);
    }
  }

  /**
   * 接続を閉じる（QUITコマンド）
   */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    try {
      await this.sendCommand('QUIT');
    } catch (error) {
      // QUITコマンドのエラーは無視
    } finally {
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
      }
    }
  }

  /**
   * データハンドラーを設定
   */
  private setupDataHandler(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('data', (data: Buffer) => {
      this.responseBuffer += data.toString('utf8');
      
      // 完全な行が来たら処理
      while (this.responseBuffer.includes('\r\n')) {
        const lineEnd = this.responseBuffer.indexOf('\r\n');
        const line = this.responseBuffer.substring(0, lineEnd);
        this.responseBuffer = this.responseBuffer.substring(lineEnd + 2);

        // 待機中のレスポンスリゾルバーを探す
        for (const [key, resolver] of this.responseResolvers.entries()) {
          resolver.resolve(line);
          this.responseResolvers.delete(key);
          break;
        }
      }
    });
  }

  /**
   * コマンドを送信し、応答を待つ
   */
  private async sendCommand(command: string, arg?: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const commandStr = arg ? `${command} ${arg}` : command;
    const id = `cmd_${this.commandId++}`;

    return new Promise((resolve, reject) => {
      this.responseResolvers.set(id, { resolve, reject });
      
      this.socket!.write(`${commandStr}\r\n`);
      
      // タイムアウト設定（30秒）
      setTimeout(() => {
        if (this.responseResolvers.has(id)) {
          this.responseResolvers.delete(id);
          reject(new Error(`Command timeout: ${commandStr}`));
        }
      }, 30000);
    });
  }

  /**
   * 初期応答を待つ
   */
  private async waitForResponse(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.responseResolvers.set(key, { resolve, reject });
      
      // タイムアウト設定（30秒）
      setTimeout(() => {
        if (this.responseResolvers.has(key)) {
          this.responseResolvers.delete(key);
          reject(new Error('Response timeout'));
        }
      }, 30000);
    });
  }

  /**
   * マルチライン応答を読み取る
   */
  private async readMultilineResponse(): Promise<string[]> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const lines: string[] = [];
    
    return new Promise((resolve, reject) => {
      const timeout = 60000; // 60秒のタイムアウト
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const dataHandler = (data: Buffer) => {
        const text = data.toString('utf8');
        const newLines = text.split('\r\n');
        
        for (const line of newLines) {
          if (line.trim() === '') {
            continue;
          }
          
          lines.push(line);
          
          // 終了マーカー（.）を検出
          if (line === '.') {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            this.socket!.removeListener('data', dataHandler);
            resolve(lines.slice(0, -1)); // 終了マーカーを除く
            return;
          }
        }
      };

      this.socket!.on('data', dataHandler);

      timeoutId = setTimeout(() => {
        this.socket!.removeListener('data', dataHandler);
        reject(new Error('Multiline response timeout'));
      }, timeout);
    });
  }
}

