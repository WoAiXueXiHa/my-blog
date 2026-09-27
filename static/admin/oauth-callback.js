(() => {
  const payload = JSON.parse(decodeURIComponent(location.hash.slice(1) || '{}'));
  if (!payload.error && !payload.token) payload.error = 'Missing GitHub token.';
  history.replaceState(null, '', location.pathname);
  if (!window.opener) {
    document.body.textContent = '请从文章管理页面重新登录。';
    return;
  }
  const origin = location.origin;
  const handshake = 'authorizing:github';
  const onMessage = (event) => {
    if (event.source !== window.opener || event.origin !== origin || event.data !== handshake) return;
    window.removeEventListener('message', onMessage);
    const result = payload.error
      ? `authorization:github:error:${JSON.stringify({ message: payload.error })}`
      : `authorization:github:success:${JSON.stringify({ token: payload.token, provider: 'github' })}`;
    window.opener.postMessage(result, origin);
  };
  window.addEventListener('message', onMessage);
  window.opener.postMessage(handshake, origin);
})();
