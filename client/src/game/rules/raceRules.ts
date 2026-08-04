/**
 * Spielregeln als pure Reducer – siehe `.features/level-one-arena/design.md`,
 * Abschnitt "rules/raceRules.ts". Das Herzstück dieses Features: keine
 * Phaser-Abhängigkeit, jede Funktion nimmt einen `RacerRuntimeState` entgegen
 * und liefert einen neuen (Immutability, testbar wie ein Redux-Reducer).
 */
import type { HazardKind } from "@arena/bot-contract";
import { HAZARD_REGISTRY } from "../hazards/registry";
import type { CheckpointDef } from "../level/types";
import { LIVES_PER_RUN, type RacerRuntimeState, RUN_TIME_LIMIT_MS } from "./racerState";

export { LIVES_PER_RUN, RUN_TIME_LIMIT_MS };

export function applyCoinPickup(
  state: RacerRuntimeState,
  coinId: string,
  fruitValue: number
): RacerRuntimeState {
  return {
    ...state,
    coinsCollected: state.coinsCollected + 1,
    fruitScore: state.fruitScore + fruitValue,
    collectedCoinIds: new Set(state.collectedCoinIds).add(coinId),
  };
}

export function applyBlockHit(state: RacerRuntimeState, blockId: string): RacerRuntimeState {
  return {
    ...state,
    resolvedBlockIds: new Set(state.resolvedBlockIds).add(blockId),
  };
}

export type HazardContactKind = "none" | "stomped" | "hit";

export function resolveHazardContact(
  kind: HazardKind,
  isActive: boolean,
  contactFromAbove: boolean
): HazardContactKind {
  if (!isActive) return "none";
  const stompable = HAZARD_REGISTRY[kind].stompable;
  if (stompable && contactFromAbove) return "stomped";
  return "hit";
}

function loseLifeAndRespawn(state: RacerRuntimeState): RacerRuntimeState {
  const livesRemaining = state.livesRemaining - 1;
  const outOfLives = livesRemaining <= 0;
  return {
    ...state,
    x: state.lastCheckpoint.x,
    y: state.lastCheckpoint.y,
    livesRemaining,
    deaths: state.deaths + 1,
    didNotFinish: outOfLives ? true : state.didNotFinish,
    isAlive: outOfLives ? false : state.isAlive,
  };
}

export function applyHazardContact(
  state: RacerRuntimeState,
  contact: Exclude<HazardContactKind, "none">
): RacerRuntimeState {
  if (contact === "stomped") return state;
  return loseLifeAndRespawn(state);
}

export function applyPitFall(state: RacerRuntimeState): RacerRuntimeState {
  return loseLifeAndRespawn(state);
}

export function applyCheckpointReached(
  state: RacerRuntimeState,
  checkpoint: CheckpointDef
): RacerRuntimeState {
  return { ...state, lastCheckpoint: { x: checkpoint.x, y: checkpoint.y } };
}

export function applyGoalReached(state: RacerRuntimeState): RacerRuntimeState {
  return { ...state, finished: true };
}

export function applyTimeLimitReached(state: RacerRuntimeState): RacerRuntimeState {
  if (state.finished) return state;
  return { ...state, didNotFinish: true };
}
