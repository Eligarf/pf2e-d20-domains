import { log, interpolateString } from "./main.js";
import { TEST_LOG } from "./test-data.js";
export { doHistogram };

const MODULE_ID = "pf2e-d20-love-meter";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let gHistogram;

async function doHistogram() {
  if (gHistogram) await gHistogram?.close();
  else gHistogram = new Histogram();
  gHistogram.render(true);
}

class Histogram extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(object, options = {}) {
    super(object, options);
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-histogram`,
    tag: "form",
    form: {
      handler: Histogram.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    window: {
      icon: "fas fa-chart",
      title: `${MODULE_ID}.histogram.title`,
      resizable: true,
    },
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/histogram.hbs`,
    },
  };

  filter(context) {
    let results = {};
    for (let f of Object.keys(context.results)) {
      const rolls = context.results[f]?.rolls?.filter((r) => {
        if (
          !context.users[r.rollerId].enabled &&
          !context.users[r.vsId].enabled
        )
          return false;
        if (!context.types[r.type].enabled) return false;
        return true;
      });
      const critFails = rolls?.filter((r) => r?.dos === "criticalFailure");
      const fails = rolls?.filter((r) => r?.dos === "failure");
      const successes = rolls?.filter((r) => r?.dos === "success");
      const crits = rolls?.filter((r) => r?.dos === "criticalSuccess");
      const unknowns = rolls?.filter((r) => !("dos" in r));
      results[f] = {
        rolls: rolls,
        criticalFailures: critFails.length,
        failures: fails.length,
        successes: successes.length,
        criticalSuccesses: crits.length,
        unknowns: unknowns.length,
      };
    }
    return results;
  }

  async _prepareContext() {
    const context = await super._prepareContext();
    // const srcLog = game.user.flags[MODULE_ID]?.rolls;
    const srcLog = TEST_LOG;
    if (!srcLog) return context;

    // remove instance IDs
    let results = {};
    for (let r = 1; r <= 20; ++r) {
      results[r] = {
        rolls: srcLog.rolls[r]
          ? foundry.utils.deepClone(Object.values(srcLog.rolls[r]))
          : [],
      };
    }

    let users = { gmId: { name: "GM", enabled: true } };
    function accrueUserName(id) {
      if (id in users) return;
      users[id] = {
        name: game.users.get(id)?.name ?? id,
        enabled: true,
      };
    }
    let types = {};
    function accrueType(type) {
      if (type in types) return;
      types[type] = {
        name: type,
        enabled: true,
      };
    }
    for (let face of Object.values(results)) {
      for (let i of face.rolls) {
        if (!i.rollerId) i.rollerId = "gmId";
        accrueUserName(i.rollerId);
        if (!i.vsId) i.vsId = "gmId";
        accrueUserName(i.vsId);
        accrueType(i.type);
      }
    }

    // Sort the accrued values for presentation
    const sessions = Object.entries(srcLog.sessions)
      .sort((a, b) => {
        if (a[1].started < b[1].started) return -1;
        if (a[1].started > b[1].started) return 1;
        return 0;
      })
      .map(([k, v]) => {
        return [k, { started: new Date(v.started), ended: new Date(v.ended) }];
      });
    context.sessions = Object.fromEntries([
      ["_all", { started: "All sessions" }],
      ...sessions,
    ]);
    context.users = Object.fromEntries(
      Object.entries(users).sort((a, b) => {
        if (a[1].name < b[1].name) return -1;
        if (a[1].name > b[1].name) return 1;
        return 0;
      }),
    );
    context.types = Object.fromEntries(
      Object.entries(types).sort((a, b) => {
        if (a[1].name < b[1].name) return -1;
        if (a[1].name > b[1].name) return 1;
        return 0;
      }),
    );
    context.results = results;
    context.filteredResults = this.filter(context);

    log("context", context);
    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;

    log("onSubmit", object, { event, form, formData });
  }
}
