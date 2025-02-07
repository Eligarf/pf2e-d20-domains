[![License](https://img.shields.io/github/license/eligarf/pf2e-d20-domains?label=License)](LICENSE)
[![Latest Version](https://img.shields.io/github/v/release/eligarf/pf2e-d20-domains?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/eligarf/pf2e-d20-domains/releases/latest)
![Foundry Version](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https%3A%2F%2Fraw.github.com%2Feligarf%2Fpf2e-d20-domains%2Frelease%2Fmodule.json)

![Latest Downloads](https://img.shields.io/github/downloads/eligarf/pf2e-d20-domains/latest/total?color=blue&label=latest%20downloads)
![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-pf2e-d20-domains&colorB=4aa94a)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rule671908)

# PF2e d20 Domains

Do your d20's love you, or are they spiteful little orbs of hate? This is a central question for all PF2e gamers, and now you can have the empirical data to finally back up your anthropomorphizations! This module goes beyond others by logging the domains associated with your PF2e d20 rolls in addtion to action type, DC, target, and success level, and provides analysis modes to truly show the quality of the hatred (or, theoretically, love) that d20s bear for their rollers.

## Why would you write a piece of statistical nonsense like this?

This is self-therapy for an extended run of bad luck with my characters. Either I get "proof" of the "unfairness" of disadvantage that my characters labor under, or I make the problem go away by shining the _spotlight of truth_ upon the baleful d20s and they start behaving with a more uniform distribution. There are other dice loggers out there that I could use, but they don't capture the greater context of the rolls other than if it is an attack roll.

## But as a GM, I have to "build mystery" by hiding everything, obfuscating feedback and impairing player agency

Well, don't use this then. While not visible to the player on the chat card, the domain, DC, and die roll data you are hoarding is available in the html regardless of your desires about the precious, and those are essential for truly evaluating the malevolence within the d20s. It is an unrelenting and irrevocable war between the player's dice and the GM's, so one also needs the know if the GMs dice only get hot against them - poor player rolling seems to excite the GM's dice when specifically rolling against them. This conspiracy needs unmasking.

## How it works

Once a client unlocks the module in the _PF2e d20 Love Meter_ game settings, it enables a new control where logging sessions can be started, paused, and stopped. When logging is started, the module will scrape d20 rolls out of certain chat cards and log the context. This applies to all chat cards equally, GM and other players included (remember, though not visible to the player, the data is still there). So there isn't any need to have multiple clients unlock the module - they will each end up with the same data.

The Analyze button in the control brings up a sheet where roll analyses are displayed based on various filters selected by the viewer.

## Supported Modules

- PF2e Toolbelt
- PF2e Utility buttons
