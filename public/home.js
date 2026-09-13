/* Visible, keyboard-accessible home-page controls. No screenshot hotspots. */
'use strict';
const byId = id => document.getElementById(id);
let currentUser = null;
let configuration;
let destination = '/student.html';
const account = byId('accountDialog');
function setTheme(theme) {
  theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#121132' : '#3d261a';
  try { localStorage.setItem('ch-theme', theme); } catch (_) {}
}
setTheme(document.documentElement.dataset.theme);
document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.themeChoice)));
window.addEventListener('storage', event => { if (event.key === 'ch-theme') setTheme(event.newValue); });
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
byId('eventsBtn').addEventListener('click', () => byId('eventsDialog').showModal());
const configReady = api('/api/config').then(config => {
  configuration = config;
  byId('devForm').hidden = !config.devLogin;
  byId('googleLogin').hidden = !config.firebaseConfigured;
  if (config.firebaseConfigured && window.firebase) firebase.initializeApp(config.firebase);
  return config;
}).catch(() => null);
const userReady = api('/api/me').then(me => {
  currentUser = me;
  byId('loginBtn').querySelector('span').textContent = me.school ? 'Enter Hall' : 'Join school';
  return me;
}).catch(() => null);
async function chooseSchool(user) {
  byId('accountTitle').textContent = 'Find your community';
  byId('accountHint').textContent = 'Welcome, ' + (user.name || 'friend') + '! Choose your school to get started.';
  byId('googleLogin').hidden = true;
  byId('devForm').hidden = true;
  const schools = await api('/api/schools');
  byId('schoolSelect').replaceChildren(...schools.map(school => {
    const option = document.createElement('option');
    option.value = school.id; option.textContent = school.name; return option;
  }));
  byId('schoolForm').hidden = false;
  if (!schools.length) byId('loginStatus').textContent = 'No schools are available yet. Please contact your school administrator.';
}
async function openAccount(target = '/student.html') {
  destination = target;
  await userReady;
  if (currentUser && currentUser.school) { location.assign(destination); return; }
  if (byId('eventsDialog').open) byId('eventsDialog').close();
  account.showModal();
  byId('loginStatus').textContent = 'Connecting…';
  try {
    if (currentUser) await chooseSchool(currentUser.user);
    else {
      const config = await configReady;
      if (!config) throw new Error('Sign-in is temporarily unavailable. Please try again shortly.');
      if (!config.firebaseConfigured && !config.devLogin) throw new Error('Sign-in has not been enabled for this café yet.');
    }
    byId('loginStatus').textContent = '';
  } catch (error) { byId('loginStatus').textContent = error.message; }
}
byId('loginBtn').addEventListener('click', () => openAccount());
document.querySelectorAll('a[href^="/student.html"],a[href="/ai-assistant.html"],a[href="/settings.html"]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    openAccount(link.getAttribute('href'));
  });
});
async function afterLogin(data) {
  currentUser = data;
  if (data.school) { location.assign(destination); return; }
  await chooseSchool(data.user);
}
async function busy(button, operation) {
  button.disabled = true; byId('loginStatus').textContent = '';
  try { await operation(); }
  catch (error) { byId('loginStatus').textContent = error.message || 'Something went wrong. Please try again.'; }
  finally { button.disabled = false; }
}
byId('googleLogin').addEventListener('click', event => busy(event.currentTarget, async () => {
  if (!window.firebase || !configuration?.firebaseConfigured) throw new Error('Google sign-in could not load. Please refresh and try again.');
  const result = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
  await afterLogin(await api('/api/auth/firebase', { method: 'POST', body: { idToken: await result.user.getIdToken() } }));
}));
byId('devForm').addEventListener('submit', event => {
  event.preventDefault();
  busy(event.submitter, async () => afterLogin(await api('/api/auth/dev', { method: 'POST', body: { email: byId('devEmail').value.trim(), name: byId('devName').value.trim() } })));
});
byId('schoolForm').addEventListener('submit', event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    await api('/api/school/join', { method: 'POST', body: { schoolId: Number(byId('schoolSelect').value) } });
    location.assign(destination);
  });
});
