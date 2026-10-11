const { esc, layout, field, selectField, checkboxGroup, uploadField, fileList, flash, alertBox, badge } = require('./layout');

function dashboard(ctx, { stats, activity }) {
  const { t, fmt } = ctx;
  const kpis = [
    ['projects', t('kpiProjects'), stats.projects, '/projects'],
    ['active-rfps', t('kpiActiveRfps'), stats.activeRfps, '/projects'],
    ['proposals', t('kpiProposals'), stats.proposals, '/projects'],
    ['vendors', t('kpiVendors'), stats.vendors, '/vendors'],
  ].map(([key, label, value, href]) => `<a class="kpi" href="${href}" data-testid="kpi-${key}"><span class="kpi-value" data-testid="kpi-${key}-value">${value}</span><span class="kpi-label">${esc(label)}</span></a>`).join('');
  const items = activity.length
    ? activity.map((a) => `<li data-testid="activity-item" data-type="${a.type}"><span>${esc(t('act_' + a.type, a.params))}</span><time datetime="${a.at}">${esc(fmt.dateTime(a.at))}</time></li>`).join('')
    : `<li class="empty" data-testid="activity-empty">${esc(t('noActivity'))}</li>`;
  return layout(ctx, t('dashboard'), `
  <h1>${esc(t('dashboard'))}</h1>
  <div class="kpis">${kpis}</div>
  <section class="card"><h2>${esc(t('recentActivity'))}</h2><ul class="activity" data-testid="activity-list">${items}</ul></section>`, { active: 'dashboard' });
}

function projectsList(ctx, { projects, q, status, message }) {
  const { t, fmt } = ctx;
  const statusOptions = [['', t('allStatuses')], ...['planning', 'active', 'completed', 'archived'].map((s) => [s, t('status_' + s)])];
  const rows = projects.length
    ? projects.map((p) => `<tr data-testid="project-row" data-project-id="${p.id}">
        <td><a href="/projects/${p.id}" data-testid="project-link">${esc(p.name)}</a></td>
        <td>${esc(p.owner)}</td>
        <td class="nowrap">${esc(fmt.date(p.startDate))} – ${esc(fmt.date(p.endDate))}</td>
        <td>${badge(p.status, t('status_' + p.status), 'project-status')}</td>
        <td class="num" data-testid="project-budget">${esc(fmt.money(p.budget))}</td></tr>`).join('')
    : `<tr><td colspan="5" class="empty" data-testid="projects-empty">${esc(t('noProjects'))}</td></tr>`;
  return layout(ctx, t('projects'), `
  <div class="page-head"><h1>${esc(t('projects'))}</h1><a class="button" href="/projects/new" data-testid="new-project">${esc(t('newProject'))}</a></div>
  ${flash(message)}
  <form class="toolbar" method="get" action="/projects" role="search" data-testid="project-filters">
    <div class="field"><label for="q">${esc(t('search'))}</label><input id="q" name="q" type="search" value="${esc(q)}" data-testid="input-search"></div>
    ${selectField('status', t('status'), statusOptions, { value: status })}
    <button class="secondary" type="submit" data-testid="apply-filters">${esc(t('apply'))}</button>
  </form>
  <div class="card table-wrap"><table data-testid="projects-table">
    <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('owner'))}</th><th>${esc(t('period'))}</th><th>${esc(t('status'))}</th><th class="num">${esc(t('budget'))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`, { active: 'projects' });
}

function projectForm(ctx, { project, values = {}, errors = {} }) {
  const { t, market } = ctx;
  const editing = !!project;
  const v = { ...(project || { status: 'planning' }), ...values };
  const statusOptions = ['planning', 'active', 'completed'].map((s) => [s, t('status_' + s)]);
  return layout(ctx, editing ? t('editProject') : t('newProject'), `
  <a class="crumb" href="${editing ? `/projects/${project.id}` : '/projects'}" data-testid="crumb-back">${esc(t('back'))}</a>
  <h1>${esc(editing ? t('editProject') : t('newProject'))}</h1>
  <form class="card form-grid" method="post" action="${editing ? `/projects/${project.id}` : '/projects'}" novalidate data-testid="project-form">
    ${field('name', t('name'), { value: v.name, error: errors.name, attrs: 'placeholder="Cloud Migration 2027"' })}
    ${field('owner', t('owner'), { value: v.owner, error: errors.owner })}
    ${field('budget', `${t('budget')} (${market.currency})`, { type: 'number', value: v.budget, error: errors.budget, attrs: 'min="1" step="1"' })}
    ${selectField('status', t('status'), statusOptions, { value: v.status === 'archived' ? 'planning' : v.status })}
    ${field('startDate', t('startDate'), { type: 'date', value: v.startDate, error: errors.startDate })}
    ${field('endDate', t('endDate'), { type: 'date', value: v.endDate, error: errors.endDate })}
    <div class="span-2">${field('description', t('description'), { type: 'textarea', value: v.description })}</div>
    <div class="span-2 actions"><button class="primary" type="submit" data-testid="save-project">${esc(editing ? t('saveChanges') : t('createProject'))}</button></div>
  </form>`, { active: 'projects' });
}

function projectDetail(ctx, { project, requirements, assigned, assignable, rfps, message, reqError, reqValue }) {
  const { t, fmt, store } = ctx;
  const archived = project.status === 'archived';
  const reqItems = requirements.length
    ? requirements.map((r) => `<li data-testid="requirement-item" data-requirement-id="${r.id}">
        <span><span data-testid="requirement-name">${esc(r.name)}</span> ${badge('p-' + r.priority, t('priority_' + r.priority), 'requirement-priority')}</span>
        ${archived ? '' : `<form method="post" action="/requirements/${r.id}/delete"><button class="link danger" type="submit" data-testid="requirement-remove">${esc(t('remove'))}</button></form>`}</li>`).join('')
    : `<li class="empty" data-testid="requirements-empty">${esc(t('noRequirements'))}</li>`;
  const assignedItems = assigned.length
    ? assigned.map((v) => `<li data-testid="assigned-vendor"><a href="/vendors/${v.id}">${esc(v.name)}</a>
        ${archived ? '' : `<form method="post" action="/projects/${project.id}/vendors/${v.id}/unassign"><button class="link danger" type="submit" data-testid="unassign-vendor">${esc(t('unassign'))}</button></form>`}</li>`).join('')
    : `<li class="empty" data-testid="assigned-empty">${esc(t('noAssignedVendors'))}</li>`;
  const rfpRows = rfps.length
    ? rfps.map((r) => {
        const state = store.rfpState(r);
        return `<tr data-testid="rfp-row" data-rfp-id="${r.id}">
          <td><a href="/rfps/${r.id}" data-testid="rfp-link">${esc(r.title)}</a></td>
          <td class="nowrap">${esc(fmt.date(r.deadline))}</td>
          <td>${badge(state, t(state), 'rfp-status')}</td>
          <td class="num" data-testid="rfp-proposal-count">${store.proposalsFor(r.id).length} / ${r.vendorIds.length}</td></tr>`;
      }).join('')
    : `<tr><td colspan="4" class="empty" data-testid="rfps-empty">${esc(t('noRfps'))}</td></tr>`;
  return layout(ctx, project.name, `
  <a class="crumb" href="/projects" data-testid="crumb-back">${esc(t('projects'))}</a>
  <div class="page-head">
    <div><h1 data-testid="project-title">${esc(project.name)}</h1>
      <p class="meta">${badge(project.status, t('status_' + project.status), 'project-status')} ${esc(project.owner)} | ${esc(fmt.date(project.startDate))} – ${esc(fmt.date(project.endDate))} | <span data-testid="project-budget">${esc(fmt.money(project.budget))}</span></p></div>
    <div class="head-actions">
      ${archived ? '' : `<a class="button secondary" href="/projects/${project.id}/edit" data-testid="edit-project">${esc(t('edit'))}</a>`}
      <form method="post" action="/projects/${project.id}/${archived ? 'restore' : 'archive'}"><button class="secondary" type="submit" data-testid="${archived ? 'restore-project' : 'archive-project'}">${esc(archived ? t('restore') : t('archive'))}</button></form>
    </div>
  </div>
  ${flash(message)}
  ${project.description ? `<p class="lede" data-testid="project-description">${esc(project.description)}</p>` : ''}
  <div class="split">
    <div>
      <section class="card table-wrap">
        <div class="section-head"><h2>${esc(t('rfps'))}</h2>${archived ? '' : `<a class="button" href="/projects/${project.id}/rfps/new" data-testid="new-rfp">${esc(t('newRfp'))}</a>`}</div>
        <table data-testid="rfps-table"><thead><tr><th>${esc(t('rfpTitle'))}</th><th>${esc(t('deadline'))}</th><th>${esc(t('status'))}</th><th class="num">${esc(t('proposals'))}</th></tr></thead>
        <tbody>${rfpRows}</tbody></table>
      </section>
      <section class="card">
        <h2>${esc(t('requirements'))}</h2>
        <ul class="plain" data-testid="requirements-list">${reqItems}</ul>
        ${archived ? '' : `<form method="post" action="/projects/${project.id}/requirements" novalidate class="inline-form" data-testid="requirement-form">
          ${field('reqName', t('requirementName'), { value: reqValue, error: reqError })}
          ${selectField('reqPriority', t('priority'), ['must', 'should', 'could'].map((p) => [p, t('priority_' + p)]))}
          <button class="secondary" type="submit" data-testid="add-requirement">${esc(t('addRequirement'))}</button></form>`}
      </section>
    </div>
    <aside class="card">
      <h2>${esc(t('assignedVendors'))}</h2>
      <ul class="plain" data-testid="assigned-list">${assignedItems}</ul>
      ${archived || !assignable.length ? '' : `<form method="post" action="/projects/${project.id}/vendors" data-testid="assign-form">
        ${selectField('vendorId', t('assignToProject'), assignable.map((v) => [v.id, v.name]))}
        <button class="secondary" type="submit" data-testid="assign-vendor">${esc(t('assign'))}</button></form>`}
    </aside>
  </div>`, { active: 'projects' });
}

function rfpForm(ctx, { project, requirements, vendors, values = {}, errors = {} }) {
  const { t } = ctx;
  const checkedVendors = values.vendorIds || project.vendorIds;
  const body = requirements.length ? `
  <form class="card" method="post" action="/projects/${project.id}/rfps" enctype="multipart/form-data" novalidate data-testid="rfp-form">
    ${errors.files ? alertBox(errors.files, 'upload-error') : ''}
    ${field('title', t('rfpTitle'), { value: values.title, error: errors.title, attrs: `placeholder="${esc(project.name)} RFP"` })}
    ${checkboxGroup('requirementIds', t('selectRequirements'), requirements.map((r) => [r.id, r.name, t('priority_' + r.priority)]), { checked: values.requirementIds || [], error: errors.requirementIds })}
    ${checkboxGroup('vendorIds', t('selectVendors'), vendors.map((v) => [v.id, v.name, `${v.expertise.map((x) => t('exp_' + x)).join(', ')} | ${v.rating}`]), { checked: checkedVendors, error: errors.vendorIds })}
    ${field('deadline', t('deadline'), { type: 'date', value: values.deadline, error: errors.deadline, attrs: `min="${ctx.store.today()}"` })}
    ${uploadField(ctx, 'attachments', t('attachments'))}
    <button class="primary" type="submit" data-testid="send-rfp">${esc(t('sendRfp'))}</button>
  </form>` : alertBox(t('errNoRequirements'), 'no-requirements');
  return layout(ctx, t('newRfp'), `
  <a class="crumb" href="/projects/${project.id}" data-testid="crumb-back">${esc(project.name)}</a>
  <h1>${esc(t('newRfp'))}</h1>${body}`, { active: 'projects' });
}

function rfpDetail(ctx, { project, rfp, requirements, invited, rows, analysis, minRating, sort, files, message, notice }) {
  const { t, fmt, flags, store } = ctx;
  const state = store.rfpState(rfp);
  const canDecide = rfp.status !== 'awarded';
  const a = (id) => analysis.find((x) => x.proposalId === id);
  const sortLink = (key, label) => `<a href="?sort=${key}${minRating ? `&minRating=${minRating}` : ''}" data-testid="sort-${key}" ${sort === key ? 'aria-current="true"' : ''}>${esc(label)}</a>`;
  const cols = flags.vatBreakdown ? 9 : 7;
  const proposalRows = rows.length
    ? rows.map(({ proposal: x, vendor: v }) => `<tr data-testid="proposal-row" data-proposal-id="${x.id}" data-vendor="${esc(v.name)}">
        <td><input type="checkbox" name="ids" value="${x.id}" form="compare-form" data-testid="compare-check" aria-label="${esc(v.name)}"></td>
        <td data-testid="proposal-vendor"><a href="/proposals/${x.id}" data-testid="open-proposal">${esc(v.name)}</a>${flags.aiAnalyzer && a(x.id)?.recommended ? ` ${badge('recommended', t('recommended'), 'recommended-badge')}` : ''}</td>
        <td class="num" data-testid="proposal-price">${esc(fmt.money(x.priceNet))}</td>
        ${flags.vatBreakdown ? `<td class="num" data-testid="proposal-vat">${esc(fmt.money(x.vat))}</td><td class="num" data-testid="proposal-gross">${esc(fmt.money(x.gross))}</td>` : ''}
        <td class="num" data-testid="proposal-delivery">${esc(t('months', { n: x.deliveryMonths }))}</td>
        <td class="num" data-testid="proposal-rating">${esc(fmt.num(v.rating))}</td>
        <td>${badge(x.status, t('ps_' + x.status), 'proposal-status')}</td>
        <td class="row-actions">${canDecide && x.status === 'submitted' ? `
          <form method="post" action="/proposals/${x.id}/select"><button class="small" type="submit" data-testid="select-proposal">${esc(t('select'))}</button></form>
          <form method="post" action="/proposals/${x.id}/reject"><button class="small secondary" type="submit" data-testid="reject-proposal">${esc(t('reject'))}</button></form>` : ''}</td>
      </tr>`).join('')
    : `<tr><td colspan="${cols}" class="empty" data-testid="proposals-empty">${esc(t('noProposals'))}</td></tr>`;

  const analyzer = flags.aiAnalyzer && analysis.length ? `
  <section class="card analyzer" data-testid="analyzer">
    <div class="section-head"><h2>${esc(t('analyzer'))}</h2>
      <form method="post" action="/rfps/${rfp.id}/ai-summary"><button class="secondary" type="submit" data-testid="generate-ai-summary">${esc(t('generateSummary'))}</button></form></div>
    <p class="hint">${esc(t('analyzerNote'))}</p>
    <ol class="score-list">${[...analysis].sort((x, y) => y.score - x.score).map((s) => `
      <li data-testid="analysis-row" data-vendor="${esc(s.vendorName)}">
        <span class="sname" data-testid="analysis-vendor">${esc(s.vendorName)}${s.recommended ? ` ${badge('recommended', t('recommended'), 'analysis-recommended')}` : ''}</span>
        <span class="bar" style="--w:${s.score}%"><span></span></span>
        <span class="num" data-testid="analysis-score">${s.score}%</span>
        ${badge('risk-' + s.risk, `${t('risk')}: ${t('risk_' + s.risk)}`, 'analysis-risk')}
        <span class="hint" data-testid="analysis-missing">${s.missing.length ? esc(t('missingInfo', { items: s.missing.map((m) => t('missing_' + m)).join(', ') })) : esc(t('completeInfo'))}</span>
      </li>`).join('')}</ol>
    ${rfp.aiSummary ? `<div class="ai" data-testid="ai-summary"><h3>${esc(t('aiSummary'))}</h3><p data-testid="ai-summary-text">${esc(rfp.aiSummary.text)}</p>
      <p class="hint">${esc(rfp.aiSummary.model)} | ${esc(fmt.dateTime(rfp.aiSummary.at))}</p></div>` : ''}
  </section>` : '';

  const qs = store.questionsFor(rfp.id);
  const questions = `<section class="card" data-testid="questions"><h2>${esc(t('questions'))}</h2>
    ${qs.length ? `<ul class="plain qa">${qs.map((q) => `<li data-testid="question-item">
      <p><strong>${esc(store.getVendor(q.vendorId)?.name)}</strong>: <span data-testid="question-text">${esc(q.text)}</span></p>
      ${q.answer ? `<p class="answer" data-testid="answer-text">${esc(q.answer)}</p>` : `
      <form method="post" action="/questions/${q.id}/answer" class="inline" data-testid="answer-form">
        <label class="sr-only" for="ans-${q.id}">${esc(t('answer'))}</label>
        <input id="ans-${q.id}" name="answer" data-testid="input-answer" required>
        <button class="small" type="submit" data-testid="send-answer">${esc(t('sendAnswer'))}</button></form>`}</li>`).join('')}</ul>`
    : `<p class="empty" data-testid="questions-empty">${esc(t('noQuestions'))}</p>`}</section>`;

  return layout(ctx, rfp.title, `
  <a class="crumb" href="/projects/${project.id}" data-testid="crumb-back">${esc(project.name)}</a>
  <div class="page-head"><div><h1 data-testid="rfp-title">${esc(rfp.title)}</h1>
    <p class="meta">${badge(state, t(state), 'rfp-status')} ${esc(t('deadline'))}: <span data-testid="rfp-deadline">${esc(fmt.date(rfp.deadline))}</span></p></div></div>
  ${flash(message)}${notice ? alertBox(notice, 'notice') : ''}
  <section class="card table-wrap" data-testid="comparison">
    <div class="section-head"><h2>${esc(t('proposals'))}</h2>
      <div class="inline">
        <form method="get" class="inline" data-testid="proposal-filters">
          <input type="hidden" name="sort" value="${esc(sort)}">
          <label for="minRating">${esc(t('minRating'))}</label>
          <select id="minRating" name="minRating" data-testid="input-minRating" data-autosubmit>
            ${['', '3', '3.5', '4', '4.5'].map((v) => `<option value="${v}" ${String(minRating) === v ? 'selected' : ''}>${v || t('all')}</option>`).join('')}
          </select><noscript><button>${esc(t('apply'))}</button></noscript></form>
        <form method="get" action="/rfps/${rfp.id}/compare" id="compare-form" data-testid="compare-form"><button class="secondary small" type="submit" data-testid="compare-selected">${esc(t('compareSelected'))}</button></form>
      </div></div>
    <p class="hint">${esc(t('compareHint'))}</p>
    <table data-testid="proposals-table"><thead><tr><th></th>
      <th>${esc(t('vendor'))}</th><th class="num">${sortLink('price', t('priceNet'))}</th>
      ${flags.vatBreakdown ? `<th class="num">${esc(t('vat'))}</th><th class="num">${esc(t('gross'))}</th>` : ''}
      <th class="num">${sortLink('delivery', t('delivery'))}</th><th class="num">${sortLink('rating', t('rating'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead>
    <tbody>${proposalRows}</tbody></table>
  </section>
  ${analyzer}
  <div class="split even">
    <section class="card"><h2>${esc(t('invitedVendors'))}</h2><ul class="plain" data-testid="invited-list">
      ${invited.map(({ vendor: v, responded }) => `<li data-testid="invited-item"><a href="/vendors/${v.id}">${esc(v.name)}</a> ${badge(responded ? 'submitted' : 'awaiting', responded ? t('responded') : t('awaiting'), 'invite-status')}</li>`).join('')}
    </ul>
    <h2>${esc(t('requirements'))}</h2><ul class="plain" data-testid="rfp-requirements">${requirements.map((r) => `<li>${esc(r.name)} ${badge('p-' + r.priority, t('priority_' + r.priority))}</li>`).join('')}</ul>
    <h2>${esc(t('attachments'))}</h2>${fileList(ctx, files, 'rfp-files')}</section>
    ${flags.vendorQuestions ? questions : ''}
  </div>`, { active: 'projects' });
}

function proposalDetail(ctx, { project, rfp, proposal: x, vendor: v, files, analysis }) {
  const { t, fmt, flags } = ctx;
  const canDecide = rfp.status !== 'awarded' && x.status === 'submitted';
  return layout(ctx, `${v.name} | ${rfp.title}`, `
  <a class="crumb" href="/rfps/${rfp.id}" data-testid="crumb-back">${esc(rfp.title)}</a>
  <div class="page-head"><div><h1 data-testid="proposal-vendor-name">${esc(v.name)}</h1>
    <p class="meta">${badge(x.status, t('ps_' + x.status), 'proposal-status')} ${esc(project.name)} | ${esc(t('submittedOn'))}: ${esc(fmt.dateTime(x.submittedAt))}</p></div>
    ${canDecide ? `<div class="head-actions">
      <form method="post" action="/proposals/${x.id}/select"><button type="submit" data-testid="select-proposal">${esc(t('select'))}</button></form>
      <form method="post" action="/proposals/${x.id}/reject"><button class="secondary" type="submit" data-testid="reject-proposal">${esc(t('reject'))}</button></form></div>` : ''}</div>
  <div class="split even">
    <section class="card"><h2>${esc(t('proposalDetails'))}</h2><dl class="facts">
      <div><dt>${esc(t('priceNet'))}</dt><dd data-testid="detail-price">${esc(fmt.money(x.priceNet))}</dd></div>
      ${flags.vatBreakdown ? `<div><dt>${esc(t('vat'))}</dt><dd data-testid="detail-vat">${esc(fmt.money(x.vat))}</dd></div><div><dt>${esc(t('gross'))}</dt><dd data-testid="detail-gross">${esc(fmt.money(x.gross))}</dd></div>` : ''}
      <div><dt>${esc(t('delivery'))}</dt><dd data-testid="detail-delivery">${esc(t('months', { n: x.deliveryMonths }))}</dd></div>
      <div><dt>${esc(t('rating'))}</dt><dd data-testid="detail-rating">${esc(fmt.num(v.rating))} / 5</dd></div>
      ${flags.aiAnalyzer && analysis ? `<div><dt>${esc(t('score'))}</dt><dd data-testid="detail-score">${analysis.score}% ${badge('risk-' + analysis.risk, `${t('risk')}: ${t('risk_' + analysis.risk)}`, 'detail-risk')}</dd></div>` : ''}
    </dl>${x.note ? `<h3>${esc(t('note'))}</h3><p data-testid="detail-note">${esc(x.note)}</p>` : ''}</section>
    <section class="card"><h2>${esc(t('proposalDocuments'))}</h2>${fileList(ctx, files, 'proposal-files')}</section>
  </div>`, { active: 'projects' });
}

function compareView(ctx, { project, rfp, items }) {
  const { t, fmt, flags } = ctx;
  const row = (label, fn, testid) => `<tr data-testid="compare-row-${testid}"><th scope="row">${esc(label)}</th>${items.map((i) => `<td data-testid="compare-${testid}">${fn(i)}</td>`).join('')}</tr>`;
  return layout(ctx, t('compareTitle'), `
  <a class="crumb" href="/rfps/${rfp.id}" data-testid="crumb-back">${esc(rfp.title)}</a>
  <h1>${esc(t('compareTitle'))}</h1><p class="meta">${esc(project.name)} | ${esc(rfp.title)}</p>
  <div class="card table-wrap"><table class="compare" data-testid="compare-table">
    <thead><tr><th></th>${items.map((i) => `<th data-testid="compare-vendor">${esc(i.vendor.name)}${flags.aiAnalyzer && i.analysis?.recommended ? ` ${badge('recommended', t('recommended'))}` : ''}</th>`).join('')}</tr></thead>
    <tbody>
      ${row(t('priceNet'), (i) => esc(fmt.money(i.proposal.priceNet)), 'price')}
      ${flags.vatBreakdown ? row(t('gross'), (i) => esc(fmt.money(i.proposal.gross)), 'gross') : ''}
      ${row(t('delivery'), (i) => esc(t('months', { n: i.proposal.deliveryMonths })), 'delivery')}
      ${row(t('rating'), (i) => esc(fmt.num(i.vendor.rating)), 'rating')}
      ${row(t('expertise'), (i) => esc(i.vendor.expertise.map((x) => t('exp_' + x)).join(', ')), 'expertise')}
      ${row(t('certifications'), (i) => esc(i.vendor.certifications.join(', ') || t('none')), 'certifications')}
      ${flags.aiAnalyzer ? row(t('score'), (i) => `${i.analysis.score}%`, 'score') : ''}
      ${flags.aiAnalyzer ? row(t('risk'), (i) => esc(t('risk_' + i.analysis.risk)), 'risk') : ''}
      ${row(t('documents'), (i) => String(i.files.length), 'documents')}
      ${row(t('status'), (i) => badge(i.proposal.status, t('ps_' + i.proposal.status)), 'status')}
    </tbody></table></div>`, { active: 'projects' });
}

function vendorsList(ctx, { vendors, q, expertise, minRating, all, message }) {
  const { t, fmt } = ctx;
  const rows = vendors.length
    ? vendors.map((v) => `<tr data-testid="vendor-row" data-vendor-id="${v.id}">
        <td><a href="/vendors/${v.id}" data-testid="vendor-link">${esc(v.name)}</a></td><td>${esc(v.city)}</td>
        <td>${v.expertise.map((x) => esc(t('exp_' + x))).join(', ')}</td>
        <td>${esc(v.certifications.join(', '))}</td>
        <td class="num" data-testid="vendor-rating">${esc(fmt.num(v.rating))}</td></tr>`).join('')
    : `<tr><td colspan="5" class="empty" data-testid="vendors-empty">${esc(t('noVendors'))}</td></tr>`;
  return layout(ctx, t('vendors'), `
  <div class="page-head"><h1>${esc(t('vendors'))}</h1><a class="button" href="/vendors/new" data-testid="new-vendor">${esc(t('addVendor'))}</a></div>
  ${flash(message)}
  <form class="toolbar" method="get" action="/vendors" role="search" data-testid="vendor-filters">
    <div class="field"><label for="q">${esc(t('search'))}</label><input id="q" name="q" type="search" value="${esc(q)}" data-testid="input-search"></div>
    ${selectField('expertise', t('expertise'), [['', t('allExpertise')], ...all.map((x) => [x, t('exp_' + x)])], { value: expertise })}
    ${selectField('minRating', t('minRating'), [['', t('all')], ['3', '3+'], ['4', '4+'], ['4.5', '4.5+']], { value: minRating })}
    <button class="secondary" type="submit" data-testid="apply-filters">${esc(t('apply'))}</button>
  </form>
  <div class="card table-wrap"><table data-testid="vendors-table">
    <thead><tr><th>${esc(t('companyName'))}</th><th>${esc(t('city'))}</th><th>${esc(t('expertise'))}</th><th>${esc(t('certifications'))}</th><th class="num">${esc(t('rating'))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`, { active: 'vendors' });
}

function vendorForm(ctx, { all, values = {}, errors = {} }) {
  const { t } = ctx;
  return layout(ctx, t('newVendor'), `
  <a class="crumb" href="/vendors" data-testid="crumb-back">${esc(t('vendors'))}</a>
  <h1>${esc(t('newVendor'))}</h1>
  <form class="card form-grid" method="post" action="/vendors" novalidate data-testid="vendor-form">
    ${field('name', t('companyName'), { value: values.name, error: errors.name })}
    ${field('city', t('city'), { value: values.city, error: errors.city })}
    ${field('contact', t('contactPerson'), { value: values.contact, error: errors.contact })}
    ${field('contactEmail', t('contactEmail'), { type: 'email', value: values.contactEmail, error: errors.contactEmail })}
    ${field('rating', t('rating'), { type: 'number', value: values.rating, error: errors.rating, attrs: 'min="1" max="5" step="0.1"' })}
    ${field('certifications', t('certifications'), { value: values.certifications, hint: t('certificationsHint'), attrs: 'placeholder="ISO 27001, SOC 2"' })}
    <div class="span-2">${checkboxGroup('expertise', t('expertise'), all.map((x) => [x, t('exp_' + x)]), { checked: values.expertise || [], error: errors.expertise })}</div>
    <div class="span-2 actions"><button class="primary" type="submit" data-testid="save-vendor">${esc(t('addVendor'))}</button></div>
  </form>`, { active: 'vendors' });
}

function vendorDetail(ctx, { vendor: v, history, projects, message }) {
  const { t, fmt } = ctx;
  return layout(ctx, v.name, `
  <a class="crumb" href="/vendors" data-testid="crumb-back">${esc(t('vendors'))}</a>
  <div class="page-head"><h1 data-testid="vendor-name">${esc(v.name)}</h1>
    <form method="post" action="/vendors/${v.id}/remove"><button class="secondary danger" type="submit" data-testid="remove-vendor">${esc(t('remove'))}</button></form></div>
  ${flash(message)}
  <div class="split even">
    <section class="card"><dl class="facts">
      <div><dt>${esc(t('city'))}</dt><dd data-testid="vendor-city">${esc(v.city)}</dd></div>
      <div><dt>${esc(t('expertise'))}</dt><dd data-testid="vendor-expertise">${v.expertise.map((x) => esc(t('exp_' + x))).join(', ')}</dd></div>
      <div><dt>${esc(t('rating'))}</dt><dd data-testid="vendor-rating">${esc(fmt.num(v.rating))} / 5</dd></div>
      <div><dt>${esc(t('certifications'))}</dt><dd data-testid="vendor-certifications">${esc(v.certifications.join(', ') || t('none'))}</dd></div>
      <div><dt>${esc(t('contactPerson'))}</dt><dd data-testid="vendor-contact">${esc(v.contact)}</dd></div>
      <div><dt>${esc(t('contactEmail'))}</dt><dd data-testid="vendor-email">${esc(v.contactEmail || t('none'))}</dd></div>
    </dl>
    ${projects.length ? `<form method="post" action="/vendors/${v.id}/assign" class="inline-form" data-testid="vendor-assign-form">
      ${selectField('projectId', t('assignToProject'), projects.map((p) => [p.id, p.name]))}
      <button class="secondary" type="submit" data-testid="vendor-assign">${esc(t('assign'))}</button></form>` : ''}
    </section>
    <section class="card"><h2>${esc(t('previousRfps'))}</h2>
      ${history.length ? `<ul class="plain" data-testid="vendor-history">${history.map((h) => `<li><a href="/rfps/${h.rfp.id}">${esc(h.rfp.title)}</a> ${h.proposal ? badge(h.proposal.status, t('ps_' + h.proposal.status), 'history-status') : badge('awaiting', t('awaiting'), 'history-status')}</li>`).join('')}</ul>`
        : `<p class="empty" data-testid="vendor-history-empty">${esc(t('none'))}</p>`}
    </section>
  </div>`, { active: 'vendors' });
}

module.exports = { dashboard, projectsList, projectForm, projectDetail, rfpForm, rfpDetail, proposalDetail, compareView, vendorsList, vendorForm, vendorDetail };
