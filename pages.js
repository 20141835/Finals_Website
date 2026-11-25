/* Common Ground – page behavior (loaded after script.js)
   Filters, community posting, sign in / join, contact form. */
(() => {
  'use strict';

  const CG = window.CG;
  const params = new URLSearchParams(location.search);

  const TOPICS = {
    anxiety: 'Anxiety & stress',
    relationships: 'Relationships',
    therapy: 'Starting therapy',
    wellbeing: 'Everyday wellbeing',
  };

  const CRISIS_WORDS =
    /(kill myself|suicid|end (my life|it all)|want to die|hurt myself|self[- ]?harm|magpakamatay|magpatiwakal|ayoko na (na )?mabuhay)/i;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    kids.forEach((k) => n.append(k));
    return n;
  };

  /* ================= Community: composer + saved posts ================= */
  const refilters = {};
  window.CG_refilter = (id) => { if (refilters[id]) refilters[id](); };

  const threadList = document.querySelector('.forum-thread-list');
  const composerHost = document.getElementById('composer');

  const dateLabel = (ts) =>
    new Date(ts).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

  function postEl(p) {
    const me = CG.user();
    const mine = me && me.email === p.email;
    const meta = el('div', { class: 'forum-thread-meta' },
      el('span', { text: `${p.nick} · ${dateLabel(p.ts)} · Saved on this device` }));
    if (mine) {
      const del = el('button', { type: 'button', class: 'link-btn', text: 'Delete' });
      del.addEventListener('click', () => {
        if (!confirm('Delete this post?')) return;
        CG.write('cg_posts', CG.posts().filter((x) => x.id !== p.id));
        renderPosts();
      });
      meta.append(del);
    }
    const art = el('article', { class: 'forum-thread user-post' },
      el('span', { class: 'forum-topic-badge', text: TOPICS[p.topic] || 'Conversation' }),
      el('h3', { class: 'forum-thread-title', text: p.title }),
      el('p', { class: 'forum-thread-excerpt forum-thread-body', text: p.body }),
      meta);
    art.dataset.filterItem = 'forum';
    art.dataset.cats = p.topic;
    return art;
  }

  function renderPosts() {
    if (!threadList) return;
    threadList.querySelectorAll('.user-post').forEach((n) => n.remove());
    CG.posts().slice().sort((a, b) => a.ts - b.ts).forEach((p) => threadList.prepend(postEl(p)));
    refilters.forum && refilters.forum();
  }

  function renderComposer() {
    if (!composerHost) return;
    const me = CG.user();
    composerHost.textContent = '';

    if (!me) {
      composerHost.append(
        el('h3', { class: 'composer-title', text: 'Want to share something?' }),
        el('p', { class: 'composer-text', text: 'You can read everything without an account. Join with a nickname when you’d like to post.' }),
        el('a', { class: 'btn btn-primary', href: 'signin.html#join', text: 'Join the community' })
      );
      return;
    }

    const topic = el('select', { id: 'post-topic', name: 'topic' });
    Object.entries(TOPICS).forEach(([v, label]) => topic.append(el('option', { value: v, text: label })));
    const title = el('input', { id: 'post-title', name: 'title', type: 'text', maxlength: '100', required: '', placeholder: 'A short title' });
    const body = el('textarea', { id: 'post-body', name: 'body', maxlength: '1500', required: '', placeholder: 'Share what feels comfortable. Leave out names and identifying details.' });
    const alertBox = el('div', { class: 'composer-alert', role: 'alert', tabindex: '-1' });
    alertBox.hidden = true;
    const status = el('p', { class: 'auth-status', role: 'status' });
    status.hidden = true;
    let confirmed = false;

    const f = el('form', { class: 'composer-form', novalidate: '' },
      el('h3', { class: 'composer-title', text: `Share with the community, ${me.nickname}` }),
      el('div', { class: 'composer-row' },
        el('div', { class: 'field' }, el('label', { for: 'post-topic', text: 'Topic' }), topic),
        el('div', { class: 'field' }, el('label', { for: 'post-title', text: 'Title' }), title)),
      el('div', { class: 'field' }, el('label', { for: 'post-body', text: 'Your post' }), body),
      alertBox,
      el('button', { type: 'submit', class: 'btn btn-primary', text: 'Post' }),
      el('p', { class: 'composer-note', text: 'Posts are saved in this browser only. There is no server yet, so no one else can see them. Peer support is not a crisis service.' }),
      status);

    const showCrisis = () => {
      alertBox.textContent = '';
      alertBox.append(
        el('p', {}, el('strong', { text: 'It sounds like things may be very hard right now. ' }),
          'No one monitors this website, so nobody here will see this in time. If you are in danger, call 911. To talk to someone now, call the NCMH crisis hotline at 1553 (24/7).'),
        el('div', { class: 'alert-actions' },
          el('a', { class: 'btn btn-primary', href: 'tel:1553', text: 'Call 1553' }),
          el('a', { class: 'btn btn-secondary', href: 'tel:911', text: 'Call 911' }),
          (() => {
            const b = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Post anyway' });
            b.addEventListener('click', () => { confirmed = true; f.requestSubmit(); });
            return b;
          })()));
      alertBox.hidden = false;
      alertBox.focus();
    };

    f.addEventListener('input', () => { confirmed = false; alertBox.hidden = true; });

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      status.hidden = true;
      status.classList.remove('error');
      const t = title.value.trim();
      const b = body.value.trim();
      if (!t || !b) {
        status.classList.add('error');
        status.textContent = 'Please add a title and a message.';
        status.hidden = false;
        return;
      }
      if (!confirmed && CRISIS_WORDS.test(t + ' ' + b)) { showCrisis(); return; }

      const posts = CG.posts();
      posts.push({ id: 'p' + Date.now().toString(36), nick: me.nickname, email: me.email, topic: topic.value, title: t, body: b, ts: Date.now() });
      if (!CG.write('cg_posts', posts)) {
        status.classList.add('error');
        status.textContent = 'Your browser is blocking storage, so the post could not be saved.';
        status.hidden = false;
        return;
      }
      confirmed = false;
      alertBox.hidden = true;
      title.value = '';
      body.value = '';
      status.textContent = 'Posted. It appears at the top of the list.';
      status.hidden = false;
      renderPosts();
    });

    composerHost.append(f);
  }

  renderComposer();
  renderPosts();

  // Signed-in visitors: the sidebar button jumps to the composer instead of "join"
  if (composerHost && CG.user()) {
    const cta = document.querySelector('.forum-cta-btn');
    if (cta) {
      cta.setAttribute('href', '#composer');
      cta.firstChild.textContent = 'Write a post ';
    }
  }

  /* ================= Generic filtering =================
     Bar:    [data-filter-bar="ID"] containing .js-filter buttons (data-filter)
     Items:  [data-filter-item="ID"]  data-cats="a b"  data-format="online|inperson|both"
     Search: [data-filter-search="ID"]   Select: [data-filter-select="ID"]
     Extras: [data-filter-count="ID"], [data-filter-empty="ID"]                      */
  const NOUN = { care: 'illustrative listings', forum: 'conversations', groups: 'illustrative groups' };
  const ids = new Set(
    [...document.querySelectorAll('[data-filter-bar],[data-filter-item]')].map(
      (e) => e.dataset.filterBar || e.dataset.filterItem
    )
  );

  ids.forEach((id) => {
    const buttons = [...document.querySelectorAll(`[data-filter-bar="${id}"] .js-filter`)];
    const search = document.querySelector(`[data-filter-search="${id}"]`);
    const select = document.querySelector(`[data-filter-select="${id}"]`);
    const count = document.querySelector(`[data-filter-count="${id}"]`);
    const empty = document.querySelector(`[data-filter-empty="${id}"]`);
    let current = 'all';

    if (search && id === 'care' && params.get('q')) search.value = params.get('q');

    const apply = () => {
      const items = [...document.querySelectorAll(`[data-filter-item="${id}"]`)];
      const q = search ? search.value.trim().toLowerCase() : '';
      const fmt = select ? select.value : 'any';
      let shown = 0;
      items.forEach((item) => {
        const cats = (item.dataset.cats || '').split(' ');
        const okCat = current === 'all' || cats.includes(current);
        const itemFmt = item.dataset.format || 'both';
        const okFmt = fmt === 'any' || itemFmt === 'both' || itemFmt === fmt;
        const okText = !q || item.textContent.toLowerCase().includes(q);
        const visible = okCat && okFmt && okText;
        item.hidden = !visible;
        if (visible) shown += 1;
      });
      if (count) count.textContent = `Showing ${shown} of ${items.length} ${NOUN[id] || 'items'}`;
      if (empty) empty.hidden = shown !== 0;
    };
    refilters[id] = apply;

    buttons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
      btn.addEventListener('click', () => {
        current = btn.dataset.filter || 'all';
        buttons.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        apply();
      });
    });

    if (search) search.addEventListener('input', apply);
    if (select) select.addEventListener('change', apply);
    const form = (search || select) && (search || select).closest('form');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });

    apply();
  });

  // Buttons that just open another page (e.g. "More topics")
  document.querySelectorAll('[data-href]').forEach((b) =>
    b.addEventListener('click', () => { location.href = b.dataset.href; })
  );

  /* ================= Directory: region note (arrives from the home page) ================= */
  const regionNote = document.getElementById('region-note');
  const REGIONS = { ncr: 'Metro Manila (NCR)', car: 'Cordillera (CAR)', cebu: 'Cebu', davao: 'Davao' };
  if (regionNote && REGIONS[params.get('region')]) {
    regionNote.textContent =
      `Listings for ${REGIONS[params.get('region')]} aren’t available yet. These are nationwide categories — ` +
      'ask your local hospital or city/municipal health office what is offered near you.';
    regionNote.hidden = false;
  }

  /* ================= Sign in / Join ================= */
  const authTabs = [...document.querySelectorAll('.auth-tab')];
  const panels = [...document.querySelectorAll('.auth-panel')];

  if (panels.length) {
    const tabsBar = document.querySelector('.auth-tabs');
    const me = CG.user();

    const show = (name) => {
      if (CG.user()) name = 'signedin';
      authTabs.forEach((t) => {
        const on = t.dataset.panel === name;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
      });
      panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
      if (tabsBar) tabsBar.hidden = name === 'signedin';
      document.title = ({ join: 'Join the community', signin: 'Sign in', signedin: 'Your account' }[name]) + ' – Common Ground';
      document.querySelectorAll('.auth-status').forEach((s) => { s.hidden = true; });
    };
    const hashPanel = () => (location.hash === '#join' ? 'join' : 'signin');

    authTabs.forEach((t) => t.addEventListener('click', () => {
      show(t.dataset.panel);
      history.replaceState(null, '', '#' + t.dataset.panel);
    }));
    document.querySelectorAll('[data-switch]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      show(a.dataset.switch);
      history.replaceState(null, '', '#' + a.dataset.switch);
    }));
    window.addEventListener('hashchange', () => show(hashPanel()));

    const name = document.getElementById('signedin-name');
    if (name && me) name.textContent = me.nickname;
    show(hashPanel());

    const fail = (form, msg) => {
      const s = form.querySelector('.auth-status');
      s.classList.add('error');
      s.textContent = msg;
      s.hidden = false;
    };

    document.querySelectorAll('.auth-panel form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        form.querySelector('.auth-status').classList.remove('error');
        const data = Object.fromEntries(new FormData(form).entries());
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;

        let result;
        if (form.dataset.form === 'join') {
          const nick = (data.nickname || '').trim();
          if (nick.length < 2) result = { ok: false, error: 'Please choose a nickname with at least 2 characters.' };
          else if (/@/.test(nick) || nick.split(/\s+/).length > 2) result = { ok: false, error: 'Please use a short nickname rather than your full name or email.' };
          else if (!/^[\p{L}\p{N}_.\- ]+$/u.test(nick)) result = { ok: false, error: 'Nicknames can use letters, numbers, spaces, dots, dashes and underscores.' };
          else if ((data.password || '').length < 8) result = { ok: false, error: 'Please choose a password with at least 8 characters.' };
          else result = await CG.signUp({ nickname: nick, email: data.email, password: data.password });
        } else {
          result = await CG.signIn(data.email, data.password);
        }

        btn.disabled = false;
        if (result.ok) location.href = 'community.html';
        else fail(form, result.error);
      });
    });

    const out = document.getElementById('signout-btn');
    if (out) out.addEventListener('click', () => { CG.signOut(); location.href = 'index.html'; });
    const del = document.getElementById('delete-account');
    if (del) del.addEventListener('click', () => {
      if (confirm('Delete your account and all of your posts from this browser? This cannot be undone.')) {
        CG.deleteAccount();
        location.href = 'index.html';
      }
    });
  }

  /* ================= Contact form (opens the visitor's email app) ================= */
  const contact = document.getElementById('contact-form');
  if (contact) {
    const cfg = window.CG_CONFIG || {};
    const to = cfg.contactEmail || '';
    document.querySelectorAll('.contact-email').forEach((a) => {
      a.textContent = to;
      a.setAttribute('href', 'mailto:' + to);
    });

    const topicSel = document.getElementById('ct-topic');
    if (topicSel && [...topicSel.options].some((o) => o.value === params.get('topic'))) {
      topicSel.value = params.get('topic');
    }
    const status = contact.querySelector('.auth-status');

    contact.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(contact).entries());
      const label = topicSel.options[topicSel.selectedIndex].text;
      const lines = [d.message.trim(), '', '—'];
      if (d.name.trim()) lines.push('From: ' + d.name.trim());
      if (d.email.trim()) lines.push('Reply to: ' + d.email.trim());
      const mailto =
        'mailto:' + encodeURIComponent(to).replace('%40', '@') +
        '?subject=' + encodeURIComponent('[Common Ground] ' + label) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      contact.dataset.mailto = mailto;
      status.classList.remove('error');
      status.textContent =
        'Your email app should open with the message filled in. If nothing opens, copy your message and send it to ' + to + '.';
      status.hidden = false;
      location.href = mailto;
    });
  }
})();
