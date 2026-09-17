/** Keep enough ascent for a moving target; never request a second air jump. */
export function holdForStomp(
  elapsedMs: number,
  requestedMs: number,
  minimumMs: number,
  horizontalError: number,
  bodyWidth: number
) {
  return (
    elapsedMs < Math.max(requestedMs, minimumMs) ||
    (elapsedMs < 650 && Math.abs(horizontalError) > bodyWidth / 2)
  );
}
