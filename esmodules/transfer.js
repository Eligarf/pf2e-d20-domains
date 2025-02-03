import { log, interpolateString } from "./main.js";
export { TransferApplication };

const MODULE_ID = "pf2e-d20-love-meter";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TransferApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(object, options = {}) {
    super(object, options);
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-transfer`,
    tag: "form",
    form: {
      handler: TransferApplication.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    window: {
      icon: "fas fa-exchange",
      title: `${MODULE_ID}.dialog.transfer.name`,
      resizable: true,
    },
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/transfer.hbs`,
    },
  };

  async _prepareContext() {
    let context = await super._prepareContext();
    context.from = game.users
      .filter((u) => u.flags[MODULE_ID]?.rolls)
      .map((u) => {
        return { id: u.id, name: u.name };
      });
    context.to = game.users
      .filter((u) => context.from.length > 1 || u.id !== context.from[0].id)
      .map((u) => {
        return { id: u.id, name: u.name };
      });
    //log("context", context);
    return context;
  }

  static async #onSubmit(event, form, formData) {
    const object = formData.object;
    const from = game.users.get(object.from);
    const to = game.users.get(object.to);
    if (!from || !to) return;
    if (from.id === to.id) return;

    const logs = from.flags[MODULE_ID];
    if (logs?.session)
      return ui.notifications.warn(
        game.i18n.localize(`${MODULE_ID}.notifications.stopSession`),
      );
    let toUpdate = { _id: to.id };
    for (let s in logs.sessions) {
      toUpdate[`flags.${MODULE_ID}.sessions.${s}`] = logs.sessions[s];
    }
    for (let r in logs.rolls) {
      const roll = logs.rolls[r];
      for (let i in roll) {
        toUpdate[`flags.${MODULE_ID}.rolls.${r}.${i}`] = roll[i];
      }
    }
    let fromUpdate = { _id: from.id };
    fromUpdate[`flags.-=${MODULE_ID}`] = true;
    // log("update", { toUpdate, fromUpdate });
    await User.updateDocuments([fromUpdate, toUpdate]);
  }
}
