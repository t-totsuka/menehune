// Glossary metadata (key, category, translation policy, note). Classic script that registers
// into window.MockGlossary. The glossary holds no copy: entries only annotate dictionary keys
// in assets/i18n/messages.{locale}.js. Intentionally empty here; entries are added in task 3.1.
(function () {
  /** @type {GlossaryMeta} */
  const glossary = Object.freeze([]);

  window.MockGlossary = glossary;
})();
