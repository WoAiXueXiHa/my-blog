// TOC Sidebar — Scroll Spy + Toggle
(() => {
  const sidebar = document.getElementById('toc-sidebar');
  if (!sidebar) return;

  const toggleBtn = sidebar.querySelector('.toc-toggle');
  const nav = sidebar.querySelector('.toc-nav');
  const links = [...nav.querySelectorAll('a')];

  // ── Toggle 收起/展开 ──
  const STORAGE_KEY = 'toc-sidebar-hidden';

  function applyHidden(hidden) {
    sidebar.setAttribute('aria-hidden', hidden);
    toggleBtn.setAttribute('aria-expanded', !hidden);
    toggleBtn.setAttribute('aria-label', hidden ? '展开目录' : '收起目录');
  }

  // 恢复上次状态
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'true') applyHidden(true);

  toggleBtn.addEventListener('click', () => {
    const hidden = sidebar.getAttribute('aria-hidden') === 'true';
    const next = !hidden;
    applyHidden(next);
    localStorage.setItem(STORAGE_KEY, next);
  });

  // ── Scroll Spy: IntersectionObserver ──
  if (links.length === 0) return;

  // 收集所有被目录引用的标题元素
  const headings = links
    .map(a => {
      const id = a.getAttribute('href')?.replace('#', '');
      if (!id) return null;
      return document.getElementById(id);
    })
    .filter(Boolean);

  if (headings.length === 0) return;

  let observer;

  function handleIntersect(entries) {
    // 找到当前最靠近视口顶部的可见标题
    let activeHeading = null;

    for (const entry of entries) {
      if (entry.isIntersecting) {
        // 取最靠上的那个（如果有多个同时 intersecting）
        if (!activeHeading || entry.boundingClientRect.top < activeHeading.boundingClientRect.top) {
          activeHeading = entry;
        }
      }
    }

    if (!activeHeading) {
      // 所有标题都不在视口内，检查是否已滚动过第一个标题
      const first = headings[0];
      if (first && window.scrollY < first.offsetTop - 100) {
        links.forEach(a => a.classList.remove('active'));
      }
      return;
    }

    // 移除所有 active，给当前标题对应的链接加 active
    const activeId = activeHeading.target.id;
    links.forEach(a => {
      const href = a.getAttribute('href')?.replace('#', '');
      a.classList.toggle('active', href === activeId);
    });
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '-80px 0px -70% 0px',
      threshold: 0,
    });
    headings.forEach(h => observer.observe(h));
  }

  // ── 点击平滑滚动 ──
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')?.replace('#', '');
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // 小屏下点击后自动收起（可选）
      if (window.innerWidth < 1024) {
        applyHidden(true);
      }
    });
  });
})();
