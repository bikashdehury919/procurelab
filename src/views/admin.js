const { MARKETS } = require('../markets');
const { APP_NAME, DEMO_PASSWORD } = require('../config');
const { esc, layout, field, selectField, flash, alertBox, badge, fileSize } = require('./layout');

function usersPage(ctx, { users, vendors, values = {}, errors = {}, message, error }) {
  const { t, fmt, store } = ctx;
  const rows = users.map((u) => {
    const v = u.vendorId ? store.getVendor(u.vendorId) : null;
    const self = u.id === ctx.user.id;
    return `<tr data-testid="user-row" data-user-id="${u.id}" data-email="${esc(u.email)}">
      <td data-testid="user-name-cell">${esc(u.name)}</td><td data-testid="user-email">${esc(u.email)}</td>
      <td>${esc(t('role_' + u.role))}${v ? `<br><span class="hint">${esc(v.name)}</span>` : ''}</td>
      <td>${esc(u.market)}</td>
      <td>${badge(u.active ? 'active' : 'inactive', u.active ? t('active') : t('inactive'), 'user-status')}</td>
      <td class="nowrap hint">${esc(fmt.dateTime(u.createdAt))}</td>
      <td class="row-actions">${self ? '' : `<form method="post" action="/admin/users/${u.id}/${u.active ? 'deactivate' : 'activate'}"><button class="small secondary" type="submit" data-testid="${u.active ? 'deactivate-user' : 'activate-user'}">${esc(u.active ? t('deactivate') : t('activate'))}</button></form>`}</td>
    </tr>`;
  }).join('');
  const roleOptions = [['', '…'], ...store.ROLES.map((r) => [r, t('role_' + r)])];
  const vendorOptions = [['', '…'], ...vendors.map((v) => [v.id, `${v.name} (${v.market})`])];
  return layout(ctx, t('users'), `
  <h1>${esc(t('users'))}</h1>
  ${flash(message)}${alertBox(error, 'users-error')}
  <div class="split">
    <section class="card table-wrap"><table data-testid="users-table">
      <thead><tr><th>${esc(t('fullName'))}</th><th>${esc(t('email'))}</th><th>${esc(t('role'))}</th><th>${esc(t('homeMarket'))}</th><th>${esc(t('status'))}</th><th></th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></section>
    <aside class="card"><h2>${esc(t('newUser'))}</h2>
      <form method="post" action="/admin/users" novalidate data-testid="user-form">
        ${field('name', t('fullName'), { value: values.name, error: errors.name })}
        ${field('email', t('email'), { type: 'email', value: values.email, error: errors.email })}
        ${selectField('role', t('role'), roleOptions, { value: values.role, error: errors.role })}
        ${selectField('market', t('homeMarket'), Object.keys(MARKETS).map((m) => [m, m]), { value: values.market || ctx.market.code })}
        ${selectField('vendorId', t('linkedVendor'), vendorOptions, { value: values.vendorId, error: errors.vendorId })}
        ${field('password', t('initialPassword'), { type: 'password', error: errors.password, hint: t('passwordHint'), attrs: 'autocomplete="new-password"' })}
        <button class="primary" type="submit" data-testid="create-user">${esc(t('createUser'))}</button>
      </form></aside>
  </div>`, { active: 'users' });
}

function systemPage(ctx, { stats, message }) {
  const { t, fmt } = ctx;
  const rows = stats.files.map((f) => `<tr data-testid="data-file-row" data-file="${esc(f.name)}"><td><code>${esc(f.name)}</code></td><td class="num" data-testid="data-file-records">${f.records}</td><td class="num">${esc(fileSize(f.bytes))}</td></tr>`).join('');
  return layout(ctx, t('systemTitle'), `
  <h1>${esc(t('systemTitle'))}</h1>
  ${flash(message)}
  <p class="lede">${esc(t('systemIntro'))}</p>
  <div class="split">
    <section class="card table-wrap"><table data-testid="data-files-table">
      <thead><tr><th>${esc(t('file'))}</th><th class="num">${esc(t('records'))}</th><th class="num">${esc(t('size'))}</th></tr></thead>
      <tbody>${rows}</tbody></table></section>
    <aside class="card"><dl class="facts">
      <div><dt>${esc(t('dataFolder'))}</dt><dd><code data-testid="data-dir">${esc(stats.dataDir)}</code></dd></div>
      <div><dt>${esc(t('uploadsFolder'))}</dt><dd data-testid="uploads-summary">${esc(t('uploadedFiles', { n: stats.uploads, size: fileSize(stats.uploadBytes) }))}</dd></div>
      <div><dt>${esc(t('lastSaved'))}</dt><dd data-testid="last-saved">${stats.meta.updatedAt ? esc(fmt.dateTime(stats.meta.updatedAt)) : ''}</dd></div>
    </dl>
    <p><a class="button secondary" href="/admin/system/export" data-testid="export-data">${esc(t('exportData'))}</a></p>
    <form method="post" action="/admin/system/reset" data-testid="reset-form" data-confirm="${esc(t('resetConfirm'))}">
      <p class="hint">${esc(t('resetConfirm'))}</p>
      <button class="secondary danger" type="submit" data-testid="reset-data">${esc(t('resetData'))}</button></form>
    </aside>
  </div>`, { active: 'system' });
}

function loginPage(ctx, { error, email = '' } = {}) {
  const { t } = ctx;
  return layout(ctx, t('signIn'), `
  <section class="auth card">
    <p class="auth-brand">${esc(APP_NAME)}</p>
    <h1>${esc(t('signInTitle'))}</h1>
    <p class="meta">${esc(t('appTagline'))}</p>
    ${alertBox(error, 'login-error')}
    <form method="post" action="/login${ctx.next ? `?next=${encodeURIComponent(ctx.next)}` : ''}" novalidate data-testid="login-form">
      ${field('email', t('email'), { type: 'email', value: email, attrs: 'autocomplete="username" required' })}
      ${field('password', t('password'), { type: 'password', attrs: 'autocomplete="current-password" required' })}
      <button class="primary" type="submit" data-testid="sign-in">${esc(t('signIn'))}</button>
    </form>
    <details class="hint" data-testid="demo-accounts"><summary>Demo accounts${DEMO_PASSWORD === 'Demo123!' ? ' (password Demo123!)' : ''}</summary>
      <p>Admin: admin@procurelab.test<br>Procurement: buyer@procurelab.test<br>Vendor: vendor.nl@ / vendor.be@ / vendor.dk@ / vendor.de@procurelab.test<br>Deactivated: locked@procurelab.test</p></details>
  </section>`);
}

const notFoundPage = (ctx) => layout(ctx, '404', `<section class="auth card"><h1>404</h1><p data-testid="not-found">${esc(ctx.t('notFound'))}</p><p><a href="/">${esc(ctx.t('back'))}</a></p></section>`);
const forbiddenPage = (ctx) => layout(ctx, '403', `<section class="auth card"><h1 data-testid="forbidden-title">${esc(ctx.t('forbidden'))}</h1><p data-testid="forbidden">${esc(ctx.t('forbiddenBody'))}</p><p><a href="/">${esc(ctx.t('back'))}</a></p></section>`);

module.exports = { usersPage, systemPage, loginPage, notFoundPage, forbiddenPage };
