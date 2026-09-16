import {
  type BotModule,
  type BotState,
  type ChooseRoute,
  type DecideResult,
  type ToolsApi,
  validateBotModule,
} from "@arena/bot-contract";
import { validateNavigationDiagnostic } from "../game/trace/navigationDiagnostic";
import type { HostToWorkerMessage, WorkerToHostMessage } from "./workerLike";

/** Structural injection boundary for @arena/bot-navigation's createNavigator. */
export interface WorkerNavigator {
  decide(state: BotState, choose?: ChooseRoute): DecideResult;
  getDiagnostics(): unknown;
  reset(): void;
}

export type NavigatorFactory = () => WorkerNavigator;

export function createBotWorkerRuntime(createNavigator?: NavigatorFactory) {
  let bot: BotModule | null = null;
  let navigator: WorkerNavigator | null = null;

  return {
    init(candidate: unknown): WorkerToHostMessage {
      bot = null;
      navigator = null;
      const validation = validateBotModule(candidate);
      if (!validation.valid) return { type: "module-invalid", reason: validation.reason };
      try {
        if (validation.module.frameworkVersion === 1) {
          if (!createNavigator) throw new Error("Navigator-Factory ist noch nicht angeschlossen");
          navigator = createNavigator();
        }
        bot = validation.module;
        return {
          type: "module-ready",
          name: bot.name,
          author: bot.author,
          color: bot.color,
          ...(bot.frameworkVersion !== undefined ? { frameworkVersion: bot.frameworkVersion } : {}),
        };
      } catch (error) {
        return { type: "module-invalid", reason: String(error) };
      }
    },

    tick(message: Extract<HostToWorkerMessage, { type: "tick" }>): WorkerToHostMessage {
      const { tick, stateTick, stateFrame, epoch, state } = message;
      const correlation = { tick, stateTick, stateFrame, epoch };
      let active = true;
      let used = false;
      let navigationActions: DecideResult | undefined;
      try {
        if (!bot) throw new Error("Bot-Modul ist nicht bereit");
        let actions: unknown;
        if (bot.frameworkVersion === 1) {
          const currentNavigator = navigator;
          if (!currentNavigator) throw new Error("Navigator ist nicht bereit");
          const tools: ToolsApi = Object.freeze({
            navigate(options?: { choose?: ChooseRoute }): DecideResult {
              if (!active)
                throw new Error("navigate ist nur synchron innerhalb von decide gueltig");
              if (used) throw new Error("navigate darf pro Tick nur einmal aufgerufen werden");
              used = true;
              if (state.navigation?.version !== 1) {
                throw new Error("navigate benoetigt navigation.version 1");
              }
              const result = currentNavigator.decide(state, options?.choose);
              navigationActions = [...result];
              return result;
            },
          });
          const decide = bot.decide;
          actions = decide(state, tools);
        } else {
          // Keep both the legacy arity and its unbound invocation unchanged.
          const decide = bot.decide;
          actions = decide(state);
        }
        active = false;
        const raw = used ? navigator?.getDiagnostics() : undefined;
        const navigation = validateNavigationDiagnostic(
          raw && typeof raw === "object" ? { ...raw, navigationActions } : undefined
        );
        return { type: "action", ...correlation, actions, ...(navigation ? { navigation } : {}) };
      } catch (error) {
        return { type: "error", ...correlation, message: String(error) };
      } finally {
        active = false;
      }
    },
  };
}
