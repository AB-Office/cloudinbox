import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ja.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ja')
  ];

  /// Application title
  ///
  /// In en, this message translates to:
  /// **'CloudInbox'**
  String get appTitle;

  /// Login button label
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// Google login button label
  ///
  /// In en, this message translates to:
  /// **'Sign in with Google'**
  String get loginWithGoogle;

  /// Apple login button label
  ///
  /// In en, this message translates to:
  /// **'Sign in with Apple'**
  String get loginWithApple;

  /// Logout button label
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// Error message title
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// Loading message
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// Account settings menu label
  ///
  /// In en, this message translates to:
  /// **'Account Settings'**
  String get accountSettings;

  /// Settings screen title
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// Inbox menu label
  ///
  /// In en, this message translates to:
  /// **'Inbox'**
  String get inbox;

  /// All mail menu label
  ///
  /// In en, this message translates to:
  /// **'All Mail'**
  String get allMail;

  /// Sent mail menu label
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get sent;

  /// Trash menu label
  ///
  /// In en, this message translates to:
  /// **'Trash'**
  String get trash;

  /// Account settings screen title
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// Account label input field
  ///
  /// In en, this message translates to:
  /// **'Label'**
  String get label;

  /// Email input field
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// POP3 host input field
  ///
  /// In en, this message translates to:
  /// **'POP3 Host'**
  String get pop3Host;

  /// POP3 port input field
  ///
  /// In en, this message translates to:
  /// **'POP3 Port'**
  String get pop3Port;

  /// POP3 username input field
  ///
  /// In en, this message translates to:
  /// **'POP3 Username'**
  String get pop3Username;

  /// POP3 password input field
  ///
  /// In en, this message translates to:
  /// **'POP3 Password'**
  String get pop3Password;

  /// Test connection button label
  ///
  /// In en, this message translates to:
  /// **'Test Connection'**
  String get testConnection;

  /// Create account button label
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// Password field hint (in edit mode)
  ///
  /// In en, this message translates to:
  /// **'Enter only if you want to change the password'**
  String get pop3PasswordHint;

  /// Update account button label
  ///
  /// In en, this message translates to:
  /// **'Update Account'**
  String get updateAccount;

  /// Delete account button label
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get deleteAccount;

  /// Delete account confirmation dialog message
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete this account?'**
  String get deleteAccountConfirm;

  /// Delete account confirmation dialog title
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get deleteAccountConfirmTitle;

  /// Cancel button label
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// Delete button label
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// Account deletion success message
  ///
  /// In en, this message translates to:
  /// **'Account deleted successfully'**
  String get accountDeleted;

  /// Deletion method selection dialog title
  ///
  /// In en, this message translates to:
  /// **'Select deletion method'**
  String get deleteAccountTypeTitle;

  /// Soft delete description
  ///
  /// In en, this message translates to:
  /// **'Temporarily delete (can be restored)'**
  String get softDelete;

  /// Permanent delete description
  ///
  /// In en, this message translates to:
  /// **'Permanently delete (cannot be restored)'**
  String get permanentDelete;

  /// Permanent delete confirmation message
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to permanently delete this account?\nThis action cannot be undone.'**
  String get permanentDeleteConfirm;

  /// Permanent delete confirmation dialog title
  ///
  /// In en, this message translates to:
  /// **'Confirm permanent deletion'**
  String get permanentDeleteConfirmTitle;

  /// Account restoration success message
  ///
  /// In en, this message translates to:
  /// **'Account restored successfully'**
  String get accountRestored;

  /// Account permanent deletion success message
  ///
  /// In en, this message translates to:
  /// **'Account permanently deleted'**
  String get accountPermanentlyDeleted;

  /// Plan label
  ///
  /// In en, this message translates to:
  /// **'Plan'**
  String get plan;

  /// Used label
  ///
  /// In en, this message translates to:
  /// **'Used'**
  String get used;

  /// Available label
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get available;

  /// Max storage label
  ///
  /// In en, this message translates to:
  /// **'Max storage (bytes)'**
  String get maxStorage;

  /// Used storage label
  ///
  /// In en, this message translates to:
  /// **'Used storage (bytes)'**
  String get usedStorage;

  /// Usage rate label
  ///
  /// In en, this message translates to:
  /// **'Usage rate (%)'**
  String get usageRate;

  /// Mail accounts label
  ///
  /// In en, this message translates to:
  /// **'Mail Accounts'**
  String get mailAccounts;

  /// Restore label
  ///
  /// In en, this message translates to:
  /// **'Restore'**
  String get restore;

  /// Logout error message
  ///
  /// In en, this message translates to:
  /// **'Logout error: {error}'**
  String logoutError(String error);

  /// No mail accounts message
  ///
  /// In en, this message translates to:
  /// **'No mail accounts'**
  String get noMailAccounts;

  /// Add account from settings message
  ///
  /// In en, this message translates to:
  /// **'Add one from \"Account Settings\" below'**
  String get addAccountFromSettings;

  /// Restore account confirmation message
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to restore this account?'**
  String get restoreAccountConfirm;

  /// Connection test error message
  ///
  /// In en, this message translates to:
  /// **'Connection test error: {error}'**
  String connectionTestError(String error);

  /// Account update success message
  ///
  /// In en, this message translates to:
  /// **'Account updated successfully'**
  String get accountUpdated;

  /// Account creation success message
  ///
  /// In en, this message translates to:
  /// **'Account created successfully'**
  String get accountCreated;

  /// Account update error message
  ///
  /// In en, this message translates to:
  /// **'Account update error: {error}'**
  String accountUpdateError(String error);

  /// Account creation error message
  ///
  /// In en, this message translates to:
  /// **'Account creation error: {error}'**
  String accountCreationError(String error);

  /// Account deletion error message
  ///
  /// In en, this message translates to:
  /// **'Account deletion error: {error}'**
  String accountDeletionError(String error);

  /// Connection test success message
  ///
  /// In en, this message translates to:
  /// **'Connection test succeeded'**
  String get connectionTestSucceeded;

  /// SMTP host input field
  ///
  /// In en, this message translates to:
  /// **'SMTP Host'**
  String get smtpHost;

  /// SMTP port input field
  ///
  /// In en, this message translates to:
  /// **'SMTP Port'**
  String get smtpPort;

  /// SMTP username input field
  ///
  /// In en, this message translates to:
  /// **'SMTP Username'**
  String get smtpUsername;

  /// SMTP password input field
  ///
  /// In en, this message translates to:
  /// **'SMTP Password'**
  String get smtpPassword;

  /// SMTP password field hint (in edit mode)
  ///
  /// In en, this message translates to:
  /// **'Enter only if you want to change the password'**
  String get smtpPasswordHint;

  /// Button label to copy SMTP settings from POP3 settings
  ///
  /// In en, this message translates to:
  /// **'Copy from POP3 Settings'**
  String get copyFromPop3;

  /// SMTP connection test button label
  ///
  /// In en, this message translates to:
  /// **'Test SMTP Connection'**
  String get testSmtpConnection;

  /// Tooltip for the reply button
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get reply;

  /// Tooltip for the reply all button
  ///
  /// In en, this message translates to:
  /// **'Reply All'**
  String get replyAll;

  /// Tooltip for the forward button
  ///
  /// In en, this message translates to:
  /// **'Forward'**
  String get forward;

  /// Tooltip for the move to trash button
  ///
  /// In en, this message translates to:
  /// **'Move to Trash'**
  String get moveToTrash;

  /// Tooltip for the archive button
  ///
  /// In en, this message translates to:
  /// **'Archive'**
  String get archive;

  /// Tooltip for the restore from trash button
  ///
  /// In en, this message translates to:
  /// **'Restore from Trash'**
  String get restoreFromTrash;

  /// Tooltip for the unarchive button
  ///
  /// In en, this message translates to:
  /// **'Unarchive'**
  String get unarchive;

  /// Compose screen title
  ///
  /// In en, this message translates to:
  /// **'Compose'**
  String get compose;

  /// Send button label
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// From field label
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get from;

  /// To field label
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get to;

  /// Email address input field hint
  ///
  /// In en, this message translates to:
  /// **'Enter email address'**
  String get enterEmailAddress;

  /// Show Cc/Bcc button label
  ///
  /// In en, this message translates to:
  /// **'Show Cc/Bcc'**
  String get showCcBcc;

  /// Hide Cc/Bcc button label
  ///
  /// In en, this message translates to:
  /// **'Hide Cc/Bcc'**
  String get hideCcBcc;

  /// Subject field label
  ///
  /// In en, this message translates to:
  /// **'Subject'**
  String get subject;

  /// Body field label
  ///
  /// In en, this message translates to:
  /// **'Body'**
  String get body;

  /// Add attachment button label
  ///
  /// In en, this message translates to:
  /// **'Add Attachment'**
  String get addAttachment;

  /// Discard button label
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discard;

  /// Discard input confirmation dialog message
  ///
  /// In en, this message translates to:
  /// **'Do you want to discard the input?'**
  String get discardInputConfirm;

  /// Forwarded message prefix
  ///
  /// In en, this message translates to:
  /// **'-------- Forwarded Message --------'**
  String get forwardedMessagePrefix;

  /// Recipient not entered error message
  ///
  /// In en, this message translates to:
  /// **'Please enter recipient'**
  String get errorPleaseEnterRecipient;

  /// Subject not entered error message
  ///
  /// In en, this message translates to:
  /// **'Please enter subject'**
  String get errorPleaseEnterSubject;

  /// Sender account not selected error message
  ///
  /// In en, this message translates to:
  /// **'Please select sender account'**
  String get errorPleaseSelectSenderAccount;

  /// Invalid email address error message
  ///
  /// In en, this message translates to:
  /// **'Invalid email address: {email}'**
  String errorInvalidEmailAddress(String email);

  /// Failed to send mail error message
  ///
  /// In en, this message translates to:
  /// **'Failed to send mail'**
  String get errorFailedToSendMail;

  /// Generic error message
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String errorGeneric(String error);

  /// File read error message
  ///
  /// In en, this message translates to:
  /// **'Failed to read file: {filename}'**
  String errorFailedToReadFile(String filename);

  /// File size exceeds limit error message
  ///
  /// In en, this message translates to:
  /// **'File size exceeds {maxSize}MB: {filename}'**
  String errorFileSizeExceedsLimit(int maxSize, String filename);

  /// File picker error message
  ///
  /// In en, this message translates to:
  /// **'Failed to pick files'**
  String get errorFailedToPickFiles;

  /// File access permission denied error message
  ///
  /// In en, this message translates to:
  /// **'File access permission denied. Please grant permission in settings.'**
  String get errorFileAccessPermissionDenied;

  /// File access permission denied error message (generic)
  ///
  /// In en, this message translates to:
  /// **'File access permission denied'**
  String get errorFileAccessPermissionDeniedGeneric;

  /// File selection canceled message
  ///
  /// In en, this message translates to:
  /// **'File selection was canceled'**
  String get errorFileSelectionCanceled;

  /// File selection unknown error message
  ///
  /// In en, this message translates to:
  /// **'Failed to pick files (unknown error)'**
  String get errorFileSelectionUnknown;

  /// File selection failed error message (with details)
  ///
  /// In en, this message translates to:
  /// **'Failed to pick files: {message}'**
  String errorFileSelectionFailed(String message);

  /// No mail message
  ///
  /// In en, this message translates to:
  /// **'No mail'**
  String get noMail;

  /// SMTP settings section title
  ///
  /// In en, this message translates to:
  /// **'SMTP Settings'**
  String get smtpSettings;

  /// Load more button label
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// Failed to load accounts error message
  ///
  /// In en, this message translates to:
  /// **'Failed to load accounts: {error}'**
  String errorFailedToLoadAccounts(String error);
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en', 'ja'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en': return AppLocalizationsEn();
    case 'ja': return AppLocalizationsJa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
