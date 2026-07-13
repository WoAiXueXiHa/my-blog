document.documentElement.classList.add('js');
(() => {
  try {
    const preference = localStorage.getItem('vect-theme');
    document.documentElement.dataset.theme = preference === 'light' || preference === 'dark' ? preference : 'auto';
  } catch (_) {
    document.documentElement.dataset.theme = 'auto';
  }
})();
