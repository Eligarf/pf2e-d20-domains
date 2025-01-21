const CONSOLE_COLORS = ['background: #222; color: #ffff80', 'color: #fff'];
const MODULE_ID = 'pf2e-confirm-my-bias';

function colorizeOutput(format, ...args) {
  return [
    `%c${MODULE_ID} %c|`,
    ...CONSOLE_COLORS,
    format,
    ...args,
  ];
}

function log(format, ...args) {
  const level = game.settings.get(MODULE_ID, 'logLevel');
  if (level !== 'none') {

    if (level === 'debug')
      console.debug(...colorizeOutput(format, ...args));
    else if (level === 'log')
      console.log(...colorizeOutput(format, ...args));
  }
}

export { MODULE_ID, log };

Hooks.once('init', () => {
  Hooks.on('createChatMessage', async (message, options, id) => {
    if (game.userId != id) return;
    if (!game.settings.get(MODULE_ID, 'autorollSpellDamage')) return;
    const pf2eFlags = message?.flags?.pf2e;

    // Accept only spell casting of non-attack damaging spells
    if (!pf2eFlags?.casting) return;
    const originUuid = pf2eFlags?.origin?.uuid;
    const origin = originUuid ? await fromUuid(originUuid) : null;
    if (origin?.traits?.has("attack")) return;
    if (!message.content.includes('<button type="button" data-action="spell-damage" data-visibility="owner">')) return;

    // Roll the damage!
    origin?.rollDamage({ target: message.token });
  });

  game.keybindings.register(MODULE_ID, "observable", {
    name: `${MODULE_ID}.observable.name`,
    hint: `${MODULE_ID}.observable.hint`,
    editable: [
      { key: "KeyB" }
    ],
    onDown: async () => {
      const conditionHandler = game.settings.get(MODULE_ID, 'conditionHandler');
      const perceptionApi = (conditionHandler === 'perception') ? getPerceptionApi() : null;
      const selectedTokens = canvas.tokens.controlled;
      for (const token of selectedTokens) {
        if (perceptionApi) await clearPerceptionData(token.document);
        const conditions = token.actor.items
          .filter((i) => ['hidden', 'undetected', 'unnoticed'].includes(i.system.slug))
          .map((i) => i.id);
        if (conditions.length > 0) {
          await token.actor.deleteEmbeddedDocuments("Item", conditions);
        }
      }
    }
  });
});

function migrate(moduleVersion, oldVersion) {

  ui.notifications.warn(`Updated PF2e Confirm my Bias data from ${oldVersion} to ${moduleVersion}`);
  return moduleVersion;
}

Hooks.once('setup', () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  game.settings.register(MODULE_ID, 'logLevel', {
    name: game.i18n.localize(`${MODULE_ID}.logLevel.name`),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'none': game.i18n.localize(`${MODULE_ID}.logLevel.none`),
      'debug': game.i18n.localize(`${MODULE_ID}.logLevel.debug`),
      'log': game.i18n.localize(`${MODULE_ID}.logLevel.log`)
    },
    default: 'none'
  });

  game.settings.register(MODULE_ID, 'schema', {
    name: game.i18n.localize(`${MODULE_ID}.schema.name`),
    hint: game.i18n.localize(`${MODULE_ID}.schema.hint`),
    scope: 'world',
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: value => {
      const newValue = migrate(moduleVersion, value);
      if (value != newValue) {
        game.settings.set(MODULE_ID, 'schema', newValue);
      }
    }
  });
  const schemaVersion = game.settings.get(MODULE_ID, 'schema');
  if (schemaVersion !== moduleVersion) {
    Hooks.once('ready', () => {
      game.settings.set(MODULE_ID, 'schema', migrate(moduleVersion, schemaVersion));
    });
  }

  log(`Setup ${moduleVersion}`);
});

Hooks.on('renderSettingsConfig', (app, html, data) => {
  const sections = [
     { label: "debug", before: "logLevel" },
  ];
  for (const section of sections) {
    $('<div>')
      .addClass('form-group group-header')
      .html(game.i18n.localize(`${MODULE_ID}.config.${section.label}`))
      .insertBefore($(`[name="${MODULE_ID}.${section.before}"]`)
        .parents('div.form-group:first'));
  }
});
