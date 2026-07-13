(() => {
  let sessionCode;
  try {
    sessionCode = sessionStorage.getItem('vect-watermark');
    if (!sessionCode) {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      sessionCode = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
      sessionStorage.setItem('vect-watermark', sessionCode);
    }
  } catch (_) {
    sessionCode = Math.random().toString(16).slice(2, 10).toUpperCase();
  }
  const layer = document.createElement('div');
  layer.className = 'vect-watermark';
  layer.setAttribute('aria-hidden', 'true');
  const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai' }).format(new Date()).replaceAll('/', '-');
  layer.dataset.text = `VECT · ${location.host} · ${date} · ${sessionCode}`;
  document.body.appendChild(layer);
})();
