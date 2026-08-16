let counter = 0;

export const uid = () => {
  counter += 1;
  return `e-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
};

export const docId = () =>
  `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;