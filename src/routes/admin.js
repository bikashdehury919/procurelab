const express = require('express');
const store = require('../store');
const db = require('../db');
const { seed } = require('../seed');
const { getMarket, MARKETS } = require('../markets');
const { usersPage, systemPage, forbiddenPage, notFoundPage } = require('../views/admin');

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

module.exports = function adminRoutes() {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!req.ctx.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    if (req.ctx.user.role !== 'admin') return res.status(403).send(forbiddenPage(req.ctx));
    next();
  });

  const allVendors = () => Object.keys(MARKETS).flatMap((code) => store.listVendors(code));

  const renderUsers = (req, res, extra = {}) => {
    const msgKey = { created: 'userCreated', updated: 'userUpdated' }[req.query.msg];
    res.send(usersPage(req.ctx, { users: store.listUsers(), vendors: allVendors(), message: msgKey && req.ctx.t(msgKey), ...extra }));
  };

  router.get('/users', (req, res) => renderUsers(req, res));

  router.post('/users', (req, res) => {
    const { t } = req.ctx;
    const b = req.body;
    const values = { name: b.name || '', email: String(b.email || '').trim().toLowerCase(), role: b.role || '', market: getMarket(b.market)?.code || req.ctx.market.code, vendorId: b.vendorId || '' };
    const errors = {};
    if (!values.name.trim()) errors.name = t('errFullName');
    if (!isEmail(values.email)) errors.email = t('errEmail');
    else if (store.getUserByEmail(values.email)) errors.email = t('errEmailTaken');
    if (!store.ROLES.includes(values.role)) errors.role = t('errRole');
    let vendor = null;
    if (values.role === 'vendor') {
      vendor = store.getVendor(values.vendorId);
      if (!vendor || !vendor.active) errors.vendorId = t('errVendorRequired');
    }
    if (String(b.password || '').length < 8) errors.password = t('errPassword');
    if (Object.keys(errors).length) { res.status(422); return renderUsers(req, res, { values, errors }); }
    store.createUser({ ...values, market: vendor ? vendor.market : values.market, vendorId: vendor ? vendor.id : null, password: b.password }, { actor: req.ctx.user.email });
    res.redirect('/admin/users?msg=created');
  });

  const toggle = (active) => (req, res) => {
    const u = store.getUser(req.params.id);
    if (!u) return res.status(404).send(notFoundPage(req.ctx));
    if (u.id === req.ctx.user.id) { res.status(409); return renderUsers(req, res, { error: req.ctx.t('errSelf') }); }
    store.setUserActive(u.id, active);
    res.redirect('/admin/users?msg=updated');
  };
  router.post('/users/:id/deactivate', toggle(false));
  router.post('/users/:id/activate', toggle(true));

  router.get('/system', (req, res) => res.send(systemPage(req.ctx, { stats: db.stats(), message: req.query.msg === 'reset' ? req.ctx.t('resetDone') : null })));

  router.get('/system/export', (req, res) => {
    const data = db.exportAll();
    data.users = data.users.map(({ passwordHash, ...u }) => u); // never export password hashes
    res.set('Content-Disposition', `attachment; filename="procurelab-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  });

  router.post('/system/reset', (req, res) => {
    seed();
    // The admin's own user id is stable in the seed (admin is created first), so the session stays valid.
    res.redirect('/admin/system?msg=reset');
  });

  return router;
};
