export type { BotModule, BotModuleValidation } from "./botModule";
export { SUPPORTED_API_VERSION, validateBotModule } from "./botModule";

export type { HazardKind, UtilityKind } from "./hazards";
export type {
  Action,
  BotState,
  BotTuning,
  DecideResult,
  GapAhead,
  NearestCoin,
  NearestHazard,
  NearestUtility,
  PlatformKind,
  TileType,
  VisibleCoin,
  VisibleHazard,
  VisiblePlatform,
  VisibleUtility,
} from "./state";
export { ACTIONS } from "./state";

export type { StaticGuardResult } from "./staticGuard";
export { checkStaticGuard } from "./staticGuard";
