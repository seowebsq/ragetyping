// Keystrokes-per-second thresholds per rage level, ported from RageType (MIT):
// https://github.com/MateiCysec/ragetype
export const RAGE_KPS = [0, 4, 7, 11, 16, 22];
export const RAGE_NAMES = ["calm", "annoyed", "heated", "furious", "unhinged", "MELTDOWN"];

export const rageLevel = (kps: number) => RAGE_KPS.findLastIndex((t) => kps >= t);
