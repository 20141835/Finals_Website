/* Common Ground – shared behavior (loaded on every page, before pages.js)
   Plain JavaScript, no libraries. Accounts and posts are stored in the
   visitor's own browser (localStorage) because there is no server. */
(() => {
  'use strict';

  /* ================= Storage + accounts ================= */
  const CG = (window.CG = {
    read(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    users() { return this.read('cg_users', []); },
    posts() { return this.read('cg_posts', []); },
    user() {
      const email = this.read('cg_session', null);
      return email ? this.users().find((u) => u.email === email) || null : null;
    },

    async hash(password, salt) {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      let h = 5381; // fallback where SubtleCrypto is unavailable
      for (const c of salt + password) h = ((h << 5) + h) ^ c.charCodeAt(0);
      return 'x' + (h >>> 0).toString(16);
    },

    newSalt() {
      if (window.crypto && crypto.getRandomValues) {
        return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    },

    async signUp({ nickname, email, password }) {
      email = email.trim().toLowerCase();
      nickname = nickname.trim();
      const users = this.users();
      if (users.some((u) => u.email === email)) {
        return { ok: false, error: 'An account with this email already exists. Try signing in instead.' };
      }
      if (users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
        return { ok: false, error: 'That nickname is taken. Please choose another.' };
      }
      const salt = this.newSalt();
      users.push({ nickname, email, salt, hash: await this.hash(password, salt), created: Date.now() });
      if (!this.write('cg_users', users) || !this.write('cg_session', email)) {
        return { ok: false, error: 'Your browser is blocking storage, so an account cannot be saved. Try a normal (non-private) window.' };
      }
      return { ok: true };
    },

    async signIn(email, password) {
      email = email.trim().toLowerCase();
      const u = this.users().find((x) => x.email === email);
      const bad = { ok: false, error: 'That email and password don’t match. Please try again.' };
      if (!u) return bad;
      if ((await this.hash(password, u.salt)) !== u.hash) return bad;
      this.write('cg_session', email);
      return { ok: true };
    },

    signOut() {
      try { localStorage.removeItem('cg_session'); } catch (e) { /* ignore */ }
    },

    deleteAccount() {
      const u = this.user();
      if (!u) return;
      this.write('cg_users', this.users().filter((x) => x.email !== u.email));
      this.write('cg_posts', this.posts().filter((p) => p.email !== u.email));
      this.signOut();
    },
  });

  /* ================= Mobile menu ================= */
  const header = document.querySelector('.navbar');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');

  if (header && toggle && nav) {
    const setMenu = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setMenu(!header.classList.contains('nav-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 769px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ================= Signed-in state in the header ================= */
  const me = CG.user();
  if (me) {
    const doSignOut = (e) => {
      e.preventDefault();
      CG.signOut();
      location.href = 'index.html';
    };
    const signInLink = document.querySelector('.nav-actions .sign-in-link');
    const joinBtn = document.querySelector('.nav-actions .btn');
    if (signInLink) {
      signInLink.textContent = 'Hi, ' + me.nickname;
      signInLink.setAttribute('href', 'signin.html');
      signInLink.setAttribute('title', 'Your account');
    }
    if (joinBtn) {
      joinBtn.textContent = 'Sign out';
      joinBtn.setAttribute('href', '#');
      joinBtn.addEventListener('click', doSignOut);
    }
    const mobile = nav ? nav.querySelectorAll('.nav-mobile-only') : [];
    if (mobile[0]) {
      mobile[0].textContent = 'Sign out (' + me.nickname + ')';
      mobile[0].setAttribute('href', '#');
      mobile[0].removeAttribute('aria-current');
      mobile[0].addEventListener('click', doSignOut);
    }
    if (mobile[1]) mobile[1].remove();
  }

  /* ================= Home page: directory search box ================= */
  const form = document.querySelector('.care-search-row');
  const metaBar = document.querySelector('.care-meta-bar');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('care-query').value.trim();
      const region = document.getElementById('care-location').value;
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (region !== 'all') params.set('region', region);
      const qs = params.toString();
      location.href = 'support.html' + (qs ? '?' + qs : '');
    });
  }

  // Filter chips on the home page: hand off to the full directory,
  // except "Verified only", which explains what verified means.
  document.querySelectorAll('.care-filter-btn').forEach((btn) => {
    if (btn.classList.contains('care-verified-btn')) return;
    btn.addEventListener('click', () => { location.href = 'support.html'; });
  });

  const verified = document.querySelector('.care-verified-btn');
  if (verified && metaBar) {
    const note = document.createElement('p');
    note.className = 'care-status';
    note.setAttribute('role', 'status');
    note.hidden = true;
    note.textContent =
      'No provider is marked “verified” yet. Every listing here is an illustrative example. ' +
      'A listing will only show as verified after its credentials are checked from an independent source.';
    metaBar.insertAdjacentElement('afterend', note);
    verified.setAttribute('aria-pressed', 'false');
    verified.addEventListener('click', () => {
      const on = verified.getAttribute('aria-pressed') !== 'true';
      verified.setAttribute('aria-pressed', String(on));
      verified.classList.toggle('is-active', on);
      note.hidden = !on;
    });
  }
})();
