import { PLANET_RADIUS } from './planet.js';

export const PIN_HEIGHT_ABOVE_PLANET = 0.03;
export const PIN_RADIUS = PLANET_RADIUS + PIN_HEIGHT_ABOVE_PLANET;

export const PIN_STYLES = {
  main: { stickRadius: 0.004, stickHeight: 0.18, dotRadius: 0.017, dotSegments: 14, color: 0x86c3f9 },
  secondary: { stickRadius: 0.002, stickHeight: 0.1, dotRadius: 0.01, dotSegments: 8, color: 0x008DFB },
};
