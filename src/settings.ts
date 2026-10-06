import { App, PluginSettingTab, Setting } from 'obsidian';
import type PDFDictionaryPlugin from './main';
import { DictionaryProvider } from './services/dictionary';
import { TranslationProvider } from './services/translator';

export interface PDFDictionarySettings {
	dictionaryProvider: DictionaryProvider;
	translationProvider: TranslationProvider;
	targetLanguage: string;
	sourceLanguage: string;
	autoShowToolbar: boolean;
	enableInMarkdown: boolean;
	vocabularyNoteName: string;
	deeplApiKey: string;
}

export const DEFAULT_SETTINGS: PDFDictionarySettings = {
	dictionaryProvider: 'cambridge-learner',
	translationProvider: 'cambridge-id',
	targetLanguage: 'id',
	sourceLanguage: 'en',
	autoShowToolbar: true,
	enableInMarkdown: true,
	vocabularyNoteName: 'Vocabulary.md',
	deeplApiKey: ''
};

export class PDFDictionarySettingTab extends PluginSettingTab {
	plugin: PDFDictionaryPlugin;

	constructor(app: App, plugin: PDFDictionaryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'PDF Dictionary & Translator Settings' });

		// 1. Dictionary Provider
		new Setting(containerEl)
			.setName('Dictionary provider')
			.setDesc('Select the English dictionary source for lookups')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('cambridge-learner', "Cambridge Learner's Dictionary (Recommended)")
					.addOption('oxford-learner', "Oxford Learner's Dictionaries")
					.addOption('dictionary-com', 'Dictionary.com')
					.setValue(this.plugin.settings.dictionaryProvider)
					.onChange(async (value) => {
						this.plugin.settings.dictionaryProvider = value as DictionaryProvider;
						await this.plugin.saveSettings();
					})
			);

		// 2. Translation Provider
		new Setting(containerEl)
			.setName('Translation provider')
			.setDesc('Select the translation engine (Defaults to English to Indonesian)')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('cambridge-id', 'Cambridge English–Indonesian (Official & Educational)')
					.addOption('mymemory', 'Web Translator / MyMemory (Fast & Accurate for Sentences)')
					.addOption('deepl', 'DeepL API (High Quality, Requires API Key)')
					.setValue(this.plugin.settings.translationProvider)
					.onChange(async (value) => {
						this.plugin.settings.translationProvider = value as TranslationProvider;
						await this.plugin.saveSettings();
						this.display(); // Refresh to toggle DeepL API key field
					})
			);

		// 3. DeepL API Key (Conditional)
		if (this.plugin.settings.translationProvider === 'deepl') {
			new Setting(containerEl)
				.setName('DeepL API key')
				.setDesc('Enter your DeepL API Authentication Key (Free or Pro)')
				.addText((text) =>
					text
						.setPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx')
						.setValue(this.plugin.settings.deeplApiKey)
						.onChange(async (value) => {
							this.plugin.settings.deeplApiKey = value.trim();
							await this.plugin.saveSettings();
						})
				);
		}

		// 4. Target & Source Languages
		new Setting(containerEl)
			.setName('Target language')
			.setDesc('Target language code (e.g. "id" for Indonesian, "es" for Spanish)')
			.addText((text) =>
				text
					.setPlaceholder('id')
					.setValue(this.plugin.settings.targetLanguage)
					.onChange(async (value) => {
						this.plugin.settings.targetLanguage = value.trim() || 'id';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Source language')
			.setDesc('Source language code of the text (e.g. "en" for English)')
			.addText((text) =>
				text
					.setPlaceholder('en')
					.setValue(this.plugin.settings.sourceLanguage)
					.onChange(async (value) => {
						this.plugin.settings.sourceLanguage = value.trim() || 'en';
						await this.plugin.saveSettings();
					})
			);

		// 5. Behavior
		new Setting(containerEl)
			.setName('Auto-show toolbar on selection')
			.setDesc('Display the floating toolbar automatically when text is selected')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoShowToolbar)
					.onChange(async (value) => {
						this.plugin.settings.autoShowToolbar = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Enable in Markdown notes')
			.setDesc('Enable the dictionary toolbar when selecting text in standard Markdown notes as well as PDFs')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInMarkdown)
					.onChange(async (value) => {
						this.plugin.settings.enableInMarkdown = value;
						await this.plugin.saveSettings();
					})
			);

		// 6. Vocabulary Note
		new Setting(containerEl)
			.setName('Vocabulary note name')
			.setDesc('Markdown file name where new vocabulary items will be saved')
			.addText((text) =>
				text
					.setPlaceholder('Vocabulary.md')
					.setValue(this.plugin.settings.vocabularyNoteName)
					.onChange(async (value) => {
						this.plugin.settings.vocabularyNoteName = value.trim() || 'Vocabulary.md';
						await this.plugin.saveSettings();
					})
			);
	}
}
