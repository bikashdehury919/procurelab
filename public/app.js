document.addEventListener('DOMContentLoaded', () => {
  // Selects marked data-autosubmit (market, language, rating filter) submit on change.
  document.querySelectorAll('select[data-autosubmit]').forEach((el) => el.addEventListener('change', () => el.form.submit()));

  // Forms with data-confirm ask before submitting (used by "Reset demo data").
  document.querySelectorAll('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => {
    if (!window.confirm(f.dataset.confirm)) e.preventDefault();
  }));

  // Show/hide the vendor company field depending on the selected role in the user form.
  const role = document.querySelector('[data-testid="input-role"]');
  const vendorField = document.querySelector('[data-testid="input-vendorId"]')?.closest('.field');
  if (role && vendorField) {
    const sync = () => { vendorField.hidden = role.value !== 'vendor'; };
    role.addEventListener('change', sync);
    sync();
  }

  // Live VAT preview on the proposal form (rendered only when the vatBreakdown flag is on).
  const preview = document.querySelector('[data-testid="vat-preview"]');
  const amount = document.querySelector('[data-testid="input-priceNet"]');
  if (preview && amount) {
    const rate = Number(preview.dataset.rate);
    const fmt = new Intl.NumberFormat(preview.dataset.locale, { style: 'currency', currency: preview.dataset.currency });
    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    const vatEl = preview.querySelector('[data-testid="vat-amount"]');
    const grossEl = preview.querySelector('[data-testid="gross-amount"]');
    const update = () => {
      const net = round2(Number(amount.value) || 0);
      const vat = round2(net * rate);
      vatEl.textContent = fmt.format(vat);
      grossEl.textContent = fmt.format(round2(net + vat));
    };
    amount.addEventListener('input', update);
    update();
  }
});
