import { log, interpolateString } from "./main.js";

const MODULE_ID = 'pf2e-d20-love-meter';

export { histogram, timeline };
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

async function histogram() {
  // new HistogramClass().render(true);;
}

async function timeline() {
}

class Histogram extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(object, options = {}) {
    super(object, options);
  }
  get #detectionModes() {
    return foundry.utils
      .deepClone(game.settings.get(Stealthy.MODULE_ID, Stealthy.ALLOWED_DETECTION_MODES));
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-analyze`,
    tag: 'form',
    form: {
      handler: Histogram.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    window: {
      icon: "fas fa-chart",
      title: `${MODULE_ID}.analyze.title`,
      resizable: true,
    }
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/analyzer.hbs`,
    }
  };

  async _prepareContext() {
    log('this', this);
    const context = await super._prepareContext();
    const srcRolls = game.user.flags[MODULE_ID]?.rolls;
    if (!srcRolls) return context;
    let rolls = {};
    for (const r in srcRolls) {
      rolls[r] = Object.values(srcRolls[r]);
    }
    context.rolls = rolls;
    log('context', context);
    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;
    log('#onSubmit', { form, formData, object });
  }
}
