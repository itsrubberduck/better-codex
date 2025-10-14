// BetterCodex - Repository filter for Codex
(function() {
  'use strict';

  const STORAGE_KEY = 'bettercodex_selected_repo';
  const logPrefix = '[BetterCodex]';

  const translations = {
    en: {
      label: 'Repo filter:',
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
    },
    de: {
      label: 'Repo-Filter:',
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
  let tokensContainer = null;
  let selectedRepos = [];

  // Wait one second after the page finishes loading
  setTimeout(init, 1000);

  function init() {
    console.log(logPrefix, t('init'));

    extractRepos();
    createFilterDropdown();
    loadAndApplyFilter();
  }

  function extractRepos() {
    const repoButtons = document.querySelectorAll('.flex.max-h-\\[280px\\] button[type="button"]');
    const repoSet = new Set();

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

    const label = document.createElement('label');
    label.textContent = t('label');
    label.className = 'bettercodex-label';

    tokensContainer = document.createElement('div');
    tokensContainer.className = 'bettercodex-selected-container';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'bettercodex-input-wrapper';

    filterDropdown = document.createElement('input');
    filterDropdown.type = 'text';
    filterDropdown.className = 'bettercodex-input';
    filterDropdown.placeholder = t('placeholder');

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
    });

    document.addEventListener('click', (e) => {
      if (!inputWrapper.contains(e.target)) {
        hideSuggestions();
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

    inputWrapper.appendChild(filterDropdown);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(suggestionsList);

    filterContainer.appendChild(label);
    filterContainer.appendChild(tokensContainer);
    filterContainer.appendChild(inputWrapper);

    const leftSection = tabBar.querySelector('.flex.items-center.gap-2');
    if (leftSection) {
      leftSection.parentElement.appendChild(filterContainer);
    }

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
    renderSelectedRepos();

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
    renderSelectedRepos();
    applyAndStoreFilters();
    showSuggestionsForValue(filterDropdown.value);
  }

  function clearSelection() {
    if (selectedRepos.length === 0) {
      return;
    }

    selectedRepos = [];
    renderSelectedRepos();
    applyAndStoreFilters();
  }

  function renderSelectedRepos() {
    if (!tokensContainer) {
      return;
    }

    tokensContainer.innerHTML = '';

    if (selectedRepos.length === 0) {
      tokensContainer.style.display = 'none';
      return;
    }

    tokensContainer.style.display = 'flex';

    selectedRepos.forEach(repo => {
      const token = document.createElement('span');
      token.className = 'bettercodex-token';

      const text = document.createElement('span');
      text.className = 'bettercodex-token-label';
      text.textContent = repo;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'bettercodex-token-remove';
      removeButton.innerHTML = '×';
      removeButton.title = `${t('clearTitle')} ${repo}`;
      removeButton.setAttribute('aria-label', `${t('clearTitle')} ${repo}`);
      removeButton.addEventListener('click', () => {
        removeSelectedRepo(repo);
      });

      token.appendChild(text);
      token.appendChild(removeButton);
      tokensContainer.appendChild(token);
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
})();
