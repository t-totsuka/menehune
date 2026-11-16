// English message dictionary (key -> copy). Classic script: registers into
// window.MockMessages so that assets/js/i18n.js can read it later.
// Keys are language independent (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/) and must match messages.ja.js exactly.
// Placeholders use the `{name}` form.
(function () {
  /** @type {MessageDictionary} */
  const en = Object.freeze({
    // Common navigation
    'nav.top': 'Home',
    'nav.calendar': 'Calendar',
    'nav.astro-events': 'Astronomical Events',
    'nav.star-chart': 'Star Chart',
    'nav.my-posts': 'My Posts',
    'nav.settings': 'Settings',
    'nav.admin': 'Admin',
    'nav.login': 'Log in',
    'nav.logout': 'Log out',
    'nav.main': 'Main menu',
    'nav.skip-to-content': 'Skip to main content',

    // Language and theme toggles
    'toggle.lang.label': 'Language',
    'toggle.lang.ja': '日本語',
    'toggle.lang.en': 'English',
    'toggle.theme.label': 'Theme',
    'toggle.theme.system': 'Match system',
    'toggle.theme.light': 'Light',
    'toggle.theme.dark': 'Dark',

    // Common buttons
    'button.save': 'Save',
    'button.cancel': 'Cancel',
    'button.submit': 'Submit',
    'button.back': 'Back',
    'button.delete': 'Delete',
    'button.edit': 'Edit',
    'button.post': 'Post',
    'button.reply': 'Reply',
    'button.report': 'Report',
    'button.like': 'Like',
    'button.unlike': 'Unlike',
    'button.close': 'Close',
    'button.retry': 'Try again',
    'button.more': 'Show more',
    'button.prev': 'Previous',
    'button.next': 'Next',
    'button.today': 'Today',

    // Screen titles (one per ScreenId)
    'screen.top.title': 'Home',
    'screen.calendar-month.title': 'Monthly Calendar',
    'screen.day-detail.title': 'Day Details',
    'screen.astro-events.title': 'Astronomical Events',
    'screen.star-chart.title': 'Star Chart',
    'screen.post-detail.title': 'Post Details',
    'screen.post-edit.title': 'Write or Edit a Post',
    'screen.my-posts.title': 'My Posts',
    'screen.settings.title': 'Settings',
    'screen.login.title': 'Log In',
    'screen.report.title': 'Report Content',
    'screen.appeal.title': 'Submit an Appeal',
    'screen.admin.title': 'Administration',
    'screen.attribution.title': 'Credits and Attributions',
    'screen.privacy.title': 'Privacy Policy',

    // Common errors
    'error.fetch': "We couldn't load the data. Please try again later.",
    'error.validation': 'Some fields need your attention. Please check them and try again.',
    'error.required': '{field} is required.',
    'error.no-permission': "You don't have permission to view this page.",
    'error.login-required': 'Please log in to do this.',
    'error.not-found': "We couldn't find the page you're looking for.",
    'error.missing-sample': 'Sample data "{id}" was not found.',

    // Common empty states
    'empty.list': 'Nothing to show yet.',
    'empty.posts': 'No posts yet.',
    'empty.comments': 'No comments yet.',
    'empty.events': 'No astronomical events in this period.',

    // Common status
    'status.loading': 'Loading…',
    'status.saved': 'Saved.',
    'common.count': '{count} items',
  });

  window.MockMessages = window.MockMessages || {};
  window.MockMessages.en = en;
})();
