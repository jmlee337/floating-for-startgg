export const singleElimPlacementToTopN = new Map([
  [1, 1],
  [2, 2],
  [3, 4],
  [5, 8],
  [9, 16],
  [17, 32],
  // not possible via web
  [33, 64],
  [65, 128],
  [129, 256],
  [257, 512],
  [513, 1024],
]);

export const losersPlacementToTopN = new Map([
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 6],
  [7, 8],
  [9, 12],
  [13, 16],
  [17, 24],
  [25, 32],
  // not possible via web
  [33, 48],
  [49, 64],
  [65, 96],
  [97, 128],
  [129, 192],
  [193, 256],
  [257, 384],
  [385, 512],
  [513, 768],
  [769, 1024],
]);
