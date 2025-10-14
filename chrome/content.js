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
  let filterDropdown = null;
  let suggestionsList = null;
  let selectedSummaryButton = null;
  let selectedMenu = null;
  let selectedWrapper = null;
  let selectedMenuOpen = false;
  let selectedRepos = [];
  let availableRepoSet = new Set();

  // Wait one second after the page finishes loading
  setTimeout(init, 1000);

  function init() {
    console.log(logPrefix, t('init'));

    extractRepos();
    createFilterDropdown();
    loadAndApplyFilter();
    collectReposFromTasks();
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

    const icon = document.createElement('span');
    icon.className = 'bettercodex-filter-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 5H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7 12H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M10 19H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
    icon.title = t('label');

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
        hideSelectedMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (inputWrapper && !inputWrapper.contains(e.target)) {
        hideSuggestions();
      }

      if (selectedWrapper && !selectedWrapper.contains(e.target)) {
        hideSelectedMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideSuggestions();
        hideSelectedMenu();
      }
    });

    filterDropdown.addEventListener('focus', () => {
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
    });

    selectedWrapper = document.createElement('div');
    selectedWrapper.className = 'bettercodex-selected-wrapper';

    selectedSummaryButton = document.createElement('button');
    selectedSummaryButton.type = 'button';
    selectedSummaryButton.className = 'bettercodex-selected-summary';
    selectedSummaryButton.addEventListener('click', () => {
      if (selectedRepos.length === 0) {
        return;
      }

      if (selectedMenuOpen) {
        hideSelectedMenu();
      } else {
        showSelectedMenu();
      }
    });

    selectedSummaryButton.setAttribute('aria-expanded', 'false');
    selectedSummaryButton.setAttribute('aria-haspopup', 'true');
    selectedSummaryButton.setAttribute('title', t('selectedSummary'));

    selectedMenu = document.createElement('div');
    selectedMenu.className = 'bettercodex-selected-menu';
    selectedMenu.style.display = 'none';

    selectedWrapper.appendChild(selectedSummaryButton);
    selectedWrapper.appendChild(selectedMenu);

    inputWrapper.appendChild(filterDropdown);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(suggestionsList);

    filterContainer.appendChild(icon);
    filterContainer.appendChild(selectedWrapper);
    filterContainer.appendChild(inputWrapper);

    const leftSection = tabBar.querySelector('.flex.items-center.gap-2');
    if (leftSection && leftSection.parentElement) {
      leftSection.parentElement.appendChild(filterContainer);
    } else {
      tabBar.appendChild(filterContainer);
    }

    renderSelectedSummary();
    console.log(logPrefix, t('uiReady'));
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

  const observer = new MutationObserver((mutations) => {
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
  });

  setTimeout(() => {
    const tasksContainer = document.querySelector('.flex.flex-col.justify-center.pb-20');
    if (tasksContainer) {
      observer.observe(tasksContainer, {
        childList: true,
        subtree: true
      });
      console.log(logPrefix, t('domWatching'));
    }
  }, 1500);

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
    if (!selectedSummaryButton || !selectedMenu) {
      return;
    }

    selectedMenu.innerHTML = '';

    if (selectedRepos.length === 0) {
      selectedSummaryButton.style.display = 'none';
      hideSelectedMenu();
      return;
    }

    const count = selectedRepos.length;
    const summaryLabel = count === 1
      ? selectedRepos[0]
      : t('multipleSelected').replace('{count}', String(count));

    selectedSummaryButton.style.display = 'inline-flex';
    selectedSummaryButton.textContent = summaryLabel;
    selectedSummaryButton.setAttribute('aria-expanded', selectedMenuOpen ? 'true' : 'false');
    selectedSummaryButton.setAttribute('aria-label', `${t('selectedSummary')}: ${summaryLabel}`);

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
        if (selectedRepos.length === 0) {
          hideSelectedMenu();
        }
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

  function showSelectedMenu() {
    if (!selectedMenu || selectedRepos.length === 0) {
      return;
    }

    selectedMenu.style.display = 'block';
    selectedMenuOpen = true;
    selectedSummaryButton.setAttribute('aria-expanded', 'true');
  }

  function hideSelectedMenu() {
    if (!selectedMenu) {
      return;
    }

    selectedMenu.style.display = 'none';
    selectedMenuOpen = false;
    if (selectedSummaryButton) {
      selectedSummaryButton.setAttribute('aria-expanded', 'false');
    }
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
        }
      });
    });
  }
})();
