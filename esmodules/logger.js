import { MODULE_ID, log, interpolateString } from "./main.js";

export { initializeLogging, createSession, startLogging, stopLogging, endSession, eraseData };

const TABLE = ['unknown', 'criticalFailure', 'failure', 'success', 'criticalSuccess'];

let g_sessionUuid;
let g_sessionWarned = false;

async function createSession() {
  g_sessionUuid = foundry.utils.randomID();
  const update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.session`] = g_sessionUuid;
  // myDate.toGMTString()+"\n"+ myDate.toLocaleString()
  update[`flags.${MODULE_ID}.sessions.${g_sessionUuid}.started`] = new Date(Date.now());
  await User.updateDocuments([update]);

  ui.notifications.notify(interpolateString(
    game.i18n.localize(`${MODULE_ID}.notifications.createSession`),
    { 'SessionUuid': g_sessionUuid }
  ));
}

async function startLogging() {
  if (!g_sessionUuid) await createSession();
  game.settings.set(MODULE_ID, 'logging', true);
}

function stopLogging() {
  game.settings.set(MODULE_ID, 'logging', false);
}

async function endSession() {
  let update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.-=session`] = true;

  stopLogging();

  if (g_sessionUuid) {
    update[`flags.${MODULE_ID}.sessions.${g_sessionUuid}.ended`] = new Date(Date.now());
    ui.notifications.notify(interpolateString(
      game.i18n.localize(`${MODULE_ID}.notifications.terminateSession`),
      { 'SessionUuid': g_sessionUuid }
    ));
    g_sessionUuid = null;
  }

  await User.updateDocuments([update]);

  g_sessionWarned = false;
}

async function eraseData() {
  endSession();
  let update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.-=rollers`] = true;
  update[`flags.${MODULE_ID}.-=sessions`] = true;
  await User.updateDocuments([update]);
  ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.erased`));
}

function getActiveGM() {
  let activeGMs = game.users.filter(u => u.active && u.isGM);
  activeGMs.sort((a, b) => b.id - a.id);
  return activeGMs[0] || null;
}

async function recordRoll({ messageId, type, roller, vs = null, d20, needs, dos, isReroll = false }) {
  if (!g_sessionUuid) {
    if (!g_sessionWarned) {
      g_sessionWarned = true;
      ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.notifications.noSession`));
    }
    return;
  }

  const gmId = getActiveGM().id;
  const rollerId = roller ?? gmId;
  const vsId = vs ?? gmId;
  const adjustedType = (isReroll) ? type + '-reroll' : type;
  const update = { _id: game.user.id };
  update[`flags.${MODULE_ID}.rollers.${rollerId}.${g_sessionUuid}.${d20}.${dos}.${adjustedType}.${messageId}`] = { vs: vsId, needed: needs };
  await User.updateDocuments([update]);
}

async function initializeLogging() {
  const unlocked = game.settings.get(MODULE_ID, 'unlocked');
  if (!unlocked) return;

  g_sessionUuid = game.user.flags[MODULE_ID]?.session;

  Hooks.on('createChatMessage', async (message, options, id) => {
    if (!game.settings.get(MODULE_ID, 'logging')) return;

    const roll = message.rolls[0];
    const rollOpt = roll?.options;
    let type = rollOpt?.type;
    // log('createChatMessage', { message, roll, type });
    if (![
      'attack-roll',
      'skill-check',
      'initiative',
      'saving-throw',
      'perception-check',
    ].includes(type)) return;

    const roller = game.users.find(u => u.character?.id === message.flags.pf2e.context.actor)?.id;
    const d20 = roll.dice[0].total;
    const dos = TABLE[1 + (rollOpt?.degreeOfSuccess ?? -1)];
    const modifier = rollOpt.totalModifier;
    const context = message.flags.pf2e.context;
    const targetToken = context?.target?.token ? await fromUuid(context?.target?.token) : null;
    const vs = targetToken ? game.users.find((u) => u.character?.id === targetToken.actor?.id)?.id : null;
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
      isReroll
    });
  });

  async function handleToolbelt(message, toolbelt) {
    const saves = toolbelt?.targetHelper?.saves;
    const actorUuid = message?.flags?.pf2e?.origin?.actor;
    const actor = actorUuid ? await fromUuid(actorUuid) : null;
    const vs = game.users.find(u => u.character === actor)?.id;
    for (const tokenId in saves) {
      const token = canvas.scene.tokens.get(tokenId);
      const roller = token ? game.users.find((u) => u.character?.id === token?.actor?.id)?.id : null;
      const save = saves[tokenId];
      const d20 = save.die;
      const dos = save.success;
      const modifier = save.value - save.die;
      const dc = message.flags['pf2e-toolbelt']?.targetHelper?.save?.dc;
      const needs = dc - modifier;
      const isReroll = save?.rerolled === 'new';
      await recordRoll({
        messageId: message.id,
        type: 'saving-throw',
        roller,
        vs,
        d20,
        dos,
        needs,
        isReroll
      });
    }
  }

  Hooks.on('updateChatMessage', async (message, delta, options, id) => {
    if (!game.settings.get(MODULE_ID, 'logging')) return;

    const toolbelt = delta?.flags['pf2e-toolbelt'];
    // log('updateChatMessage', { message, delta });

    if (toolbelt) {
      return await handleToolbelt(message, toolbelt);
    }

    const roll = delta?.flags?.['pf2e-flatcheck-helper']?.flatchecks?.targets;
    if (!roll) return;
    const flatcheck = message.flags['pf2e-flatcheck-helper'].flatchecks.targets;
    const actorUuid = message?.flags?.pf2e?.origin?.actor;
    const actor = actorUuid ? await fromUuid(actorUuid) : null;
    await recordRoll({
      messageId: message.id,
      type: 'flatcheck',
      d20: flatcheck.roll,
      needs: flatcheck.dc,
      roller: game.users.find(u => u.character?.id === actor?.id)?.id,
      dos: (flatcheck.roll >= flatcheck.dc) ? 'success' : 'failure',
    });
  });
}
