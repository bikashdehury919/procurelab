const { esc, layout, field, uploadField, fileList, flash, alertBox, badge } = require('./layout');

function invitationState(store, rfp, vendorId) {
  const proposal = store.proposalOf(rfp.id, vendorId);
  if (proposal) return { key: proposal.status === 'submitted' ? 'submitted' : proposal.status, proposal };
  return { key: store.isOpen(rfp) ? 'awaiting' : 'closed', proposal: null };
}

function portal(ctx, { invitations }) {
  const { t, fmt } = ctx;
  const rows = invitations.length
    ? invitations.map(({ rfp, project, state }) => `<tr data-testid="invitation-row" data-rfp-id="${rfp.id}">
        <td><a href="/portal/rfps/${rfp.id}" data-testid="invitation-link">${esc(rfp.title)}</a></td>
        <td>${esc(project.name)}</td><td class="nowrap" data-testid="invitation-deadline">${esc(fmt.date(rfp.deadline))}</td>
        <td>${badge(state.key, t('inv_' + state.key), 'invitation-status')}</td>
        <td><a class="button small secondary" href="/portal/rfps/${rfp.id}" data-testid="view-rfp">${esc(t('viewRfp'))}</a></td></tr>`).join('')
    : `<tr><td colspan="5" class="empty" data-testid="invitations-empty">${esc(t('noRfpsVendor'))}</td></tr>`;
  return layout(ctx, t('myRfps'), `
  <h1>${esc(t('myRfps'))}</h1>
  <p class="meta" data-testid="vendor-company">${esc(ctx.vendor.name)}</p>
  <div class="card table-wrap"><table data-testid="invitations-table">
    <thead><tr><th>${esc(t('rfpTitle'))}</th><th>${esc(t('projectLabel'))}</th><th>${esc(t('deadline'))}</th><th>${esc(t('status'))}</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`, { active: 'myRfps' });
}

function portalRfp(ctx, { rfp, project, requirements, rfpFiles, proposalFiles, state, questions, values = {}, errors = {}, message }) {
  const { t, fmt, flags, market } = ctx;
  const open = state.key === 'awaiting';
  const proposalBlock = state.proposal
    ? `<dl class="facts" data-testid="your-proposal">
        <div><dt>${esc(t('priceNet'))}</dt><dd data-testid="your-price">${esc(fmt.money(state.proposal.priceNet))}</dd></div>
        ${flags.vatBreakdown ? `<div><dt>${esc(t('vat'))}</dt><dd data-testid="your-vat">${esc(fmt.money(state.proposal.vat))}</dd></div>
        <div><dt>${esc(t('gross'))}</dt><dd data-testid="your-gross">${esc(fmt.money(state.proposal.gross))}</dd></div>` : ''}
        <div><dt>${esc(t('delivery'))}</dt><dd data-testid="your-delivery">${esc(t('months', { n: state.proposal.deliveryMonths }))}</dd></div>
        <div><dt>${esc(t('submittedOn'))}</dt><dd>${esc(fmt.dateTime(state.proposal.submittedAt))}</dd></div>
      </dl><h3>${esc(t('proposalDocuments'))}</h3>${fileList(ctx, proposalFiles, 'your-files')}`
    : open
      ? `<form method="post" action="/portal/rfps/${rfp.id}/proposal" enctype="multipart/form-data" novalidate data-testid="proposal-form">
          ${errors.form ? alertBox(errors.form, 'proposal-error') : ''}
          ${field('priceNet', `${t('priceNet')} (${market.currency})`, { type: 'number', value: values.priceNet, error: errors.priceNet, attrs: 'min="0.01" step="0.01" inputmode="decimal"' })}
          ${flags.vatBreakdown ? `<dl class="vat-preview" data-testid="vat-preview" data-rate="${market.vatRate}" data-locale="${esc(ctx.locale)}" data-currency="${market.currency}">
            <div><dt>${esc(t('vat'))} ${esc(fmt.percent(market.vatRate))}</dt><dd data-testid="vat-amount">${esc(fmt.money(0))}</dd></div>
            <div class="total"><dt>${esc(t('gross'))}</dt><dd data-testid="gross-amount">${esc(fmt.money(0))}</dd></div></dl>` : ''}
          ${field('deliveryMonths', t('deliveryMonths'), { type: 'number', value: values.deliveryMonths, error: errors.deliveryMonths, attrs: 'min="1" max="36" step="1"' })}
          ${uploadField(ctx, 'documents', t('proposalDocuments'), errors.files)}
          ${field('note', t('note'), { type: 'textarea', value: values.note })}
          <button class="primary" type="submit" data-testid="submit-proposal">${esc(t('submitProposal'))}</button>
        </form>`
      : alertBox(t('errClosed'), 'rfp-closed');

  const qBlock = flags.vendorQuestions ? `<section class="card" data-testid="questions"><h2>${esc(t('questions'))}</h2>
    ${questions.length ? `<ul class="plain qa">${questions.map((q) => `<li data-testid="question-item"><p data-testid="question-text">${esc(q.text)}</p>
      ${q.answer ? `<p class="answer" data-testid="answer-text">${esc(q.answer)}</p>` : `<p class="hint" data-testid="awaiting-answer">${esc(t('awaitingAnswer'))}</p>`}</li>`).join('')}</ul>`
      : `<p class="empty" data-testid="questions-empty">${esc(t('noQuestions'))}</p>`}
    ${open ? `<form method="post" action="/portal/rfps/${rfp.id}/questions" novalidate data-testid="question-form">
      ${field('question', t('yourQuestion'), { type: 'textarea', value: values.question, error: errors.question })}
      <button class="secondary" type="submit" data-testid="send-question">${esc(t('sendQuestion'))}</button></form>` : ''}
  </section>` : '';

  return layout(ctx, rfp.title, `
  <a class="crumb" href="/portal" data-testid="crumb-back">${esc(t('myRfps'))}</a>
  <div class="page-head"><div><h1 data-testid="rfp-title">${esc(rfp.title)}</h1>
    <p class="meta">${badge(state.key, t('inv_' + state.key), 'invitation-status')} ${esc(project.name)} | ${esc(t('deadline'))}: <span data-testid="rfp-deadline">${esc(fmt.date(rfp.deadline))}</span></p></div></div>
  ${flash(message)}
  <div class="split">
    <div>
      <section class="card"><h2>${esc(t('requirements'))}</h2><ul class="plain" data-testid="rfp-requirements">${requirements.map((r) => `<li data-testid="requirement-item"><span>${esc(r.name)}</span> ${badge('p-' + r.priority, t('priority_' + r.priority))}</li>`).join('')}</ul>
        <h2>${esc(t('documents'))}</h2>${fileList(ctx, rfpFiles, 'rfp-files')}</section>
      ${qBlock}
    </div>
    <aside class="card"><h2>${esc(t('yourProposal'))}</h2>${proposalBlock}</aside>
  </div>`, { active: 'myRfps' });
}

module.exports = { invitationState, portal, portalRfp };
