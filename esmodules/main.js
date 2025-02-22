export { MODULE_ID, log, interpolateString, getGM };
import {
  initializeLogging,
  startLogging,
  stopLogging,
  endSession,
  eraseData,
} from "./logger.js";
import { doHistogram } from "./histogram.js";
import { doTimeline } from "./timeline.js";
import { TransferApplication } from "./transfer.js";

const CONSOLE_COLORS = ["background: #222; color: #ffff80", "color: #fff"];
const MODULE_ID = "pf2e-d20-domains";

function colorizeOutput(format, ...args) {
  return [`%c${MODULE_ID} %c|`, ...CONSOLE_COLORS, format, ...args];
}

function log(format, ...args) {
  const level = game.settings.get(MODULE_ID, "logLevel");
  if (level !== "none") {
    if (level === "debug") console.debug(...colorizeOutput(format, ...args));
    else if (level === "log") console.log(...colorizeOutput(format, ...args));
  }
}

function interpolateString(str, interpolations) {
  return str.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    interpolations.hasOwnProperty(key) ? interpolations[key] : match,
  );
}

function getGM() {
  let gm = game.users.activeGM;
  if (gm) return gm;
  let gms = game.users.filter((u) => u.isGM);
  gms.sort((a, b) => b.id - a.id);
  return gms[0];
}

function versionAtLeast(version, target) {
  var a = version.split(".");
  var b = target.split(".");

  for (var i = 0; i < a.length; ++i) {
    a[i] = Number(a[i]);
  }
  for (var i = 0; i < b.length; ++i) {
    b[i] = Number(b[i]);
  }
  if (a.length == 2) {
    a[2] = 0;
  }

  if (a[0] > b[0]) return true;
  if (a[0] < b[0]) return false;

  if (a[1] > b[1]) return true;
  if (a[1] < b[1]) return false;

  if (a[2] > b[2]) return true;
  if (a[2] < b[2]) return false;

  return true;
}

async function migrate_to_0_11(oldVersion) {
  const newVersion = "0.11.0";
  log(`migrate ${oldVersion} => ${newVersion}`);
  const oldModuleId = "pf2e-d20-love-meter";
  let updates = [];

  for (let user of game.users) {
    const logs = user.flags[oldModuleId];
    if (!logs) continue;

    let update = { _id: user.id };

    update[`flags.-=${oldModuleId}`] = true;
    if (logs.session) {
      update[`flags.${MODULE_ID}.session`] = logs.session;
    }
    for (let s in logs.sessions) {
      update[`flags.${MODULE_ID}.sessions.${s}`] = logs.sessions[s];
    }
    for (let r in logs.rolls) {
      const roll = logs.rolls[r];
      for (let i in roll) {
        update[`flags.${MODULE_ID}.rolls.${r}.${i}`] = roll[i];
      }
    }
    updates.push(update);
  }

  log("updates", updates);
  await User.updateDocuments(updates);
  return newVersion;
}

async function migrate(moduleVersion, oldVersion) {
  if (versionAtLeast(oldVersion, moduleVersion)) return moduleVersion;

  let newVersion = oldVersion;
  if (!versionAtLeast(oldVersion, "0.11.0")) {
    newVersion = await migrate_to_0_11(oldVersion);
  }
  ui.notifications.warn(
    interpolateString(
      game.i18n.localize(`${MODULE_ID}.notifications.updated`),
      { oldVersion: oldVersion, moduleVersion: moduleVersion },
    ),
  );
  return moduleVersion;
}

Hooks.once("setup", () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  game.settings.register(MODULE_ID, "unlocked", {
    name: game.i18n.localize(`${MODULE_ID}.unlocked.name`),
    hint: game.i18n.localize(`${MODULE_ID}.unlocked.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    requiresReload: true,
    default: false,
  });

  if (game.user.isGM) {
    game.settings.registerMenu(MODULE_ID, "transferMenu", {
      name: game.i18n.localize(`${MODULE_ID}.dialog.transfer.name`),
      hint: game.i18n.localize(`${MODULE_ID}.dialog.transfer.hint`),
      icon: "fas fa-exchange",
      type: TransferApplication,
      restricted: true,
    });
  }

  game.settings.register(MODULE_ID, "logging", {
    name: game.i18n.localize(`${MODULE_ID}.logging.name`),
    hint: game.i18n.localize(`${MODULE_ID}.logging.hint`),
    scope: "client",
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "logLevel", {
    name: game.i18n.localize(`${MODULE_ID}.logLevel.name`),
    scope: "client",
    config: true,
    type: String,
    choices: {
      none: game.i18n.localize(`${MODULE_ID}.logLevel.none`),
      debug: game.i18n.localize(`${MODULE_ID}.logLevel.debug`),
      log: game.i18n.localize(`${MODULE_ID}.logLevel.log`),
    },
    default: "none",
  });

  game.settings.register(MODULE_ID, "schema", {
    name: game.i18n.localize(`${MODULE_ID}.schema.name`),
    hint: game.i18n.localize(`${MODULE_ID}.schema.hint`),
    scope: "world",
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: async (value) => {
      log(`schema value was '${value}'`);
      const newValue = await migrate(moduleVersion, value);
      log(`new schema value is '${newValue}'`);
      if (value != newValue) {
        game.settings.set(MODULE_ID, "schema", newValue);
      }
    },
  });
  const schemaVersion = game.settings.get(MODULE_ID, "schema");
  if (schemaVersion !== moduleVersion) {
    Hooks.once("ready", async () => {
      log(`Ready hook: migrating '${schemaVersion}' to '${moduleVersion}'`);
      const newVersion = await migrate(moduleVersion, schemaVersion);
      log(`new version = '${newVersion}'`);
      game.settings.set(MODULE_ID, "schema", newVersion);
    });
  }

  initializeLayer();
  log(`${MODULE_ID} ${moduleVersion} Setup`);
});

Hooks.once("ready", async () => {
  await initializeLogging();
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;
  log(`${MODULE_ID} ${moduleVersion} Ready`);
});

Hooks.on("renderSettingsConfig", (app, html, data) => {
  const sections = [
    { label: "logging", before: "unlocked" },
    { label: "debug", before: "logLevel" },
  ];
  for (const section of sections) {
    $("<div>")
      .addClass("form-group group-header")
      .html(game.i18n.localize(`${MODULE_ID}.config.${section.label}`))
      .insertBefore(
        $(`[name="${MODULE_ID}.${section.before}"]`).parents(
          "div.form-group:first",
        ),
      );
  }
});

function initializeLayer() {
  CONFIG.Canvas.layers.d20Domains = {
    layerClass: InteractionLayer,
    group: "interface",
  };
}

Hooks.on("getSceneControlButtons", (controls) => {
  const logger = game.users.find((u) => u.flags[MODULE_ID]);
  const watcher = !game.settings.get(MODULE_ID, "unlocked");
  if (watcher && !logger) return;

  let tools = [];
  if (!watcher) {
    tools.push(
      {
        icon: "fas fa-play",
        name: "start-logging",
        title: `${MODULE_ID}.control.startLogging`,
        visible: true,
        onClick: async () => {
          await startLogging();
        },
      },
      {
        icon: "fas fa-pause",
        name: "stop-logging",
        title: `${MODULE_ID}.control.stopLogging`,
        visible: true,
        onClick: async () => {
          await stopLogging();
        },
      },
      {
        icon: "fas fa-flag-checkered",
        name: "end-session",
        title: `${MODULE_ID}.control.endSession`,
        visible: true,
        onClick: async () => {
          await endSession();
        },
      },
    );
  }
  if (logger)
    tools.push({
      icon: "fas fa-chart-simple",
      name: `histogram`,
      title: `${MODULE_ID}.control.histogram`,
      visible: true,
      toggle: true,
      onClick: async () => {
        await doHistogram();
      },
    });
  /* tools.push({
    icon: "fas fa-timeline",
    name: `timeline`,
    title: `${MODULE_ID}.control.timeline`,
    visible: true,
    onClick: async () => {
      await doTimeline();
    },
  }); */
  if (game.user.flags[MODULE_ID]) {
    tools.push({
      icon: "fas fa-trash",
      name: "erase",
      title: `${MODULE_ID}.control.erase`,
      visible: true,
      onClick: async () => {
        const proceed = await foundry.applications.api.DialogV2.confirm({
          content: game.i18n.localize(`${MODULE_ID}.dialog.erase.content`),
          rejectClose: false,
          modal: true,
        });
        if (proceed) await eraseData();
      },
    });
  }

  controls.push({
    name: MODULE_ID,
    title: `${MODULE_ID}.control.title`,
    icon:
      !watcher && game.settings.get(MODULE_ID, "logging")
        ? "fa fa-pen-to-square"
        : "fas fa-dice-d20",
    layer: "d20Domains",
    visible: true,
    activeTool: "",
    tools,
  });
});
