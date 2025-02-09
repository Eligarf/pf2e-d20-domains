import { log, interpolateString } from "./main.js";
export { doTimeline };

const MODULE_ID = "pf2e-d20-domains";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let gTimeline;

async function doTimeline() {
  if (gTimeline) await gTimeline?.close();
  else gTimeline = new Timeline();
  gTimeline.render(true);
}

class Timeline extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(object, options = {}) {
    super(object, options);
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-timeline`,
    tag: "form",
    form: {
      handler: Timeline.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    window: {
      icon: "fas fa-chart",
      title: `${MODULE_ID}.timeline.title`,
      resizable: true,
    },
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/timeline.hbs`,
    },
  };

  async _prepareContext() {
    log("this", this);
    const context = await super._prepareContext();
    // const srcRolls = game.user.flags[MODULE_ID]?.rolls;
    const srcRolls = TEST_LOG;
    if (!srcRolls) return context;
    let rolls = {};
    for (const r in srcRolls) {
      rolls[r] = Object.values(srcRolls[r]);
    }
    context.rolls = rolls;
    log("context", context);
    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;
    log("#onSubmit", { form, formData, object });
  }
}
