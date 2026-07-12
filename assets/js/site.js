(() => {
  const root = document.documentElement;
  const meta = document.getElementById('vect-theme-color');
  const themeButton = document.getElementById('vect-theme');
  const themeIcon = themeButton?.querySelector('[data-theme-icon]');
  const system = matchMedia('(prefers-color-scheme: dark)');
  const modes = ['auto', 'light', 'dark'];
  const labels = { auto: '跟随系统', light: '浅色', dark: '深色' };
  const icons = { auto: '◐', light: '☀', dark: '☾' };

  const applyTheme = value => {
    const mode = modes.includes(value) ? value : 'auto';
    root.dataset.theme = mode;
    const dark = mode === 'dark' || (mode === 'auto' && system.matches);
    if (themeIcon) themeIcon.textContent = icons[mode];
    themeButton?.setAttribute('title', `颜色模式：${labels[mode]}`);
    meta?.setAttribute('content', dark ? '#151a17' : '#f2efe6');
  };
  let theme = localStorage.getItem('vect-theme') || 'auto';
  applyTheme(theme);
  themeButton?.addEventListener('click', () => {
    theme = modes[(modes.indexOf(theme) + 1) % modes.length];
    if (theme === 'auto') localStorage.removeItem('vect-theme'); else localStorage.setItem('vect-theme', theme);
    applyTheme(theme);
  });
  system.addEventListener?.('change', () => theme === 'auto' && applyTheme(theme));

  const menuButton = document.querySelector('.vect-menu-button');
  const menu = document.getElementById('menu');
  const setMenu = open => {
    menu?.classList.toggle('is-open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    menuButton?.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  };
  menuButton?.addEventListener('click', () => setMenu(!menu?.classList.contains('is-open')));

  const dialog = document.querySelector('.vect-search');
  const input = document.getElementById('vect-search-input');
  const results = document.querySelector('.vect-search-results');
  let searchData = null;
  let fuse = null;
  let selected = -1;
  let previousFocus = null;
  const escapeHTML = value => value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const closeSearch = () => { if (!dialog) return; dialog.hidden = true; document.body.classList.remove('vect-modal-open'); previousFocus?.focus(); };
  const openSearch = async () => {
    if (!dialog) return;
    previousFocus = document.activeElement;
    dialog.hidden = false;
    document.body.classList.add('vect-modal-open');
    input?.focus();
    if (!searchData) {
      searchData = await fetch('/index.json').then(r => r.json()).catch(() => []);
      if (typeof Fuse === 'function') fuse = new Fuse(searchData, { keys: [{name:'title',weight:0.45},{name:'topic',weight:0.2},{name:'summary',weight:0.2},{name:'content',weight:0.15}], threshold: 0.38, ignoreLocation: true });
    }
  };
  const renderResults = query => {
    if (!results || !searchData) return;
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = terms.length ? (fuse ? fuse.search(query, { limit: 8 }).map(result => ({ item: result.item })) : searchData.filter(item => `${item.title} ${item.summary} ${item.content} ${item.topic}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,8).map(item => ({item}))) : [];
    selected = matches.length ? 0 : -1;
    results.innerHTML = matches.map(({item}, index) => `<li role="option" aria-selected="${index === selected}"><a href="${item.permalink}"><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.summary || item.content || '')}</span><small>${escapeHTML(item.topic || item.section || '文章')}</small></a></li>`).join('') || (terms.length ? '<li class="is-empty">没有找到匹配内容，换个关键词试试。</li>' : '');
  };
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', openSearch));
  document.querySelectorAll('[data-search-close]').forEach(button => button.addEventListener('click', closeSearch));
  input?.addEventListener('input', () => renderResults(input.value));
  document.addEventListener('keydown', event => {
    const shortcut = (event.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName)) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
    if (shortcut) { event.preventDefault(); openSearch(); return; }
    if (dialog?.hidden !== false) return;
    if (event.key === 'Escape') closeSearch();
    const options = [...results.querySelectorAll('[role="option"]')];
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
      event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
    }
    if (event.key === 'Enter' && selected >= 0) options[selected]?.querySelector('a')?.click();
  });

  const progress = document.querySelector('.vect-reading-progress i');
  const article = document.querySelector('.post-content');
  if (progress && article) addEventListener('scroll', () => {
    const start = article.offsetTop;
    const distance = Math.max(1, article.offsetHeight - innerHeight);
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, (scrollY - start) / distance))})`;
  }, { passive: true });
})();
