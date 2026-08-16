export function computeAutoTrack(input: {
  isBought: boolean;
  autoTrackStock: boolean;
  stockUpdated: boolean;
  quantity: number;
}): { stockDelta: number | null; stockUpdated: boolean } {
  const { isBought, autoTrackStock, stockUpdated, quantity } = input;
  if (isBought && autoTrackStock && !stockUpdated) {
    return { stockDelta: quantity, stockUpdated: true };
  }
  if (!isBought && stockUpdated) {
    return { stockDelta: -quantity, stockUpdated: false };
  }
  return { stockDelta: null, stockUpdated };
}
