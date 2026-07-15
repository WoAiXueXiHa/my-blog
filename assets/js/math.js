document.addEventListener('DOMContentLoaded', () => {
  const roots = document.querySelectorAll('.post-content');
  if (!roots.length || typeof renderMathInElement !== 'function') return;
  const options = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  };
  roots.forEach(root => renderMathInElement(root, options));
});
