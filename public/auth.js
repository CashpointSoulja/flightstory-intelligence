const config = await fetch('/api/config').then(response => response.json()).catch(() => ({}));
if (config.insforgeUrl && config.insforgeAnonKey) {
  const style = document.createElement('style');
  style.textContent = '.auth-button{border:1px solid rgba(199,167,255,.38);color:#c7a7ff;background:rgba(199,167,255,.06);padding:9px 12px;border-radius:999px;font:10px DM Mono,monospace;cursor:pointer}.auth-button:hover{border-color:#c7a7ff;color:#f3f0ed}';
  document.head.appendChild(style);
  const { createClient } = await import('https://esm.sh/@insforge/sdk@1.5.2');
  const insforge = createClient({ baseUrl: config.insforgeUrl, anonKey: config.insforgeAnonKey });
  const nav = document.querySelector('.topbar nav');
  const button = document.createElement('button');
  button.className = 'auth-button';
  button.type = 'button';
  nav?.appendChild(button);
  const { data } = await insforge.auth.getCurrentUser().catch(() => ({ data: { user: null } }));
  if (data?.user) {
    button.textContent = `Signed in · ${data.user.profile?.name || data.user.email}`;
    button.addEventListener('click', async () => { await insforge.auth.signOut(); location.reload(); });
  } else {
    button.textContent = 'Sign in with GitHub';
    button.addEventListener('click', async () => { button.textContent = 'Opening GitHub…'; await insforge.auth.signInWithOAuth('github', { redirectTo: location.origin }); });
  }
}
