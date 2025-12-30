/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import MailHeader from '../MailHeader.vue';
import type { MailMessage, AttachmentListItem } from '@/types/mail';

// Firebaseのモック
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-uid',
    },
  })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    writeBatch: vi.fn(),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(),
    arrayUnion: vi.fn(),
    arrayRemove: vi.fn(),
  };
});

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja: {
      mail: {
        from: '送信者',
        to: '宛先',
        cc: 'CC',
        bcc: 'BCC',
        sentAt: '送信日時',
        attachments: '添付ファイル',
        noAttachments: '添付ファイルなし',
      },
    },
  },
});

describe('MailHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createWrapper = (props: any) => {
    return mount(MailHeader, {
      props,
      global: {
        plugins: [vuetify, i18n, createPinia()],
      },
    });
  };

  it('should display message subject', () => {
    const message = {
      messageId: '1',
      threadId: 'thread1',
      subject: 'Test Subject',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      sentAt: new Date() as any,
      receivedAt: new Date() as any,
      bodyPreview: 'Preview text',
      hasLargeBody: false,
      hasAttachments: false,
      isRead: false,
      labels: ['inbox'],
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as MailMessage;

    const wrapper = createWrapper({ message });

    expect(wrapper.text()).toContain('Test Subject');
  });

  it('should display message from address', () => {
    const message = {
      messageId: '1',
      threadId: 'thread1',
      subject: 'Test',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      sentAt: new Date() as any,
      receivedAt: new Date() as any,
      bodyPreview: 'Preview text',
      hasLargeBody: false,
      hasAttachments: false,
      isRead: false,
      labels: ['inbox'],
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as MailMessage;

    const wrapper = createWrapper({ message });

    expect(wrapper.text()).toContain('sender@example.com');
  });

  it('should display attachments', () => {
    const message = {
      messageId: '1',
      threadId: 'thread1',
      subject: 'Test',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      sentAt: new Date() as any,
      receivedAt: new Date() as any,
      bodyPreview: 'Preview text',
      hasLargeBody: false,
      hasAttachments: true,
      isRead: false,
      labels: ['inbox'],
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as MailMessage;

    const attachments: AttachmentListItem[] = [
      { filename: 'test.pdf', size: 1024, contentType: 'application/pdf' },
      { filename: 'test.jpg', size: 2048, contentType: 'image/jpeg' },
    ];

    const wrapper = createWrapper({ message, attachments });

    expect(wrapper.text()).toContain('test.pdf');
    expect(wrapper.text()).toContain('test.jpg');
  });

  it('should display "no attachments" when hasAttachments is true but no attachments provided', () => {
    const message = {
      messageId: '1',
      threadId: 'thread1',
      subject: 'Test',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      sentAt: new Date() as any,
      receivedAt: new Date() as any,
      bodyPreview: 'Preview text',
      hasLargeBody: false,
      hasAttachments: true,
      isRead: false,
      labels: ['inbox'],
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    } as MailMessage;

    const wrapper = createWrapper({ message });

    expect(wrapper.text()).toContain('添付ファイルなし');
  });
});
