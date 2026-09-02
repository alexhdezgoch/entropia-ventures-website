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
  var railList = document.getElementById('demo-rail-list');
  var mobileSteps = document.getElementById('demo-mobile-steps');
  var timerWrap = document.getElementById('demo-timer-wrap');
  var timerValue = document.getElementById('demo-timer-value');
  var messagesEl = document.getElementById('demo-messages');
  var chipRowEl = document.getElementById('demo-chip-row');
  var leadCardEl = document.getElementById('demo-lead-card');
  var checklistEl = document.getElementById('demo-checklist');
  var qualifiedStampEl = document.getElementById('demo-qualified-stamp');
  var assignmentEl = document.getElementById('demo-assignment');
  var statusBadgeEl = document.getElementById('demo-status-badge');
  var calendarEl = document.getElementById('demo-calendar');
  var followupEl = document.getElementById('demo-followup');
  var pipelineEl = document.getElementById('demo-pipeline');
  var reportEl = document.getElementById('demo-report');
  var endingEl = document.getElementById('demo-ending');
  var endingLinesEl = document.getElementById('demo-ending-lines');
  var endingAgainBtn = document.getElementById('demo-ending-again');

  var required = [
    setupEl, shellEl, tradeChipsEl, sourceChipsEl, nameInput, startBtn,
    phoneCompanyEl, railList, mobileSteps, timerWrap, timerValue, messagesEl, chipRowEl,
    leadCardEl, checklistEl, qualifiedStampEl, assignmentEl, statusBadgeEl,
    calendarEl, followupEl, pipelineEl, reportEl, endingEl, endingLinesEl,
    endingAgainBtn
  ];
  for (var i = 0; i < required.length; i++) {
    if (!required[i]) { return; }
  }

  // ---- motion / timing ----
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* matchMedia unsupported — proceed with motion */ }

  var TYPING_MIN = reduceMotion ? 0 : 500;
  var TYPING_MAX = reduceMotion ? 0 : 900;
  var STAGE_PAUSE = reduceMotion ? 0 : 500;
  var TIMER_DURATION = reduceMotion ? 0 : 2500;

  function typingDelay() {
    if (TYPING_MAX === 0) { return 0; }
    return TYPING_MIN + Math.floor(Math.random() * (TYPING_MAX - TYPING_MIN));
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

  // ---- session state ----
  var session = null;
  var RAIL_STAGE_COUNT = 8;

  function newSession(tradeId, sourceId, name) {
    return {
      trade: DATA.trades[tradeId],
      source: DATA.sources[sourceId],
      name: name || DATA.shared.setup.namePlaceholder,
      answers: [],
      stageIndex: 0
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

  // ---- phone bubbles ----
  function appendSystemBubble(text) {
    var bubble = el('div', 'demo-bubble demo-bubble-system');
    bubble.appendChild(el('p', null, text));
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function appendCustomerBubble(text) {
    var bubble = el('div', 'demo-bubble demo-bubble-customer');
    bubble.appendChild(el('p', null, text));
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
    options.forEach(function (opt) {
      var btn = el('button', 'demo-chip', opt.text);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        clear(chipRowEl);
        onPick(opt);
      });
      chipRowEl.appendChild(btn);
    });
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
    clear(checklistEl);
    qualifiedStampEl.hidden = true;
    showPlaceholder(assignmentEl);
    statusBadgeEl.hidden = true;
    showPlaceholder(calendarEl);
    followupEl.hidden = true;
    clear(followupEl);
    showPlaceholder(pipelineEl);
    showPlaceholder(reportEl);
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
    mark.textContent = isWeak ? '–' : '✓';
    text.textContent = isWeak ? 'Not a fit today' : label;
  }

  function showQualifiedStamp() {
    qualifiedStampEl.hidden = false;
  }

  function showAssignment(trade) {
    clearPlaceholder(assignmentEl);
    clear(assignmentEl);
    assignmentEl.appendChild(el('p', null, 'Assigned: ' + trade.teamMember + ' · responded in 0:07'));
    assignmentEl.hidden = false;
    statusBadgeEl.hidden = false;
    statusBadgeEl.textContent = 'On time';
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
    if (card && target && card.parentNode !== target) {
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

  // ---- ending ----
  function showEnding(kind) {
    setActiveStage(RAIL_STAGE_COUNT, true);
    clear(endingLinesEl);
    var lines = DATA.shared.endings[kind];
    lines.forEach(function (line) {
      endingLinesEl.appendChild(el('p', 'demo-ending-line', line));
    });
    clear(chipRowEl);
    timerWrap.hidden = true;
    endingEl.hidden = false;
    endingEl.scrollIntoView({ block: 'nearest' });
  }

  // ---- flow ----
  function startDemo(tradeId, sourceId, name) {
    clearPending();
    session = newSession(tradeId, sourceId, name);
    writeLastTrade(tradeId);
    phoneCompanyEl.textContent = session.trade.company;

    setupEl.hidden = true;
    shellEl.hidden = false;
    endingEl.hidden = true;
    clear(messagesEl);
    clear(chipRowEl);
    timerWrap.hidden = true;
    resetDashboard();
    buildChecklist(session.trade);
    setActiveStage(0, false);

    runS01();
  }

  function runS01() {
    setActiveStage(0, false);
    var escapedName = session.name;
    showLeadCard(escapedName, session.source);
    wait(STAGE_PAUSE, runS02Timer);
  }

  function runS02Timer() {
    setActiveStage(1, false);
    timerWrap.hidden = false;
    timerValue.textContent = '0:00';
    if (TIMER_DURATION === 0) {
      timerValue.textContent = '0:07';
      wait(0, runS02Message);
      return;
    }
    var start = null;
    function frame(ts) {
      if (start === null) { start = ts; }
      var elapsed = ts - start;
      var pct = Math.min(1, elapsed / TIMER_DURATION);
      var seconds = Math.min(7, Math.round(pct * 7));
      timerValue.textContent = '0:0' + seconds;
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
    sayThen(session.source.openingLine, function () {
      askQuestion(0);
    });
  }

  function askQuestion(qIndex) {
    var trade = session.trade;
    var q = trade.questions[qIndex];
    setActiveStage(qIndex === 0 ? 1 : 2, false);
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
      tickChecklistRow(qIndex, answer.label, answer.weak);
      if (answer.weak) {
        runNurtureEnding();
        return;
      }
      var nextIndex = qIndex + 1;
      if (nextIndex < session.trade.questions.length) {
        askQuestion(nextIndex);
      } else {
        showQualifiedStamp();
        wait(STAGE_PAUSE, runS04);
      }
    });
  }

  function runNurtureEnding() {
    var trade = session.trade;
    showNurturePipeline(trade, session.name);
    sayThen(trade.nurtureLine, function () {
      showEnding('nurture');
    });
  }

  function runS04() {
    setActiveStage(3, false);
    showAssignment(session.trade);
    wait(STAGE_PAUSE, runS05);
  }

  function runS05() {
    setActiveStage(4, false);
    var trade = session.trade;
    showCalendarPending(trade);
    var options = trade.slots.map(function (s) { return { text: s, kind: 'slot' }; });
    options.push({ text: DATA.shared.buttons.notNow, kind: 'notNow' });
    renderChips(options, function (opt) {
      appendCustomerBubble(opt.text);
      if (opt.kind === 'slot') {
        sayThen(trade.bookedConfirmation, function () {
          showCalendarBooked(trade, opt.text);
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
    var idx = 0;
    function next() {
      if (idx >= trade.followUp.length) {
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
    showPipeline(session.trade, session.name);
    wait(reduceMotion ? 200 : 1800, function () { runS08(endingKind); });
  }

  function runS08(endingKind) {
    setActiveStage(7, false);
    showReport(session.trade);
    wait(STAGE_PAUSE, function () { showEnding(endingKind); });
  }

  function resetToSetup() {
    clearPending();
    session = null;
    endingEl.hidden = true;
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
      });
      tradeChipsEl.appendChild(btn);
    });

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
    startDemo(tradeId, sourceId, name);
  });

  endingAgainBtn.addEventListener('click', resetToSetup);

  // ---- boot ----
  buildRail();
  buildSetup();
  shellEl.hidden = true;
  endingEl.hidden = true;
  section.classList.add('js-demo-ready');
})();
