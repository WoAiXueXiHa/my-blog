(() => {
  const layer = document.createElement('div');
  layer.className = 'vect-watermark';
  layer.setAttribute('aria-hidden', 'true');
  const grid = document.createElement('div');
  grid.className = 'vect-watermark-grid';
  for (let index = 0; index < 48; index += 1) {
    const mark = document.createElement('span');
    mark.textContent = 'VECT / FIELD NOTES';
    grid.appendChild(mark);
  }
  layer.appendChild(grid);
  document.body.appendChild(layer);
})();
