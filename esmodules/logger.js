import { MODULE_ID, log, interpolateString, getGM } from "./main.js";

/*global foundry, game, Hooks*/
/*eslint no-undef: "error"*/

export {
  initializeLogging,
  createSession,
  startLogging,
  stopLogging,
  endSession,
  eraseData,
};

const TABLE = [
  "unknown",
  "criticalFailure",
  "failure",
  "success",
  "criticalSuccess",
];

let g_sessionUuid;

async function createSession() {
  g_sessionUuid = foundry.utils.randomID();
  const update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.session`] = g_sessionUuid;
  // myDate.toGMTString()+"\n"+ myDate.toLocaleString()
  update[`flags.${MODULE_ID}.sessions.${g_sessionUuid}.started`] = new Date(
    Date.now(),
  );
  await User.updateDocuments([update]);

  ui.notifications.notify(
    interpolateString(
      game.i18n.localize(`${MODULE_ID}.notifications.createSession`),
      { SessionUuid: g_sessionUuid },
    ),
  );
}

async function startLogging() {
  if (!g_sessionUuid) await createSession();
  game.settings.set(MODULE_ID, "logging", true);
  log(`start logging session ${g_sessionUuid}`);
}

function stopLogging() {
  game.settings.set(MODULE_ID, "logging", false);
  log(`stop logging session ${g_sessionUuid}`);
}

async function endSession() {
  let update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.-=session`] = true;

  stopLogging();

  if (g_sessionUuid) {
    update[`flags.${MODULE_ID}.sessions.${g_sessionUuid}.ended`] = new Date(
      Date.now(),
    );
    ui.notifications.notify(
      interpolateString(
        game.i18n.localize(`${MODULE_ID}.notifications.terminateSession`),
        { SessionUuid: g_sessionUuid },
      ),
    );
    log(`finishing session ${g_sessionUuid}`);
    g_sessionUuid = null;
  }

  await User.updateDocuments([update]);
}

async function eraseData() {
  log("erasing all roll data");
  endSession();
  let update = { _id: game.user.id };
  update[`flags.-=${MODULE_ID}`] = true;
  await User.updateDocuments([update]);
  ui.notifications.warn(
    game.i18n.localize(`${MODULE_ID}.notifications.erased`),
  );
}

async function recordRoll({
  messageId,
  type,
  roller,
  vs = null,
  d20,
  needs = NaN,
  dos = TABLE[0],
  isReroll = false,
  domains = [],
}) {
  if (!g_sessionUuid && game.users.filter((u) => u.active).length > 1)
    startLogging();
  else if (!game.settings.get(MODULE_ID, "logging")) return;

  const gmId = getGM().id;
  const rollerId = roller ?? gmId;
  const vsId = vs ?? gmId;
  const adjustedType = isReroll ? type + "-reroll" : type;
  const update = { _id: game.user.id };
  let entry = {
    session: g_sessionUuid,
    now: new Date(Date.now()),
    type: adjustedType,
    messageId,
    rollerId,
    vsId,
  };
  if (dos !== TABLE[0]) entry.dos = dos;
  if (!isNaN(needs)) entry.needed = needs;
  if (domains.length) entry.domains = domains;
  update[`flags.${MODULE_ID}.rolls.${d20}.${foundry.utils.randomID()}`] = entry;
  await User.updateDocuments([update]);
}

async function initializeLogging() {
  const unlocked = game.settings.get(MODULE_ID, "unlocked");
  if (!unlocked) return;

  g_sessionUuid = game.user.flags[MODULE_ID]?.session;

  Hooks.on("createChatMessage", async (message, options, id) => {
    const roll = message.rolls[0];
    // log('createChatMessage', { message, roll });
    if (!roll) return;

    // Only look at d20s and ignore damage rolls
    if (roll.terms?.[0]?.faces !== 20) return;
    if (message.flags?.pf2e?.context?.type === "damage-roll") return;

    // Devise a stratagem has a terrible signature so we have to look for it first
    if (message.flavor == "Devise a Stratagem")
      return await onDeviseAStratagem(message, roll);

    // The vanilla chat card handles lots of stuff
    const rollOpt = roll?.options;
    const type = rollOpt?.type;
    if (type) return await onVanillaAction(message, roll, rollOpt, type);

    // Recall Knowledge is a good bet
    if (
      message.flavor.includes('class="pf2e-hud-rk') ||
      message.content.includes("<strong>Recall Knowledge</strong>")
    )
      return await onRecallKnowledge(message, roll);
    // log('createChatMessage', { message, roll });
  });

  Hooks.on("updateChatMessage", async (message, delta, options, id) => {
    const toolbelt = delta?.flags?.["pf2e-toolbelt"];
    if (toolbelt) return await onToolBelt(message, toolbelt);

    const flatcheck =
      delta?.flags?.["pf2e-flatcheck-helper"]?.flatchecks?.targets;
    if (flatcheck) return await onFlatCheckHelper(message, delta);
    // log("updateChatMessage", { message, delta });
  });
}

async function onDeviseAStratagem(message, roll) {
  const roller = game.users.find(
    (u) => u.character?.id === message.speaker.actor,
  )?.id;
  const d20 = roll.dice[0].total;
  const dos = TABLE[1 + (roll?.options?.degreeOfSuccess ?? -1)];
  await recordRoll({
    messageId: message.id,
    type: "devise-a-stratagem",
    roller,
    d20,
    dos,
  });
}

async function onVanillaAction(message, roll, rollOpt, type) {
  const roller = game.users.find(
    (u) => u.character?.id === message.flags.pf2e.context.actor,
  )?.id;
  const d20 = roll.dice[0].total;
  const dos = TABLE[1 + (rollOpt?.degreeOfSuccess ?? -1)];
  const modifier = rollOpt.totalModifier;
  const context = message.flags.pf2e.context;
  const targetToken = context?.target?.token
    ? await fromUuid(context?.target?.token)
    : null;
  const vs = targetToken
    ? game.users.find((u) => u.character?.id === targetToken.actor?.id)?.id
    : null;
  const dc = context.dc?.value;
  const isReroll = context.isReroll;
  const needs = dc - modifier;
  await recordRoll({
    messageId: message.id,
    type,
    roller,
    vs,
    d20,
    dos,
    needs,
    isReroll,
    domains: context?.domains,
  });
}

async function onRecallKnowledge(message, roll) {
  const roller = game.users.find(
    (u) => u.character?.id === message.speaker.actor,
  )?.id;
  const d20 = roll.dice[0].total;
  await recordRoll({
    messageId: message.id,
    type: "skill-check",
    roller,
    d20,
    domains: ["skill-check"],
  });
}

async function onToolBelt(message, toolbelt) {
  log("onToolBelt", { message, toolbelt });
  const saves = toolbelt?.targetHelper?.saves;
  const actorUuid = message?.flags?.pf2e?.origin?.actor;
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  const vs = game.users.find((u) => u.character?.id === actor?.id)?.id;
  for (const tokenId in saves) {
    const token = canvas.scene.tokens.get(tokenId);
    const roller = token
      ? game.users.find((u) => u.character?.id === token?.actor?.id)?.id
      : null;
    const save = saves[tokenId];
    const d20 = save.die;
    const dos = save.success;
    const modifier = save.value - save.die;
    const dc = message.flags["pf2e-toolbelt"]?.targetHelper?.save?.dc;
    const needs = dc - modifier;
    const isReroll = save?.rerolled === "new";
    await recordRoll({
      messageId: message.id,
      type: "saving-throw",
      roller,
      vs,
      d20,
      dos,
      needs,
      isReroll,
      domains: save.roll.options?.domains,
    });
  }
}

async function onFlatCheckHelper(message, delta) {
  const flatcheck = message.flags["pf2e-flatcheck-helper"].flatchecks.targets;
  const actorUuid = message?.flags?.pf2e?.origin?.actor;
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  await recordRoll({
    messageId: message.id,
    type: "flat-check",
    d20: flatcheck.roll,
    needs: flatcheck.dc,
    roller: game.users.find((u) => u.character?.id === actor?.id)?.id,
    dos: flatcheck.roll >= flatcheck.dc ? "success" : "failure",
  });
}
