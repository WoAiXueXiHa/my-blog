document.addEventListener('DOMContentLoaded', () => {
  const content = document.querySelector('.post-content');
  if (!content || typeof renderMathInElement !== 'function') return;
  renderMathInElement(content, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  });
});
