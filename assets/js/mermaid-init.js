import mermaid from 'mermaid';

const blocks = [...document.querySelectorAll('.post-content pre > code.language-mermaid')];

if (blocks.length) {
  const diagrams = blocks.map((code, index) => {
    const source = code.textContent || '';
    const host = document.createElement('div');
    host.className = 'vect-mermaid';
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', `文章图表 ${index + 1}`);
    const container = code.closest('.highlight') || code.closest('pre');
    container.replaceWith(host);
    return { host, source };
  });

  let version = 0;

  const render = async () => {
    const current = ++version;
    const styles = getComputedStyle(document.documentElement);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: styles.getPropertyValue('--vect-font-body').trim(),
      themeVariables: {
        background: styles.getPropertyValue('--vect-bg').trim(),
        primaryColor: styles.getPropertyValue('--vect-surface').trim(),
        primaryTextColor: styles.getPropertyValue('--vect-text').trim(),
        primaryBorderColor: styles.getPropertyValue('--vect-border').trim(),
        lineColor: styles.getPropertyValue('--vect-accent').trim(),
        secondaryColor: styles.getPropertyValue('--vect-surface-raised').trim(),
        tertiaryColor: styles.getPropertyValue('--vect-code-bg').trim()
      }
    });

    for (const [index, diagram] of diagrams.entries()) {
      try {
        const result = await mermaid.render(`vect-mermaid-${current}-${index}`, diagram.source);
        if (current !== version) return;
        diagram.host.classList.remove('is-error');
        diagram.host.innerHTML = result.svg;
        result.bindFunctions?.(diagram.host);
      } catch (error) {
        diagram.host.classList.add('is-error');
        diagram.host.textContent = diagram.source;
        console.error('Mermaid render failed', error);
      }
    }
  };

  render();
  new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.attributeName === 'data-theme')) render();
  }).observe(document.documentElement, { attributes: true });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.documentElement.dataset.theme === 'auto') render();
  });
}
