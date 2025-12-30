/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSnackbar } from '../useSnackbar';
import { parseError } from '@/utils/errorHandler';

// vue-i18nをモック
const mockT = vi.fn((key: string) => key);
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT,
  }),
}));

// errorHandlerをモック
vi.mock('@/utils/errorHandler', () => ({
  parseError: vi.fn(),
}));

describe('useSnackbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseError).mockReturnValue({
      messageKey: {
        category: 'unknown' as any,
        key: 'errors.generic',
      },
      message: 'An error occurred',
    });
  });

  describe('showError', () => {
    it('should set error snackbar state and message', () => {
      const error = new Error('Test error');
      vi.mocked(parseError).mockReturnValue({
        messageKey: {
          category: 'error' as any,
          key: 'errors.generic',
        },
        message: 'Test error message',
      });

      const { snackbar, snackbarText, snackbarColor, showError } = useSnackbar();

      expect(snackbar.value).toBe(false);
      expect(snackbarText.value).toBe('');

      showError(error);

      expect(parseError).toHaveBeenCalledWith(error, mockT);
      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Test error message');
      expect(snackbarColor.value).toBe('error');
    });

    it('should handle different error types', () => {
      const { snackbar, snackbarText, showError } = useSnackbar();

      // String error
      vi.mocked(parseError).mockReturnValue({
        messageKey: {
          category: 'unknown' as any,
          key: 'errors.generic',
        },
        message: 'String error',
      });
      showError('String error');

      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('String error');

      // Reset
      snackbar.value = false;

      // Object error
      vi.mocked(parseError).mockReturnValue({
        messageKey: {
          category: 'unknown' as any,
          key: 'errors.generic',
        },
        message: 'Object error',
      });
      showError({ message: 'Object error' });

      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Object error');
    });
  });

  describe('showSuccess', () => {
    it('should set success snackbar state and message', () => {
      const { snackbar, snackbarText, snackbarColor, showSuccess } = useSnackbar();

      expect(snackbar.value).toBe(false);
      expect(snackbarText.value).toBe('');

      showSuccess('Operation successful');

      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Operation successful');
      expect(snackbarColor.value).toBe('success');
    });
  });

  describe('showInfo', () => {
    it('should set info snackbar state and message', () => {
      const { snackbar, snackbarText, snackbarColor, showInfo } = useSnackbar();

      expect(snackbar.value).toBe(false);
      expect(snackbarText.value).toBe('');

      showInfo('Information message');

      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Information message');
      expect(snackbarColor.value).toBe('info');
    });
  });

  describe('showWarning', () => {
    it('should set warning snackbar state and message', () => {
      const { snackbar, snackbarText, snackbarColor, showWarning } = useSnackbar();

      expect(snackbar.value).toBe(false);
      expect(snackbarText.value).toBe('');

      showWarning('Warning message');

      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Warning message');
      expect(snackbarColor.value).toBe('warning');
    });
  });

  describe('snackbar state', () => {
    it('should return reactive refs', () => {
      const { snackbar, snackbarText, snackbarColor, showSuccess } = useSnackbar();

      // Initial state
      expect(snackbar.value).toBe(false);
      expect(snackbarText.value).toBe('');
      expect(snackbarColor.value).toBe('error');

      // After showing success
      showSuccess('Test');
      expect(snackbar.value).toBe(true);
      expect(snackbarText.value).toBe('Test');
      expect(snackbarColor.value).toBe('success');

      // Can be manually reset
      snackbar.value = false;
      expect(snackbar.value).toBe(false);
    });
  });
});

