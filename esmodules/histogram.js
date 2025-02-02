import { log, interpolateString } from "./main.js";
// import { TEST_LOG, TEST_USER_ID } from "./test-data.js";
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

    const srcLog = game.user.flags[MODULE_ID];
    // const srcLog = TEST_LOG;

    const myUserId = game.user.id;
    // const myUserId = TEST_USER_ID;

    // remove instance IDs
    let results = {};
    for (let r = 1; r <= 20; ++r) {
      results[r] = {
        rolls: srcLog.rolls[r]
          ? foundry.utils.deepClone(Object.values(srcLog.rolls[r]))
          : [],
      };
    }

    const isGM = false; //game.user.isGM;
    let users = { gmId: { name: "GM", enabled: isGM } };
    function accrueUserName(id) {
      if (id in users) return;
      users[id] = {
        name: game.users.get(id)?.name ?? id,
        enabled: id === myUserId || isGM,
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
    Histogram.STATE.sessions = Object.fromEntries([
      ["_all", { started: "All sessions" }],
      ...sessions,
    ]);
    Histogram.STATE.users = Object.fromEntries(
      Object.entries(users).sort((a, b) => {
        if (a[1].name < b[1].name) return -1;
        if (a[1].name > b[1].name) return 1;
        return 0;
      }),
    );
    Histogram.STATE.types = Object.fromEntries(
      Object.entries(types).sort((a, b) => {
        if (a[1].name < b[1].name) return -1;
        if (a[1].name > b[1].name) return 1;
        return 0;
      }),
    );
    Histogram.STATE.results = results;
  }

  static STATE = {};

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-histogram`,
    tag: "form",
    form: {
      handler: Histogram.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    actions: {
      onUser: Histogram.onUser,
      onType: Histogram.onType,
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

  static async onUser(event, target) {
    let { name, checked } = target;
    name = name.split("-")[1];
    Histogram.STATE.users[name].enabled = checked;
    await this.render();
  }

  static async onType(event, target) {
    let { name, checked } = target;
    name = name.split("-").slice(1).join("-");
    Histogram.STATE.types[name].enabled = checked;
    await this.render();
  }

  filter(context) {
    let results = {};
    for (let f of Object.keys(context.results)) {
      const rolls = context.results[f]?.rolls?.filter((r) => {
        if (!context.users[r.rollerId].enabled) return false;
        if (!context.types[r.type].enabled) return false;
        return true;
      });
      const critFails = rolls?.filter((r) => r?.dos === "criticalFailure");
      const fails = rolls?.filter((r) => r?.dos === "failure");
      const successes = rolls?.filter((r) => r?.dos === "success");
      const crits = rolls?.filter((r) => r?.dos === "criticalSuccess");
      const unknowns = rolls?.filter(
        (r) => !("dos" in r) || r.dos === "unknown",
      );
      let result = {
        rolls: rolls,
      };
      if (critFails.length > 0) result.criticalFailures = critFails.length;
      if (fails.length > 0) result.failures = fails.length;
      if (successes.length > 0) result.successes = successes.length;
      if (crits.length > 0) result.criticalSuccesses = crits.length;
      if (unknowns.length > 0) result.unknowns = unknowns.length;
      results[f] = result;
    }
    return results;
  }

  async _prepareContext() {
    let context = await super._prepareContext();

    context = { ...context, ...Histogram.STATE };
    context.filteredResults = this.filter(context);

    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;
  }
}
