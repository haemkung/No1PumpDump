export const momentumWatchMs = 20 * 60_000;

export function momentumBreakout(seed, bars, now) {
  const window = bars.filter(bar => bar.end < now).slice(-21);
  if (window.length !== 21 || window.some((bar, i) =>
    ![bar.time, bar.end, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) ||
    bar.low <= 0 || bar.high < bar.close || bar.low > bar.close || bar.volume < 0 ||
    bar.end !== bar.time + 59999 || (i > 0 && bar.time !== window[i - 1].time + 60000)
  )) return null;

  const trigger = window.at(-1);
  if (trigger.time < Date.parse(seed.seededAt) || now - trigger.end > 75_000) return null;
  const base = window.slice(0, -1);
  const top = Math.max(...base.map(bar => bar.high));
  const bottom = Math.min(...base.map(bar => bar.low));
  const averageVolume = base.reduce((sum, bar) => sum + bar.volume, 0) / base.length;
  if (!(averageVolume > 0 && trigger.high > trigger.low)) return null;
  const volumeRatio = trigger.volume / averageVolume;
  const long = seed.side === 'LONG';
  const level = long ? top : bottom;
  const closeStrength = long
    ? (trigger.close - trigger.low) / (trigger.high - trigger.low)
    : (trigger.high - trigger.close) / (trigger.high - trigger.low);
  if (volumeRatio < 2 || closeStrength < .75 || (long ? trigger.close <= level : trigger.close >= level)) return null;
  const stop = long ? Math.min(level, trigger.low) * .999 : Math.max(level, trigger.high) * 1.001;
  return {
    seed: {...seed, level, features: {volumeRatio, closeStrength}},
    confirmation: {status:'confirmed', confirmedAt:trigger.end, stop, reference:trigger.close,
      breakoutCandle:trigger, priorRange:{top,bottom}, volumeRatio, closeStrength}
  };
}
