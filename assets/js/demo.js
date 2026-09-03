/*
 * Services page interactive demo — engine.
 * Plain ES2017, no modules, no build step, no framework, no network calls.
 * Renders from window.EV_DEMO only. The only user-controlled string that
 * reaches the DOM is the first-name input, and it is inserted as a text
 * node (never innerHTML) everywhere it appears.
 *
 * Feature-detects window.EV_DEMO and the required DOM before doing anything;
 * if either is missing, the static no-JS fallback in services.html stays
 * visible and this file does nothing else.
 */
(function () {
  'use strict';

  var DATA = window.EV_DEMO;
  var section = document.getElementById('journey');
  var root = document.getElementById('journey-demo');

  if (!DATA || !section || !root) { return; }

  var setupEl = document.getElementById('demo-setup');
  var shellEl = document.getElementById('demo-shell');
  var tradeChipsEl = document.getElementById('demo-trade-chips');
  var sourceChipsEl = document.getElementById('demo-source-chips');
  var nameInput = document.getElementById('demo-name-input');
  var startBtn = document.getElementById('demo-start-btn');
  var phoneCompanyEl = document.getElementById('demo-phone-company');
  var phoneDatetimeEl = document.getElementById('demo-phone-datetime');
  var railList = document.getElementById('demo-rail-list');
  var mobileSteps = document.getElementById('demo-mobile-steps');
  var timerWrap = document.getElementById('demo-timer-wrap');
  var timerValue = document.getElementById('demo-timer-value');
  var messagesEl = document.getElementById('demo-messages');
  var chipRowEl = document.getElementById('demo-chip-row');
  var leadCardEl = document.getElementById('demo-lead-card');
  var queueListEl = document.getElementById('demo-queue-list');
  var checklistEl = document.getElementById('demo-checklist');
  var qualifiedStampEl = document.getElementById('demo-qualified-stamp');
  var nurtureStampEl = document.getElementById('demo-nurture-stamp');
  var assignedSlotEl = document.getElementById('demo-assigned-slot');
  var assignmentEl = document.getElementById('demo-assignment');
  var statusBadgeEl = document.getElementById('demo-status-badge');
  var calendarEl = document.getElementById('demo-calendar');
  var followupEl = document.getElementById('demo-followup');
  var pipelineEl = document.getElementById('demo-pipeline');
  var reportEl = document.getElementById('demo-report');
  var endingEl = document.getElementById('demo-ending');
  var endingLinesEl = document.getElementById('demo-ending-lines');
  var endingContrastEl = document.getElementById('demo-ending-contrast');
  var endingAgainBtn = document.getElementById('demo-ending-again');
  var phoneWrapEl = document.getElementById('demo-phone-wrap');
  var activityListEl = document.getElementById('demo-activity-list');
  var companyInput = document.getElementById('demo-company-input');
  var simulationNoteEl = document.getElementById('demo-simulation-note');
  var mobileTabsEl = document.getElementById('demo-mobile-tabs');
  var tabCustomerBtn = document.getElementById('demo-tab-customer');
  var tabDashboardBtn = document.getElementById('demo-tab-dashboard');
  var tabBadgeEl = document.getElementById('demo-tab-badge');
  var tabBadgeCountEl = document.getElementById('demo-tab-badge-count');
  var tickerEl = document.getElementById('demo-ticker');
  var alertDashboardEl = document.getElementById('demo-alert-dashboard');
  var alertPhoneEl = document.getElementById('demo-alert-phone');

  var required = [
    setupEl, shellEl, tradeChipsEl, sourceChipsEl, nameInput, startBtn,
    phoneCompanyEl, railList, mobileSteps, timerWrap, timerValue, messagesEl, chipRowEl,
    leadCardEl, checklistEl, qualifiedStampEl, assignmentEl, statusBadgeEl,
    calendarEl, followupEl, pipelineEl, reportEl, endingEl, endingLinesEl,
    endingAgainBtn, activityListEl
  ];
  for (var i = 0; i < required.length; i++) {
    if (!required[i]) { return; }
  }

  // ---- motion / timing ----
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* matchMedia unsupported — proceed with motion */ }

  var GSAP = (!reduceMotion && window.gsap) ? window.gsap : null;

  var TYPING_MIN = reduceMotion ? 0 : 500;
  var TYPING_MAX = reduceMotion ? 0 : 900;
  var STAGE_PAUSE = reduceMotion ? 0 : 500;
  var DISQUALIFY_PAUSE = reduceMotion ? 0 : 1200;
  var TIMER_DURATION = reduceMotion ? 0 : 2500;
  var ACTIVITY_STAGGER_MIN = reduceMotion ? 0 : 250;
  var ACTIVITY_STAGGER_MAX = reduceMotion ? 0 : 400;
  var ACTIVITY_MAX_VISIBLE = 8;

  function typingDelay() {
    if (TYPING_MAX === 0) { return 0; }
    return TYPING_MIN + Math.floor(Math.random() * (TYPING_MAX - TYPING_MIN));
  }
  function activityStagger() {
    if (ACTIVITY_STAGGER_MAX === 0) { return 0; }
    return ACTIVITY_STAGGER_MIN + Math.floor(Math.random() * (ACTIVITY_STAGGER_MAX - ACTIVITY_STAGGER_MIN));
  }

  var pendingTimeouts = [];
  function wait(ms, cb) {
    var id = window.setTimeout(function () {
      pendingTimeouts = pendingTimeouts.filter(function (t) { return t !== id; });
      cb();
    }, ms);
    pendingTimeouts.push(id);
    return id;
  }
  function clearPending() {
    pendingTimeouts.forEach(function (id) { window.clearTimeout(id); });
    pendingTimeouts = [];
  }

  // ---- localStorage (safe) ----
  function readLastTrade() {
    try {
      return window.localStorage.getItem('ev_demo_last_trade');
    } catch (e) { return null; }
  }
  function writeLastTrade(id) {
    try {
      window.localStorage.setItem('ev_demo_last_trade', id);
    } catch (e) { /* private mode / disabled storage — ignore */ }
  }
  function readLastCompany() {
    try {
      return window.localStorage.getItem('ev_demo_last_company');
    } catch (e) { return null; }
  }
  function writeLastCompany(name) {
    try {
      window.localStorage.setItem('ev_demo_last_company', name || '');
    } catch (e) { /* private mode / disabled storage — ignore */ }
  }

  // ---- phone scale (fit the frame within the viewport, no page scroll) ----
  var PHONE_W = 390;
  var PHONE_H = 740;
  function updatePhoneScale() {
    if (!phoneWrapEl) { return; }
    var isLg = false;
    try { isLg = window.matchMedia('(min-width: 1024px)').matches; } catch (e) { /* ignore */ }
    var scale;
    if (isLg) {
      scale = (window.innerHeight - 140) / PHONE_H;
    } else {
      scale = (window.innerWidth - 32) / PHONE_W;
    }
    if (!isFinite(scale) || scale <= 0) { scale = 1; }
    scale = Math.min(1, scale);
    phoneWrapEl.style.setProperty('--phone-scale', String(scale));
    phoneWrapEl.style.width = (PHONE_W * scale) + 'px';
    phoneWrapEl.style.height = (PHONE_H * scale) + 'px';
  }
  window.addEventListener('resize', updatePhoneScale);

  // ---- scroll the demo shell under the sticky nav once, on Start ----
  function scrollShellIntoView() {
    if (!shellEl) { return; }
    var run = function () {
      var navOffset = 96;
      var rect = shellEl.getBoundingClientRect();
      var top = window.pageYOffset + rect.top - navOffset;
      if (window.scrollTo) {
        try {
          window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        } catch (e) {
          window.scrollTo(0, top);
        }
      }
    };
    if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { run(); }
  }

  // ---- DOM helpers ----
  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.appendChild(document.createTextNode(text)); }
    return node;
  }
  function focusFirst(container) {
    var btn = container.querySelector('button');
    if (btn) { btn.focus(); }
  }

  // ---- tiny template substitution: {token} -> dict[token] ----
  // {company} resolves from the active session (personalized business name,
  // falling back to the trade's fictional company) unless a call site passes
  // its own `company` key.
  function fmt(str, dict) {
    return str.replace(/\{(\w+)\}/g, function (m, key) {
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) { return String(dict[key]); }
      if (key === 'company' && session) { return session.company; }
      return m;
    });
  }

  var NEXT_DAY = { Mon: 'Tue', Tue: 'Wed', Wed: 'Thu', Thu: 'Fri', Fri: 'Mon' };
  var DAY_FULL = {
    Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
    Today: 'today', Tomorrow: 'tomorrow'
  };
  function fullDay(dayPart) {
    return DAY_FULL[dayPart] || dayPart;
  }

  // ---- session state ----
  var session = null;
  var RAIL_STAGE_COUNT = 8;

  function newSession(tradeId, sourceId, name, company) {
    var trade = DATA.trades[tradeId];
    return {
      trade: trade,
      source: DATA.sources[sourceId],
      name: name || DATA.shared.setup.namePlaceholder,
      company: company || trade.company,
      answers: [],
      stageIndex: 0,
      bookedSlot: null
    };
  }

  // ---- rail ----
  function buildRail() {
    clear(railList);
    clear(mobileSteps);
    DATA.rail.forEach(function (stage, idx) {
      var li = el('li', 'demo-rail-item');
      li.setAttribute('data-stage-index', String(idx));
      var num = el('span', 'demo-rail-num', stage.n);
      var heading = el('p', 'demo-rail-heading', stage.heading);
      li.appendChild(num);
      li.appendChild(heading);
      var replace = el('p', 'demo-rail-replaces', 'What this replaces: ' + stage.replaces);
      replace.setAttribute('data-rail-replaces', '');
      replace.hidden = true;
      li.appendChild(replace);
      railList.appendChild(li);

      var step = el('span', 'demo-step', stage.n);
      step.setAttribute('data-stage-index', String(idx));
      mobileSteps.appendChild(step);
    });
  }

  function setActiveStage(idx, complete) {
    var items = railList.querySelectorAll('.demo-rail-item');
    var steps = mobileSteps.querySelectorAll('.demo-step');
    items.forEach(function (item, i) {
      var replaceEl = item.querySelector('[data-rail-replaces]');
      item.classList.remove('is-active', 'is-complete');
      item.removeAttribute('aria-current');
      if (replaceEl) { replaceEl.hidden = true; }
      if (i < idx) {
        item.classList.add('is-complete');
      } else if (i === idx) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'step');
        if (replaceEl) { replaceEl.hidden = false; }
      }
    });
    steps.forEach(function (step, i) {
      step.classList.remove('is-active', 'is-complete');
      if (i < idx) { step.classList.add('is-complete'); }
      else if (i === idx) { step.classList.add('is-active'); }
    });
  }

  // ---- card "goes active" flourish: gold border sweep + 2px lift ----
  function pulseCardActive(node) {
    if (!node) { return; }
    node.classList.add('is-active-card');
    wait(reduceMotion ? 0 : 900, function () {
      node.classList.remove('is-active-card');
    });
  }

  // ---- phone header date/time (S3) ----
  function setPhoneDatetime(text) {
    if (!phoneDatetimeEl) { return; }
    if (reduceMotion || !GSAP) {
      phoneDatetimeEl.textContent = text;
      return;
    }
    GSAP.to(phoneDatetimeEl, {
      y: -6, opacity: 0, duration: 0.14, ease: 'power1.in',
      onComplete: function () {
        phoneDatetimeEl.textContent = text;
        GSAP.fromTo(phoneDatetimeEl, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.18, ease: 'power2.out' });
      }
    });
  }

  function addThreadStamp(text) {
    var stamp = el('p', 'demo-thread-stamp', text);
    messagesEl.appendChild(stamp);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---- phone bubbles ----
  function animateBubbleIn(bubble, fromRight) {
    if (reduceMotion || !GSAP) { return; }
    GSAP.fromTo(bubble,
      { scale: 0.92, y: 8, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.26, ease: 'power2.out' }
    );
  }
  function appendSystemBubble(text) {
    var bubble = el('div', 'demo-bubble demo-bubble-system');
    bubble.appendChild(el('p', null, text));
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    animateBubbleIn(bubble, false);
  }
  function appendCustomerBubble(text) {
    var bubble = el('div', 'demo-bubble demo-bubble-customer');
    bubble.appendChild(el('p', null, text));
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    animateBubbleIn(bubble, true);
  }
  function appendHumanBubble(teamMember, text) {
    var initials = teamMember.split(' ').map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var wrap = el('div', 'demo-bubble-human-wrap');
    var avatar = el('div', 'demo-bubble-human-avatar', initials);
    var col = el('div', 'demo-bubble-human-col');
    col.appendChild(el('p', 'demo-bubble-human-sender', teamMember));
    var bubble = el('div', 'demo-bubble demo-bubble-system demo-bubble-human');
    bubble.appendChild(el('p', null, text));
    col.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(col);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    animateBubbleIn(bubble, false);
  }
  function appendTypingIndicator(cb) {
    var indicator = el('div', 'demo-bubble demo-bubble-system demo-typing');
    indicator.setAttribute('aria-hidden', 'true');
    indicator.appendChild(el('span', 'demo-typing-dot'));
    indicator.appendChild(el('span', 'demo-typing-dot'));
    indicator.appendChild(el('span', 'demo-typing-dot'));
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    wait(typingDelay(), function () {
      if (indicator.parentNode) { indicator.parentNode.removeChild(indicator); }
      cb();
    });
  }
  function sayThen(text, cb) {
    appendTypingIndicator(function () {
      appendSystemBubble(text);
      wait(reduceMotion ? 0 : 150, cb);
    });
  }

  // ---- chip rendering ----
  function renderChips(options, onPick) {
    clear(chipRowEl);
    options.forEach(function (opt, idx) {
      var btn = el('button', 'demo-chip', opt.text);
      btn.type = 'button';
      if (GSAP) {
        GSAP.fromTo(btn, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out', delay: idx * 0.04 });
      }
      btn.addEventListener('click', function () {
        clear(chipRowEl);
        onPick(opt);
      });
      chipRowEl.appendChild(btn);
    });
    focusFirst(chipRowEl);
  }

  // ---- Continue gate: nothing advances until tapped ----
  function renderContinueGate(cb) {
    clear(chipRowEl);
    var btn = el('button', 'demo-chip demo-chip-continue', 'Continue');
    btn.type = 'button';
    if (GSAP) {
      GSAP.fromTo(btn, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.24, ease: 'power2.out' });
    }
    btn.addEventListener('click', function () {
      clear(chipRowEl);
      cb();
    });
    chipRowEl.appendChild(btn);
    focusFirst(chipRowEl);
  }

  // ---- dashboard ----
  function showPlaceholder(container) {
    clear(container);
    var label = container.getAttribute('data-placeholder');
    container.classList.add('demo-slot-empty');
    if (label) { container.appendChild(el('p', 'demo-slot-empty-text', label)); }
  }
  function clearPlaceholder(container) {
    container.classList.remove('demo-slot-empty');
  }

  function resetDashboard() {
    showPlaceholder(leadCardEl);
    if (queueListEl) {
      queueListEl.hidden = true;
      var kept = queueListEl.querySelector('.demo-queue-heading');
      clear(queueListEl);
      if (kept) { queueListEl.appendChild(kept); }
    }
    clear(checklistEl);
    qualifiedStampEl.hidden = true;
    if (nurtureStampEl) { nurtureStampEl.hidden = true; }
    showPlaceholder(assignmentEl);
    statusBadgeEl.hidden = true;
    statusBadgeEl.classList.remove('is-warn');
    showPlaceholder(calendarEl);
    followupEl.hidden = true;
    clear(followupEl);
    showPlaceholder(pipelineEl);
    showPlaceholder(reportEl);
    if (activityListEl) { clear(activityListEl); }
  }

  function showLeadCard(name, source) {
    clearPlaceholder(leadCardEl);
    clear(leadCardEl);
    var title = el('p', 'demo-lead-name');
    title.appendChild(document.createTextNode('New lead — '));
    title.appendChild(document.createTextNode(name));
    var meta = el('p', 'demo-lead-meta');
    meta.appendChild(document.createTextNode(source.leadCardSource + ' · '));
    var consent = el('span', 'demo-consent', source.consentLine);
    meta.appendChild(consent);
    leadCardEl.appendChild(title);
    leadCardEl.appendChild(meta);
    leadCardEl.hidden = false;
  }

  // ---- lead queue (S5): other leads arrive while the visitor plays ----
  function showQueueEntry(entry) {
    if (!queueListEl || !DATA.shared.queue) { return; }
    queueListEl.hidden = false;
    var pill = el('div', 'demo-queue-pill');
    var label = el('span', null, entry.text);
    var replied = el('span', 'demo-queue-pill-replied', 'replied 0:07');
    pill.appendChild(label);
    pill.appendChild(replied);
    queueListEl.appendChild(pill);
    if (GSAP) {
      GSAP.fromTo(pill, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'power2.out' });
    }
    wait(reduceMotion ? 0 : 800, function () {
      replied.classList.add('is-shown');
    });
  }
  var queueIndex = 0;
  function advanceQueue() {
    if (!DATA.shared.queue) { return; }
    if (queueIndex >= DATA.shared.queue.length) { return; }
    showQueueEntry(DATA.shared.queue[queueIndex]);
    queueIndex++;
  }

  function buildChecklist(trade) {
    clear(checklistEl);
    trade.questions.forEach(function (q, idx) {
      var row = el('li', 'demo-checklist-row demo-checklist-pending');
      row.setAttribute('data-question-index', String(idx));
      var mark = el('span', 'demo-check', '');
      var text = el('span', 'demo-check-text', '—');
      row.appendChild(mark);
      row.appendChild(text);
      checklistEl.appendChild(row);
    });
  }

  function tickChecklistRow(idx, label, isWeak) {
    var row = checklistEl.querySelector('[data-question-index="' + idx + '"]');
    if (!row) { return; }
    row.classList.remove('demo-checklist-pending');
    row.classList.add(isWeak ? 'demo-checklist-weak' : 'demo-checklist-done');
    var mark = row.querySelector('.demo-check');
    var text = row.querySelector('.demo-check-text');
    mark.textContent = isWeak ? '⚠' : '✓';
    text.textContent = isWeak ? 'Not a fit today' : label;
    if (GSAP) {
      GSAP.fromTo(mark, { scale: 1.4 }, { scale: 1, duration: 0.3, ease: 'power2.out' });
    }
  }

  function showQualifiedStamp() {
    qualifiedStampEl.hidden = false;
    if (GSAP) {
      GSAP.fromTo(qualifiedStampEl,
        { scale: 1.3, rotate: -3, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
      );
    }
  }

  function showNurtureStamp(trade) {
    if (!nurtureStampEl) { return; }
    nurtureStampEl.textContent = trade.nurtureStamp;
    nurtureStampEl.hidden = false;
    if (GSAP) {
      GSAP.fromTo(nurtureStampEl,
        { scale: 1.3, rotate: -3, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
      );
    }
  }

  function showAssignment(trade) {
    clearPlaceholder(assignmentEl);
    clear(assignmentEl);
    assignmentEl.appendChild(el('p', null, 'Assigned: ' + trade.teamMember + ' · responded in 0:07'));
    assignmentEl.hidden = false;
    statusBadgeEl.hidden = false;
    statusBadgeEl.classList.remove('is-warn');
    statusBadgeEl.textContent = 'On time';
    pulseCardActive(assignedSlotEl);
  }

  // ---- escalation beat (s04): On time (green) -> Escalated (amber) -> Owned (green) ----
  function runEscalation(trade, cb) {
    var teamFirst = trade.teamMember.split(' ')[0];
    logActivity(fmt(DATA.shared.activity.s04[0], { teamMember: trade.teamMember }));
    wait(reduceMotion ? 150 : 1200, function () {
      statusBadgeEl.classList.add('is-warn');
      statusBadgeEl.textContent = 'Escalated';
      pulseCardActive(assignedSlotEl);
      showOwnerAlert(
        DATA.shared.alerts.unclaimedTitle,
        fmt(DATA.shared.alerts.unclaimedBody, { teamMember: trade.teamMember, owner: trade.owner })
      );
      logActivity(fmt(DATA.shared.activity.s04[1], { teamFirstName: teamFirst, owner: trade.owner }));
      wait(reduceMotion ? 100 : 700, function () {
        statusBadgeEl.classList.remove('is-warn');
        statusBadgeEl.textContent = 'Owned by ' + trade.owner;
        pulseCardActive(assignedSlotEl);
        logActivity(fmt(DATA.shared.activity.s04[2], { owner: trade.owner }));
        wait(STAGE_PAUSE, cb);
      });
    });
  }

  function showCalendarPending(trade) {
    clearPlaceholder(calendarEl);
    clear(calendarEl);
    var label = el('p', 'demo-calendar-label', trade.slotType);
    calendarEl.appendChild(label);
    calendarEl.hidden = false;
  }
  function showCalendarBooked(trade, slot) {
    clearPlaceholder(calendarEl);
    clear(calendarEl);
    var label = el('p', 'demo-calendar-label', trade.slotType);
    var value = el('p', 'demo-calendar-slot');
    value.appendChild(document.createTextNode(slot + ' '));
    value.appendChild(el('span', 'demo-gold', '✓'));
    calendarEl.appendChild(label);
    calendarEl.appendChild(value);
    calendarEl.hidden = false;
    pulseCardActive(calendarEl.closest('.demo-slot'));
  }

  function showFollowupThread(trade) {
    clear(followupEl);
    var heading = el('p', 'demo-followup-heading', 'Follow-up scheduled');
    followupEl.appendChild(heading);
    trade.followUp.forEach(function (f) {
      var row = el('p', 'demo-followup-row');
      row.appendChild(el('span', 'demo-followup-timing', f.timing));
      row.appendChild(document.createTextNode(' — ' + f.text));
      followupEl.appendChild(row);
    });
    followupEl.hidden = false;
  }

  function moveCard(board, card, colName) {
    var target = board.querySelector('[data-col="' + colName + '"]');
    if (!card || !target || card.parentNode === target) { return; }
    if (GSAP && !reduceMotion) {
      var before = card.getBoundingClientRect();
      card.parentNode.removeChild(card);
      target.appendChild(card);
      var after = card.getBoundingClientRect();
      var dx = before.left - after.left;
      var dy = before.top - after.top;
      GSAP.fromTo(card, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.45, ease: 'power2.inOut' });
    } else {
      card.parentNode.removeChild(card);
      target.appendChild(card);
    }
  }

  function showPipeline(trade, name) {
    clearPlaceholder(pipelineEl);
    clear(pipelineEl);
    var board = el('div', 'demo-pipeline-board');
    trade.pipelineColumns.forEach(function (col) {
      var colEl = el('div', 'demo-pipeline-col');
      colEl.appendChild(el('p', 'demo-pipeline-col-label', col));
      if (col === 'New') {
        colEl.appendChild(el('div', 'demo-pipeline-card', name));
      }
      colEl.setAttribute('data-col', col);
      board.appendChild(colEl);
    });
    pipelineEl.appendChild(board);
    pipelineEl.hidden = false;
    // animate the card moving New -> Booked -> Won
    wait(reduceMotion ? 0 : 500, function () {
      var card = board.querySelector('.demo-pipeline-card');
      moveCard(board, card, 'Booked');
      wait(reduceMotion ? 0 : 600, function () {
        moveCard(board, card, 'Won');
      });
    });
  }

  function showNurturePipeline(trade, name) {
    clearPlaceholder(pipelineEl);
    clear(pipelineEl);
    var board = el('div', 'demo-pipeline-board demo-pipeline-board-nurture');
    var newCol = el('div', 'demo-pipeline-col');
    newCol.setAttribute('data-col', 'New');
    newCol.appendChild(el('p', 'demo-pipeline-col-label', 'New'));
    var nurtureCol = el('div', 'demo-pipeline-col');
    nurtureCol.setAttribute('data-col', 'Nurture');
    nurtureCol.appendChild(el('p', 'demo-pipeline-col-label', 'Nurture'));
    var card = el('div', 'demo-pipeline-card', name);
    newCol.appendChild(card);
    board.appendChild(newCol);
    board.appendChild(nurtureCol);
    pipelineEl.appendChild(board);
    pipelineEl.hidden = false;
    wait(reduceMotion ? 0 : 500, function () {
      moveCard(board, card, 'Nurture');
    });
  }

  function showReport(trade) {
    clearPlaceholder(reportEl);
    clear(reportEl);
    reportEl.appendChild(el('p', 'demo-report-line', trade.reportLine));
    var chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chart.setAttribute('viewBox', '0 0 160 70');
    chart.setAttribute('class', 'demo-report-chart');
    chart.setAttribute('aria-hidden', 'true');
    var heights = [34, 46, 22, 54];
    var xs = [6, 34, 62, 90];
    var cols = trade.pipelineColumns.slice(0, 4);
    heights.forEach(function (h, idx) {
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(xs[idx]));
      rect.setAttribute('y', String(64 - h));
      rect.setAttribute('width', '18');
      rect.setAttribute('height', String(h));
      rect.setAttribute('class', idx === 2 ? 'demo-chart-bar demo-chart-bar-weak' : 'demo-chart-bar');
      chart.appendChild(rect);
    });
    reportEl.appendChild(chart);
    var labels = el('p', 'demo-report-chart-labels');
    labels.setAttribute('aria-hidden', 'true');
    cols.forEach(function (c, idx) {
      labels.appendChild(el('span', null, c));
    });
    reportEl.appendChild(labels);
    reportEl.hidden = false;
  }

  // ---- system activity feed (C2) ----
  var activityQueue = [];
  var activityRunning = false;
  function logActivity(text, kind) {
    activityQueue.push({ text: text, kind: kind || 'default' });
    runActivityQueue();
  }
  function logActivityBatch(lines, kind) {
    lines.forEach(function (line) { logActivity(line, kind); });
  }
  function runActivityQueue() {
    if (activityRunning) { return; }
    activityRunning = true;
    step();
    function step() {
      if (activityQueue.length === 0) { activityRunning = false; return; }
      var item = activityQueue.shift();
      appendActivityRow(item.text, item.kind);
      wait(activityStagger(), step);
    }
  }
  function appendActivityRow(text, kind) {
    var row = el('li', 'demo-activity-row', text);
    if (kind === 'good') { row.classList.add('is-status-good'); }
    if (kind === 'warn') { row.classList.add('is-status-warn'); }
    activityListEl.appendChild(row);
    if (GSAP) {
      GSAP.fromTo(row, { opacity: 0, x: -4 }, { opacity: 1, x: 0, duration: 0.22, ease: 'power2.out' });
    }
    var rows = activityListEl.querySelectorAll('.demo-activity-row');
    if (rows.length > ACTIVITY_MAX_VISIBLE) {
      var extra = rows.length - ACTIVITY_MAX_VISIBLE;
      for (var i = 0; i < extra; i++) {
        var old = rows[i];
        if (GSAP) {
          GSAP.to(old, { opacity: 0, y: -8, duration: 0.25, onComplete: function (node) {
            return function () { if (node.parentNode) { node.parentNode.removeChild(node); } };
          }(old) });
        } else if (old.parentNode) {
          old.parentNode.removeChild(old);
        }
      }
    }
    activityListEl.scrollTop = activityListEl.scrollHeight;
    updateTicker(text);
    bumpDashboardBadge();
  }

  // ---- mobile tabs (below lg): Customer / Your dashboard ----
  var mobileTab = 'customer';
  var dashboardBadgeCount = 0;
  function setMobileTab(tab) {
    mobileTab = tab;
    if (shellEl) { shellEl.setAttribute('data-mobile-tab', tab); }
    if (tabCustomerBtn) {
      tabCustomerBtn.classList.toggle('is-active', tab === 'customer');
      tabCustomerBtn.setAttribute('aria-selected', tab === 'customer' ? 'true' : 'false');
    }
    if (tabDashboardBtn) {
      tabDashboardBtn.classList.toggle('is-active', tab === 'dashboard');
      tabDashboardBtn.setAttribute('aria-selected', tab === 'dashboard' ? 'true' : 'false');
    }
    if (tab === 'dashboard') { clearDashboardBadge(); }
  }
  function clearDashboardBadge() {
    dashboardBadgeCount = 0;
    if (tabBadgeEl) { tabBadgeEl.hidden = true; }
    if (tabBadgeCountEl) { tabBadgeCountEl.textContent = ''; }
  }
  function bumpDashboardBadge() {
    if (!tabBadgeEl || !tabBadgeCountEl) { return; }
    if (mobileTab !== 'customer') { return; }
    dashboardBadgeCount++;
    tabBadgeEl.hidden = false;
    tabBadgeCountEl.textContent = dashboardBadgeCount + ' new';
    var dot = tabBadgeEl.querySelector('.demo-tab-dot');
    if (dot && GSAP) {
      GSAP.fromTo(dot, { scale: 1 }, { scale: 1.4, duration: 0.25, yoyo: true, repeat: 1, ease: 'power1.inOut' });
    }
  }
  function updateTicker(text) {
    if (!tickerEl) { return; }
    tickerEl.textContent = text;
    if (reduceMotion) { tickerEl.classList.add('is-shown'); return; }
    tickerEl.classList.remove('is-shown');
    void tickerEl.offsetWidth; /* force reflow so the fade-in retriggers */
    tickerEl.classList.add('is-shown');
  }
  function maybeAutoSwitchToDashboard() {
    var isMobile = false;
    try { isMobile = !window.matchMedia('(min-width: 1024px)').matches; } catch (e) { /* ignore */ }
    if (isMobile && mobileTab === 'customer') { setMobileTab('dashboard'); }
  }
  if (tabCustomerBtn) { tabCustomerBtn.addEventListener('click', function () { setMobileTab('customer'); }); }
  if (tabDashboardBtn) { tabDashboardBtn.addEventListener('click', function () { setMobileTab('dashboard'); }); }

  // ---- owner lock-screen alerts (C at s04: new lead + escalation) ----
  function removeAlertCard(card) {
    if (card && card.parentNode) { card.parentNode.removeChild(card); }
  }
  function showOwnerAlert(title, body) {
    var isDesktop = false;
    try { isDesktop = window.matchMedia('(min-width: 1024px)').matches; } catch (e) { /* ignore */ }
    var anchor = isDesktop ? alertDashboardEl : alertPhoneEl;
    if (!anchor) { return; }
    var card = el('div', 'demo-alert-card');
    card.setAttribute('role', 'status');
    var icon = el('div', 'demo-alert-icon', 'LC');
    icon.setAttribute('aria-hidden', 'true');
    var bodyWrap = el('div', 'demo-alert-body');
    var appLine = el('p', 'demo-alert-appline');
    appLine.appendChild(document.createTextNode(DATA.shared.alerts.app));
    appLine.appendChild(el('span', 'demo-alert-time', DATA.shared.alerts.time));
    bodyWrap.appendChild(appLine);
    bodyWrap.appendChild(el('p', 'demo-alert-title', title));
    bodyWrap.appendChild(el('p', 'demo-alert-text', body));
    card.appendChild(icon);
    card.appendChild(bodyWrap);
    anchor.appendChild(card);
    if (reduceMotion || !GSAP) {
      wait(2800, function () { removeAlertCard(card); });
      return;
    }
    GSAP.fromTo(card, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.32, ease: 'power3.out' });
    wait(2800, function () {
      GSAP.to(card, {
        y: -12, opacity: 0, duration: 0.22, ease: 'power2.in',
        onComplete: function () { removeAlertCard(card); }
      });
    });
  }

  // ---- ending ----
  function renderEndingContrast(kind, ctx) {
    if (!endingContrastEl) { return; }
    clear(endingContrastEl);
    var data = DATA.shared.endings[kind];
    if (!data || !data.usually || !data.withSystem) { return; }
    var usuallyCol = el('div', 'demo-ending-contrast-col demo-ending-contrast-usually');
    usuallyCol.appendChild(el('p', 'demo-ending-contrast-col-label', 'Usually'));
    var usuallyLines = data.usually.map(function (line) {
      var p = el('p', 'demo-ending-contrast-line', line);
      usuallyCol.appendChild(p);
      return p;
    });
    var systemCol = el('div', 'demo-ending-contrast-col demo-ending-contrast-system');
    systemCol.appendChild(el('p', 'demo-ending-contrast-col-label', 'With the system'));
    data.withSystem.forEach(function (line) {
      systemCol.appendChild(el('p', 'demo-ending-contrast-line', fmt(line, ctx)));
    });
    endingContrastEl.appendChild(usuallyCol);
    endingContrastEl.appendChild(systemCol);
    wait(reduceMotion ? 0 : 300, function () {
      usuallyLines.forEach(function (p, idx) {
        wait(reduceMotion ? 0 : idx * 150, function () { p.classList.add('is-struck'); });
      });
    });
  }

  function showEnding(kind, ctx) {
    setActiveStage(RAIL_STAGE_COUNT, true);
    maybeAutoSwitchToDashboard();
    clear(endingLinesEl);
    var data = DATA.shared.endings[kind];
    var lines = data.lines || data;
    lines.forEach(function (line) {
      endingLinesEl.appendChild(el('p', 'demo-ending-line', line));
    });
    renderEndingContrast(kind, ctx || {});
    clear(chipRowEl);
    timerWrap.hidden = true;
    messagesEl.hidden = true;
    endingEl.hidden = false;
  }

  // ---- flow ----
  function startDemo(tradeId, sourceId, name, company) {
    clearPending();
    session = newSession(tradeId, sourceId, name, company);
    writeLastTrade(tradeId);
    writeLastCompany(company);
    phoneCompanyEl.textContent = session.company;
    setPhoneDatetime('Tue 4:12 pm');
    queueIndex = 0;
    setMobileTab('customer');
    clearDashboardBadge();
    if (tickerEl) { tickerEl.textContent = ''; tickerEl.classList.remove('is-shown'); }

    setupEl.hidden = true;
    shellEl.hidden = false;
    endingEl.hidden = true;
    messagesEl.hidden = false;
    clear(messagesEl);
    clear(chipRowEl);
    timerWrap.hidden = true;
    resetDashboard();
    buildChecklist(session.trade);
    setActiveStage(0, false);
    scrollShellIntoView();

    runS01();
  }

  function runS01() {
    setActiveStage(0, false);
    var escapedName = session.name;
    showLeadCard(escapedName, session.source);
    pulseCardActive(leadCardEl.closest('.demo-slot'));
    logActivityBatch(
      DATA.shared.activity.s01.map(function (t) { return fmt(t, { sourceLabel: session.source.label }); })
    );
    wait(STAGE_PAUSE, runS02Timer);
  }

  function runS02Timer() {
    setActiveStage(1, false);
    timerWrap.hidden = false;
    timerValue.textContent = 'Time to first reply · 0:00';
    if (TIMER_DURATION === 0) {
      timerValue.textContent = 'Time to first reply · 0:07';
      wait(0, runS02Message);
      return;
    }
    var start = null;
    function frame(ts) {
      if (start === null) { start = ts; }
      var elapsed = ts - start;
      var pct = Math.min(1, elapsed / TIMER_DURATION);
      var seconds = Math.min(7, Math.round(pct * 7));
      timerValue.textContent = 'Time to first reply · 0:0' + seconds;
      if (pct < 1) {
        window.requestAnimationFrame(frame);
      } else {
        wait(150, runS02Message);
      }
    }
    window.requestAnimationFrame(frame);
  }

  function runS02Message() {
    timerWrap.hidden = true;
    logActivityBatch(DATA.shared.activity.s02);
    sayThen(session.source.openingLine, function () {
      askQuestion(0);
    });
  }

  function askQuestion(qIndex) {
    var trade = session.trade;
    var q = trade.questions[qIndex];
    setActiveStage(qIndex === 0 ? 1 : 2, false);
    if (qIndex === 1) { advanceQueue(); }
    sayThen(q.text, function () {
      renderChips(q.answers, function (answer) {
        handleAnswer(qIndex, answer);
      });
    });
  }

  function handleAnswer(qIndex, answer) {
    session.answers[qIndex] = answer;
    appendCustomerBubble(answer.text);
    sayThen(answer.ack, function () {
      if (answer.weak) {
        runDisqualifyMoment(qIndex, answer);
        return;
      }
      tickChecklistRow(qIndex, answer.label, false);
      pulseCardActive(checklistEl.closest('.demo-slot'));
      var nextIndex = qIndex + 1;
      if (nextIndex < session.trade.questions.length) {
        askQuestion(nextIndex);
      } else {
        showQualifiedStamp();
        var trade = session.trade;
        logActivityBatch(
          DATA.shared.activity.s03.map(function (t) { return fmt(t, { shortName: trade.shortName }); })
        );
        logActivity(DATA.shared.activity.s03Qualified, 'good');
        wait(STAGE_PAUSE, runS04);
      }
    });
  }

  // ---- C1: disqualification is a moment, gated behind Continue ----
  function runDisqualifyMoment(qIndex, answer) {
    var trade = session.trade;
    wait(DISQUALIFY_PAUSE, function () {
      tickChecklistRow(qIndex, answer.label, true);
      pulseCardActive(checklistEl.closest('.demo-slot'));
      logActivityBatch(
        DATA.shared.activity.s03.map(function (t) { return fmt(t, { shortName: trade.shortName }); })
      );
      logActivity(DATA.shared.activity.s03Weak, 'warn');
      wait(reduceMotion ? 0 : 300, function () {
        showNurtureStamp(trade);
        showNurturePipeline(trade, session.name);
        logActivityBatch(DATA.shared.activity.weak, 'warn');
        wait(STAGE_PAUSE, function () {
          addThreadStamp('Later that day');
          appendSystemBubble(fmt(trade.nurtureLine, {}));
          renderContinueGate(function () {
            showEnding('nurture', { resource: trade.resourceLabel });
          });
        });
      });
    });
  }

  function runS04() {
    setActiveStage(3, false);
    var trade = session.trade;
    showAssignment(trade);
    var firstName = session.name.split(' ')[0];
    var serviceAnswer = session.answers[0] ? session.answers[0].text : '';
    var areaAnswer = session.answers[1] ? session.answers[1].text : '';
    showOwnerAlert(
      fmt(DATA.shared.alerts.newLeadTitle, { firstName: firstName }),
      fmt(DATA.shared.alerts.newLeadBody, { serviceAnswer: serviceAnswer, areaAnswer: areaAnswer })
    );
    runEscalation(trade, runS05);
  }

  function runS05() {
    setActiveStage(4, false);
    var trade = session.trade;
    showCalendarPending(trade);
    advanceQueue();
    var options = trade.slots.map(function (s) { return { text: s, kind: 'slot' }; });
    options.push({ text: DATA.shared.buttons.notNow, kind: 'notNow' });
    renderChips(options, function (opt) {
      appendCustomerBubble(opt.text);
      if (opt.kind === 'slot') {
        session.bookedSlot = opt.text;
        sayThen(trade.bookedConfirmation, function () {
          showCalendarBooked(trade, opt.text);
          var dayPart = opt.text.split(' ')[0];
          var reminderTime = dayPart + ' 8:00 am';
          logActivityBatch(
            DATA.shared.activity.s05.map(function (t) {
              return fmt(t, { slot: opt.text, reminderTime: reminderTime });
            })
          );
          setPhoneDatetime(opt.text);
          addThreadStamp(opt.text);
          appendHumanBubble(trade.teamMember, fmt(trade.humanLine, {
            name: session.name,
            day: fullDay(dayPart)
          }));
          logActivity(fmt(DATA.shared.activity.handoff, { teamMember: trade.teamMember }));
          runS07('booked');
        });
      } else {
        runS06();
      }
    });
  }

  function runS06() {
    setActiveStage(5, false);
    var trade = session.trade;
    showFollowupThread(trade);
    logActivityBatch(DATA.shared.activity.s06.slice(0, 2));
    var idx = 0;
    function next() {
      if (idx >= trade.followUp.length) {
        logActivity(DATA.shared.activity.s06[2]);
        runS07('followUp');
        return;
      }
      sayThen(trade.followUp[idx].text, function () {
        idx++;
        next();
      });
    }
    next();
  }

  function runS07(endingKind) {
    setActiveStage(6, false);
    advanceQueue();
    showPipeline(session.trade, session.name);
    var trade = session.trade;
    var slot = session.bookedSlot || trade.slots[0];
    var dayPart = slot.split(' ')[0];
    var nextDay = NEXT_DAY[dayPart] || 'Later';
    var milestoneCol = trade.pipelineColumns[2];
    logActivityBatch(
      DATA.shared.activity.s07.map(function (t) {
        return fmt(t, { slot: slot, teamMember: trade.teamMember, milestoneCol: milestoneCol, nextDay: nextDay });
      })
    );
    wait(reduceMotion ? 200 : 1800, function () { runS08(endingKind); });
  }

  function runS08(endingKind) {
    setActiveStage(7, false);
    showReport(session.trade);
    logActivityBatch(
      DATA.shared.activity.s08.map(function (t) { return fmt(t, { owner: session.trade.owner }); })
    );
    wait(STAGE_PAUSE, function () {
      var trade = session.trade;
      var slot = session.bookedSlot || trade.slots[0];
      renderContinueGate(function () {
        showEnding(endingKind, { slot: slot, teamMember: trade.teamMember, resource: trade.resourceLabel });
      });
    });
  }

  function resetToSetup() {
    clearPending();
    session = null;
    endingEl.hidden = true;
    messagesEl.hidden = false;
    shellEl.hidden = true;
    setupEl.hidden = false;
    clear(messagesEl);
    clear(chipRowEl);
    setActiveStage(-1, false);
  }

  // ---- setup UI ----
  function buildSetup() {
    clear(tradeChipsEl);
    clear(sourceChipsEl);
    var lastTrade = readLastTrade();
    var tradeIds = Object.keys(DATA.trades);
    var selectedTrade = tradeIds.indexOf(lastTrade) !== -1 ? lastTrade : tradeIds[0];
    tradeIds.forEach(function (id) {
      var btn = el('button', 'demo-setup-chip', DATA.trades[id].label);
      btn.type = 'button';
      btn.setAttribute('data-trade-id', id);
      btn.setAttribute('aria-pressed', id === selectedTrade ? 'true' : 'false');
      if (id === selectedTrade) { btn.classList.add('is-selected'); }
      btn.addEventListener('click', function () {
        tradeChipsEl.querySelectorAll('.demo-setup-chip').forEach(function (b) {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
        if (companyInput) { companyInput.placeholder = DATA.trades[id].company; }
      });
      tradeChipsEl.appendChild(btn);
    });

    if (companyInput) {
      companyInput.placeholder = DATA.trades[selectedTrade].company;
      var lastCompany = readLastCompany();
      if (lastCompany) { companyInput.value = lastCompany; }
    }
    if (simulationNoteEl) { simulationNoteEl.textContent = DATA.shared.setup.simulationNote; }

    var sourceIds = Object.keys(DATA.sources);
    sourceIds.forEach(function (id, idx) {
      var btn = el('button', 'demo-setup-chip', DATA.sources[id].label);
      btn.type = 'button';
      btn.setAttribute('data-source-id', id);
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      if (idx === 0) { btn.classList.add('is-selected'); }
      btn.addEventListener('click', function () {
        sourceChipsEl.querySelectorAll('.demo-setup-chip').forEach(function (b) {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
      });
      sourceChipsEl.appendChild(btn);
    });
  }

  function currentSelection(container, attr) {
    var selected = container.querySelector('.is-selected');
    return selected ? selected.getAttribute(attr) : null;
  }

  startBtn.addEventListener('click', function () {
    var tradeId = currentSelection(tradeChipsEl, 'data-trade-id') || Object.keys(DATA.trades)[0];
    var sourceId = currentSelection(sourceChipsEl, 'data-source-id') || Object.keys(DATA.sources)[0];
    var name = (nameInput.value || '').trim().slice(0, 40) || DATA.shared.setup.namePlaceholder;
    var company = companyInput ? (companyInput.value || '').trim().slice(0, 40) : '';
    startDemo(tradeId, sourceId, name, company);
  });

  endingAgainBtn.addEventListener('click', resetToSetup);

  // ---- arriving with #journey: scroll under the sticky nav, focus the first trade chip ----
  function handleJourneyHash() {
    if (window.location.hash !== '#journey') { return; }
    wait(reduceMotion ? 0 : 60, function () {
      var navOffset = 96;
      var rect = section.getBoundingClientRect();
      var top = window.pageYOffset + rect.top - navOffset;
      if (window.scrollTo) {
        try {
          window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        } catch (e) {
          window.scrollTo(0, top);
        }
      }
      var firstChip = tradeChipsEl.querySelector('.demo-setup-chip');
      if (firstChip) { firstChip.focus(); }
    });
  }

  // ---- boot ----
  buildRail();
  buildSetup();
  shellEl.hidden = true;
  endingEl.hidden = true;
  updatePhoneScale();
  setMobileTab('customer');
  section.classList.add('js-demo-ready');
  handleJourneyHash();
})();
