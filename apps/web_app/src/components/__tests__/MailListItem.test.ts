/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import MailListItem from '../MailListItem.vue';
import type { MailThread } from '@/types/mail';

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: 'ja',
  messages: {
    ja: {},
  },
});

// formatRelativeTimeをモック
vi.mock('@/plugins/i18n', () => ({
  formatRelativeTime: vi.fn(() => '1時間前'),
}));

// MailThread型の必須プロパティを満たすヘルパー関数
function createMockThread(overrides: Partial<MailThread> = {}): MailThread {
  return {
    threadId: 'thread1',
    latestMessageId: 'message1',
    subject: 'Test Subject',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    preview: 'Test preview',
    hasUnread: false,
    labels: ['inbox'],
    lastMessageAt: new Date() as any,
    sentAt: new Date() as any,
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
    ...overrides,
  };
}

describe('MailListItem', () => {
  const createWrapper = (props: any) => {
    return mount(MailListItem, {
      props,
      global: {
        plugins: [vuetify, i18n],
      },
    });
  };

  it('should display thread subject', () => {
    const thread = createMockThread({
      subject: 'Test Subject',
    });

    const wrapper = createWrapper({ thread, hasUnread: false });

    expect(wrapper.text()).toContain('Test Subject');
  });

  it('should display sender address', () => {
    const thread = createMockThread({
      from: 'sender@example.com',
    });

    const wrapper = createWrapper({ thread, hasUnread: false });

    expect(wrapper.text()).toContain('sender@example.com');
  });

  it('should display preview text', () => {
    const thread = createMockThread({
      preview: 'Test preview text',
    });

    const wrapper = createWrapper({ thread, hasUnread: false });

    expect(wrapper.text()).toContain('Test preview text');
  });

  it('should bold subject when hasUnread is true', () => {
    const thread = createMockThread({
      hasUnread: true,
    });

    const wrapper = createWrapper({ thread, hasUnread: true });

    // v-list-item-title内のspan要素を検索
    const subjectElement = wrapper.find('.v-list-item-title span');
    expect(subjectElement.exists()).toBe(true);
    expect(subjectElement.classes()).toContain('font-weight-bold');
  });

  it('should emit click event when clicked', async () => {
    const thread = createMockThread();

    const wrapper = createWrapper({ thread, hasUnread: false });

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toBeTruthy();
    expect(wrapper.emitted('click')?.[0]).toEqual(['thread1']);
  });
});
