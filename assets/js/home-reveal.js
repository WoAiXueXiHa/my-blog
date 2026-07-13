(() => {
  const home = document.querySelector('[data-vect-home]');
  if (!home) return;
  const reveals = [...home.querySelectorAll('.vect-reveal')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    reveals.forEach(element => element.classList.add('is-visible'));
    return;
  }
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }), { threshold: 0.08 });
  reveals.forEach(element => observer.observe(element));
})();
