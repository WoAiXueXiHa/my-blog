const addCopyButton = (container, code) => {
  if (!container || !code || container.querySelector(':scope > .copy-code')) return;
  const button = document.createElement('button');
  button.className = 'copy-code';
  button.type = 'button';
  button.textContent = '复制';
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent || '');
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = '复制'; }, 1600);
  });
  container.appendChild(button);
};

document.querySelectorAll('.post-content .highlight').forEach(highlight => {
  const code = highlight.querySelector('code[data-lang], td:last-child pre > code, pre > code');
  addCopyButton(highlight, code);
});

document.querySelectorAll('.post-content pre > code').forEach(code => {
  if (code.closest('.highlight')) return;
  addCopyButton(code.closest('pre'), code);
});
