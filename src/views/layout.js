const { MARKETS, LANGUAGES } = require('../markets');
const { APP_NAME, MAX_UPLOAD_MB, ALLOWED_EXTENSIONS } = require('../config');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NAV = {
  admin: [['dashboard', '/dashboard'], ['projects', '/projects'], ['vendors', '/vendors'], ['users', '/admin/users'], ['system', '/admin/system']],
  buyer: [['dashboard', '/dashboard'], ['projects', '/projects'], ['vendors', '/vendors']],
  vendor: [['myRfps', '/portal']],
};

function layout(ctx, title, body, { active = '' } = {}) {
  const { t, market, lang, user, locale } = ctx;
  const marketOptions = Object.values(MARKETS).map((m) => `<option value="${m.code}" ${m.code === market.code ? 'selected' : ''}>${m.code} · ${esc(m.name)}</option>`).join('');
  const langOptions = Object.entries(LANGUAGES).map(([code, name]) => `<option value="${code}" ${code === lang ? 'selected' : ''}>${esc(name)}</option>`).join('');
  const nav = (user ? NAV[user.role] : []).map(([key, href]) => `<a href="${href}" data-testid="nav-${key}" ${active === key ? 'aria-current="page"' : ''}>${esc(t(key))}</a>`).join('');
  const marketControl = user?.role === 'vendor'
    ? `<span class="pill" data-testid="market-label">${market.code}</span>`
    : `<form method="get" action="/market" class="switch"><label for="market-select">${esc(t('market'))}</label>
       <select id="market-select" name="code" data-testid="market-switcher" data-autosubmit>${marketOptions}</select><noscript><button>OK</button></noscript></form>`;
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(APP_NAME)}</title>
<link rel="stylesheet" href="/styles.css">
<script src="/app.js" defer></script>
</head>
<body data-market="${market.code}" data-lang="${lang}" data-locale="${esc(locale)}" data-role="${user ? user.role : 'anonymous'}" style="--market:${market.color}">
<header class="topbar">
  <a class="brand" href="/" data-testid="brand"><span class="mark" aria-hidden="true"></span>${esc(APP_NAME)}</a>
  <nav class="nav" aria-label="Main">${nav}</nav>
  <div class="controls">
    ${marketControl}
    <form method="get" action="/lang" class="switch"><label for="lang-select">${esc(t('language'))}</label>
      <select id="lang-select" name="code" data-testid="language-switcher" data-autosubmit>${langOptions}</select><noscript><button>OK</button></noscript></form>
    ${user ? `<div class="user"><span data-testid="user-name">${esc(user.name)}</span> <span class="role" data-testid="user-role">${esc(t('role_' + user.role))}</span>
      <form method="post" action="/logout"><button class="link" type="submit" data-testid="sign-out">${esc(t('signOut'))}</button></form></div>` : ''}
  </div>
</header>
<div class="market-line" data-testid="market-line" aria-hidden="true"></div>
<main>${body}</main>
<footer class="foot" data-testid="footer">${esc(APP_NAME)} ${esc(ctx.version)} | ${market.code} | ${esc(locale)} | ${esc(market.currency)}</footer>
</body>
</html>`;
}

function field(name, label, { type = 'text', value = '', error, attrs = '', hint } = {}) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ');
  const aria = `${error ? 'aria-invalid="true"' : ''} ${describedBy ? `aria-describedby="${describedBy}"` : ''}`;
  return `<div class="field ${error ? 'has-error' : ''}">
    <label for="${name}">${esc(label)}</label>
    ${hint ? `<p class="hint" id="${name}-hint">${esc(hint)}</p>` : ''}
    ${type === 'textarea'
      ? `<textarea id="${name}" name="${name}" rows="3" data-testid="input-${name}" ${aria} ${attrs}>${esc(value)}</textarea>`
      : `<input id="${name}" name="${name}" type="${type}" value="${esc(value)}" data-testid="input-${name}" ${aria} ${attrs}>`}
    ${error ? `<p class="error" id="${name}-error" data-testid="error-${name}">${esc(error)}</p>` : ''}
  </div>`;
}

function selectField(name, label, options, { value = '', error, attrs = '' } = {}) {
  const opts = options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="field ${error ? 'has-error' : ''}"><label for="${name}">${esc(label)}</label>
    <select id="${name}" name="${name}" data-testid="input-${name}" ${attrs}>${opts}</select>
    ${error ? `<p class="error" data-testid="error-${name}">${esc(error)}</p>` : ''}</div>`;
}

function checkboxGroup(name, legend, options, { checked = [], error } = {}) {
  const boxes = options.map(([v, l, extra = '']) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(v)}" data-testid="check-${name}-${esc(v)}" ${checked.includes(v) ? 'checked' : ''}> <span>${esc(l)}</span>${extra ? ` <small>${esc(extra)}</small>` : ''}</label>`).join('');
  return `<fieldset class="field ${error ? 'has-error' : ''}" data-testid="group-${name}"><legend>${esc(legend)}</legend>${boxes}
    ${error ? `<p class="error" data-testid="error-${name}">${esc(error)}</p>` : ''}</fieldset>`;
}

function uploadField(ctx, name, label, error) {
  return `<div class="field ${error ? 'has-error' : ''}"><label for="${name}">${esc(label)}</label>
    <p class="hint" id="${name}-hint">${esc(ctx.t('uploadHint', { mb: MAX_UPLOAD_MB }))}</p>
    <input id="${name}" name="${name}" type="file" multiple accept="${ALLOWED_EXTENSIONS.join(',')}" data-testid="input-${name}" aria-describedby="${name}-hint">
    ${error ? `<p class="error" data-testid="error-${name}">${esc(error)}</p>` : ''}</div>`;
}

function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileList(ctx, files, testid = 'file-list') {
  if (!files.length) return `<p class="empty" data-testid="${testid}-empty">${esc(ctx.t('none'))}</p>`;
  return `<ul class="plain files" data-testid="${testid}">${files.map((f) => `<li data-testid="file-item" data-file-id="${f.id}">
    <a href="/files/${f.id}" data-testid="file-link">${esc(f.originalName)}</a><span class="hint">${esc(fileSize(f.size))}</span></li>`).join('')}</ul>`;
}

const flash = (msg) => (msg ? `<p class="flash" role="status" data-testid="flash">${esc(msg)}</p>` : '');
const alertBox = (msg, testid = 'alert') => (msg ? `<p class="alert" role="alert" data-testid="${testid}">${esc(msg)}</p>` : '');
const badge = (kind, label, testid = 'status') => `<span class="badge b-${esc(kind)}" data-testid="${testid}" data-status="${esc(kind)}">${esc(label)}</span>`;

module.exports = { esc, layout, field, selectField, checkboxGroup, uploadField, fileList, fileSize, flash, alertBox, badge };
