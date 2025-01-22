export { MODULE_ID, log, interpolateString };
import { initializeLogging, startLogging, stopLogging, endSession, eraseData } from "./logger.js";

const CONSOLE_COLORS = ['background: #222; color: #ffff80', 'color: #fff'];
const MODULE_ID = 'pf2e-d20-love-meter';

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

function migrate(moduleVersion, oldVersion) {
  ui.notifications.warn(interpolateString(
    game.i18n.localize(`${MODULE_ID}.notifications.updated`),
    { 'oldVersion': oldVersion, 'moduleVersion': moduleVersion }
  ));
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

  game.settings.register(MODULE_ID, "logging", {
    name: game.i18n.localize(`${MODULE_ID}.logging.name`),
    hint: game.i18n.localize(`${MODULE_ID}.logging.hint`),
    scope: 'client',
    type: Boolean,
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

  initializeLayer();
  log(`Setup ${moduleVersion}`);
});

Hooks.once('ready', async () => {
  await initializeLogging();
  log('Ready');
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

function initializeLayer() {
  if (!game.settings.get(MODULE_ID, 'unlocked')) return;
  CONFIG.Canvas.layers.d20LoveMeter = { layerClass: InteractionLayer, group: 'interface' };
}

async function analyze(rollerId) {
  const roller = game.users.get(rollerId);
  log(`Analyze ${roller.name}`);
}

Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.settings.get(MODULE_ID, 'unlocked')) return;
  const startLoggingTool = {
    icon: "fas fa-play",
    name: "start-logging",
    title: `${MODULE_ID}.control.startLogging`,
    visible: true,
    onClick: async () => { await startLogging(); }
  };
  const stopLoggingTool = {
    icon: "fas fa-pause",
    name: "stop-logging",
    title: `${MODULE_ID}.control.stopLogging`,
    visible: true,
    onClick: async () => { await stopLogging(); }
  };
  const endSessionTool = {
    icon: "fas fa-flag-checkered",
    name: "end-session",
    title: `${MODULE_ID}.control.endSession`,
    visible: true,
    onClick: async () => { await endSession(); }
  };
  let tools = [startLoggingTool, stopLoggingTool, endSessionTool];
  const rollers = game.user.flags[MODULE_ID]?.rollers;
  if (rollers) {
    for (let rollerId in rollers) {
      const roller = game.users.get(rollerId);
      if (!roller) continue;
      tools.push({
        icon: "fas fa-chart-simple",
        name: `analyze-${roller.name}`,
        title: interpolateString(
          game.i18n.localize(`${MODULE_ID}.control.analyze`),
          { 'roller': roller.name }
        ),
        visible: true,
        onClick: async () => { await analyze(rollerId); }
      });
    }
  }
  tools.push({
    icon: "fas fa-trash",
    name: "erase",
    title: `${MODULE_ID}.control.erase`,
    visible: true,
    onClick: async () => {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        content: game.i18n.localize(`${MODULE_ID}.dialog.content`),
        rejectClose: false,
        modal: true
      });
      if (proceed)
        await eraseData();
    }
  });
  controls.push({
    name: MODULE_ID,
    title: `${MODULE_ID}.control.title`,
    icon: game.settings.get(MODULE_ID, 'logging') ? "fa fa-pen-to-square" : 'fas fa-dice-d20',
    layer: 'd20LoveMeter',
    visible: true,
    activeTool: '',
    tools: tools
  });
});
