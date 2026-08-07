export const MODULE_ID = "really-inspired";

export const SETTINGS = {
  POOL_MODE: "poolMode",
  MAX_PER_CHARACTER: "maxPerCharacter",
  PLAYERS_CAN_ADJUST: "playersCanAdjust",
  // Solo se registra si socketlib está activo (ver shared-pool-backend.mjs).
  SHARED_POOL_SETTING: "sharedPoolSetting"
};

export const POOL_MODES = {
  SHARED: "shared",
  INDIVIDUAL: "individual"
};
