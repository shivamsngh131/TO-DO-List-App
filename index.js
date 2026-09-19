(() => {
  'use strict';

  /* ---------- State (in-memory only) ---------- */
  let tasks = [
    { id: cryptoId(), text: 'Sketch the wireframe for the client review', priority: 'high', due: todayStr(), done: false, order: 0 },
    { id: cryptoId(), text: 'Reply to the internship coordinator', priority: 'medium', due: '', done: false, order: 1 },
    { id: cryptoId(), text: "Read one chapter before bed", priority: 'low', due: addDays(3), order: 2, done: false },
    { id: cryptoId(), text: "Push last night's commits", priority: 'medium', due: '', done: true, order: 3 },
  ];

  let statusFilter = 'all';       // all | active | completed
  let priorityFilter = 'all';     // all | low | medium | high
  let activePriority = 'medium';  // selected priority in the add form
  let dragId = null;
  let firstRender = true;

  /* ---------- Helpers ---------- */
  function cryptoId(){ return 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function todayStr(){ return new Date().toISOString().slice(0, 10); }
  function addDays(n){ const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function formatDue(iso){
    if(!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---------- DOM refs ---------- */
  const groupsEl = document.getElementById('groups');
  const emptyStateEl = document.getElementById('emptyState');
  const emptyTitleEl = document.getElementById('emptyTitle');
  const emptySubEl = document.getElementById('emptySub');
  const addForm = document.getElementById('addForm');
  const taskInput = document.getElementById('taskInput');
  const dueInput = document.getElementById('dueInput');
  const rowTemplate = document.getElementById('taskRowTemplate');
  const ringFill = document.getElementById('ringFill');
  const ringWrap = document.querySelector('.progress-ring');
  const progressPct = document.getElementById('progressPct');
  const progressSub = document.getElementById('progressSub');
  const doneCountEl = document.getElementById('doneCount');
  const totalCountEl = document.getElementById('totalCount');
  const themeToggle = document.getElementById('themeToggle');
  const toastStack = document.getElementById('toastStack');

  const RING_CIRCUMFERENCE = 201;

  /* ---------- Priority selector in add form ---------- */
  document.querySelectorAll('.priority-select .pri-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-select .pri-dot').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activePriority = btn.dataset.priority;
    });
  });

  /* ---------- Add task ---------- */
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if(!text) return;
    tasks.push({
      id: cryptoId(),
      text,
      priority: activePriority,
      due: dueInput.value || '',
      done: false,
      order: tasks.length,
    });
    taskInput.value = '';
    dueInput.value = '';
    render();
    showToast(`Added "${truncate(text, 32)}"`);
    taskInput.focus();
  });

  function truncate(str, n){ return str.length > n ? str.slice(0, n - 1) + '…' : str; }

  /* ---------- Status & priority filters ---------- */
  document.getElementById('statusFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    statusFilter = btn.dataset.filter;
    setActiveChip('statusFilters', btn);
    render();
  });
  document.getElementById('priorityFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    priorityFilter = btn.dataset.priorityFilter;
    setActiveChip('priorityFilters', btn);
    render();
  });
  function setActiveChip(containerId, activeBtn){
    document.getElementById(containerId).querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    activeBtn.classList.add('is-active');
  }

  /* ---------- Theme toggle ---------- */
  themeToggle.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeToggle.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  });

  /* ---------- Toasts ---------- */
  function showToast(message){
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2200);
  }

  /* ---------- Confetti (respects reduced motion) ---------- */
  function fireConfetti(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#2F6F5E', '#3F8A73', '#C77F1C', '#5C9EA6'];
    const originX = window.innerWidth - 70;
    const originY = window.innerHeight - 70;
    for(let i = 0; i < 26; i++){
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 140;
      piece.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      piece.style.setProperty('--dy', `${Math.sin(angle) * dist - 60}px`);
      piece.style.setProperty('--rot', `${(Math.random() * 480 - 240)}deg`);
      piece.style.left = originX + 'px';
      piece.style.top = originY + 'px';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = (0.9 + Math.random() * 0.5) + 's';
      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }

  /* ---------- Rendering ---------- */
  function visibleTasks(){
    return tasks.filter(t => {
      if(statusFilter === 'active' && t.done) return false;
      if(statusFilter === 'completed' && !t.done) return false;
      if(priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }

  function groupTasks(list){
    const today = todayStr();
    const groups = { today: [], upcoming: [], someday: [], completed: [] };
    list.forEach(t => {
      if(t.done){ groups.completed.push(t); return; }
      if(t.due && t.due === today) groups.today.push(t);
      else if(t.due && t.due > today) groups.upcoming.push(t);
      else groups.someday.push(t);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => a.order - b.order));
    return groups;
  }

  function captureFlipRects(){
    const rects = new Map();
    groupsEl.querySelectorAll('.task-row').forEach(row => {
      rects.set(row.dataset.id, row.getBoundingClientRect());
    });
    return rects;
  }

  function playFlip(oldRects){
    groupsEl.querySelectorAll('.task-row').forEach(row => {
      const prev = oldRects.get(row.dataset.id);
      if(!prev) return;
      const next = row.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if(!dx && !dy) return;
      row.classList.add('is-flipping');
      row.style.transition = 'none';
      row.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        row.style.transition = '';
        row.style.transform = '';
        row.addEventListener('transitionend', () => row.classList.remove('is-flipping'), { once: true });
      });
    });
  }

  function render(){
    const oldRects = firstRender ? null : captureFlipRects();

    const list = visibleTasks();
    const groups = groupTasks(list);
    const sections = [
      { key: 'today', label: 'Today' },
      { key: 'upcoming', label: 'Upcoming' },
      { key: 'someday', label: 'Someday' },
      { key: 'completed', label: 'Closed' },
    ];

    groupsEl.innerHTML = '';
    let anyVisible = false;
    let rowIndex = 0;

    sections.forEach(({ key, label }) => {
      const items = groups[key];
      if(!items.length) return;
      anyVisible = true;

      const groupEl = document.createElement('div');
      groupEl.className = 'group';

      const title = document.createElement('h2');
      title.className = 'group-title';
      title.innerHTML = `<span>${label}</span><span class="count">${items.length}</span>`;
      groupEl.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'task-list';
      ul.dataset.group = key;

      items.forEach(t => {
        const row = buildRow(t);
        if(firstRender){
          row.style.animationDelay = (rowIndex * 45) + 'ms';
          rowIndex++;
        } else {
          row.style.animation = 'none';
        }
        ul.appendChild(row);
      });
      groupEl.appendChild(ul);
      groupsEl.appendChild(groupEl);
    });

    emptyStateEl.hidden = anyVisible;
    if(!anyVisible && tasks.length === 0){
      emptyTitleEl.textContent = 'The page is blank.';
      emptySubEl.textContent = "Write the first line above and it'll land here.";
    } else if(!anyVisible){
      emptyTitleEl.textContent = 'Nothing matches this view.';
      emptySubEl.textContent = 'Try another filter, or clear it to see everything.';
    }

    updateProgress();
    if(oldRects) playFlip(oldRects);
    firstRender = false;
  }

  function buildRow(task){
    const node = rowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    if(task.done) node.classList.add('is-done');

    const textEl = node.querySelector('.task-text');
    textEl.textContent = task.text;

    const dot = node.querySelector('.task-meta .dot');
    dot.classList.add('pri-' + task.priority);

    const dueChip = node.querySelector('.due-chip');
    if(task.due){
      dueChip.textContent = formatDue(task.due);
      if(!task.done && task.due < todayStr()) dueChip.classList.add('is-overdue');
    }

    /* toggle complete */
    node.querySelector('.check').addEventListener('click', () => toggleTask(task.id));

    /* inline edit */
    textEl.addEventListener('blur', () => commitEdit(task.id, textEl.textContent));
    textEl.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); textEl.blur(); }
      if(e.key === 'Escape'){ textEl.textContent = task.text; textEl.blur(); }
    });

    /* delete */
    node.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    /* drag reorder */
    node.addEventListener('dragstart', () => { dragId = task.id; requestAnimationFrame(() => node.classList.add('is-dragging')); });
    node.addEventListener('dragend', () => { dragId = null; node.classList.remove('is-dragging'); clearDropTargets(); });
    node.addEventListener('dragover', (e) => { e.preventDefault(); if(dragId !== task.id){ clearDropTargets(); node.classList.add('is-drop-target'); } });
    node.addEventListener('dragleave', () => node.classList.remove('is-drop-target'));
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      if(dragId && dragId !== task.id) reorder(dragId, task.id);
    });

    return node;
  }

  function clearDropTargets(){
    groupsEl.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
  }

  function toggleTask(id){
    const t = tasks.find(x => x.id === id);
    if(!t) return;
    t.done = !t.done;
    render();
    if(t.done){
      const remaining = tasks.filter(x => !x.done).length;
      if(remaining === 0 && tasks.length > 0){
        fireConfetti();
        showToast('All caught up — ledger closed for today.');
      }
    }
  }

  function commitEdit(id, newText){
    const t = tasks.find(x => x.id === id);
    if(!t) return;
    const clean = newText.trim();
    t.text = clean || t.text;
    if(!clean) render(); // restore original text if left blank
  }

  function deleteTask(id){
    const row = groupsEl.querySelector(`.task-row[data-id="${id}"]`);
    const t = tasks.find(x => x.id === id);
    if(row){
      row.classList.add('is-leaving');
      row.addEventListener('animationend', () => {
        tasks = tasks.filter(x => x.id !== id);
        render();
      }, { once: true });
    } else {
      tasks = tasks.filter(x => x.id !== id);
      render();
    }
    if(t) showToast(`Removed "${truncate(t.text, 32)}"`);
  }

  function reorder(sourceId, targetId){
    const source = tasks.find(t => t.id === sourceId);
    const target = tasks.find(t => t.id === targetId);
    if(!source || !target) return;
    const temp = source.order;
    source.order = target.order;
    target.order = temp;
    clearDropTargets();
    render();
  }

  function updateProgress(){
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * pct) / 100);
    progressPct.textContent = pct + '%';
    doneCountEl.textContent = done;
    totalCountEl.textContent = total;
    ringWrap.classList.toggle('is-complete', total > 0 && pct === 100);
    progressSub.textContent = total === 0
      ? 'Write the first line.'
      : pct === 100
        ? 'Every line closed. Well kept.'
        : 'Keep the ledger tidy.';
  }

  /* ---------- Init ---------- */
  render();
})();
