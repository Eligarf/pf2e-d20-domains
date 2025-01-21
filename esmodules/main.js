const CONSOLE_COLORS = ['background: #222; color: #ffff80', 'color: #fff'];
const MODULE_ID = 'pf2e-d20-love-tester';

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

function interpolateString(str, interpolations) {
  return str.replace(
    /\{([A-Za-z0-9_]+)\}/g,
    (match, key) => interpolations.hasOwnProperty(key) ? interpolations[key] : match
  );
}

export { MODULE_ID, log, interpolateString };

function migrate(moduleVersion, oldVersion) {
  ui.notifications.warn(`Updated PF2e Confirm my Bias data from ${oldVersion} to ${moduleVersion}`);
  return moduleVersion;
}

Hooks.once('setup', () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  game.settings.register(MODULE_ID, 'unlocked', {
    name: game.i18n.localize(`${MODULE_ID}.unlocked.name`),
    hint: game.i18n.localize(`${MODULE_ID}.unlocked.hint`),
    scope: 'client',
    config: true,
    type: Boolean,
    requiresReload: true,
    default: false,
  });

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
    { label: "logging", before: "unlocked" },
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
