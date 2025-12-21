/**
 * mailbuild型定義
 */
declare module 'mailbuild' {
  interface MailBuildOptions {
    from: string;
    to?: string;
    subject: string;
    date?: Date;
    messageId?: string;
    text?: string;
    html?: string;
  }

  interface AttachmentOptions {
    filename: string;
    contents: Buffer;
    contentType?: string;
  }

  interface MailBuilder {
    cc(cc: string): MailBuilder;
    bcc(bcc: string): MailBuilder;
    attachment(options: AttachmentOptions): MailBuilder;
    build(): string;
  }

  function mailbuild(options: MailBuildOptions): MailBuilder;

  export = mailbuild;
}

