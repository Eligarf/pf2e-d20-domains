import { MODULE_ID, log } from "./main";

const TABLE = ['unknown', 'criticalFailure', 'failure', 'success', 'criticalSuccess'];

const SESSION_UUID = foundry.utils.randomID();

function getActiveGM() {
  let activeGMs = game.users.filter(u => u.active && u.isGM);
  activeGMs.sort((a, b) => b.id - a.id);
  return activeGMs[0] || null;
}

async function recordRoll({ id, type, roller, vs = null, d20, needs, dos }) {
  const rollerId = roller ?? getActiveGM().id;
  const vsId = vs ?? getActiveGM().id;
  const update = {
    _id: game.user.id,
  };
  update[`flags.${MODULE_ID}.sessions.${SESSION_UUID}.${rollerId}.${d20}.${dos}.${type}.${id}`] = { vs: vsId, needed: needs };
  await User.updateDocuments([update]);
}

Hooks.once('init', () => {
  Hooks.on('createChatMessage', async (message, options, id) => {
    const roll = message.rolls[0];
    const rollOpt = roll?.options;
    const type = rollOpt?.type;
    if (!['attack-roll', 'skill-check', 'initiative', 'saving-throw'].includes(type)) {
      return;
    }

    // log('createChatMessage', { message, roll, type });
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
    await recordRoll({ id: message.id, type, roller, vs, d20, dos, needs, isReroll });
  });

  Hooks.on('updateChatMessage', async (message, delta, options, id) => {
    const toolbelt = delta?.flags['pf2e-toolbelt'];
    // log('updateChatMessage', { message, delta });

    if (toolbelt) {
      const saves = toolbelt?.targetHelper?.saves;
      const actor = message?.flags?.pf2e?.origin?.actor ? await fromUuid(message?.flags?.pf2e?.origin?.actor) : null;
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
        await recordRoll({ id: message.id, type: 'saving-throw', roller, vs, d20, dos, needs, isReroll });
      }
      return;
    }
    const roll = delta?.flags?.['pf2e-flatcheck-helper']?.flatchecks?.targets;
    if (!roll) return;
    const flatcheck = message.flags['pf2e-flatcheck-helper'].flatchecks.targets;
    const actor = message?.flags?.pf2e?.origin?.actor ? await fromUuid(message?.flags?.pf2e?.origin?.actor) : null;
    await recordRoll({
      id: message.id,
      type: 'flatcheck',
      d20: flatcheck.roll,
      needs: flatcheck.dc,
      roller: game.users.find(u => u.character?.id === actor?.id)?.id,
      dos: (flatcheck.roll >= flatcheck.dc) ? 'success' : 'failure',
    });
  });

  ui.notifications.notify(`Logging session ${SESSION_UUID}`);
});
