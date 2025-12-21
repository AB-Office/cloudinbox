/**
 * SMTP接続テストプログラム
 * 
 * 実際のSMTPサーバーに接続して、メール送信をテストするためのスクリプト
 * 
 * 使用方法:
 *   npx ts-node test/smtp-test.ts <host>:<port> <username> <password> <from> <to>
 * 
 * 例:
 *   npx ts-node test/smtp-test.ts smtp.example.com:587 user@example.com password user@example.com recipient@example.com
 */

import * as nodemailer from 'nodemailer';

interface TestConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string;
}

function parseArguments(): TestConfig {
  const args = process.argv.slice(2);

  if (args.length < 5) {
    console.error('Usage: npx ts-node test/smtp-test.ts <host>:<port> <username> <password> <from> <to>');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node test/smtp-test.ts smtp.example.com:587 user@example.com password user@example.com recipient@example.com');
    process.exit(1);
  }

  const [hostPort, username, password, from, to] = args;
  
  // host:port形式をパース
  const [host, portStr] = hostPort.split(':');
  if (!host || !portStr) {
    console.error(`Invalid host:port format: ${hostPort}`);
    console.error('Expected format: host:port (e.g., smtp.example.com:587)');
    process.exit(1);
  }

  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${portStr}`);
    process.exit(1);
  }

  const secure = port === 465;

  return {
    host,
    port,
    secure,
    username,
    password,
    from,
    to,
  };
}

async function testSmtpConnection(config: TestConfig): Promise<void> {
  console.log('='.repeat(60));
  console.log('SMTP Connection Test');
  console.log('='.repeat(60));
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`Secure: ${config.secure} (port 465 = true, otherwise false)`);
  console.log(`Username: ${config.username}`);
  console.log(`From: ${config.from}`);
  console.log(`To: ${config.to}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // トランスポートを作成
    console.log('Creating transporter...');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: true,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
    });

    // 接続と認証をテスト
    console.log('Verifying connection and authentication...');
    await transporter.verify();
    console.log('✓ Connection and authentication successful!');
    console.log('');

    // メール送信をテスト
    console.log('Sending test email...');
    const mailOptions: nodemailer.SendMailOptions = {
      from: config.from,
      to: config.to,
      subject: 'SMTP Test Email',
      text: `This is a test email sent from the SMTP test program.

Test Information:
- Host: ${config.host}
- Port: ${config.port}
- Secure: ${config.secure}
- From: ${config.from}
- To: ${config.to}
- Sent at: ${new Date().toISOString()}
`,
      envelope: {
        from: config.from,
        to: [config.to],
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Response: ${info.response || 'N/A'}`);
    console.log('');

    // トランスポートを閉じる
    transporter.close();
    console.log('✓ Test completed successfully!');
  } catch (error: any) {
    console.error('✗ Test failed!');
    console.error('');
    console.error('Error details:');
    console.error(`  Code: ${error.code || 'N/A'}`);
    console.error(`  Response Code: ${error.responseCode || 'N/A'}`);
    console.error(`  Response: ${error.response || 'N/A'}`);
    console.error(`  Command: ${error.command || 'N/A'}`);
    console.error(`  Message: ${error.message || 'N/A'}`);
    console.error('');
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// メイン処理
(async () => {
  try {
    const config = parseArguments();
    await testSmtpConnection(config);
  } catch (error: any) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();

