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
  private multilineMode: boolean = false; // マルチライン応答モード
  private multilineLines: string[] = []; // マルチライン応答の行を蓄積
  private multilineResolver: {
    resolve: (value: string[]) => void;
    reject: (error: Error) => void;
  } | null = null;
  private multilineTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

    console.log('[Pop3sClient] Sending LIST command...');
    
    // LISTコマンドは特殊：+OKの後にマルチライン応答が続く
    // sendCommand()を使わず、直接コマンドを送信してマルチライン応答を処理する
    const commandId = `cmd_${this.commandId++}`;
    const command = 'LIST';
    
    return new Promise((resolve, reject) => {
      // マルチライン応答モードを先に有効化
      this.multilineMode = true;
      this.multilineLines = [];
      this.multilineResolver = {
        resolve: (lines: string[]) => {
          console.log('[Pop3sClient] Multiline response received, lines count:', lines.length);
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
          resolve(messages);
        },
        reject: (error: Error) => {
          reject(error);
        }
      };

      // タイムアウト設定
      const timeout = 120000;
      this.multilineTimeoutId = setTimeout(() => {
        if (this.multilineResolver) {
          this.multilineMode = false;
          const resolver = this.multilineResolver;
          const linesCount = this.multilineLines.length;
          this.multilineResolver = null;
          this.multilineLines = [];
          this.multilineTimeoutId = null;
          resolver.reject(new Error(`Multiline response timeout (${timeout}ms), received ${linesCount} lines, buffer length: ${this.responseBuffer.length}`));
        }
      }, timeout);

      // コマンドを送信
      if (!this.socket) {
        this.multilineMode = false;
        this.multilineResolver = null;
        this.multilineLines = [];
        if (this.multilineTimeoutId) {
          clearTimeout(this.multilineTimeoutId);
          this.multilineTimeoutId = null;
        }
        reject(new Error('Not connected'));
        return;
      }

      // +OK応答を待つ（通常モードで処理）
      const okResolver = {
        resolve: (line: string) => {
          if (!line.startsWith('+OK')) {
            this.multilineMode = false;
            const resolver = this.multilineResolver;
            this.multilineResolver = null;
            this.multilineLines = [];
            if (this.multilineTimeoutId) {
              clearTimeout(this.multilineTimeoutId);
              this.multilineTimeoutId = null;
            }
            resolver?.reject(new Error(`LIST command failed: ${line}`));
          } else {
            console.log('[Pop3sClient] LIST command +OK received:', line);
            // +OKを受け取った後、バッファに残っているデータを処理
            if (this.responseBuffer.includes('\r\n')) {
              console.log('[Pop3sClient] Processing remaining buffer data');
              // setupDataHandlerが自動的に処理する
            }
          }
        },
        reject: (error: Error) => {
          this.multilineMode = false;
          const resolver = this.multilineResolver;
          this.multilineResolver = null;
          this.multilineLines = [];
          if (this.multilineTimeoutId) {
            clearTimeout(this.multilineTimeoutId);
            this.multilineTimeoutId = null;
          }
          resolver?.reject(error);
        }
      };
      
      this.responseResolvers.set(commandId, okResolver);
      this.socket.write(`${command}\r\n`);
    });
  }

  /**
   * メール本文を取得する（RETRコマンド）
   */
  async retrieveMessage(messageNumber: number): Promise<string> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    console.log('[Pop3sClient] Sending RETR command for message:', messageNumber);
    
    // RETRコマンドは特殊：+OKの後にマルチライン応答が続く
    // sendCommand()を使わず、直接コマンドを送信してマルチライン応答を処理する
    const commandId = `cmd_${this.commandId++}`;
    const command = `RETR ${messageNumber}`;
    
    return new Promise((resolve, reject) => {
      // マルチライン応答モードを先に有効化
      this.multilineMode = true;
      this.multilineLines = [];
      this.multilineResolver = {
        resolve: (lines: string[]) => {
          console.log('[Pop3sClient] RETR multiline response received, lines count:', lines.length);
          
          // +OKで始まる行を除去（POP3サーバーのレスポンス行）
          const filteredLines = lines.filter(line => !line.trim().startsWith('+OK'));
          
          // メッセージを結合
          const message = filteredLines.join('\r\n');
          console.log('[Pop3sClient] RETR message after filtering (removed +OK lines):', message.length, 'bytes');
          
          resolve(message);
        },
        reject: (error: Error) => {
          reject(error);
        }
      };

      // タイムアウト設定
      const timeout = 120000;
      this.multilineTimeoutId = setTimeout(() => {
        if (this.multilineResolver) {
          this.multilineMode = false;
          const resolver = this.multilineResolver;
          const linesCount = this.multilineLines.length;
          this.multilineResolver = null;
          this.multilineLines = [];
          this.multilineTimeoutId = null;
          resolver.reject(new Error(`RETR multiline response timeout (${timeout}ms), received ${linesCount} lines, buffer length: ${this.responseBuffer.length}`));
        }
      }, timeout);

      // コマンドを送信
      if (!this.socket) {
        this.multilineMode = false;
        this.multilineResolver = null;
        this.multilineLines = [];
        if (this.multilineTimeoutId) {
          clearTimeout(this.multilineTimeoutId);
          this.multilineTimeoutId = null;
        }
        reject(new Error('Not connected'));
        return;
      }

      // +OK応答を待つ（通常モードで処理）
      const okResolver = {
        resolve: (line: string) => {
          if (!line.startsWith('+OK')) {
            this.multilineMode = false;
            const resolver = this.multilineResolver;
            this.multilineResolver = null;
            this.multilineLines = [];
            if (this.multilineTimeoutId) {
              clearTimeout(this.multilineTimeoutId);
              this.multilineTimeoutId = null;
            }
            resolver?.reject(new Error(`RETR command failed: ${line}`));
          } else {
            console.log('[Pop3sClient] RETR command +OK received:', line);
            // +OKを受け取った後、バッファに残っているデータを処理
            if (this.responseBuffer.includes('\r\n')) {
              console.log('[Pop3sClient] Processing remaining buffer data for RETR');
              // setupDataHandlerが自動的に処理する
            }
          }
        },
        reject: (error: Error) => {
          this.multilineMode = false;
          const resolver = this.multilineResolver;
          this.multilineResolver = null;
          this.multilineLines = [];
          if (this.multilineTimeoutId) {
            clearTimeout(this.multilineTimeoutId);
            this.multilineTimeoutId = null;
          }
          resolver?.reject(error);
        }
      };
      
      this.responseResolvers.set(commandId, okResolver);
      this.socket.write(`${command}\r\n`);
    });
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
      const text = data.toString('utf8');
      console.log('[Pop3sClient] Received data:', text.substring(0, 100), '... (length:', text.length, ')');
      this.responseBuffer += text;
      console.log('[Pop3sClient] Buffer length after append:', this.responseBuffer.length, 'multilineMode:', this.multilineMode);
      
      // マルチライン応答モードの場合
      if (this.multilineMode && this.multilineResolver) {
        console.log('[Pop3sClient] Processing multiline response, current lines:', this.multilineLines.length);
        // 完全な行を処理
        while (this.responseBuffer.includes('\r\n')) {
          const lineEnd = this.responseBuffer.indexOf('\r\n');
          const line = this.responseBuffer.substring(0, lineEnd);
          this.responseBuffer = this.responseBuffer.substring(lineEnd + 2);

          // 空行はスキップしない（MIMEメッセージのヘッダーと本文の間の空行を保持するため）
          // 終了マーカー（.）のみをチェック
          if (line === '.') {
            console.log('[Pop3sClient] End marker detected, resolving with', this.multilineLines.length, 'lines');
            this.multilineMode = false;
            const resolver = this.multilineResolver;
            const multilineLines = this.multilineLines;
            this.multilineResolver = null;
            this.multilineLines = [];
            if (this.multilineTimeoutId) {
              clearTimeout(this.multilineTimeoutId);
              this.multilineTimeoutId = null;
            }
            resolver.resolve(multilineLines); // 終了マーカーを除く（既に追加していない）
            return;
          }

          console.log('[Pop3sClient] Multiline line received:', line);
      
          // 行を蓄積（空行も含む）
          this.multilineLines.push(line);
        }
        return;
      }
      
      // 通常モード: 完全な行が来たら処理
      while (this.responseBuffer.includes('\r\n')) {
        const lineEnd = this.responseBuffer.indexOf('\r\n');
        const line = this.responseBuffer.substring(0, lineEnd);
        this.responseBuffer = this.responseBuffer.substring(lineEnd + 2);

        console.log('[Pop3sClient] Normal mode line received:', line, 'waiting resolvers:', this.responseResolvers.size, 'multilineMode:', this.multilineMode);

        // マルチライン応答モードが有効な場合、+OK以外の行はマルチライン応答として処理
        if (this.multilineMode && this.multilineResolver) {
          if (line.startsWith('+OK')) {
            // +OK行は通常モードのリゾルバーに渡す
            for (const [key, resolver] of this.responseResolvers.entries()) {
              resolver.resolve(line);
              this.responseResolvers.delete(key);
              break;
            }
          } else {
            // +OK以外の行はマルチライン応答として処理
            console.log('[Pop3sClient] Treating as multiline line:', line);
            
            // 終了マーカー（.）を検出
            if (line === '.') {
              console.log('[Pop3sClient] End marker detected, resolving with', this.multilineLines.length, 'lines');
              this.multilineMode = false;
              const resolver = this.multilineResolver;
              const multilineLines = this.multilineLines;
              this.multilineResolver = null;
              this.multilineLines = [];
              if (this.multilineTimeoutId) {
                clearTimeout(this.multilineTimeoutId);
                this.multilineTimeoutId = null;
              }
              resolver.resolve(multilineLines);
              continue;
            }

            // 行を蓄積
            this.multilineLines.push(line);
          }
          continue;
        }

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

}

