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
    themeButton?.setAttribute('aria-label', `颜色模式：${labels[mode]}，点击切换`);
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
  menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));

  const dialog = document.querySelector('.vect-search');
  const panel = dialog?.querySelector('.vect-search-panel');
  const input = document.getElementById('vect-search-input');
  const results = document.querySelector('.vect-search-results');
  const suggestions = document.querySelector('.vect-search-suggestions');
  const status = document.querySelector('.vect-search-status');
  let searchData = null;
  let selected = -1;
  let previousFocus = null;

  const typeLabel = item => ({ article: '文章', topic: '知识板块', path: '学习路径', page: '页面' }[item.type] || '内容');
  const fieldLabel = key => ({ title: '标题', tags: '标签', keywords: '关键词', series: '系列', headings: '目录', categories: '分类', topic: '板块', summary: '摘要' }[key] || key);
  const setStatus = message => { if (status) status.textContent = message; };
  const clearNode = node => { while (node?.firstChild) node.removeChild(node.firstChild); };

  const renderSuggestions = () => {
    if (!suggestions || !searchData) return;
    clearNode(suggestions);
    const label = document.createElement('span');
    label.textContent = '推荐关键词';
    suggestions.append(label);
    VectSearch.topSuggestions(searchData).forEach(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value;
      button.addEventListener('click', () => { input.value = value; renderResults(value); input.focus(); });
      suggestions.append(button);
    });
  };

  const renderResults = query => {
    if (!results || !searchData) return;
    clearNode(results);
    const normalized = VectSearch.normalize(query);
    suggestions?.toggleAttribute('hidden', Boolean(normalized));
    if (!normalized) { selected = -1; setStatus('输入关键词开始搜索'); return; }
    const matches = VectSearch.search(searchData, query, { limit: 8 });
    selected = matches.length ? 0 : -1;
    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      const strong = document.createElement('strong'); strong.textContent = '没有找到匹配内容';
      const text = document.createElement('p'); text.textContent = '试试更短的关键词，或点击上方推荐词。';
      empty.append(strong, text); results.append(empty); setStatus('0 条结果'); return;
    }
    matches.forEach(({ item, matchedFields }, index) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(index === selected));
      const link = document.createElement('a'); link.href = item.permalink;
      const title = document.createElement('b'); title.textContent = item.title;
      const summary = document.createElement('span'); summary.textContent = item.summary || item.excerpt || '';
      const type = document.createElement('small');
      const reasons = matchedFields.slice(0, 2).map(fieldLabel).join('、');
      type.textContent = reasons ? `${typeLabel(item)} · 命中${reasons}` : typeLabel(item);
      link.append(title, summary, type); li.append(link); results.append(li);
    });
    setStatus(`${matches.length} 条结果`);
  };

  const loadSearch = async () => {
    if (searchData) return;
    setStatus('正在加载搜索索引');
    searchData = await fetch('/index.json').then(response => {
      if (!response.ok) throw new Error(`search index ${response.status}`);
      return response.json();
    }).catch(() => []);
    renderSuggestions();
    setStatus(searchData.length ? '输入关键词开始搜索' : '搜索暂时不可用');
  };

  const openSearch = async () => {
    if (!dialog) return;
    previousFocus = document.activeElement;
    dialog.hidden = false; document.body.classList.add('vect-modal-open');
    await loadSearch(); input?.focus(); renderResults(input?.value || '');
  };
  const closeSearch = () => {
    if (!dialog) return;
    dialog.hidden = true; document.body.classList.remove('vect-modal-open'); previousFocus?.focus();
  };
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', openSearch));
  document.querySelectorAll('[data-search-close]').forEach(button => button.addEventListener('click', closeSearch));
  document.querySelectorAll('[data-search-seed]').forEach(button => button.addEventListener('click', async () => {
    await openSearch();
    if (!input) return;
    input.value = button.dataset.searchSeed || '';
    renderResults(input.value);
  }));
  input?.addEventListener('input', () => renderResults(input.value));
  dialog?.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !panel) return;
    const focusable = [...panel.querySelectorAll('button:not([hidden]),input,a[href]')].filter(element => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', event => {
    const shortcut = (event.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName)) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
    if (shortcut) { event.preventDefault(); openSearch(); return; }
    if (dialog?.hidden !== false) return;
    if (event.key === 'Escape') { closeSearch(); return; }
    const options = [...results.querySelectorAll('[role="option"]')];
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
      event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
      options[selected].scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && selected >= 0) options[selected]?.querySelector('a')?.click();
  });

  const setupCollection = ({ rootSelector, inputSelector, itemSelector, chipSelector, emptySelector, countSelector }) => {
    const collection = document.querySelector(rootSelector);
    if (!collection) return;
    const field = collection.querySelector(inputSelector);
    const items = [...collection.querySelectorAll(itemSelector)];
    const chips = [...collection.querySelectorAll(chipSelector)];
    const empty = collection.querySelector(emptySelector);
    const count = collection.querySelector(countSelector);
    let filter = 'all';
    const update = () => {
      const query = VectSearch.normalize(field?.value || '');
      let visible = 0;
      items.forEach(item => {
        const matchesFilter = filter === 'all' || (item.dataset.filters || '').split('|').includes(filter);
        const matchesQuery = !query || VectSearch.normalize(item.dataset.search || item.textContent).includes(query);
        item.hidden = !(matchesFilter && matchesQuery); if (!item.hidden) visible += 1;
      });
      if (empty) empty.hidden = visible > 0;
      if (count) count.textContent = `${visible} 条内容`;
    };
    chips.forEach(chip => chip.addEventListener('click', () => {
      filter = chip.dataset.filter || 'all'; chips.forEach(item => item.classList.toggle('is-active', item === chip)); update();
    }));
    field?.addEventListener('input', update); update();
  };
  setupCollection({ rootSelector: '[data-topic-browser]', inputSelector: '[data-topic-search]', itemSelector: '[data-topic-item]', chipSelector: '[data-filter]', emptySelector: '[data-empty]', countSelector: '[data-result-count]' });
  setupCollection({ rootSelector: '[data-post-browser]', inputSelector: '[data-post-search]', itemSelector: '[data-post-item]', chipSelector: '[data-filter]', emptySelector: '[data-empty]', countSelector: '[data-result-count]' });

  const progress = document.querySelector('.vect-reading-progress i');
  const article = document.querySelector('.post-content');
  if (progress && article) addEventListener('scroll', () => {
    const start = article.offsetTop;
    const distance = Math.max(1, article.offsetHeight - innerHeight);
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, (scrollY - start) / distance))})`;
  }, { passive: true });
})();
