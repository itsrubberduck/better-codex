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

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'bettercodex-input-wrapper';

    const label = document.createElement('label');
    label.textContent = t('label');
    label.className = 'bettercodex-label';

    filterDropdown = document.createElement('input');
    filterDropdown.type = 'text';
    filterDropdown.className = 'bettercodex-input';
    filterDropdown.placeholder = t('placeholder');

    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'bettercodex-suggestions';
    suggestionsList.style.display = 'none';

    filterDropdown.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase();

      if (value === '') {
        suggestionsList.style.display = 'none';
        onFilterChange();
        return;
      }

      const matches = availableRepos.filter(repo =>
        repo.toLowerCase().includes(value)
      );

      if (matches.length > 0) {
        suggestionsList.innerHTML = '';
        matches.forEach(repo => {
          const item = document.createElement('div');
          item.className = 'bettercodex-suggestion-item';
          item.textContent = repo;
          item.addEventListener('click', () => {
            filterDropdown.value = repo;
            suggestionsList.style.display = 'none';
            onFilterChange();
          });
          suggestionsList.appendChild(item);
        });
        suggestionsList.style.display = 'block';
      } else {
        suggestionsList.style.display = 'none';
      }

      onFilterChange();
    });

    document.addEventListener('click', (e) => {
      if (!inputWrapper.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    });

    filterDropdown.addEventListener('focus', () => {
      if (filterDropdown.value === '' && availableRepos.length > 0) {
        suggestionsList.innerHTML = '';
        availableRepos.forEach(repo => {
          const item = document.createElement('div');
          item.className = 'bettercodex-suggestion-item';
          item.textContent = repo;
          item.addEventListener('click', () => {
            filterDropdown.value = repo;
            suggestionsList.style.display = 'none';
            onFilterChange();
          });
          suggestionsList.appendChild(item);
        });
        suggestionsList.style.display = 'block';
      }
    });

    const clearButton = document.createElement('button');
    clearButton.className = 'bettercodex-clear-btn';
    clearButton.innerHTML = '×';
    clearButton.title = t('clearTitle');
    clearButton.addEventListener('click', () => {
      filterDropdown.value = '';
      suggestionsList.style.display = 'none';
      onFilterChange();
    });

    inputWrapper.appendChild(filterDropdown);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(suggestionsList);

    filterContainer.appendChild(label);
    filterContainer.appendChild(inputWrapper);

    const leftSection = tabBar.querySelector('.flex.items-center.gap-2');
    if (leftSection) {
      leftSection.parentElement.appendChild(filterContainer);
    }

    console.log(logPrefix, t('uiReady'));
  }

  function onFilterChange() {
    const selectedRepo = filterDropdown.value.trim();

    localStorage.setItem(STORAGE_KEY, selectedRepo);
    applyFilter(selectedRepo);

    console.log(logPrefix, t('filterChanged'), selectedRepo || t('allLabel'));
  }

  function applyFilter(repoName) {
    const taskContainers = document.querySelectorAll('.group.task-row-container');
    const filterLower = repoName.toLowerCase();

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

      if (!repoName || taskRepoName.toLowerCase().includes(filterLower)) {
        container.style.display = '';
      } else {
        container.style.display = 'none';
      }
    });

    console.log(logPrefix, t('filterApplied'), repoName || t('allLabel'));
  }

  function loadAndApplyFilter() {
    const savedRepo = localStorage.getItem(STORAGE_KEY);

    if (savedRepo && filterDropdown) {
      filterDropdown.value = savedRepo;
      applyFilter(savedRepo);

      console.log(logPrefix, t('filterLoaded'), savedRepo);
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('task-row-container')) {
            const currentFilter = filterDropdown ? filterDropdown.value : '';
            if (currentFilter) {
              applyFilter(currentFilter);
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
})();
