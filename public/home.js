/* CoffeeHouse home page — login, theme toggle, dialogs */
'use strict';

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ── Theme toggle ── */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('ch-theme', theme); } catch (e) {}
    $$('.theme-toggle button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.themeChoice === theme);
    });
  }

  $$('.theme-toggle button').forEach((b) => {
    b.addEventListener('click', () => applyTheme(b.dataset.themeChoice));
  });

  applyTheme(document.documentElement.dataset.theme || 'light');

  /* ── Account dialog ── */
  const accountDialog = $('#accountDialog');
  const schoolForm = $('#schoolForm');
  const devForm = $('#devForm');
  const loginBtn = $('#loginBtn');
  const googleLogin = $('#googleLogin');
  const loginStatus = $('#loginStatus');
  let signedIn = false;

  async function loadCommunities() {
    const select = $('#schoolSelect');
    const joinButton = schoolForm.querySelector('button');
    joinButton.disabled = true;
    select.innerHTML = '<option value="" disabled selected>Loading communities…</option>';
    try {
      const schools = await api('/api/schools');
      select.innerHTML = '<option value="" disabled selected>Choose a community</option>' + schools
        .map(s => '<option value="' + s.id + '" ' + (s.available ? '' : 'disabled') + '>' + esc(s.name) + (s.available ? '' : ' — setup pending') + '</option>').join('');
      if (!schools.length) {
        select.innerHTML = '<option value="" disabled selected>No communities yet</option>';
        loginStatus.textContent = signedIn ? 'Create a community to get started.' : 'Sign in to create the first community.';
      } else if (!schools.some(s => s.available)) {
        loginStatus.textContent = 'These communities are being set up. ' + (signedIn ? 'You can also create your own.' : 'Sign in to create your own.');
      }
    } catch (error) {
      select.innerHTML = '<option value="" disabled selected>Communities unavailable</option>';
      loginStatus.textContent = 'Could not load communities: ' + error.message;
    }
  }

  $('#schoolSelect').addEventListener('change', () => {
    schoolForm.querySelector('button').disabled = !signedIn || !$('#schoolSelect').value;
  });

  function openDialog(d) {
    if (d && typeof d.showModal === 'function') d.showModal();
  }
  function closeDialog(d) {
    if (d && typeof d.close === 'function') d.close();
  }

  $$('.close-dialog').forEach((b) => {
    b.addEventListener('click', () => closeDialog(b.closest('dialog')));
  });
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d) closeDialog(d);
    });
    d.addEventListener('cancel', () => closeDialog(d));
  });

  /* ── Events dialog ── */
  const eventsBtn = $('#eventsBtn');
  const eventsDialog = $('#eventsDialog');
  if (eventsBtn && eventsDialog) {
    eventsBtn.addEventListener('click', () => openDialog(eventsDialog));
  }

  /* ── Config & Auth ── */
  let CFG = null;

  async function boot() {
    try {
      CFG = await api('/api/config');
    } catch (e) {
      CFG = { firebaseConfigured: false, devLogin: false };
      loginStatus.textContent = 'Could not load sign-in settings. Refresh to retry.';
    }

    /* Show/hide dev form */
    if (CFG.devLogin) {
      devForm.hidden = false;
    }

    /* Check if already logged in */
    try {
      const me = await api('/api/me');
      showLoggedIn(me);
      if (new URLSearchParams(location.search).has('login')) await openSchoolPicker(me.user);
      return;
    } catch (e) {
      /* not logged in */
    }

    // Visitors can browse the same catalog before signing in.
    schoolForm.hidden = false;
    $('#schoolPassword').closest('label').hidden = true;
    schoolForm.querySelector('button').hidden = true;
    loadCommunities();

    /* Set up Firebase */
    if (CFG.firebaseConfigured && window.firebase) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
        googleLogin.addEventListener('click', signInWithGoogle);
      } catch (e) {
        loginStatus.textContent = 'Firebase setup failed: ' + e.message;
      }
    } else {
      googleLogin.disabled = true;
      googleLogin.textContent = 'Google sign-in unavailable';
      loginStatus.textContent = 'Google sign-in could not load. Please refresh and try again.';
    }

    /* Open login dialog when login button clicked */
    loginBtn.addEventListener('click', () => openDialog(accountDialog));
    if (new URLSearchParams(location.search).has('login')) openDialog(accountDialog);
  }

  $$('[data-login]').forEach(b => b.addEventListener('click', () => loginBtn.click()));

  function showLoggedIn(me) {
    signedIn = true;
    loginBtn.innerHTML = '<svg aria-hidden="true"><use href="#user"/></svg><span>' + esc(me.user.name) + '</span>';
    loginBtn.addEventListener('click', () => {
      if (me.school) {
        enterStudentHall();
      } else {
        openSchoolPicker(me.user);
      }
    });
  }

  async function signInWithGoogle() {
    if (googleLogin.disabled) return;
    googleLogin.disabled = true;
    googleLogin.setAttribute('aria-busy', 'true');
    googleLogin.textContent = 'Signing in...';
    loginStatus.textContent = '';
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const idToken = await result.user.getIdToken();
      const data = await api('/api/auth/firebase', { method: 'POST', body: { idToken } });
      afterLogin(data);
    } catch (err) {
      loginStatus.textContent = 'Sign-in failed: ' + err.message;
      googleLogin.disabled = false;
      googleLogin.removeAttribute('aria-busy');
      googleLogin.textContent = 'Continue with Google';
    }
  }

  /* Dev login */
  devForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#devEmail').value.trim();
    const name = $('#devName').value.trim();
    if (!email) return;
    try {
      const data = await api('/api/auth/dev', { method: 'POST', body: { email, name } });
      afterLogin(data);
    } catch (err) {
      loginStatus.textContent = 'Dev login failed: ' + err.message;
    }
  });

  function enterStudentHall() {
    loginStatus.textContent = 'Signed in. Opening Student Hall…';
    location.assign('/student.html');
  }

  function afterLogin(data) {
    if (data.school) {
      enterStudentHall();
    } else {
      closeDialog(accountDialog);
      openSchoolPicker(data.user);
    }
  }

  async function openSchoolPicker(user) {
    signedIn = true;
    schoolForm.hidden = false;
    $('#schoolPassword').closest('label').hidden = false;
    schoolForm.querySelector('button').hidden = false;
    const createLink=$('#createCommunityLink');if(createLink)createLink.hidden=false;
    googleLogin.hidden = true;
    devForm.hidden = true;
    loginStatus.textContent = '';
    openDialog(accountDialog);
    $('#accountHint').textContent =
      'Welcome, ' + (user.name || 'student') + '! Pick your community and enter the password.';
    await loadCommunities();
  }

  schoolForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = schoolForm.querySelector('button');
    if (button.disabled) return;
    const password = $('#schoolPassword').value;
    if (!password) { loginStatus.textContent = 'Please enter the community password.'; return; }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Joining…';
    loginStatus.textContent = 'Joining your community…';
    try {
      await api('/api/school/join', {
        method: 'POST',
        body: { schoolId: Number($('#schoolSelect').value), password },
      });
      enterStudentHall();
    } catch (err) {
      loginStatus.textContent = 'Could not join: ' + err.message;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Join your community';
    }
  });

  /* ── Scroll reveal ── */
  const reveals = $$('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  boot();
})();
