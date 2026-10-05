// Static preview only (not part of the Shopify theme). Cart, checkout, search and forms need Shopify,
// so instead of posting to a host that can't handle them, explain what happens on the live store.
(() => {
  const MESSAGES = {
    cart: 'This is a preview of the Nº01 store. Adding to cart and checkout open when the store launches on Shopify.',
    form: 'This is a preview of the Nº01 store, so this form isn\u2019t sent anywhere yet. It goes live when the store launches on Shopify.',
    search: 'Search opens when the store launches on Shopify. For now, browse everything on the Shop page.',
    sort: 'Sorting opens when the store launches on Shopify.',
  };

  let dialog;
  const show = (text) => {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'demo-dialog';
      dialog.innerHTML = '<p></p><button type="button" class="button">OK</button>';
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      document.body.appendChild(dialog);
    }
    dialog.querySelector('p').textContent = text;
    dialog.showModal();
  };

  const kindOf = (form) => {
    const action = form.getAttribute('action') || '';
    if (form.getAttribute('role') === 'search' || /\/search\/?$/.test(action)) return 'search';
    if (/\/cart(\/add)?\/?$/.test(action)) return 'cart';
    if ((form.getAttribute('method') || '').toLowerCase() === 'post') return 'form';
    return null;
  };

  window.addEventListener('submit', (event) => {
    const form = event.target;
    const kind = kindOf(form);
    if (!kind) return;
    // Let the theme show its inline validation errors first.
    if (kind === 'form' && form.classList.contains('js-loading-form') && !form.checkValidity()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    show(MESSAGES[kind]);
  }, true);

  window.addEventListener('change', (event) => {
    if (!event.target.matches('[data-auto-submit]')) return;
    event.stopImmediatePropagation();
    show(MESSAGES.sort);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      .demo-banner { background: #1f1a15; color: #f3ece2; font-size: .78rem; letter-spacing: .04em; text-align: center; padding: .5rem 1rem; }
      .demo-dialog { max-width: 26rem; border: 0; border-radius: 6px; padding: 1.5rem; text-align: center; }
      .demo-dialog::backdrop { background: rgba(20, 15, 10, .55); }
      .demo-dialog p { margin: 0 0 1.25rem; line-height: 1.5; }
    `;
    document.head.appendChild(style);
    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.textContent = 'Preview site \u2014 shopping and forms open when the store launches.';
    document.body.prepend(banner);
  });
})();
