// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'CloudInbox';

  @override
  String get login => 'Login';

  @override
  String get loginWithGoogle => 'Sign in with Google';

  @override
  String get loginWithApple => 'Sign in with Apple';

  @override
  String get logout => 'Logout';

  @override
  String get error => 'Error';

  @override
  String get loading => 'Loading...';

  @override
  String get accountSettings => 'Account Settings';

  @override
  String get settings => 'Settings';

  @override
  String get inbox => 'Inbox';

  @override
  String get allMail => 'All Mail';

  @override
  String get sent => 'Sent';

  @override
  String get trash => 'Trash';

  @override
  String get account => 'Account';

  @override
  String get label => 'Label';

  @override
  String get email => 'Email';

  @override
  String get pop3Host => 'POP3 Host';

  @override
  String get pop3Port => 'POP3 Port';

  @override
  String get pop3Username => 'POP3 Username';

  @override
  String get pop3Password => 'POP3 Password';

  @override
  String get testConnection => 'Test Connection';

  @override
  String get createAccount => 'Create Account';

  @override
  String get pop3PasswordHint => 'Enter only if you want to change the password';

  @override
  String get updateAccount => 'Update Account';

  @override
  String get deleteAccount => 'Delete Account';

  @override
  String get deleteAccountConfirm => 'Are you sure you want to delete this account?';

  @override
  String get deleteAccountConfirmTitle => 'Delete Account';

  @override
  String get cancel => 'Cancel';

  @override
  String get delete => 'Delete';

  @override
  String get accountDeleted => 'Account deleted successfully';

  @override
  String get deleteAccountTypeTitle => 'Select deletion method';

  @override
  String get softDelete => 'Temporarily delete (can be restored)';

  @override
  String get permanentDelete => 'Permanently delete (cannot be restored)';

  @override
  String get permanentDeleteConfirm => 'Are you sure you want to permanently delete this account?\nThis action cannot be undone.';

  @override
  String get permanentDeleteConfirmTitle => 'Confirm permanent deletion';

  @override
  String get accountRestored => 'Account restored successfully';

  @override
  String get accountPermanentlyDeleted => 'Account permanently deleted';

  @override
  String get plan => 'Plan';

  @override
  String get used => 'Used';

  @override
  String get available => 'Available';

  @override
  String get maxStorage => 'Max storage (bytes)';

  @override
  String get usedStorage => 'Used storage (bytes)';

  @override
  String get usageRate => 'Usage rate (%)';

  @override
  String get mailAccounts => 'Mail Accounts';

  @override
  String get restore => 'Restore';

  @override
  String logoutError(String error) {
    return 'Logout error: $error';
  }

  @override
  String get noMailAccounts => 'No mail accounts';

  @override
  String get addAccountFromSettings => 'Add one from \"Account Settings\" below';

  @override
  String get restoreAccountConfirm => 'Are you sure you want to restore this account?';

  @override
  String connectionTestError(String error) {
    return 'Connection test error: $error';
  }

  @override
  String get accountUpdated => 'Account updated successfully';

  @override
  String get accountCreated => 'Account created successfully';

  @override
  String accountUpdateError(String error) {
    return 'Account update error: $error';
  }

  @override
  String accountCreationError(String error) {
    return 'Account creation error: $error';
  }

  @override
  String accountDeletionError(String error) {
    return 'Account deletion error: $error';
  }

  @override
  String get connectionTestSucceeded => 'Connection test succeeded';

  @override
  String get smtpHost => 'SMTP Host';

  @override
  String get smtpPort => 'SMTP Port';

  @override
  String get smtpUsername => 'SMTP Username';

  @override
  String get smtpPassword => 'SMTP Password';

  @override
  String get smtpPasswordHint => 'Enter only if you want to change the password';

  @override
  String get copyFromPop3 => 'Copy from POP3 Settings';

  @override
  String get testSmtpConnection => 'Test SMTP Connection';

  @override
  String get reply => 'Reply';

  @override
  String get replyAll => 'Reply All';

  @override
  String get forward => 'Forward';

  @override
  String get moveToTrash => 'Move to Trash';

  @override
  String get archive => 'Archive';

  @override
  String get restoreFromTrash => 'Restore from Trash';

  @override
  String get unarchive => 'Unarchive';

  @override
  String get compose => 'Compose';

  @override
  String get send => 'Send';

  @override
  String get from => 'From';

  @override
  String get to => 'To';

  @override
  String get enterEmailAddress => 'Enter email address';

  @override
  String get showCcBcc => 'Show Cc/Bcc';

  @override
  String get hideCcBcc => 'Hide Cc/Bcc';

  @override
  String get subject => 'Subject';

  @override
  String get body => 'Body';

  @override
  String get addAttachment => 'Add Attachment';

  @override
  String get discard => 'Discard';

  @override
  String get discardInputConfirm => 'Do you want to discard the input?';

  @override
  String get forwardedMessagePrefix => '-------- Forwarded Message --------';

  @override
  String get errorPleaseEnterRecipient => 'Please enter recipient';

  @override
  String get errorPleaseEnterSubject => 'Please enter subject';

  @override
  String get errorPleaseSelectSenderAccount => 'Please select sender account';

  @override
  String errorInvalidEmailAddress(String email) {
    return 'Invalid email address: $email';
  }

  @override
  String get errorFailedToSendMail => 'Failed to send mail';

  @override
  String errorGeneric(String error) {
    return 'Error: $error';
  }

  @override
  String errorFailedToReadFile(String filename) {
    return 'Failed to read file: $filename';
  }

  @override
  String errorFileSizeExceedsLimit(int maxSize, String filename) {
    return 'File size exceeds ${maxSize}MB: $filename';
  }

  @override
  String get errorFailedToPickFiles => 'Failed to pick files';

  @override
  String get errorFileAccessPermissionDenied => 'File access permission denied. Please grant permission in settings.';

  @override
  String get errorFileAccessPermissionDeniedGeneric => 'File access permission denied';

  @override
  String get errorFileSelectionCanceled => 'File selection was canceled';

  @override
  String get errorFileSelectionUnknown => 'Failed to pick files (unknown error)';

  @override
  String errorFileSelectionFailed(String message) {
    return 'Failed to pick files: $message';
  }

  @override
  String get noMail => 'No mail';

  @override
  String get smtpSettings => 'SMTP Settings';

  @override
  String get loadMore => 'Load more';

  @override
  String errorFailedToLoadAccounts(String error) {
    return 'Failed to load accounts: $error';
  }

  @override
  String get errorOperationFailed => 'Operation failed. Please try again.';
}
