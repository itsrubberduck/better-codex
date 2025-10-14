// BetterCodex - Repo Filter für Codex
(function() {
  'use strict';

  const STORAGE_KEY = 'bettercodex_selected_repo';
  let availableRepos = [];
  let filterDropdown = null;

  // Warte 1 Sekunde nach Pageload, dann initialisiere
  setTimeout(init, 1000);

  function init() {
    console.log('BetterCodex: Initialisierung...');

    // Extrahiere verfügbare Repos
    extractRepos();

    // Erstelle Filter-Dropdown
    createFilterDropdown();

    // Lade gespeicherte Auswahl und wende Filter an
    loadAndApplyFilter();
  }

  function extractRepos() {
    // Finde alle Repo-Buttons in der Liste
    const repoButtons = document.querySelectorAll('.flex.max-h-\\[280px\\] button[type="button"]');
    const repoSet = new Set();

    repoButtons.forEach(button => {
      const repoSpan = button.querySelector('span.truncate');
      if (repoSpan && repoSpan.textContent.trim()) {
        const repoName = repoSpan.textContent.trim();
        // Filtere "Umgebungen" und "Repositorys" Überschriften heraus
        if (repoName !== 'Umgebungen' &&
            repoName !== 'Repositorys' &&
            !repoName.includes('konfigurieren') &&
            !repoName.includes('verwalten')) {
          repoSet.add(repoName);
        }
      }
    });

    availableRepos = Array.from(repoSet).sort();
    console.log('BetterCodex: Gefundene Repos:', availableRepos);
  }

  function createFilterDropdown() {
    // Finde die Tab-Leiste
    const tabBar = document.querySelector('.border-token-border-primary.mt-4.flex.w-full');
    if (!tabBar) {
      console.error('BetterCodex: Tab-Leiste nicht gefunden');
      return;
    }

    // Erstelle Filter-Container
    const filterContainer = document.createElement('div');
    filterContainer.className = 'bettercodex-filter-container';

    // Erstelle Wrapper für Input + Suggestions
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'bettercodex-input-wrapper';

    // Erstelle Label
    const label = document.createElement('label');
    label.textContent = 'Repo Filter: ';
    label.className = 'bettercodex-label';

    // Erstelle Text-Input
    filterDropdown = document.createElement('input');
    filterDropdown.type = 'text';
    filterDropdown.className = 'bettercodex-input';
    filterDropdown.placeholder = 'Repo eingeben oder auswählen...';

    // Erstelle Suggestions-Liste
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'bettercodex-suggestions';
    suggestionsList.style.display = 'none';

    // Event Listener
    filterDropdown.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase();

      if (value === '') {
        suggestionsList.style.display = 'none';
        onFilterChange();
        return;
      }

      // Filtere Repos basierend auf Eingabe
      const matches = availableRepos.filter(repo =>
        repo.toLowerCase().includes(value)
      );

      // Zeige Suggestions
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

    // Schließe Suggestions beim Klick außerhalb
    document.addEventListener('click', (e) => {
      if (!inputWrapper.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    });

    // Focus zeigt alle Repos
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

    // Clear-Button
    const clearButton = document.createElement('button');
    clearButton.className = 'bettercodex-clear-btn';
    clearButton.innerHTML = '×';
    clearButton.title = 'Filter zurücksetzen';
    clearButton.addEventListener('click', () => {
      filterDropdown.value = '';
      suggestionsList.style.display = 'none';
      onFilterChange();
    });

    // Baue zusammen
    inputWrapper.appendChild(filterDropdown);
    inputWrapper.appendChild(clearButton);
    inputWrapper.appendChild(suggestionsList);

    filterContainer.appendChild(label);
    filterContainer.appendChild(inputWrapper);

    // Füge rechts neben den Tabs ein
    const leftSection = tabBar.querySelector('.flex.items-center.gap-2');
    if (leftSection) {
      leftSection.parentElement.appendChild(filterContainer);
    }

    console.log('BetterCodex: Filter-Input erstellt');
  }

  function onFilterChange() {
    const selectedRepo = filterDropdown.value.trim();

    // Speichere im localStorage
    localStorage.setItem(STORAGE_KEY, selectedRepo);

    // Wende Filter an
    applyFilter(selectedRepo);

    console.log('BetterCodex: Filter geändert zu:', selectedRepo || 'Alle');
  }

  function applyFilter(repoName) {
    // Finde alle Task-Container
    const taskContainers = document.querySelectorAll('.group.task-row-container');
    const filterLower = repoName.toLowerCase();

    taskContainers.forEach(container => {
      // Finde ALLE spans mit truncate empty:hidden im tertiary container
      const tertiaryDiv = container.querySelector('.text-token-text-tertiary.flex.gap-1');

      if (!tertiaryDiv) {
        container.style.display = '';
        return;
      }

      // Hole alle truncate spans und finde den mit "/"
      const allSpans = tertiaryDiv.querySelectorAll('span.truncate.empty\\:hidden');
      let taskRepoName = '';

      allSpans.forEach(span => {
        const text = span.textContent.trim();
        // Repo-Namen enthalten typischerweise "/"
        if (text.includes('/')) {
          taskRepoName = text;
        }
      });

      // Wenn kein Repo-Name gefunden, zeige Task an
      if (!taskRepoName) {
        container.style.display = '';
        return;
      }

      // Wenn kein Filter gesetzt oder Repo passt (auch Teilstrings), zeige an
      if (!repoName || taskRepoName.toLowerCase().includes(filterLower)) {
        container.style.display = '';
      } else {
        container.style.display = 'none';
      }
    });

    console.log('BetterCodex: Filter angewendet für:', repoName || 'Alle');
  }

  function loadAndApplyFilter() {
    // Lade gespeicherte Auswahl
    const savedRepo = localStorage.getItem(STORAGE_KEY);

    if (savedRepo && filterDropdown) {
      // Setze Input-Wert
      filterDropdown.value = savedRepo;

      // Wende Filter an
      applyFilter(savedRepo);

      console.log('BetterCodex: Gespeicherten Filter geladen:', savedRepo);
    }
  }

  // Beobachte DOM-Änderungen für dynamisch geladene Tasks
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('task-row-container')) {
            // Neuer Task hinzugefügt, wende Filter an
            const currentFilter = filterDropdown ? filterDropdown.value : '';
            if (currentFilter) {
              applyFilter(currentFilter);
            }
          }
        });
      }
    });
  });

  // Starte Beobachtung nach Initialisierung
  setTimeout(() => {
    const tasksContainer = document.querySelector('.flex.flex-col.justify-center.pb-20');
    if (tasksContainer) {
      observer.observe(tasksContainer, {
        childList: true,
        subtree: true
      });
      console.log('BetterCodex: DOM-Beobachtung gestartet');
    }
  }, 1500);

})();
