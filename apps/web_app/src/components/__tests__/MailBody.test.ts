/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createI18n } from 'vue-i18n';
import MailBody from '../MailBody.vue';
import type { DecryptedMailBody } from '@/types/mail';

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
        noBody: '本文がありません',
      },
    },
  },
});

// DOMPurifyをモック
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}));

describe('MailBody', () => {
  const createWrapper = (props: any) => {
    return mount(MailBody, {
      props,
      global: {
        plugins: [vuetify, i18n],
      },
    });
  };

  it('should display HTML body when available', () => {
    const decryptedBody: DecryptedMailBody = {
      bodyHtml: '<p>Test HTML body</p>',
      bodyText: 'Test text body',
    };

    const wrapper = createWrapper({ decryptedBody });

    expect(wrapper.html()).toContain('<p>Test HTML body</p>');
  });

  it('should display text body when HTML is not available', () => {
    const decryptedBody: DecryptedMailBody = {
      bodyText: 'Test text body',
    };

    const wrapper = createWrapper({ decryptedBody });

    expect(wrapper.text()).toContain('Test text body');
  });

  it('should display "no body" message when body is empty', () => {
    const decryptedBody: DecryptedMailBody = {};

    const wrapper = createWrapper({ decryptedBody });

    expect(wrapper.text()).toContain('本文がありません');
  });

  it('should sanitize HTML content', async () => {
    const DOMPurify = await import('dompurify');
    const decryptedBody: DecryptedMailBody = {
      bodyHtml: '<p>Test</p><script>alert("xss")</script>',
    };

    createWrapper({ decryptedBody });

    expect(DOMPurify.default.sanitize).toHaveBeenCalled();
  });
});
