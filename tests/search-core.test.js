const test = require('node:test');
const assert = require('node:assert/strict');
const search = require('../assets/js/search-core.js');

const items = [
  { title: 'Go 中的字符串', tags: ['Go', 'string'], headings: ['内存共享'], summary: 'UTF-8 与底层表示', type: 'article', lastmod: '2026-07-12' },
  { title: '大模型入门', tags: ['AI', 'LLM'], headings: ['Transformer 与注意力机制'], summary: '认识大语言模型', excerpt: '示例提到 Redis 数据库和 string，但它们不是本文主题', type: 'article', lastmod: '2026-07-13' },
  { title: '链表', tags: ['数据结构'], summary: '指针结构', type: 'article', lastmod: '2026-07-10' },
  { title: '训练方法', tags: ['机器学习'], summary: 'training details', type: 'article', lastmod: '2026-07-09' },
];

test('normalizes punctuation, case and width', () => {
  assert.equal(search.normalize('  Ｇｏ—STRING  '), 'go string');
});

test('matches Chinese and English aliases', () => {
  assert.equal(search.search(items, '字符串')[0].item.title, 'Go 中的字符串');
  assert.equal(search.search(items, '大模型')[0].item.title, '大模型入门');
});

test('requires every keyword across weighted fields', () => {
  assert.equal(search.search(items, 'Go 内存').length, 1);
  assert.equal(search.search(items, 'Go 推理').length, 0);
});

test('does not recall results from incidental body excerpt mentions', () => {
  assert.equal(search.search(items, '数据库').length, 0);
  assert.equal(search.search(items, '字符串').length, 1);
});

test('uses token boundaries for short latin keywords', () => {
  const matches = search.search(items, 'AI');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].item.title, '大模型入门');
});

test('returns matched fields for explainable results', () => {
  const match = search.search(items, 'Transformer')[0];
  assert.deepEqual(match.matchedFields, ['headings']);
});

test('returns stable suggestions from article tags', () => {
  const suggestions = search.topSuggestions(items, 6);
  assert.equal(suggestions.length, 6);
  assert.ok(suggestions.includes('Go'));
  assert.ok(suggestions.includes('LLM'));
});
