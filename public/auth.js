const config = await fetch('/api/config').then(response => response.json()).catch(() => ({}));
const hint = document.querySelector('#hint');
if (config.searchAccessMode === 'workspace') {
  if (hint) hint.firstChild.textContent = 'Workspace search requires sign-in and FlightStory membership. GPT Spark sends your question and matched excerpts to OpenAI. ';
  const coverageLabel = document.querySelector('[data-coverage-label]');
  if (coverageLabel) coverageLabel.textContent = 'WORKSPACE SEARCH';
  const demoSearchCount = document.querySelector('[data-demo-search-count]');
  if (demoSearchCount) demoSearchCount.hidden = true;
  if (!config.insforgeUrl || !config.insforgeAnonKey) {
    const status = document.querySelector('.status');
    if (status) status.innerHTML = '<span></span> Workspace sign-in unavailable';
  } else {
  const style = document.createElement('style');
  style.textContent = '.auth-button{border:1px solid rgba(199,167,255,.38);color:#c7a7ff;background:rgba(199,167,255,.06);padding:9px 12px;border-radius:999px;font:10px DM Mono,monospace;cursor:pointer}.auth-button:hover{border-color:#c7a7ff;color:#f3f0ed}';
  document.head.appendChild(style);
  const { createClient } = await import('https://esm.sh/@insforge/sdk@1.5.2');
  const insforge = createClient({ baseUrl: config.insforgeUrl, anonKey: config.insforgeAnonKey });
  window.flightstoryAuth = { getAccessToken: () => insforge.getHttpClient().getValidAccessToken() };
  const nav = document.querySelector('.topbar nav');
  const button = document.createElement('button');
  button.className = 'auth-button';
  button.type = 'button';
  nav?.appendChild(button);
  const { data } = await insforge.auth.getCurrentUser().catch(() => ({ data: { user: null } }));
  if (data?.user) {
    window.flightstoryAuth = { searchAccessMode: config.searchAccessMode, user: data.user, getAccessToken: () => insforge.getHttpClient().getValidAccessToken() };
    const { initSharedReview } = await import('./shared-review.js');
    await initSharedReview(window.flightstoryAuth);
    button.textContent = `Signed in · ${data.user.profile?.name || data.user.email}`;
    const status = document.querySelector('.status');
    if (status) status.innerHTML = '<span></span> Membership checked on search';
    button.addEventListener('click', async () => { await insforge.auth.signOut(); location.reload(); });
  } else {
    button.textContent = 'Sign in to search';
    button.addEventListener('click', async () => { button.textContent = 'Opening GitHub…'; await insforge.auth.signInWithOAuth('github', { redirectTo: location.origin }); });
  }
  }
} else if (hint) {
  hint.firstChild.textContent = 'Search indexed conversations for moments to publish. GPT Spark · fast OpenAI pass when configured. ';
}
