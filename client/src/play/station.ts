/**
 * Zustandsmaschine EINER Spielstation – siehe `.features/play-mode/design.md`,
 * Abschnitt "Stations-Zustandsmaschine" (US-2, US-4, US-5, US-7).
 *
 * Zwei Stationen = zwei unabhängige Instanzen dieses Reducers; es gibt bewusst
 * keinen gemeinsamen Zustand.
 *
 * Pur und zeitlos: Jede Wartezeit läuft über `{type:"tick", deltaMs}`, es gibt
 * keine `setTimeout`/`Date.now`-Aufrufe. Dadurch ist der komplette Ablauf ohne
 * Fake-Timer testbar.
 */

import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeScore } from "../game/scoring";
import type { InputSnapshot } from "./input/inputSnapshot";
import {
  createNameEntryState,
  finalizeName,
  type NameEntryState,
  nameEntryReducer,
} from "./nameEntry";

/** Leben für den GESAMTEN Run, nicht pro Level (US-4). */
export const PLAY_LIVES = 5;

/** Die sechs regulären Level in fester Reihenfolge – `toolkit-test` aus der
 *  `LEVEL_REGISTRY` gehört bewusst nicht dazu (US-4). */
export const PLAY_LEVEL_IDS = [
  "level-one",
  "level-two",
  "level-three",
  "level-four",
  "level-five",
  "level-six",
] as const;

export const COUNTDOWN_MS = 3_000;
export const LEVEL_RESULT_MS = 4_000;
export const GAME_OVER_TIMEOUT_MS = 45_000;

export type StationPhase =
  | "attract"
  | "name-entry"
  | "countdown"
  | "playing"
  | "disconnected"
  | "level-result"
  | "game-over";

export interface LevelResult {
  levelId: string;
  score: number;
  reachedGoal: boolean;
  fruitScore: number;
  deaths: number;
  timeElapsedMs: number;
  livesRemaining: number;
}

export interface StationState {
  phase: StationPhase;
  name: string;
  nameEntry: NameEntryState;
  levelIndex: number;
  livesRemaining: number;
  totalScore: number;
  results: LevelResult[];
  /** Zeit in der aktuellen Phase (für Countdown/Zwischenanzeige/Timeout). */
  phaseElapsedMs: number;
  /** Platzierung in der Bestenliste, von außen nachgereicht (US-6). */
  rank: number | null;
}

export type StationEvent =
  | { type: "tick"; deltaMs: number }
  | { type: "input"; edges: InputSnapshot }
  | { type: "level-ended"; racer: RacerRuntimeState }
  | { type: "gamepad-lost" }
  | { type: "gamepad-found" }
  | { type: "rank-assigned"; rank: number | null };

export function createStationState(): StationState {
  return {
    phase: "attract",
    name: "",
    nameEntry: createNameEntryState(),
    levelIndex: 0,
    livesRemaining: PLAY_LIVES,
    totalScore: 0,
    results: [],
    phaseElapsedMs: 0,
    rank: null,
  };
}

/** Level-ID der aktuellen Position im Run. */
export function currentLevelId(state: StationState): string {
  return PLAY_LEVEL_IDS[Math.min(state.levelIndex, PLAY_LEVEL_IDS.length - 1)];
}

/** Anzahl tatsächlich geschaffter (Ziel erreicht) Level – für die Bestenliste. */
export function levelsCompleted(state: StationState): number {
  return state.results.filter((result) => result.reachedGoal).length;
}

function enter(state: StationState, phase: StationPhase): StationState {
  return { ...state, phase, phaseElapsedMs: 0 };
}

export function stationReducer(state: StationState, event: StationEvent): StationState {
  switch (event.type) {
    case "tick":
      return applyTick(state, event.deltaMs);
    case "input":
      return applyInput(state, event.edges);
    case "level-ended":
      return applyLevelEnded(state, event.racer);
    case "gamepad-lost":
      return state.phase === "playing" ? enter(state, "disconnected") : state;
    case "gamepad-found":
      return state.phase === "disconnected" ? enter(state, "playing") : state;
    case "rank-assigned":
      return { ...state, rank: event.rank };
  }
}

function applyTick(state: StationState, deltaMs: number): StationState {
  const elapsed = state.phaseElapsedMs + deltaMs;

  switch (state.phase) {
    case "countdown":
      return elapsed >= COUNTDOWN_MS
        ? enter(state, "playing")
        : { ...state, phaseElapsedMs: elapsed };
    case "level-result":
      return elapsed >= LEVEL_RESULT_MS
        ? startNextLevel(state)
        : { ...state, phaseElapsedMs: elapsed };
    case "game-over":
      return elapsed >= GAME_OVER_TIMEOUT_MS
        ? createStationState()
        : { ...state, phaseElapsedMs: elapsed };
    default:
      return { ...state, phaseElapsedMs: elapsed };
  }
}

function applyInput(state: StationState, edges: InputSnapshot): StationState {
  switch (state.phase) {
    case "attract":
      return edges.confirm
        ? { ...enter(createStationState(), "name-entry"), nameEntry: createNameEntryState() }
        : state;

    case "name-entry": {
      if (edges.back) return enter(createStationState(), "attract");
      if (edges.confirm) {
        return { ...enter(state, "countdown"), name: finalizeName(state.nameEntry) };
      }
      const direction = edges.up
        ? "up"
        : edges.down
          ? "down"
          : edges.left
            ? "left"
            : edges.right
              ? "right"
              : null;
      return direction
        ? { ...state, nameEntry: nameEntryReducer(state.nameEntry, { type: direction }) }
        : state;
    }

    case "playing":
    case "disconnected":
    case "countdown":
      // Abbruch am Stand: Der nächste Besucher soll sofort loslegen können.
      return edges.back ? enter(createStationState(), "attract") : state;

    case "level-result":
      return edges.confirm || edges.jump ? startNextLevel(state) : state;

    case "game-over":
      return edges.confirm || edges.back ? enter(createStationState(), "attract") : state;
  }
}

function applyLevelEnded(state: StationState, racer: RacerRuntimeState): StationState {
  if (state.phase !== "playing" && state.phase !== "disconnected") return state;

  const reachedGoal = racer.finished;
  const score = computeScore({
    fruitScore: racer.fruitScore,
    timeElapsedMs: racer.timeElapsedMs,
    deaths: racer.deaths,
    reachedGoal,
  });

  const result: LevelResult = {
    levelId: currentLevelId(state),
    score,
    reachedGoal,
    fruitScore: racer.fruitScore,
    deaths: racer.deaths,
    timeElapsedMs: racer.timeElapsedMs,
    livesRemaining: racer.livesRemaining,
  };

  const next: StationState = {
    ...state,
    results: [...state.results, result],
    totalScore: state.totalScore + score,
    livesRemaining: racer.livesRemaining,
  };

  // Ohne Leben ist der Run vorbei – unabhängig davon, wie viele Level noch
  // folgen würden (US-4).
  const isLastLevel = state.levelIndex >= PLAY_LEVEL_IDS.length - 1;
  if (racer.livesRemaining <= 0 || isLastLevel) {
    return enter(next, "game-over");
  }

  return enter(next, "level-result");
}

/** Nach der Zwischenanzeige ins nächste Level (Countdown, Leben bleiben). */
function startNextLevel(state: StationState): StationState {
  return enter({ ...state, levelIndex: state.levelIndex + 1 }, "countdown");
}
