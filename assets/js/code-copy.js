document.querySelectorAll('pre > code').forEach(code => {
  const pre = code.closest('pre');
  if (!pre || pre.querySelector('.copy-code')) return;
  const button = document.createElement('button');
  button.className = 'copy-code';
  button.type = 'button';
  button.textContent = '复制';
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent || '');
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = '复制'; }, 1600);
  });
  pre.appendChild(button);
});
