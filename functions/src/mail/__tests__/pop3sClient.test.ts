/**
 * pop3sClient - POP3S接続・メール取得のテスト
 */

import { Pop3sClient } from '../pop3sClient';
import * as tls from 'tls';

// tlsモジュールのモック
jest.mock('tls');

describe('Pop3sClient', () => {
  const mockHost = 'pop.example.com';
  const mockPort = 995;
  const mockUserName = 'user@example.com';
  const mockPassword = 'password123';

  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      write: jest.fn(),
      on: jest.fn(),
      destroy: jest.fn(),
      setEncoding: jest.fn(),
    };

    (tls.connect as jest.Mock).mockImplementation((options, callback) => {
      if (callback) {
        setTimeout(() => callback(), 0);
      }
      return mockSocket;
    });
  });

  describe('connect', () => {
    it('SSL/TLS接続を確立できる', async () => {
      // モック: 接続成功時の応答をシミュレート
      let dataHandler: ((data: Buffer) => void) | null = null;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      // 接続開始
      const connectPromise = client.connect();

      // サーバーからの初期応答をシミュレート
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server ready\r\n'));
      }

      await connectPromise;

      expect(tls.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: mockHost,
          port: mockPort,
          rejectUnauthorized: true,
        }),
        expect.any(Function)
      );
    });

    it('useSslがfalseの場合はエラーを投げる', async () => {
      const client = new Pop3sClient(mockHost, 110, mockUserName, mockPassword, false);
      
      await expect(client.connect()).rejects.toThrow('SSL/TLS is required');
    });

    it('接続エラー時にエラーを投げる', async () => {
      (tls.connect as jest.Mock).mockImplementation((options, callback) => {
        const socket = {
          on: jest.fn((event: string, handler: any) => {
            if (event === 'error') {
              setTimeout(() => handler(new Error('Connection failed')), 0);
            }
          }),
        };
        return socket;
      });

      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      await expect(client.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('listMessages', () => {
    it('メール一覧を取得できる', async () => {
      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      // 接続をモック
      let dataHandler: ((data: Buffer) => void) | null = null;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const connectPromise = client.connect();
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server ready\r\n'));
      }
      await connectPromise;

      // LISTコマンドの応答をシミュレート
      const listPromise = client.listMessages();
      
      if (dataHandler) {
        dataHandler(Buffer.from('+OK\r\n1 1000\r\n2 2000\r\n.\r\n'));
      }

      const messages = await listPromise;

      expect(messages).toEqual([
        { number: 1, size: 1000 },
        { number: 2, size: 2000 },
      ]);
      expect(mockSocket.write).toHaveBeenCalledWith('LIST\r\n');
    });
  });

  describe('retrieveMessage', () => {
    it('メール本文を取得できる', async () => {
      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      // 接続をモック
      let dataHandler: ((data: Buffer) => void) | null = null;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const connectPromise = client.connect();
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server ready\r\n'));
      }
      await connectPromise;

      // RETRコマンドの応答をシミュレート
      const retrievePromise = client.retrieveMessage(1);
      
      if (dataHandler) {
        dataHandler(Buffer.from('+OK\r\nFrom: test@example.com\r\nSubject: Test\r\n\r\nBody content\r\n.\r\n'));
      }

      const message = await retrievePromise;

      expect(message).toContain('From: test@example.com');
      expect(message).toContain('Subject: Test');
      expect(message).toContain('Body content');
      expect(mockSocket.write).toHaveBeenCalledWith('RETR 1\r\n');
    });
  });

  describe('deleteMessage', () => {
    it('メールを削除できる', async () => {
      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      // 接続をモック
      let dataHandler: ((data: Buffer) => void) | null = null;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const connectPromise = client.connect();
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server ready\r\n'));
      }
      await connectPromise;

      // DELEコマンドの応答をシミュレート
      const deletePromise = client.deleteMessage(1);
      
      if (dataHandler) {
        dataHandler(Buffer.from('+OK message deleted\r\n'));
      }

      await deletePromise;

      expect(mockSocket.write).toHaveBeenCalledWith('DELE 1\r\n');
    });
  });

  describe('disconnect', () => {
    it('接続を閉じることができる', async () => {
      const client = new Pop3sClient(mockHost, mockPort, mockUserName, mockPassword);
      
      // 接続をモック
      let dataHandler: ((data: Buffer) => void) | null = null;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const connectPromise = client.connect();
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server ready\r\n'));
      }
      await connectPromise;

      // QUITコマンドの応答をシミュレート
      const disconnectPromise = client.disconnect();
      
      if (dataHandler) {
        dataHandler(Buffer.from('+OK POP3 server signing off\r\n'));
      }

      await disconnectPromise;

      expect(mockSocket.write).toHaveBeenCalledWith('QUIT\r\n');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });
});

