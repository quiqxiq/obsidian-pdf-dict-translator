# PDF Dictionary & Translator for Obsidian

A powerful, elegant, cross-platform reader companion for [Obsidian](https://obsidian.md). Look up words across multiple authoritative dictionaries (Cambridge Learner's, Oxford Learner's, Dictionary.com) and translate selections in real-time with an intuitive, non-intrusive floating toolbar on desktop and mobile.

![Obsidian Version](https://img.shields.io/badge/Obsidian-v1.0.0+-purple.svg)
![Platforms](https://img.shields.io/badge/Platform-Desktop%20%7C%20Android%20%7C%20iOS-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## ✨ Features

- **📖 Multiple Authoritative Dictionaries**
  - **Cambridge Learner's Dictionary**: Learner-friendly definitions, UK/US IPA phonetics, and authentic native audio clips.
  - **Oxford Learner's Dictionaries**: Rigorous definitions, CEFR language levels, UK/US phonetics, and pronunciations.
  - **Dictionary.com**: Rich American English definitions, syllabification, and audio pronunciations.

- **🌐 Intelligent Multi-Engine Translation**
  - **Cambridge English–Indonesian**: Curated bilingual entries with parts of speech, English explanations, and contextual translated examples.
  - **Web Translator (MyMemory)**: High-speed translation for idioms, phrases, and entire paragraphs.
  - **DeepL API**: Optional integration for professional-grade neural translation (Free and Pro API keys supported).

- **📱 Designed for Both Desktop and Mobile (Android & iOS)**
  - **Desktop**: A sleek, glassmorphic pill toolbar hovers directly above your text selection.
  - **Mobile (Android & iOS)**: Automatically docks into a thumb-friendly **Floating Bottom Dock**, completely eliminating collisions with Android's native text selection popups (`Copy` / `Share` / `Select all`). Tapping opens a modern slide-up **Bottom Sheet**.

- **🔍 Interactive Search Bar**
  - Built-in editable search bar at the top of the card. If you ever select an incomplete word in a PDF or want to look up a different word, simply edit it in the bar and tap **Search** without re-selecting text.

- **🔊 Audio Pronunciations**
  - Instant playback for UK and US pronunciations with interactive audio buttons.

- **📝 One-Click Vocabulary Note Export**
  - Save looked-up words, definitions, phonetics, and example sentences directly into your `Vocabulary.md` note with a single click.

- **📄 Universal PDF & Markdown Support**
  - Works seamlessly with Obsidian's native PDF reader, PDF++ plugin, and standard Markdown notes.

---

## 🚀 Installation

### Via Obsidian Community Plugins (Recommended once listed)
1. In Obsidian, open **Settings** → **Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for `PDF Dictionary & Translator`.
4. Click **Install**, then **Enable**.

### Manual Installation
1. Download the latest release (`pdf-dictionary-translator.zip` or `main.js`, `manifest.json`, `styles.css`) from the [Releases](https://github.com/quiqxiq/obsidian-pdf-dict-translator/releases) page.
2. Extract the files into your vault's plugin directory:
   `<YourVault>/.obsidian/plugins/pdf-dictionary-translator/`
3. Reload Obsidian or toggle the plugin in **Settings** → **Community plugins**.

---

## ⚙️ Configuration

In **Settings** → **PDF Dictionary & Translator**, you can customize:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Dictionary provider** | Choose between Cambridge Learner's, Oxford Learner's, or Dictionary.com | `Cambridge Learner's` |
| **Translation provider** | Choose between Cambridge English–Indonesian, Web Translator, or DeepL | `Cambridge English–Indonesian` |
| **DeepL API key** | Authentication key for DeepL API (if selected) | Empty |
| **Target language** | Language code for translation | `id` (Indonesian) |
| **Source language** | Language code of the original text | `en` (English) |
| **Auto-show toolbar** | Show the floating toolbar automatically on text selection | `Enabled` |
| **Enable in Markdown** | Also trigger the toolbar when selecting text in Markdown notes | `Enabled` |
| **Vocabulary note name** | File name for exported words | `Vocabulary.md` |

---

## 🛠️ Development & Building

To build the plugin from source:

```bash
# Clone the repository
git clone https://github.com/quiqxiq/obsidian-pdf-dict-translator.git
cd obsidian-pdf-dict-translator

# Install dependencies
npm install

# Start development build with auto-reload
npm run dev

# Build for production
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
