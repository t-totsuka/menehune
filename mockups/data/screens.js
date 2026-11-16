// Screen registry: the single source of truth for the 15 screens, their allowed login states
// and scenarios, access level and per-stage review status. Classic script that registers into
// window.MockScreens. The file of each screen is always screens/{id}.html.
//
// Invariants (checked by tools/check-registry.mjs):
// - scenarios[0] === 'default'
// - review.hifi.status !== 'draft' implies review.wireframe.status === 'approved'
//
// authStates: 'guest' is the MockState default, so every screen lists it first.
// Member-only screens keep 'guest' so the not-logged-in view can be reviewed.
// Only the admin screen offers 'admin' (admin UI vs. the no-permission view for guest/member).
//
// To record a review, change the status (and optionally reviewedAt / notes) of a stage, e.g.
//   review: review({ status: 'approved', reviewedAt: '2026-11-20', notes: ['...'] }, DRAFT)
(function () {
  /** @type {StageReview} */
  const DRAFT = Object.freeze({ status: 'draft' });

  /**
   * @param {StageReview} wireframe
   * @param {StageReview} hifi
   * @returns {Readonly<Record<StageId, StageReview>>}
   */
  const review = (wireframe, hifi) => Object.freeze({ wireframe, hifi });

  /** @type {readonly AuthState[]} */
  const GUEST_MEMBER = Object.freeze(['guest', 'member']);
  /** @type {readonly AuthState[]} */
  const ALL_AUTH = Object.freeze(['guest', 'member', 'admin']);

  /**
   * @param {ScreenId} id
   * @param {ScreenAccess} access
   * @param {readonly AuthState[]} authStates
   * @param {readonly ScenarioId[]} extraScenarios scenarios after 'default'
   * @returns {ScreenEntry}
   */
  const screen = (id, access, authStates, extraScenarios = []) =>
    Object.freeze({
      id,
      titleKey: `screen.${id}.title`,
      access,
      authStates,
      scenarios: Object.freeze(/** @type {ScenarioId[]} */ (['default', ...extraScenarios])),
      review: review(DRAFT, DRAFT),
    });

  /** @type {ScreenRegistry} */
  const screens = Object.freeze([
    screen('top', 'public', GUEST_MEMBER),
    screen('calendar-month', 'public', GUEST_MEMBER, ['provisional-holiday']),
    screen('day-detail', 'public', GUEST_MEMBER),
    screen('astro-events', 'public', GUEST_MEMBER, ['empty', 'fetch-error']),
    screen('star-chart', 'public', GUEST_MEMBER),
    screen('post-detail', 'public', GUEST_MEMBER, [
      'private-blocked', 'hidden-own', 'hidden-other',
      'deleted-comment', 'no-location', 'weather-failed',
    ]),
    screen('post-edit', 'member', GUEST_MEMBER, ['validation-error']),
    screen('my-posts', 'member', GUEST_MEMBER, ['empty', 'fetch-error']),
    screen('settings', 'member', GUEST_MEMBER),
    screen('login', 'public', GUEST_MEMBER),
    screen('report', 'member', GUEST_MEMBER),
    screen('appeal', 'member', GUEST_MEMBER),
    screen('admin', 'admin', ALL_AUTH, ['empty']),
    screen('attribution', 'public', GUEST_MEMBER),
    screen('privacy', 'public', GUEST_MEMBER),
  ]);

  window.MockScreens = screens;
})();
