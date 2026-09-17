import {
  type BotModule,
  type BotState,
  type ControlCommand,
  type ControlStatus,
  type DecideResult,
  type MovementOption,
  type ToolsApi,
  validateBotModule,
} from "@arena/bot-contract";
import { validateNavigationDiagnostic } from "../game/trace/navigationDiagnostic";
import type { NavigationDiagnostic } from "../game/trace/types";
import type { HostToWorkerMessage, WorkerToHostMessage } from "./workerLike";

/** Structural injection boundary for the observation-driven movement controller. */
export interface WorkerMovementController {
  run(state: BotState, command: ControlCommand): DecideResult;
  status(state: BotState): ControlStatus;
  reset(): void;
  options?(state: BotState): MovementOption[];
}

export type MovementControllerFactory = () => WorkerMovementController;

export function createBotWorkerRuntime(createController?: MovementControllerFactory) {
  let bot: BotModule | null = null;
  let controller: WorkerMovementController | null = null;
  let previous: {
    command: ControlCommand;
    status: ControlStatus;
    epoch: number | undefined;
  } | null = null;

  return {
    init(candidate: unknown): WorkerToHostMessage {
      bot = null;
      controller = null;
      previous = null;
      const validation = validateBotModule(candidate);
      if (!validation.valid) return { type: "module-invalid", reason: validation.reason };
      try {
        if (validation.module.frameworkVersion === 2) {
          if (!createController) throw new Error("Controller-Factory ist noch nicht angeschlossen");
          controller = createController();
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
      let command: ControlCommand | undefined;
      let observed: ControlStatus | undefined;
      let statusTransition: NavigationDiagnostic["statusTransition"];
      try {
        if (!bot) throw new Error("Bot-Modul ist nicht bereit");
        let actions: unknown;
        if (bot.frameworkVersion === 2) {
          const current = controller;
          if (!current) throw new Error("Controller ist nicht bereit");
          // Observe contacts/respawn before the visitor chooses its next command.
          observed = current.status(state);
          if (
            previous &&
            !state.justRespawned &&
            previous.epoch === state.navigation?.epoch &&
            observed.commandId !== null &&
            observed.commandId === previous.status.commandId &&
            (observed.state !== previous.status.state ||
              observed.phase !== previous.status.phase ||
              observed.reason !== previous.status.reason)
          ) {
            statusTransition = {
              ...observed,
              commandId: observed.commandId,
              targetId: previous.command.kind === "walk" ? null : previous.command.platformId,
            };
          }
          const assertActive = () => {
            if (!active) throw new Error("Tools sind nur synchron innerhalb von decide gueltig");
          };
          const tools: ToolsApi = Object.freeze({
            run: (next: ControlCommand) => {
              assertActive();
              if (used) throw new Error("run darf pro Tick nur einmal aufgerufen werden");
              used = true;
              command = { ...next };
              const result = current.run(state, next);
              navigationActions = [...result];
              return result;
            },
            status: () => {
              assertActive();
              return current.status(state);
            },
            options: () => {
              assertActive();
              if (!current.options) throw new Error("options ist nicht verfügbar");
              return current.options(state);
            },
          });
          const decide = bot.decide;
          actions = decide(state, tools);
        } else {
          const decide = bot.decide;
          actions = decide(state);
        }
        active = false;
        const status = used ? controller?.status(state) : statusTransition ? observed : undefined;
        const diagnosticCommand = command ?? (statusTransition ? previous?.command : undefined);
        // Preserve the existing trace schema without inventing a route or search budget.
        const navigation =
          status &&
          validateNavigationDiagnostic({
            targetId:
              diagnosticCommand && diagnosticCommand.kind !== "walk"
                ? diagnosticCommand.platformId
                : null,
            routeId: null,
            planId: status.commandId,
            phase:
              status.state === "failed"
                ? "blocked"
                : status.state === "running"
                  ? "execute"
                  : "wait",
            reason: status.reason ?? status.phase ?? status.state,
            relevantObjectIds:
              diagnosticCommand?.kind === "boingo"
                ? [diagnosticCommand.utilityId, diagnosticCommand.platformId]
                : diagnosticCommand && diagnosticCommand.kind !== "walk"
                  ? [diagnosticCommand.platformId]
                  : [],
            navigationActions,
            ...(statusTransition ? { statusTransition } : {}),
          });
        previous =
          command && status
            ? { command, status: { ...status }, epoch: state.navigation?.epoch }
            : null;
        if (
          bot.frameworkVersion === 2 &&
          (!used || JSON.stringify(actions) !== JSON.stringify(navigationActions))
        ) {
          controller?.reset();
          previous = null;
        }
        return { type: "action", ...correlation, actions, ...(navigation ? { navigation } : {}) };
      } catch (error) {
        return { type: "error", ...correlation, message: String(error) };
      } finally {
        active = false;
      }
    },
  };
}
