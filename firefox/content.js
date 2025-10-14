// BetterCodex - Repository filter for Codex
(function() {
  'use strict';

  const STORAGE_KEY = 'bettercodex_selected_repo';
  const logPrefix = '[BetterCodex]';

  const translations = {
    en: {
      label: 'Repository filter',
      placeholder: 'Type or select a repository…',
      clearTitle: 'Reset filter',
      init: 'Starting…',
      reposFound: 'Repositories found:',
      tabBarMissing: 'Tab bar not found',
      uiReady: 'Filter ready',
      filterChanged: 'Filter changed to:',
      filterApplied: 'Filter applied for:',
      filterLoaded: 'Loaded saved filter:',
      domWatching: 'Started watching the Codex task list',
      allLabel: 'All',
      multipleSelected: '{count} repos',
      selectedSummary: 'Selected repositories',
      buttonLabel: 'Filter',
    },
    de: {
      label: 'Repository-Filter',
      placeholder: 'Repository eingeben oder auswählen…',
      clearTitle: 'Filter zurücksetzen',
      init: 'Starte…',
      reposFound: 'Gefundene Repositories:',
      tabBarMissing: 'Tab-Leiste nicht gefunden',
      uiReady: 'Filter bereit',
      filterChanged: 'Filter geändert zu:',
      filterApplied: 'Filter angewendet für:',
      filterLoaded: 'Gespeicherten Filter geladen:',
      domWatching: 'Beobachtung der Codex-Aufgaben gestartet',
      allLabel: 'Alle',
      multipleSelected: '{count} Repositories',
      selectedSummary: 'Ausgewählte Repositories',
      buttonLabel: 'Filter',
    }
  };

  const language = (navigator.language || navigator.userLanguage || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';

  function t(key) {
    return translations[language][key] || translations.en[key] || key;
  }

  const IGNORED_EXACT_LABELS = [
    'Umgebungen',
    'Repositorys',
    'Environments',
    'Repositories'
  ];

  const IGNORED_PARTIAL_LABELS = [
    'konfigurieren',
    'verwalten',
    'configure',
    'manage'
  ];

  let availableRepos = [];
  let filterRoot = null;
  let filterToggleButton = null;
  let filterPanel = null;
  let filterDropdown = null;
  let suggestionsList = null;
  let selectedWrapper = null;
  let selectedMenu = null;
  let filterPanelOpen = false;
  let selectedRepos = [];
  let availableRepoSet = new Set();
  let initTimeoutId = null;
  let observerTimeoutId = null;
  let observer = null;
  let observerTarget = null;
  let observerLogShown = false;
  let documentListenersRegistered = false;
  let lastPathname = null;

  const NAVIGATION_EVENT = 'bettercodex:navigation';

  setupNavigationWatcher();
  handleNavigation();

  function init() {
    if (!isOnCodexPage()) {
      return;
    }

    console.log(logPrefix, t('init'));

    extractRepos();
    createFilterDropdown();
    loadAndApplyFilter();
    collectReposFromTasks();
    ensureObserver();
  }

  function cleanup() {
    if (initTimeoutId) {
      clearTimeout(initTimeoutId);
      initTimeoutId = null;
    }

    if (observerTimeoutId) {
      clearTimeout(observerTimeoutId);
      observerTimeoutId = null;
    }

    if (observer) {
      observer.disconnect();
    }

    observerTarget = null;
    observerLogShown = false;

    if (filterRoot && filterRoot.parentElement) {
      filterRoot.remove();
    }

    filterRoot = null;
    filterToggleButton = null;
    filterPanel = null;
    filterDropdown = null;
    suggestionsList = null;
    selectedWrapper = null;
    selectedMenu = null;
    filterPanelOpen = false;
    selectedRepos = [];
    availableRepos = [];
    availableRepoSet = new Set();
  }

  function isOnCodexPage() {
    return location.pathname.startsWith('/codex');
  }

  function scheduleInit({ force = false } = {}) {
    if (!isOnCodexPage()) {
      return;
    }

    if (initTimeoutId) {
      clearTimeout(initTimeoutId);
      initTimeoutId = null;
    }

    if (!force && filterRoot && document.body.contains(filterRoot)) {
      return;
    }

    initTimeoutId = setTimeout(() => {
      initTimeoutId = null;
      init();
    }, 1000);
  }

  function setupNavigationWatcher() {
    const dispatchNavigation = () => window.dispatchEvent(new Event(NAVIGATION_EVENT));

    const wrapHistoryMethod = (method) => {
      const original = history[method];
      if (typeof original !== 'function') {
        return;
      }

      history[method] = function(...args) {
        const result = original.apply(this, args);
        dispatchNavigation();
        return result;
      };
    };

    wrapHistoryMethod('pushState');
    wrapHistoryMethod('replaceState');

    window.addEventListener('popstate', dispatchNavigation);
    window.addEventListener('hashchange', dispatchNavigation);
    window.addEventListener(NAVIGATION_EVENT, handleNavigation);
  }

  function handleNavigation() {
    const currentPath = location.pathname;
    const pathChanged = currentPath !== lastPathname;
    lastPathname = currentPath;

    if (!isOnCodexPage()) {
      cleanup();
      return;
    }

    if (pathChanged) {
      cleanup();
      scheduleInit({ force: true });
      return;
    }

    if (!filterRoot || !document.body.contains(filterRoot)) {
      cleanup();
      scheduleInit({ force: true });
      return;
    }

    collectReposFromTasks();
    applyFilter();
    ensureObserver();
  }

  const documentClickHandler = (e) => {
    if (!filterRoot) {
      return;
    }

    if (filterPanelOpen && !filterRoot.contains(e.target)) {
      hideSuggestions();
      closeFilterPanel();
    }
  };

  const documentKeydownHandler = (e) => {
    if (e.key === 'Escape') {
      hideSuggestions();
      closeFilterPanel();
    }
  };

  function registerDocumentListeners() {
    if (documentListenersRegistered) {
      return;
    }

    document.addEventListener('click', documentClickHandler);
    document.addEventListener('keydown', documentKeydownHandler);
    documentListenersRegistered = true;
  }

  function extractRepos() {
    const repoButtons = document.querySelectorAll('.flex.max-h-\\[280px\\] button[type="button"]');
    const repoSet = new Set(availableRepos);

    repoButtons.forEach(button => {
      const repoSpan = button.querySelector('span.truncate');
      if (repoSpan && repoSpan.textContent.trim()) {
        const repoName = repoSpan.textContent.trim();
        const lowerRepo = repoName.toLowerCase();

        const isIgnoredExact = IGNORED_EXACT_LABELS.includes(repoName);
        const isIgnoredPartial = IGNORED_PARTIAL_LABELS.some(partial => lowerRepo.includes(partial));

        if (!isIgnoredExact && !isIgnoredPartial) {
          repoSet.add(repoName);
        }
      }
    });

    availableRepos = Array.from(repoSet).sort((a, b) => a.localeCompare(b));
    availableRepoSet = new Set(availableRepos.map(repo => repo.toLowerCase()));
    console.log(logPrefix, t('reposFound'), availableRepos);
  }

  function createFilterDropdown() {
    const tabBar = document.querySelector('.border-token-border-primary.mt-4.flex.w-full');
    if (!tabBar) {
      console.error(logPrefix, t('tabBarMissing'));
      return;
    }

    const filterContainer = document.createElement('div');
    filterContainer.className = 'bettercodex-filter-container';
    filterRoot = filterContainer;

    filterToggleButton = document.createElement('button');
    filterToggleButton.type = 'button';
    filterToggleButton.className = 'bettercodex-filter-toggle';
    filterToggleButton.textContent = t('buttonLabel');
    filterToggleButton.setAttribute('aria-haspopup', 'true');
    filterToggleButton.setAttribute('aria-expanded', 'false');
    filterToggleButton.addEventListener('click', () => {
      if (filterPanelOpen) {
        closeFilterPanel();
      } else {
        openFilterPanel({ focusInput: true });
      }
    });

    filterPanel = document.createElement('div');
    filterPanel.className = 'bettercodex-filter-panel';
    filterPanel.style.display = 'none';

    selectedWrapper = document.createElement('div');
    selectedWrapper.className = 'bettercodex-selected-wrapper';

    selectedMenu = document.createElement('div');
    selectedMenu.className = 'bettercodex-selected-list';
    selectedWrapper.appendChild(selectedMenu);

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'bettercodex-input-wrapper';

    filterDropdown = document.createElement('input');
    filterDropdown.type = 'text';
    filterDropdown.className = 'bettercodex-input';
    filterDropdown.placeholder = t('placeholder');
    filterDropdown.setAttribute('aria-label', t('label'));

    suggestionsList = document.createElement('div');
    suggestionsList.className = 'bettercodex-suggestions';
    suggestionsList.style.display = 'none';

    filterDropdown.addEventListener('input', (e) => {
      showSuggestionsForValue(e.target.value);
    });

    filterDropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFreeformSelection();
      }

      if (e.key === 'Backspace' && filterDropdown.value === '' && selectedRepos.length > 0) {
        removeSelectedRepo(selectedRepos[selectedRepos.length - 1]);
      }

      if (e.key === 'Escape') {
        hideSuggestions();
        closeFilterPanel();
      }
    });

    registerDocumentListeners();

    filterDropdown.addEventListener('focus', () => {
      if (!filterPanelOpen) {
        openFilterPanel();
      }
      showSuggestionsForValue(filterDropdown.value);
    });

    const clearButton = document.createElement('button');
    clearButton.className = 'bettercodex-clear-btn';
    clearButton.innerHTML = '×';
    clearButton.title = t('clearTitle');
    clearButton.addEventListener('click', () => {
      filterDropdown.value = '';
      hideSuggestions();
      clearSelection();
      filterDropdown.focus();
    });

    inputWrapper.appendChild(filterDropdown);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(suggestionsList);

    filterPanel.appendChild(selectedWrapper);
    filterPanel.appendChild(inputWrapper);

    filterContainer.appendChild(filterToggleButton);
    filterContainer.appendChild(filterPanel);

    const leftSection = tabBar.querySelector('.flex.items-center.gap-2');
    if (leftSection && leftSection.parentElement) {
      leftSection.parentElement.appendChild(filterContainer);
    } else {
      tabBar.appendChild(filterContainer);
    }

    renderSelectedSummary();
    console.log(logPrefix, t('uiReady'));
  }

  function openFilterPanel({ focusInput = false } = {}) {
    if (!filterPanel) {
      return;
    }

    filterPanel.style.display = 'flex';
    filterPanelOpen = true;

    if (filterToggleButton) {
      filterToggleButton.setAttribute('aria-expanded', 'true');
    }

    if (filterRoot) {
      filterRoot.classList.add('bettercodex-filter-open');
    }

    if (focusInput && filterDropdown) {
      requestAnimationFrame(() => filterDropdown.focus());
    }
  }

  function closeFilterPanel() {
    if (!filterPanel) {
      return;
    }

    hideSuggestions();
    filterPanel.style.display = 'none';
    filterPanelOpen = false;

    if (filterToggleButton) {
      filterToggleButton.setAttribute('aria-expanded', 'false');
    }

    if (filterRoot) {
      filterRoot.classList.remove('bettercodex-filter-open');
    }

    if (filterDropdown) {
      filterDropdown.blur();
    }
  }

  function applyFilter() {
    const taskContainers = document.querySelectorAll('.group.task-row-container');
    const activeFilters = selectedRepos
      .map(repo => repo.toLowerCase())
      .filter(Boolean);

    taskContainers.forEach(container => {
      const tertiaryDiv = container.querySelector('.text-token-text-tertiary.flex.gap-1');

      if (!tertiaryDiv) {
        container.style.display = '';
        return;
      }

      const allSpans = tertiaryDiv.querySelectorAll('span.truncate.empty\\:hidden');
      let taskRepoName = '';

      allSpans.forEach(span => {
        const text = span.textContent.trim();
        if (text.includes('/')) {
          taskRepoName = text;
        }
      });

      if (!taskRepoName) {
        container.style.display = '';
        return;
      }

      ensureRepoAvatar(container, taskRepoName);
      ensureRepoTracked(taskRepoName);

      if (activeFilters.length === 0) {
        container.style.display = '';
        return;
      }

      const taskRepoLower = taskRepoName.toLowerCase();
      const isMatch = activeFilters.some(filterLower => taskRepoLower.includes(filterLower));

      container.style.display = isMatch ? '' : 'none';
    });
  }

  function loadAndApplyFilter() {
    const savedRepo = localStorage.getItem(STORAGE_KEY);

    if (!savedRepo || !filterDropdown) {
      return;
    }

    let reposToRestore = [];

    try {
      const parsed = JSON.parse(savedRepo);
      if (Array.isArray(parsed)) {
        reposToRestore = parsed;
      } else if (parsed) {
        reposToRestore = [parsed];
      }
    } catch (err) {
      if (typeof savedRepo === 'string' && savedRepo.trim() !== '') {
        reposToRestore = [savedRepo];
      }
    }

    const seen = new Set();
    const normalizedRepos = reposToRestore
      .map(repo => (typeof repo === 'string' ? repo.trim() : ''))
      .filter(Boolean)
      .map(repo => {
        const match = findMatchingRepo(repo);
        return match || repo;
      })
      .filter(repo => {
        const lower = repo.toLowerCase();
        if (seen.has(lower)) {
          return false;
        }
        seen.add(lower);
        return true;
      });

    if (normalizedRepos.length === 0) {
      return;
    }

    normalizedRepos.forEach(repo => addSelectedRepo(repo, { deferApply: true }));

    applyAndStoreFilters({ skipLog: true });

    const activeLabel = getActiveLabel();
    console.log(logPrefix, t('filterLoaded'), activeLabel);
    console.log(logPrefix, t('filterApplied'), activeLabel);
  }

  const mutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('task-row-container')) {
            collectReposFromTasks();
            if (selectedRepos.length > 0) {
              applyFilter();
            }
          }
        });
      }
    });
  };

  function ensureObserver() {
    if (!isOnCodexPage()) {
      return;
    }

    if (!observer) {
      observer = new MutationObserver(mutationCallback);
    }

    if (observerTarget && observerTarget.isConnected) {
      return;
    }

    if (observerTimeoutId) {
      clearTimeout(observerTimeoutId);
    }

    observerTimeoutId = setTimeout(() => {
      const tasksContainer = document.querySelector('.flex.flex-col.justify-center.pb-20');
      if (!tasksContainer) {
        observerTarget = null;
        observerLogShown = false;
        return;
      }

      observer.disconnect();
      observer.observe(tasksContainer, {
        childList: true,
        subtree: true
      });
      observerTarget = tasksContainer;

      if (!observerLogShown) {
        console.log(logPrefix, t('domWatching'));
        observerLogShown = true;
      }
    }, 1500);
  }

  function findMatchingRepo(repoName) {
    const lowerName = repoName.toLowerCase();
    return availableRepos.find(repo => repo.toLowerCase() === lowerName);
  }

  function addSelectedRepo(repoName, { deferApply = false } = {}) {
    if (!repoName) {
      return;
    }

    const match = findMatchingRepo(repoName) || repoName;
    const normalized = match.trim();

    if (!normalized) {
      return;
    }

    const exists = selectedRepos.some(repo => repo.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      return;
    }

    selectedRepos.push(normalized);
    renderSelectedSummary();

    if (deferApply) {
      return;
    }

    applyAndStoreFilters();
    hideSuggestions();
    filterDropdown.value = '';
  }

  function removeSelectedRepo(repoName) {
    const index = selectedRepos.findIndex(repo => repo.toLowerCase() === repoName.toLowerCase());

    if (index === -1) {
      return;
    }

    selectedRepos.splice(index, 1);
    renderSelectedSummary();
    applyAndStoreFilters();
    showSuggestionsForValue(filterDropdown.value);
  }

  function clearSelection() {
    if (selectedRepos.length === 0) {
      return;
    }

    selectedRepos = [];
    renderSelectedSummary();
    applyAndStoreFilters();
  }

  function renderSelectedSummary() {
    if (filterToggleButton) {
      const count = selectedRepos.length;
      const baseLabel = t('buttonLabel');
      const buttonLabel = count > 0 ? `${baseLabel} (${count})` : baseLabel;
      filterToggleButton.textContent = buttonLabel;
      filterToggleButton.setAttribute('aria-label', count > 0
        ? `${t('selectedSummary')}: ${selectedRepos.join(', ')}`
        : baseLabel);
    }

    if (!selectedMenu) {
      return;
    }

    selectedMenu.innerHTML = '';

    if (selectedRepos.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'bettercodex-selected-empty';
      emptyState.textContent = t('allLabel');
      selectedMenu.appendChild(emptyState);
      return;
    }

    selectedRepos.forEach(repo => {
      const item = document.createElement('div');
      item.className = 'bettercodex-selected-item';

      const text = document.createElement('span');
      text.className = 'bettercodex-selected-item-label';
      text.textContent = repo;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'bettercodex-selected-item-remove';
      removeButton.innerHTML = '×';
      removeButton.title = `${t('clearTitle')} ${repo}`;
      removeButton.setAttribute('aria-label', `${t('clearTitle')} ${repo}`);
      removeButton.addEventListener('click', () => {
        removeSelectedRepo(repo);
      });

      item.appendChild(text);
      item.appendChild(removeButton);
      selectedMenu.appendChild(item);
    });
  }

  function handleFreeformSelection() {
    const value = filterDropdown.value.trim();
    if (!value) {
      return;
    }

    const exactMatch = findMatchingRepo(value);

    if (exactMatch) {
      addSelectedRepo(exactMatch);
      return;
    }

    const lowerValue = value.toLowerCase();
    const matches = availableRepos.filter(repo =>
      repo.toLowerCase().includes(lowerValue)
    );

    if (matches.length === 1) {
      addSelectedRepo(matches[0]);
    }
  }

  function showSuggestionsForValue(value) {
    if (!suggestionsList) {
      return;
    }

    const search = (value || '').trim().toLowerCase();

    const matches = availableRepos.filter(repo =>
      repo.toLowerCase().includes(search)
    ).filter(repo => !selectedRepos.some(selected => selected.toLowerCase() === repo.toLowerCase()));

    if (matches.length === 0) {
      hideSuggestions();
      return;
    }

    suggestionsList.innerHTML = '';

    matches.forEach(repo => {
      const item = document.createElement('div');
      item.className = 'bettercodex-suggestion-item';
      item.textContent = repo;
      item.addEventListener('click', () => {
        addSelectedRepo(repo);
      });
      suggestionsList.appendChild(item);
    });

    suggestionsList.style.display = 'block';
    suggestionsList.scrollTop = 0;
  }

  function hideSuggestions() {
    if (!suggestionsList) {
      return;
    }

    suggestionsList.style.display = 'none';
    suggestionsList.innerHTML = '';
  }

  function applyAndStoreFilters({ skipLog = false } = {}) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedRepos));
    } catch (error) {
      console.warn(logPrefix, 'Failed to persist selected repositories', error);
    }

    applyFilter();

    if (!skipLog) {
      const activeLabel = getActiveLabel();
      console.log(logPrefix, t('filterChanged'), activeLabel);
      console.log(logPrefix, t('filterApplied'), activeLabel);
    }
  }

  function getActiveLabel() {
    return selectedRepos.length > 0 ? selectedRepos.join(', ') : t('allLabel');
  }

  function ensureRepoTracked(repoName) {
    if (!repoName) {
      return;
    }

    const normalized = repoName.trim();
    if (!normalized) {
      return;
    }

    const lower = normalized.toLowerCase();
    if (availableRepoSet.has(lower)) {
      return;
    }

    availableRepoSet.add(lower);
    availableRepos.push(normalized);
    availableRepos.sort((a, b) => a.localeCompare(b));

    if (suggestionsList && suggestionsList.style.display === 'block') {
      showSuggestionsForValue(filterDropdown.value);
    }
  }

  function collectReposFromTasks() {
    const taskContainers = document.querySelectorAll('.group.task-row-container');
    taskContainers.forEach(container => {
      const tertiaryDiv = container.querySelector('.text-token-text-tertiary.flex.gap-1');
      if (!tertiaryDiv) {
        return;
      }

      const allSpans = tertiaryDiv.querySelectorAll('span.truncate.empty\\:hidden');
      allSpans.forEach(span => {
        const text = span.textContent.trim();
        if (text.includes('/')) {
          ensureRepoTracked(text);
          ensureRepoAvatar(container, text);
        }
      });
    });
  }

  function ensureRepoAvatar(container, repoName) {
    if (!container || !repoName || !repoName.includes('/')) {
      return;
    }

    const owner = repoName.split('/')[0].trim();
    if (!owner) {
      return;
    }

    const desiredUrl = `https://github.com/${owner}.png?size=80`;

    const textColumn = container.querySelector('.flex.flex-col.gap-0\\.5');
    const interactiveRow = container.querySelector(
      '.hover\\:bg-token-bg-tertiary.relative.ring-inset.focus-within\\:border-token-border-heavy.focus-within\\:border-s-2.focus-within\\:ps-\\[-2px\\]'
    );
    const columnParent = textColumn ? textColumn.parentElement : null;
    const insertionParent = interactiveRow || columnParent;
    const searchRoot = insertionParent || container;

    if (interactiveRow && !interactiveRow.classList.contains('bettercodex-task-row')) {
      interactiveRow.classList.add('bettercodex-task-row');
    }

    let wrapper = searchRoot.querySelector('.bettercodex-task-avatar-wrapper');
    if (!wrapper) {
      wrapper = container.querySelector('.bettercodex-task-avatar-wrapper');
    }
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'bettercodex-task-avatar-wrapper';

      const image = document.createElement('img');
      image.className = 'bettercodex-task-avatar';
      image.loading = 'lazy';
      wrapper.appendChild(image);

      if (insertionParent && textColumn) {
        insertionParent.insertBefore(wrapper, textColumn);
      } else if (insertionParent) {
        insertionParent.insertBefore(wrapper, insertionParent.firstChild);
      } else if (container.firstChild) {
        container.insertBefore(wrapper, container.firstChild);
        container.classList.add('bettercodex-task-with-avatar');
      } else {
        container.appendChild(wrapper);
        container.classList.add('bettercodex-task-with-avatar');
      }
    }

    const image = wrapper.querySelector('img');
    if (!image) {
      return;
    }

    if (insertionParent && textColumn && (wrapper.parentElement !== insertionParent || wrapper.nextSibling !== textColumn)) {
      insertionParent.insertBefore(wrapper, textColumn);
    } else if (insertionParent && !textColumn && wrapper.parentElement !== insertionParent) {
      insertionParent.insertBefore(wrapper, insertionParent.firstChild);
    }

    if (insertionParent) {
      container.classList.remove('bettercodex-task-with-avatar');
    }

    if (image.getAttribute('src') !== desiredUrl) {
      image.src = desiredUrl;
    }

    image.alt = `${owner} avatar`;
    wrapper.dataset.bettercodexOwner = owner;
  }
})();
