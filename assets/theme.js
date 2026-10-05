(() => {
  'use strict';

  const root = window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/';
  const strings = window.themeStrings || {};

  // Custom storefront events. They reach Shopify's Customer Events (custom pixels) when enabled; otherwise no-op.
  const track = (name, detail = {}) => {
    try {
      if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
        window.Shopify.analytics.publish(name, detail);
      }
    } catch (error) {
      /* analytics must never break the page */
    }
  };

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-track]');
    if (el) track(el.dataset.track, { label: el.dataset.trackLabel || el.textContent.trim(), href: el.getAttribute('href') });
  });

  // Mobile menu: native <details>; close on Escape and keep the panel below the header.
  const drawer = document.querySelector('[data-menu-drawer]');
  const header = document.querySelector('.site-header');
  const setHeaderBottom = () => {
    if (header) document.documentElement.style.setProperty('--header-bottom', `${Math.max(header.getBoundingClientRect().bottom, 0)}px`);
  };
  if (drawer) {
    drawer.addEventListener('toggle', () => {
      setHeaderBottom();
      document.body.style.overflow = drawer.open ? 'hidden' : '';
      drawer.querySelector('summary').setAttribute('aria-expanded', drawer.open ? 'true' : 'false');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && drawer.open) {
        drawer.open = false;
        drawer.querySelector('summary').focus();
      }
    });
  }

  // Header search toggle
  const searchToggle = document.querySelector('[data-search-toggle]');
  const searchPanel = document.querySelector('[data-search-panel]');
  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const open = searchPanel.hidden;
      searchPanel.hidden = !open;
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) searchPanel.querySelector('input').focus();
    });
  }

  // Toast
  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  const showToast = (message, link) => {
    if (!toast) return;
    toast.textContent = '';
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      toast.appendChild(a);
    }
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
  };

  const updateCartCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.hidden = count === 0;
      const link = el.closest('a');
      if (link && strings.cartCountOther) {
        const countText = count === 1 ? strings.cartCountOne : strings.cartCountOther.replace('[count]', count);
        link.setAttribute('aria-label', `${strings.cart}, ${countText}`);
      }
    });
  };

  // Quantity steppers
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qty-step]');
    if (!button) return;
    const input = button.parentElement.querySelector('input[type="number"]');
    const step = Number(button.dataset.qtyStep);
    const min = Number(input.min || 0);
    input.value = Math.max(min, (Number(input.value) || 0) + step);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Variant picker: keeps the hidden variant id, price, button state and URL in sync.
  document.querySelectorAll('[data-product-form]').forEach((form) => {
    const dataEl = form.querySelector('[data-variants]');
    if (!dataEl) return;
    const variants = JSON.parse(dataEl.textContent);
    const idInput = form.querySelector('input[name="id"]');
    const submit = form.querySelector('[type="submit"]');
    const section = form.closest('[data-section]');
    const priceEl = section && section.querySelector('[data-price]');

    const money = (cents) => {
      const fmt = form.dataset.moneyFormat || '${{amount}}';
      const amount = (cents / 100).toFixed(2);
      return fmt.replace(/\{\{\s*amount\s*\}\}/, amount).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100));
    };

    form.addEventListener('change', (event) => {
      if (!event.target.matches('[data-option-input]')) return;
      const selected = [...form.querySelectorAll('[data-option-group]')].map((group) => {
        const checked = group.querySelector('input:checked');
        return checked ? checked.value : null;
      });
      const variant = variants.find((v) => v.options.every((opt, i) => opt === selected[i]));
      if (!variant) {
        submit.disabled = true;
        submit.textContent = strings.unavailable;
        return;
      }
      idInput.value = variant.id;
      const pricePending = variant.price === 0;
      submit.disabled = !variant.available || pricePending;
      if (pricePending) submit.textContent = strings.comingSoon;
      else submit.textContent = variant.available ? strings.addToCart : strings.soldOut;
      if (priceEl) {
        priceEl.innerHTML = pricePending
          ? `<span class="price__pending">${strings.priceComingSoon}</span>`
          : variant.compare_at_price > variant.price
          ? `<span class="visually-hidden">${strings.salePrice}</span><span class="price__sale">${money(variant.price)}</span> <span class="visually-hidden">${strings.regularPrice}</span><s class="price__compare">${money(variant.compare_at_price)}</s>`
          : `<span>${money(variant.price)}</span>`;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    });
  });

  // Add to cart without leaving the page (falls back to a normal form post without JS).
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[action$="/cart/add"]');
    if (!form || !window.fetch) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const errorEl = form.querySelector('[data-form-error]');
    if (errorEl) errorEl.textContent = '';
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: new FormData(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.description || strings.addError);
      const cart = await fetch(`${root}cart.js`).then((r) => r.json());
      updateCartCount(cart.item_count);
      showToast(strings.added, { href: `${root}cart`, label: strings.viewCart });
      track('product_added', { title: data.product_title, variant_id: data.variant_id, quantity: data.quantity });
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || strings.addError;
    } finally {
      submit.classList.remove('is-loading');
      submit.removeAttribute('aria-busy');
    }
  });

  // Contact / quote / newsletter forms submit natively to Shopify; show a loading state while they post.
  // JS takes over validation so errors render inline and are announced; without JS the browser's native validation applies.
  const showFieldError = (field) => {
    const id = `${field.id || field.name}-error`;
    let message = document.getElementById(id);
    if (field.validity.valid) {
      field.removeAttribute('aria-invalid');
      if (message) message.remove();
    } else {
      field.setAttribute('aria-invalid', 'true');
      if (!message) {
        message = document.createElement('span');
        message.className = 'field__error';
        message.id = id;
        field.insertAdjacentElement('afterend', message);
      }
      message.textContent = field.validationMessage;
    }
    const describedBy = (field.getAttribute('aria-describedby') || '').split(' ').filter((token) => token && token !== id);
    if (!field.validity.valid) describedBy.push(id);
    if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
    else field.removeAttribute('aria-describedby');
  };

  document.querySelectorAll('form.js-loading-form').forEach((form) => {
    form.noValidate = true;
    const fields = [...form.querySelectorAll('input:not([type="hidden"]), textarea, select')];
    fields.forEach((field) => {
      field.addEventListener('blur', () => { if (field.value) showFieldError(field); });
      field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') showFieldError(field); });
    });
    form.addEventListener('submit', (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        fields.forEach(showFieldError);
        const firstInvalid = fields.find((field) => !field.validity.valid);
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      const submit = form.querySelector('[type="submit"]');
      if (submit) {
        submit.classList.add('is-loading');
        submit.setAttribute('aria-busy', 'true');
      }
      track('form_submitted', { form: form.id });
    });
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('form.js-loading-form [type="submit"].is-loading').forEach((button) => {
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    });
  });

  // Cart: auto-submit quantity changes
  document.querySelectorAll('[data-cart-form] input[type="number"]').forEach((input) => {
    input.addEventListener('change', () => {
      clearTimeout(input._timer);
      input._timer = setTimeout(() => input.form.requestSubmit ? input.form.requestSubmit() : input.form.submit(), 500);
    });
  });

  // Sort select auto-submit
  document.querySelectorAll('[data-auto-submit]').forEach((select) => {
    select.addEventListener('change', () => select.form.submit());
  });

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  window.addEventListener('resize', setHeaderBottom, { passive: true });
  window.addEventListener('scroll', setHeaderBottom, { passive: true });
})();
