// Contracts for every data file, runtime service, component and check tool in the mockups.
// This is a global (script) declaration file: it has no top-level import/export so that
// classic <script> files can reference these types from JSDoc without imports.
// Source of truth: .kiro/specs/ui-mockups/design.md "Components and Interfaces".
// `any` is forbidden in this file and in every type-checked JS file.

/* ------------------------------------------------------------------ */
/* Data: ScreenRegistry (data/screens.js -> window.MockScreens)        */
/* ------------------------------------------------------------------ */

type StageId = 'wireframe' | 'hifi';
type ReviewStatus = 'draft' | 'in-review' | 'changes-requested' | 'approved';
type ScreenId =
  | 'top' | 'calendar-month' | 'day-detail' | 'astro-events' | 'star-chart'
  | 'post-detail' | 'post-edit' | 'my-posts' | 'settings' | 'login'
  | 'report' | 'appeal' | 'admin' | 'attribution' | 'privacy';
type AuthState = 'guest' | 'member' | 'admin';
type ScenarioId =
  | 'default' | 'empty' | 'fetch-error' | 'validation-error'
  | 'private-blocked' | 'hidden-own' | 'hidden-other'
  | 'deleted-comment' | 'no-location' | 'weather-failed' | 'provisional-holiday';
type ScreenAccess = 'public' | 'member' | 'admin';

interface StageReview {
  readonly status: ReviewStatus;
  /** ISO 8601 date */
  readonly reviewedAt?: string;
  /** Summary of review findings */
  readonly notes?: readonly string[];
}

/**
 * Invariant (checked by tools/check-registry.mjs):
 * review.hifi.status !== 'draft' implies review.wireframe.status === 'approved',
 * and scenarios[0] === 'default'. The file is always screens/{id}.html.
 */
interface ScreenEntry {
  readonly id: ScreenId;
  readonly titleKey: MessageKey;
  readonly access: ScreenAccess;
  /** Login states that can be switched on this screen */
  readonly authStates: readonly AuthState[];
  /** The first element must be 'default' */
  readonly scenarios: readonly ScenarioId[];
  readonly review: Readonly<Record<StageId, StageReview>>;
}

type ScreenRegistry = readonly ScreenEntry[];

/* ------------------------------------------------------------------ */
/* Data: MessageDictionaries and GlossaryMeta                           */
/* ------------------------------------------------------------------ */

type LocaleId = 'ja' | 'en';
/** Format /^[a-z0-9-]+(\.[a-z0-9-]+)+$/ (checked by tools/check-i18n.mjs) */
type MessageKey = string;
/** Placeholders use the `{name}` form */
type MessageDictionary = Readonly<Record<MessageKey, string>>;
/** The ja and en key sets must be identical */
type MessageDictionaries = Readonly<Record<LocaleId, MessageDictionary>>;

type GlossaryCategory =
  | 'ui' | 'rokuyo' | 'sekki' | 'kou' | 'zassetsu' | 'lunar-month'
  | 'moon-phase' | 'astro-event' | 'holiday' | 'location' | 'weather' | 'moderation';
type TranslationPolicy =
  /** Meaning-based translation (e.g. 二十四節気 -> 24 Solar Terms) */
  | 'translation'
  /** Transliteration (e.g. 大安 -> Taian) */
  | 'transliteration'
  /** Transliteration plus translation (e.g. Taian (Great Peace)) */
  | 'both'
  /** Standard English, e.g. astronomy terms (e.g. Opposition) */
  | 'standard';

/** The glossary holds no copy; it only annotates dictionary keys. */
interface GlossaryEntry {
  readonly key: MessageKey;
  readonly category: GlossaryCategory;
  readonly policy: TranslationPolicy;
  readonly note?: Readonly<Record<LocaleId, string>>;
}

type GlossaryMeta = readonly GlossaryEntry[];

/* ------------------------------------------------------------------ */
/* Data: SampleData (data/sample-data.js -> window.MockSample)          */
/* ------------------------------------------------------------------ */

/** YYYY-MM-DD */
type IsoDate = string;
/** ISO 8601 with offset */
type IsoDateTime = string;

interface Holiday { readonly key: MessageKey; readonly provisional: boolean; }
interface AlmanacDay {
  readonly date: IsoDate;
  readonly rokuyoKey: MessageKey;
  readonly lunar: { readonly month: number; readonly day: number; readonly leap: boolean };
  /** One decimal place */
  readonly moonAge: number;
  /** Only on new moon, first quarter, full moon and last quarter */
  readonly moonPhaseKey?: MessageKey;
  readonly sekkiKey?: MessageKey;
  /** Only on the first day of a kou */
  readonly kouKey?: MessageKey;
  readonly zassetsuKeys: readonly MessageKey[];
  readonly holiday?: Holiday;
  readonly eventIds: readonly string[];
  /** Rise/set times of that day at the fictional sample point near Tokyo (mk-rise-set with `date`) */
  readonly riseSet: RiseSet;
}
type AstroEventKind =
  | 'moon-phase' | 'moon-apsis' | 'moon-declination' | 'planet-conjunction'
  | 'planet-opposition' | 'planet-elongation' | 'close-approach';
interface AstroEvent {
  readonly id: string;
  readonly kind: AstroEventKind;
  readonly at: IsoDateTime;
  readonly titleKey: MessageKey;
  readonly bodies: readonly string[];
}
interface RiseSet {
  readonly sunrise?: IsoDateTime;
  readonly sunset?: IsoDateTime;
  readonly moonrise?: IsoDateTime;
  readonly moonset?: IsoDateTime;
}

type PostStatus = 'public' | 'members-only' | 'hidden' | 'deleted';
interface SampleUser { readonly id: string; readonly displayName: string; readonly isAdmin: boolean; }
interface CommentNode {
  readonly id: string;
  readonly authorId: string;
  readonly body: string;
  readonly at: IsoDateTime;
  readonly deleted: boolean;
  readonly children: readonly CommentNode[];
}
interface LikeState { readonly count: number; readonly likedByMe: boolean; }

type LocationPrecision = 'exact' | 'fuzzed-1km' | 'municipality' | 'prefecture' | 'country';
interface MapFrame {
  readonly zoom: 'street' | 'district' | 'city' | 'prefecture' | 'country';
  readonly showPin: boolean;
  readonly showRadiusKm?: number;
}
interface PostLocation {
  readonly precision: LocationPrecision;
  readonly regionLabel: string;
  readonly mapFrame: MapFrame;
  readonly riseSet: RiseSet;
}
interface WeatherSnapshot {
  readonly conditionKey: MessageKey;
  readonly temperatureC: number;
  readonly humidityPct: number;
  readonly windMps: number;
  readonly observedAt: IsoDateTime;
}

interface SamplePost {
  readonly id: string;
  readonly authorId: string;
  readonly targetDate: IsoDate;
  readonly postedAt: IsoDateTime;
  readonly body: string;
  readonly status: PostStatus;
  readonly guestVisible: boolean;
  /** undefined: the post has no location (no map, rise/set or weather; the no-location case) */
  readonly location?: PostLocation;
  /**
   * Only present together with `location`. `location` present and `weather` undefined means the
   * weather could not be fetched (the weather-failed case).
   */
  readonly weather?: WeatherSnapshot;
  readonly likes: LikeState;
  readonly comments: readonly CommentNode[];
}
type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'personal-info' | 'other';
type ReportQueueState = 'open' | 'auto-hidden' | 'hidden-by-admin' | 'appealed' | 'restored' | 'removed';
interface ReportQueueItem {
  readonly targetId: string;
  readonly targetType: 'post' | 'comment';
  readonly reportCount: number;
  readonly reasons: readonly ReportReason[];
  readonly state: ReportQueueState;
}

interface StarChartStar { readonly az: number; readonly alt: number; readonly mag: number; readonly nameKey?: MessageKey; }
interface StarChartLabel { readonly az: number; readonly alt: number; readonly nameKey: MessageKey; }
interface StarChartBody { readonly kind: 'sun' | 'moon' | 'planet'; readonly nameKey: MessageKey; readonly az: number; readonly alt: number; }
interface StarChartSample {
  readonly observedAt: IsoDateTime;
  readonly placeLabel: string;
  readonly stars: readonly StarChartStar[];
  /** Pairs of indexes into `stars` */
  readonly constellationLines: readonly (readonly [number, number])[];
  readonly constellationLabels: readonly StarChartLabel[];
  readonly bodies: readonly StarChartBody[];
}

/** Scenarios of the post-detail screen that are tied to one sample post. */
type PostDetailScenarioId = Extract<ScenarioId,
  | 'default' | 'private-blocked' | 'hidden-own' | 'hidden-other'
  | 'deleted-comment' | 'no-location' | 'weather-failed'>;

interface SampleDataSet {
  /** Fixed to 2026-11-16 */
  readonly today: IsoDate;
  readonly users: readonly SampleUser[];
  /**
   * User id of "me" for each logged-in AuthState (the member viewer owns hidden-own posts and
   * is the subject of LikeState.likedByMe; the admin viewer is the single admin user).
   */
  readonly viewerIds: Readonly<Record<Exclude<AuthState, 'guest'>, string>>;
  /** Post id shown by post-detail for each scenario */
  readonly postDetailScenarios: Readonly<Record<PostDetailScenarioId, string>>;
  /** Every day of 2026-11 and 2027-03 (provisional holidays), plus one leap-month example day */
  readonly almanac: readonly AlmanacDay[];
  readonly events: readonly AstroEvent[];
  readonly posts: readonly SamplePost[];
  readonly reports: readonly ReportQueueItem[];
  readonly starChart: StarChartSample;
}

/* ------------------------------------------------------------------ */
/* Core: MockState                                                      */
/* ------------------------------------------------------------------ */

type ThemePreference = 'system' | 'light' | 'dark';
interface MockStateSnapshot {
  readonly stage: StageId;
  readonly lang: LocaleId;
  readonly theme: ThemePreference;
  readonly auth: AuthState;
  readonly scenario: ScenarioId;
  /** undefined on catalog pages */
  readonly screenId?: ScreenId;
}
type MockStatePatch = Partial<Omit<MockStateSnapshot, 'screenId'>>;
type MockStateWarning = { readonly kind: 'unknown-param'; readonly param: string; readonly value: string };

/**
 * Resolution order: URL params, stored values (stage, lang, theme only), defaults
 * (hifi, ja, system, guest, default). Every change dispatches
 * CustomEvent<MockStateSnapshot>('mock:change') on document.
 */
interface MockStateService {
  get(): MockStateSnapshot;
  update(patch: MockStatePatch): MockStateSnapshot;
  warnings(): readonly MockStateWarning[];
}

/* ------------------------------------------------------------------ */
/* Core: I18nRuntime                                                    */
/* ------------------------------------------------------------------ */

type DateStyle = 'date-long' | 'date-short' | 'weekday' | 'time' | 'datetime' | 'month-year';
type MessageArgs = Readonly<Record<string, string | number>>;

/**
 * Markup: data-i18n="key", data-i18n-args='{"n":3}',
 * data-i18n-attr="aria-label:key1;title:key2",
 * data-i18n-date="2026-11-16" data-date-style="date-long".
 * Missing keys render as ⟦key⟧ with a console warning. Dates use Asia/Tokyo, 24-hour.
 */
interface I18nRuntime {
  register(locale: LocaleId, dict: MessageDictionary): void;
  t(key: MessageKey, args?: MessageArgs): string;
  formatDate(value: IsoDate | IsoDateTime, style: DateStyle): string;
  /** Processes [data-i18n], [data-i18n-attr] and [data-i18n-date] */
  apply(root: ParentNode): void;
}

/* ------------------------------------------------------------------ */
/* Review: ReviewShell                                                  */
/* ------------------------------------------------------------------ */

interface ReviewShellService {
  /** Called once on DOMContentLoaded */
  mount(): void;
  /** Hides elements whose [data-when-auth] / [data-when-scenario] do not match */
  applyConditions(snapshot: MockStateSnapshot): void;
}

/* ------------------------------------------------------------------ */
/* Parts: MockElement base and presentational attributes                */
/* ------------------------------------------------------------------ */

/**
 * Shape of the MockElement base class implemented in assets/js/components/base.js.
 * Declared as an interface (not a class) so that base.js can define the real
 * `class MockElement extends HTMLElement` in the same global scope without a
 * duplicate-identifier conflict. Every member is public (JSDoc @protected would make the class
 * unassignable to MockElementConstructor); render/sample/t/el/missingSample are meant to be called
 * only by the element itself and its subclasses.
 */
interface MockElementContract extends HTMLElement {
  /**
   * Abstract: every subclass overrides it and renders into Light DOM via this.replaceChildren(...).
   * The base implementation throws.
   */
  render(state: MockStateSnapshot): void;
  /** Returns window.MockSample */
  sample(): SampleDataSet;
  /** window.MockI18n.t in the current language */
  t(key: MessageKey, args?: MessageArgs): string;
  /**
   * Builds an element: attributes from `attrs` (null for none), children appended in order
   * (strings become text nodes).
   */
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Readonly<Record<string, string>> | null,
    ...children: readonly (Node | string)[]
  ): HTMLElementTagNameMap[K];
  /** Visible error for a sample id that does not exist (error.missing-sample, [data-missing-sample="{id}"]) */
  missingSample(id: string): HTMLElement;
  /**
   * Re-renders with `state`, keeping keyboard focus on the element with the same
   * [data-mk-focus] value inside this element when it was focused before.
   */
  refresh(state: MockStateSnapshot): void;
  /** First render and subscription to mock:change */
  connectedCallback(): void;
  /** Unsubscribes from mock:change */
  disconnectedCallback(): void;
}

/** Abstract constructor type of the MockElement base class. */
type MockElementConstructor = abstract new () => MockElementContract;

/** Diagram parts (star chart, map) expose alt text for role="img" + aria-label. */
interface DescribableElement {
  describe(state: MockStateSnapshot): string;
}

/** HTML boolean attribute: the attribute being present (any value, usually '') means true. */
type BooleanAttr = string;

interface SiteHeaderAttrs { readonly current?: 'calendar' | 'astro-events' | 'star-chart' | 'my-posts' | 'settings' | 'admin'; }
type SiteFooterAttrs = Readonly<Record<string, never>>;
/** `band` (boolean, task 8.1) renders the full-width band placed right after mk-site-header on every screen but login */
interface GuestNoticeAttrs { readonly variant?: 'read-only' | 'private-post'; readonly band?: ''; }
interface StatusBadgeAttrs { readonly status: PostStatus; }
type AdminBandAttrs = Readonly<Record<string, never>>;

/**
 * `month` is YYYY-MM. `week-start="mon"` (task 8.1) starts the week on Monday (default Sunday).
 * `nav` (boolean, task 8.1) adds previous / this / next month buttons that change `month` and
 * fire a bubbling CustomEvent<{ month: string }>('mk-month-change').
 */
interface MonthCalendarAttrs { readonly month: string; readonly 'week-start'?: 'sun' | 'mon'; readonly nav?: ''; }
interface DayCellAttrs { readonly date: IsoDate; readonly compact?: BooleanAttr; }
interface AlmanacSummaryAttrs { readonly date: IsoDate; readonly variant?: 'full' | 'brief'; }
/** `chart` (boolean, task 8.1) adds the 0-24h chart of when the sun and the moon are up */
interface RiseSetAttrs { readonly date?: IsoDate; readonly 'post-id'?: string; readonly chart?: ''; }
/** `kinds` is a space-separated list of AstroEventKind; `filters="collapsed"` (task 8.1) folds the filters into a closed accordion */
interface EventListAttrs { readonly from?: IsoDate; readonly to?: IsoDate; readonly kinds?: string; readonly filters?: 'collapsed'; readonly 'mark-past'?: ''; }

/** `sample` selects a star chart sample; omitted means SampleDataSet.starChart */
interface StarChartAttrs { readonly sample?: string; }

/**
 * `meta="icons"` (task 8.1, my-posts) shows the visibility setting as an icon and the public /
 * members-only status badge as its symbol only (hidden / deleted keep their text)
 */
interface PostCardAttrs { readonly 'post-id': string; readonly variant?: 'list' | 'compact'; readonly meta?: 'icons'; }
interface CommentTreeAttrs { readonly 'post-id': string; }
interface LikeButtonAttrs { readonly 'post-id': string; }
interface ReportLinkAttrs { readonly 'target-id': string; }

/** `collapsed` (boolean, task 8.1) folds the radio group into a closed accordion whose summary shows the current choice */
interface PrecisionPickerAttrs { readonly value?: LocationPrecision; readonly collapsed?: ''; }
interface LocationPanelAttrs { readonly 'post-id': string; }
/** `region` overrides the region name (Japanese free text); omitted means the first sample post with that precision */
interface MapSampleAttrs { readonly precision: LocationPrecision; readonly region?: string; }
interface WeatherAttrs { readonly 'post-id': string; }

/** Element name -> attribute contract. */
interface MockElementAttrsMap {
  'mk-site-header': SiteHeaderAttrs;
  'mk-site-footer': SiteFooterAttrs;
  'mk-guest-notice': GuestNoticeAttrs;
  'mk-status-badge': StatusBadgeAttrs;
  'mk-admin-band': AdminBandAttrs;
  'mk-month-calendar': MonthCalendarAttrs;
  'mk-day-cell': DayCellAttrs;
  'mk-almanac-summary': AlmanacSummaryAttrs;
  'mk-rise-set': RiseSetAttrs;
  'mk-event-list': EventListAttrs;
  'mk-star-chart': StarChartAttrs;
  'mk-post-card': PostCardAttrs;
  'mk-comment-tree': CommentTreeAttrs;
  'mk-like-button': LikeButtonAttrs;
  'mk-report-link': ReportLinkAttrs;
  'mk-precision-picker': PrecisionPickerAttrs;
  'mk-location-panel': LocationPanelAttrs;
  'mk-map-sample': MapSampleAttrs;
  'mk-weather': WeatherAttrs;
}
type MockElementName = keyof MockElementAttrsMap;

/* ------------------------------------------------------------------ */
/* Tools: CheckScripts configuration                                    */
/* ------------------------------------------------------------------ */

type ThemeBlock = 'light' | 'dark';
/** One element of tools/contrast-pairs.json */
interface ContrastPair {
  /** e.g. '--color-text' */
  readonly fg: string;
  /** e.g. '--color-bg' */
  readonly bg: string;
  readonly min: 4.5 | 3;
  readonly themes: readonly ThemeBlock[];
}
/** A rule inside tools/check-tokens.mjs */
interface TokenCheckRule {
  readonly id: 'color-literal' | 'length-literal' | 'media-breakpoint';
  readonly pattern: RegExp;
  /** e.g. 'assets/css/base.css' */
  readonly appliesTo: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Globals registered by the classic scripts                            */
/* ------------------------------------------------------------------ */

interface Window {
  /** data/screens.js */
  MockScreens: ScreenRegistry;
  /** data/glossary.js */
  MockGlossary: GlossaryMeta;
  /** data/sample-data.js */
  MockSample: SampleDataSet;
  /** assets/i18n/messages.{locale}.js register here before i18n.js loads */
  MockMessages: Partial<Record<LocaleId, MessageDictionary>>;
  /** assets/js/mock-state.js */
  MockState: MockStateService;
  /** assets/js/i18n.js */
  MockI18n: I18nRuntime;
  /** assets/js/review-shell.js */
  MockReviewShell: ReviewShellService;
  /** assets/js/components/base.js */
  MockElement: MockElementConstructor;
}

interface DocumentEventMap {
  'mock:change': CustomEvent<MockStateSnapshot>;
}
