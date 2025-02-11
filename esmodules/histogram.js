import { log, interpolateString, getGM } from "./main.js";
export { doHistogram };

const MODULE_ID = "pf2e-d20-domains";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

var gHistogram;

async function doHistogram() {
  if (gHistogram) gHistogram.close();
  else gHistogram = new Histogram();
  gHistogram.render(true);
}

class Histogram extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(object, options = {}) {
    super(object, options);
  }

  static STATE = {
    users: {},
    types: {},
    domains: {},
    sessions: {},
  };

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-histogram`,
    tag: "form",
    form: {
      handler: Histogram.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    actions: {
      onSession: Histogram.onSession,
      onUser: Histogram.onUser,
      onType: Histogram.onType,
      onDomain: Histogram.onDomain,
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
    name = name.split("-").slice(1).join("-");
    Histogram.STATE.users[name].enabled = checked;
    await this.render();
  }

  static async onType(event, target) {
    let { name, checked } = target;
    name = name.split("-").slice(1).join("-");
    Histogram.STATE.types[name].enabled = checked;
    await this.render();
  }

  static async onDomain(event, target) {
    let { name, checked } = target;
    name = name.split("-").slice(1).join("-");
    Histogram.STATE.domains[name].enabled = checked;
    log("domains", { name, checked });
    await this.render();
  }

  static async onSession(event, target) {
    let { name, checked } = target;
    name = name.split("-").slice(1).join("-");
    Histogram.STATE.sessions[name].enabled = checked;
    await this.render();
  }

  filter(context, rawResults) {
    let results = {};
    const inDomains = Object.entries(context.domains).filter(
      ([k, v]) => v.enabled,
    );
    const multiRoller =
      Object.entries(context.users).filter(([k, v]) => v.enabled).length > 1;
    const multiType =
      Object.entries(context.types).filter(([k, v]) => v.enabled).length > 1;

    let domains = {};
    function accrueDomain(domain) {
      if (["all", "check"].includes(domain)) return;
      if (domain in domains) return;
      domains[domain] = {
        enabled: context.domains[domain].enabled,
      };
    }

    for (let f of Object.keys(rawResults)) {
      const rolls = rawResults[f]?.rolls?.filter((r) => {
        if (!context.users[r.rollerId].enabled) return false;
        if (!context.types[r.type].enabled) return false;
        for (let [k] of inDomains) {
          if (!r?.domains?.includes(k)) return false;
        }
        if (!context.sessions[r.session]?.enabled) return false;

        if (r.domains)
          for (let d of r.domains) {
            accrueDomain(d);
          }
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
      if (critFails.length > 0) {
        result.criticalFailures = {
          count: critFails.length,
          tooltip: critFails.map((r) => {
            let roll = {};
            if ("needed" in r) roll.needed = r.needed;
            if (multiRoller) roll.roller = context.users[r.rollerId].name;
            if (multiType) roll.type = r.type;
            return roll;
          }),
        };
      }
      if (fails.length > 0) {
        result.failures = {
          count: fails.length,
          tooltip: fails.map((r) => {
            let roll = {};
            if ("needed" in r) roll.needed = r.needed;
            if (multiRoller) roll.roller = context.users[r.rollerId].name;
            if (multiType) roll.type = r.type;
            return roll;
          }),
        };
      }
      if (successes.length > 0) {
        result.successes = {
          count: successes.length,
          tooltip: successes.map((r) => {
            let roll = {};
            if ("needed" in r) roll.needed = r.needed;
            if (multiRoller) roll.roller = context.users[r.rollerId].name;
            if (multiType) roll.type = r.type;
            return roll;
          }),
        };
      }
      if (crits.length > 0) {
        result.criticalSuccesses = {
          count: crits.length,
          tooltip: crits.map((r) => {
            let roll = {};
            if ("needed" in r) roll.needed = r.needed;
            if (multiRoller) roll.roller = context.users[r.rollerId].name;
            if (multiType) roll.type = r.type;
            return roll;
          }),
        };
      }
      if (unknowns.length > 0)
        result.unknowns = {
          count: unknowns.length,
          tooltip: unknowns.map((r) => {
            let roll = {};
            if (multiRoller) roll.roller = context.users[r.rollerId].name;
            if (multiType) roll.type = r.type;
            return roll;
          }),
        };
      results[f] = result;
    }
    context.multiRoller = multiRoller;
    context.multiType = multiType;
    context.domains = Object.fromEntries(
      Object.entries(domains).sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
      }),
    );
    return results;
  }

  async _prepareContext() {
    let context = await super._prepareContext();

    const logger = game.users.find((u) => u.flags[MODULE_ID]?.rolls);
    const srcLog = logger?.flags?.[MODULE_ID];

    const myUserId = game.user.id;

    // remove instance IDs
    let results = {};
    for (let r = 1; r <= 20; ++r) {
      results[r] = {
        rolls: srcLog?.rolls?.[r]
          ? foundry.utils.deepClone(Object.values(srcLog.rolls[r]))
          : [],
      };
    }

    const isGM = game.user.isGM;
    const gm = getGM();
    function accrueUserName(id) {
      if (id in Histogram.STATE.users) return;
      Histogram.STATE.users[id] = {
        name: game.users.get(id)?.name ?? id,
        enabled: id === myUserId || isGM,
      };
    }
    function accrueType(type) {
      if (type in Histogram.STATE.types) return;
      Histogram.STATE.types[type] = {
        enabled: true,
      };
    }
    function accrueDomain(domain) {
      if (["all", "check"].includes(domain)) return;
      if (domain in Histogram.STATE.domains) return;
      Histogram.STATE.domains[domain] = {
        enabled: false,
      };
    }
    function accrueSession(session) {
      if (session in Histogram.STATE.sessions) return;
      if (session === srcLog.session) return;
      Histogram.STATE.sessions[session] = {
        started: new Date(srcLog.sessions[session].started),
        ended: new Date(srcLog.sessions[session].ended),
        enabled: true,
      };
    }

    for (let face of Object.values(results)) {
      for (let i of face.rolls) {
        if (!i.rollerId) i.rollerId = gm.id;
        accrueUserName(i.rollerId);
        if (!i.vsId) i.vsId = gm.id;
        accrueUserName(i.vsId);
        accrueType(i.type);
        if (i.domains)
          for (let d of i.domains) {
            accrueDomain(d);
          }
        accrueSession(i.session);
      }
    }

    Histogram.STATE.sessions = Object.fromEntries(
      Object.entries(Histogram.STATE.sessions).sort((a, b) => {
        if (a[1].started < b[1].started) return -1;
        if (a[1].started > b[1].started) return 1;
        return 0;
      }),
    );
    Histogram.STATE.users = Object.fromEntries(
      Object.entries(Histogram.STATE.users).sort((a, b) => {
        if (a[1].name < b[1].name) return -1;
        if (a[1].name > b[1].name) return 1;
        return 0;
      }),
    );
    Histogram.STATE.types = Object.fromEntries(
      Object.entries(Histogram.STATE.types).sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
      }),
    );
    Histogram.STATE.domains = Object.fromEntries(
      Object.entries(Histogram.STATE.domains).sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
      }),
    );
    context = { ...context, ...Histogram.STATE };
    context.filteredResults = this.filter(context, results);

    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;
  }
}
