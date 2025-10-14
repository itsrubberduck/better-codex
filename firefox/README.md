# BetterCodex Firefox Addon

Ein Firefox-Addon für bessere Repo-Kontrolle in ChatGPT Codex.

## Features

- 🔍 **Repo-Filter**: Filtere Codex-Aufgaben nach Repository
- 💾 **Persistenz**: Letzte Auswahl wird automatisch im localStorage gespeichert
- 🔄 **Automatisch**: Filter wird beim Seitenladen automatisch angewendet
- 🎨 **Dark Mode**: Unterstützt sowohl helle als auch dunkle Themes

## Installation

### Dateien erstellen

Erstelle einen neuen Ordner `bettercodex` und lege diese Dateien darin an:

1. **manifest.json** (siehe Artifact 1)
2. **content.js** (siehe Artifact 2)
3. **style.css** (siehe Artifact 3)
4. **icon.png** (optional - erstelle ein 96x96px Icon oder lade ein beliebiges Icon)

### In Firefox installieren

1. Öffne Firefox und gehe zu `about:debugging`
2. Klicke auf "Dieser Firefox" (links in der Sidebar)
3. Klicke auf "Temporäres Add-on laden..."
4. Navigiere zum `bettercodex` Ordner und wähle die `manifest.json` Datei
5. Das Addon ist jetzt installiert!

### Permanente Installation

Für eine permanente Installation musst du das Addon bei Mozilla signieren lassen:

1. Gehe zu [addons.mozilla.org/developers](https://addons.mozilla.org/developers)
2. Erstelle ein Konto und lade dein Addon hoch
3. Alternativ: Verwende Firefox Developer Edition oder Nightly mit deaktivierter Signaturprüfung

## Verwendung

1. Öffne ChatGPT Codex (`chatgpt.com/codex`)
2. Das Addon lädt automatisch nach 1 Sekunde
3. Rechts neben den Tabs "Aufgaben", "Code-Überprüfungen", "Archivieren" erscheint ein Dropdown-Menü
4. Wähle ein Repository aus, um nur Tasks für dieses Repo anzuzeigen
5. Wähle "Alle Repos" um alle Tasks anzuzeigen
6. Deine Auswahl wird automatisch gespeichert und beim nächsten Besuch wiederhergestellt

## Funktionsweise

Das Addon:
- Wartet 1 Sekunde nach dem Laden der Seite
- Extrahiert alle verfügbaren Repositories aus dem DOM
- Erstellt ein Dropdown-Filter-Element
- Speichert die Auswahl im localStorage
- Filtert die Task-Liste basierend auf dem ausgewählten Repo
- Beobachtet DOM-Änderungen für dynamisch geladene Tasks

## Technische Details

- **Manifest Version**: 2 (kompatibel mit älteren Firefox-Versionen)
- **Berechtigungen**: Nur `storage` für localStorage
- **Content Scripts**: Läuft nur auf Codex-Seiten
- **Keine Background Scripts**: Alles läuft im Content Script

## Debugging

Öffne die Browser-Konsole (F12) und suche nach Log-Einträgen mit "BetterCodex:" für Debug-Informationen.

## Anpassungen

Du kannst das Addon nach Belieben anpassen:

- **Styling**: Bearbeite `style.css`
- **Timing**: Ändere die `setTimeout` Werte in `content.js`
- **Filter-Position**: Passe die DOM-Manipulation in `createFilterDropdown()` an

## Support

Bei Problemen:
1. Überprüfe die Browser-Konsole auf Fehler
2. Stelle sicher, dass du auf der richtigen Seite bist (Codex)
3. Lade die Seite neu nach Addon-Installation

## Lizenz

Frei verwendbar für persönliche Zwecke.
