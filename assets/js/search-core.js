(function (root, factory) {
  const api = factory();
  root.VectSearch = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const aliasGroups = [
    ['go', 'golang', 'go语言'],
    ['string', '字符串'],
    ['slice', '切片'],
    ['utf8', 'utf-8', 'unicode'],
    ['llm', '大模型', 'large language model'],
    ['ai', '人工智能'],
    ['heap', '堆', '优先队列'],
    ['linkedlist', 'linked list', '链表'],
  ];

  const fields = [
    { key: 'title', weight: 32, strength: 4 },
    { key: 'tags', weight: 26, strength: 4 },
    { key: 'keywords', weight: 24, strength: 4 },
    { key: 'series', weight: 20, strength: 3 },
    { key: 'headings', weight: 16, strength: 3 },
    { key: 'categories', weight: 14, strength: 3 },
    { key: 'topic', weight: 12, strength: 3 },
    { key: 'summary', weight: 7, strength: 2 },
  ];

  const normalize = value => String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/([\p{L}\p{N}])[-_]+(?=[\p{L}\p{N}])/gu, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const variantsFor = term => {
    const normalized = normalize(term);
    const group = aliasGroups.find(values => values.some(value => normalize(value) === normalized));
    return group ? [...new Set(group.map(normalize))] : [normalized];
  };

  const fieldText = (item, key) => normalize(Array.isArray(item[key]) ? item[key].join(' ') : item[key]);
  const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isLatin = value => /^[a-z0-9 ]+$/.test(value);
  const contains = (text, value) => {
    if (!text || !value) return false;
    if (!isLatin(value)) return text.includes(value);
    const phrase = escapeRegExp(value).replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${phrase}(?=$|[^a-z0-9])`, 'i').test(text);
  };

  const matchesForTerm = (item, term) => {
    const variants = variantsFor(term);
    return fields.flatMap(field => {
      const text = fieldText(item, field.key);
      const variant = variants.find(value => contains(text, value));
      return variant ? [{ ...field, text, variant, exact: text === variant }] : [];
    });
  };

  function search(items, query, options = {}) {
    const normalizedQuery = normalize(query);
    const terms = normalizedQuery.split(' ').filter(Boolean);
    if (!terms.length) return [];
    const scope = options.scope || null;

    return items.flatMap((item, originalIndex) => {
      if (scope && item.topic !== scope && item.section !== scope) return [];
      const termMatches = terms.map(term => matchesForTerm(item, term));
      // Every term must appear in an intentional metadata/summary field.
      // The body excerpt is preview-only and never qualifies a result by itself.
      if (termMatches.some(matches => !matches.length)) return [];

      let score = 0;
      const matchedFields = new Set();
      termMatches.forEach(matches => matches.forEach(match => {
        matchedFields.add(match.key);
        score += match.weight;
        if (match.exact) score += match.weight;
        else if (match.text.startsWith(match.variant)) score += Math.ceil(match.weight / 2);
      }));

      const title = fieldText(item, 'title');
      if (contains(title, normalizedQuery)) score += 48;
      if (terms.length > 1 && matchedFields.size === 1) score += 8;
      return [{ item, score, matchedFields: [...matchedFields], originalIndex }];
    }).sort((a, b) => b.score - a.score || String(b.item.lastmod).localeCompare(String(a.item.lastmod)) || a.originalIndex - b.originalIndex)
      .slice(0, options.limit || 8);
  }

  function topSuggestions(items, limit = 6) {
    const counts = new Map();
    items.filter(item => item.type === 'article').forEach(item => {
      [...(item.tags || []), ...(item.categories || [])].forEach(value => {
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });
    });
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).slice(0, limit).map(([label]) => label);
  }

  return { normalize, search, topSuggestions };
});
