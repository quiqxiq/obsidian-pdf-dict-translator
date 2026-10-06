import { App, Notice, Platform, TFile } from 'obsidian';
import { computePosition, offset, flip, shift } from '@floating-ui/dom';
import { DictResult, DictionaryProvider, fetchDictionaryEntry } from '../services/dictionary';
import { TranslationProvider, TranslationResult, translateText } from '../services/translator';

export type ActiveTab = 'dictionary' | 'translate';

export class ReaderCard {
	private el: HTMLElement | null = null;
	private backdropEl: HTMLElement | null = null;
	private app: App;
	private activeTab: ActiveTab = 'dictionary';
	private currentQuery: string = '';
	private dictResult: DictResult | null = null;
	private transResult: TranslationResult | null = null;
	private isLoadingDict = false;
	private isLoadingTrans = false;

	// Provider Configs
	private dictProvider: DictionaryProvider = 'cambridge-learner';
	private transProvider: TranslationProvider = 'cambridge-id';
	private targetLang = 'id';
	private sourceLang = 'en';
	private vocabularyNote = 'Vocabulary.md';
	private deeplApiKey = '';

	constructor(app: App) {
		this.app = app;
	}

	setSettings(
		dictProvider: DictionaryProvider,
		transProvider: TranslationProvider,
		targetLang: string,
		sourceLang: string,
		vocabularyNote: string,
		deeplApiKey: string = ''
	) {
		this.dictProvider = dictProvider;
		this.transProvider = transProvider;
		this.targetLang = targetLang;
		this.sourceLang = sourceLang;
		this.vocabularyNote = vocabularyNote;
		this.deeplApiKey = deeplApiKey;
	}

	destroy() {
		if (this.el) {
			this.el.remove();
			this.el = null;
		}
		if (this.backdropEl) {
			this.backdropEl.remove();
			this.backdropEl = null;
		}
	}

	async open(
		text: string,
		initialTab: ActiveTab,
		anchorRect?: DOMRect | null
	) {
		this.destroy();
		this.currentQuery = text.trim();
		this.activeTab = initialTab;
		this.dictResult = null;
		this.transResult = null;

		const isMobile = Platform.isMobile;

		// Mobile Backdrop
		if (isMobile) {
			this.backdropEl = document.body.createDiv({ cls: 'pdf-dict-backdrop' });
			this.backdropEl.onclick = () => this.destroy();
		}

		// Container
		this.el = document.createElement('div');
		this.el.className = `pdf-dict-modal ${isMobile ? 'is-mobile-sheet' : 'is-desktop-card'}`;

		document.body.appendChild(this.el);

		// Mobile pull handle
		if (isMobile) {
			const handle = this.el.createDiv({ cls: 'pdf-dict-sheet-handle' });
			handle.onclick = () => this.destroy();
		}

		// 1. Search Bar Row (Editable query for imprecise selections)
		this.renderSearchBar();

		// 2. Navigation Tabs Bar
		const navBar = this.el.createDiv({ cls: 'pdf-dict-navbar' });
		const tabsGroup = navBar.createDiv({ cls: 'pdf-dict-tabs-group' });

		const dictLabel = this.getDictTabLabel();
		const transLabel = this.getTransTabLabel();

		const dictTabBtn = tabsGroup.createEl('button', {
			cls: `pdf-dict-tab ${this.activeTab === 'dictionary' ? 'is-active' : ''}`,
			text: dictLabel
		});
		const transTabBtn = tabsGroup.createEl('button', {
			cls: `pdf-dict-tab ${this.activeTab === 'translate' ? 'is-active' : ''}`,
			text: transLabel
		});

		dictTabBtn.onclick = (e) => {
			e.stopPropagation();
			this.switchTab('dictionary');
		};
		transTabBtn.onclick = (e) => {
			e.stopPropagation();
			this.switchTab('translate');
		};

		const closeBtn = navBar.createEl('button', {
			cls: 'pdf-dict-close-btn',
			text: '✕'
		});
		closeBtn.onclick = (e) => {
			e.stopPropagation();
			this.destroy();
		};

		// 3. Content Body & Footer
		this.el.createDiv({ cls: 'pdf-dict-body' });
		this.el.createDiv({ cls: 'pdf-dict-footer' });

		// Desktop positioning
		if (!isMobile && anchorRect) {
			const virtualEl = {
				getBoundingClientRect: () => anchorRect
			};
			computePosition(virtualEl, this.el, {
				strategy: 'fixed',
				placement: 'bottom-start',
				middleware: [
					offset(10),
					flip({ fallbackPlacements: ['top-start', 'bottom', 'top'] }),
					shift({ padding: 16, boundary: document.body })
				]
			}).then(({ x, y }) => {
				if (!this.el) return;
				Object.assign(this.el.style, {
					left: `${Math.round(x)}px`,
					top: `${Math.round(y)}px`
				});
				this.el.classList.add('is-positioned');
			}).catch((err) => {
				console.error('[PDF-Dict] Card positioning error:', err);
			});
		} else if (isMobile) {
			this.el.classList.add('is-positioned');
		}

		// Initial Data Load
		this.renderBody();

		if (initialTab === 'dictionary') {
			this.loadDictionary();
		} else {
			this.loadTranslation();
		}
	}

	private renderSearchBar() {
		if (!this.el) return;
		const searchForm = this.el.createEl('form', { cls: 'pdf-dict-search-row' });
		searchForm.setAttribute('action', '#');

		const searchBox = searchForm.createDiv({ cls: 'pdf-dict-search-box' });

		// Clickable Search Icon Button
		const searchIconBtn = searchBox.createEl('button', {
			cls: 'pdf-dict-search-icon-btn',
			type: 'submit',
			text: '🔍'
		});
		searchIconBtn.title = 'Search this word';

		const input = searchBox.createEl('input', {
			cls: 'pdf-dict-search-input',
			type: 'search',
			value: this.currentQuery
		});
		input.placeholder = 'Type word to search...';
		input.autocomplete = 'off';
		input.autocapitalize = 'none';
		input.spellcheck = false;

		const clearBtn = searchBox.createEl('button', {
			cls: 'pdf-dict-search-clear-btn',
			type: 'button',
			text: '✕'
		});
		clearBtn.onclick = (e) => {
			e.stopPropagation();
			input.value = '';
			input.focus();
		};

		// Submit button
		const submitBtn = searchForm.createEl('button', {
			cls: 'pdf-dict-search-submit-btn',
			type: 'submit',
			text: 'Search'
		});

		const executeSearch = () => {
			const rawVal = input.value;
			const newQuery = rawVal.trim();
			if (newQuery) {
				// Blur input to hide mobile soft keyboard
				input.blur();
				this.updateQuery(newQuery);
			}
		};

		searchForm.addEventListener('submit', (e) => {
			e.preventDefault();
			e.stopPropagation();
			executeSearch();
		});

		searchIconBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			executeSearch();
		};

		submitBtn.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			executeSearch();
		};

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				executeSearch();
			}
		});
	}

	private updateQuery(newQuery: string) {
		this.currentQuery = newQuery;
		this.dictResult = null;
		this.transResult = null;

		// Keep input value in sync
		if (this.el) {
			const input = this.el.querySelector('.pdf-dict-search-input') as HTMLInputElement | null;
			if (input && input.value !== newQuery) {
				input.value = newQuery;
			}
		}

		if (this.activeTab === 'dictionary') {
			this.loadDictionary();
		} else {
			this.loadTranslation();
		}
	}

	private getDictTabLabel(): string {
		switch (this.dictProvider) {
			case 'oxford-learner':
				return '📖 Oxford';
			case 'dictionary-com':
				return '📖 Dict.com';
			case 'cambridge-learner':
			default:
				return '📖 Cambridge';
		}
	}

	private getTransTabLabel(): string {
		switch (this.transProvider) {
			case 'cambridge-id':
				return '🌐 Cambridge ID';
			case 'deepl':
				return '🌐 DeepL';
			case 'mymemory':
			default:
				return '🌐 Translate';
		}
	}

	private switchTab(tab: ActiveTab) {
		if (this.activeTab === tab) return;
		this.activeTab = tab;

		if (!this.el) return;
		const tabs = this.el.querySelectorAll('.pdf-dict-tab');
		tabs.forEach((t) => t.classList.remove('is-active'));

		if (tab === 'dictionary') {
			tabs[0]?.classList.add('is-active');
			if (!this.dictResult && !this.isLoadingDict) {
				this.loadDictionary();
			} else {
				this.renderBody();
			}
		} else {
			tabs[1]?.classList.add('is-active');
			if (!this.transResult && !this.isLoadingTrans) {
				this.loadTranslation();
			} else {
				this.renderBody();
			}
		}
	}

	private async loadDictionary() {
		this.isLoadingDict = true;
		this.renderBody();

		this.dictResult = await fetchDictionaryEntry(this.currentQuery, this.dictProvider);
		this.isLoadingDict = false;
		if (this.activeTab === 'dictionary') {
			this.renderBody();
		}
	}

	private async loadTranslation() {
		this.isLoadingTrans = true;
		this.renderBody();
		this.transResult = await translateText(
			this.currentQuery,
			this.transProvider,
			this.targetLang,
			this.sourceLang,
			this.deeplApiKey
		);
		this.isLoadingTrans = false;
		if (this.activeTab === 'translate') {
			this.renderBody();
		}
	}

	private renderBody() {
		if (!this.el) return;
		const body = this.el.querySelector('.pdf-dict-body') as HTMLElement;
		const footer = this.el.querySelector('.pdf-dict-footer') as HTMLElement;
		if (!body || !footer) return;

		body.empty();
		footer.empty();

		if (this.activeTab === 'dictionary') {
			this.renderDictionaryTab(body, footer);
		} else {
			this.renderTranslationTab(body, footer);
		}
	}

	private renderDictionaryTab(body: HTMLElement, footer: HTMLElement) {
		if (this.isLoadingDict) {
			const loader = body.createDiv({ cls: 'pdf-dict-state-container' });
			loader.createDiv({ cls: 'pdf-dict-spinner' });
			loader.createSpan({ text: `Looking up "${this.currentQuery}" in ${this.getDictTabLabel()}...` });
			return;
		}

		if (!this.dictResult || this.dictResult.entries.length === 0) {
			const emptyState = body.createDiv({ cls: 'pdf-dict-state-container' });
			emptyState.createDiv({ cls: 'pdf-dict-state-icon', text: '🔍' });
			emptyState.createSpan({
				text: `Word "${this.currentQuery}" not found in ${this.dictResult?.provider || 'Dictionary'}.`
			});
			emptyState.createDiv({
				cls: 'pdf-dict-state-hint',
				text: 'Tip: You can edit or retype the word in the search bar above.'
			});
			return;
		}

		// Entries
		this.dictResult.entries.forEach((entry) => {
			const entryCard = body.createDiv({ cls: 'pdf-dict-entry-card' });

			// Headword & Part of Speech Badge
			const headRow = entryCard.createDiv({ cls: 'pdf-dict-head-row' });
			headRow.createSpan({ cls: 'pdf-dict-word-title', text: entry.word });
			if (entry.pos) {
				headRow.createSpan({ cls: 'pdf-dict-pos-badge', text: entry.pos });
			}

			// Pronunciations
			if (entry.ukIpa || entry.usIpa) {
				const pronRow = entryCard.createDiv({ cls: 'pdf-dict-pron-row' });

				if (entry.ukIpa) {
					const ukPill = pronRow.createDiv({ cls: 'pdf-dict-ipa-pill' });
					ukPill.createSpan({ cls: 'pdf-dict-region-tag', text: 'UK' });
					ukPill.createSpan({ text: `/${entry.ukIpa}/` });
					if (entry.ukAudioUrl) {
						const audioBtn = ukPill.createEl('button', { cls: 'pdf-dict-audio-btn', text: '🔊' });
						audioBtn.title = 'Listen to UK Pronunciation';
						audioBtn.onclick = (e) => {
							e.stopPropagation();
							new Audio(entry.ukAudioUrl).play();
						};
					}
				}

				if (entry.usIpa) {
					const usPill = pronRow.createDiv({ cls: 'pdf-dict-ipa-pill' });
					usPill.createSpan({ cls: 'pdf-dict-region-tag', text: 'US' });
					usPill.createSpan({ text: `/${entry.usIpa}/` });
					if (entry.usAudioUrl) {
						const audioBtn = usPill.createEl('button', { cls: 'pdf-dict-audio-btn', text: '🔊' });
						audioBtn.title = 'Listen to US Pronunciation';
						audioBtn.onclick = (e) => {
							e.stopPropagation();
							new Audio(entry.usAudioUrl).play();
						};
					}
				}
			}

			// Definitions
			const defList = entryCard.createEl('ol', { cls: 'pdf-dict-definition-list' });
			entry.definitions.forEach((def) => {
				const li = defList.createEl('li', { cls: 'pdf-dict-def-item' });
				li.createDiv({ cls: 'pdf-dict-def-text', text: def.definition });

				if (def.examples.length > 0) {
					const exBox = li.createDiv({ cls: 'pdf-dict-examples-box' });
					def.examples.forEach((ex) => {
						exBox.createDiv({ cls: 'pdf-dict-example-item', text: `“${ex}”` });
					});
				}
			});
		});

		// Footer Buttons
		const saveBtn = footer.createEl('button', {
			cls: 'pdf-dict-primary-btn',
			text: '📝 Save to Vocabulary'
		});
		saveBtn.onclick = async () => {
			if (this.dictResult) await this.saveDictionaryToVocabulary(this.dictResult);
		};

		const linkBtn = footer.createEl('a', {
			cls: 'pdf-dict-secondary-btn',
			text: `Open ${this.dictResult.provider} ↗`,
			href: this.dictResult.sourceUrl
		});
		linkBtn.setAttribute('target', '_blank');
	}

	private renderTranslationTab(body: HTMLElement, footer: HTMLElement) {
		if (this.isLoadingTrans) {
			const loader = body.createDiv({ cls: 'pdf-dict-state-container' });
			loader.createDiv({ cls: 'pdf-dict-spinner' });
			loader.createSpan({ text: 'Translating text...' });
			return;
		}

		if (!this.transResult) {
			const emptyState = body.createDiv({ cls: 'pdf-dict-state-container' });
			emptyState.createDiv({ cls: 'pdf-dict-state-icon', text: '⚠️' });
			emptyState.createSpan({
				text: 'Failed to translate. Please check your internet connection.'
			});
			return;
		}

		const transContainer = body.createDiv({ cls: 'pdf-dict-trans-container' });

		// Source Box
		const srcBox = transContainer.createDiv({ cls: 'pdf-dict-bubble is-source' });
		srcBox.createDiv({ cls: 'pdf-dict-bubble-label', text: `ORIGINAL (${this.transResult.sourceLang.toUpperCase()})` });
		srcBox.createDiv({ cls: 'pdf-dict-bubble-text', text: this.transResult.query });

		// Provider Tag
		const provTag = transContainer.createDiv({ cls: 'pdf-dict-trans-provider-badge' });
		provTag.textContent = `Provider: ${this.transResult.provider}`;

		// Target Box
		const targetBox = transContainer.createDiv({ cls: 'pdf-dict-bubble is-target' });
		targetBox.createDiv({
			cls: 'pdf-dict-bubble-label',
			text: `TRANSLATION (${this.transResult.targetLang.toUpperCase()})`
		});
		targetBox.createDiv({
			cls: 'pdf-dict-bubble-text is-highlight',
			text: this.transResult.translatedText
		});

		// Rich senses from Cambridge English-Indonesian if available
		if (this.transResult.senses && this.transResult.senses.length > 0) {
			const senseBox = transContainer.createDiv({ cls: 'pdf-dict-senses-container' });
			senseBox.createDiv({ cls: 'pdf-dict-senses-title', text: 'Meanings & Context:' });

			this.transResult.senses.forEach((s) => {
				const item = senseBox.createDiv({ cls: 'pdf-dict-sense-item' });
				const titleRow = item.createDiv({ cls: 'pdf-dict-sense-title-row' });
				titleRow.createSpan({ cls: 'pdf-dict-sense-meaning', text: `• ${s.indonesianMeaning}` });
				if (s.pos) titleRow.createSpan({ cls: 'pdf-dict-pos-badge', text: s.pos });

				if (s.englishDef) {
					item.createDiv({ cls: 'pdf-dict-sense-def', text: s.englishDef });
				}
				if (s.example) {
					item.createDiv({ cls: 'pdf-dict-example-item', text: `“${s.example}”` });
				}
			});
		}

		// Footer Buttons
		const copyBtn = footer.createEl('button', {
			cls: 'pdf-dict-secondary-btn',
			text: '📋 Copy Translation'
		});
		copyBtn.onclick = async () => {
			if (this.transResult) {
				await navigator.clipboard.writeText(this.transResult.translatedText);
				new Notice('Translation copied to clipboard!');
			}
		};

		const saveBtn = footer.createEl('button', {
			cls: 'pdf-dict-primary-btn',
			text: '📝 Save to Vocabulary'
		});
		saveBtn.onclick = async () => {
			if (this.transResult) await this.saveTranslationToVocabulary(this.transResult);
		};
	}

	private async saveDictionaryToVocabulary(result: DictResult) {
		const fileName = this.vocabularyNote;
		const vault = this.app.vault;
		let file = vault.getAbstractFileByPath(fileName);

		let contentToAppend = `\n### ${result.query} *(${result.provider})*\n`;
		result.entries.forEach((e) => {
			if (e.pos) contentToAppend += `- *(${e.pos})* ${e.ukIpa ? `/${e.ukIpa}/` : ''}\n`;
			e.definitions.forEach((d) => {
				contentToAppend += `  - **Definition**: ${d.definition}\n`;
				if (d.examples.length > 0) {
					contentToAppend += `  - *Example*: "${d.examples[0]}"\n`;
				}
			});
		});

		try {
			if (file instanceof TFile) {
				await vault.append(file, contentToAppend);
			} else {
				await vault.create(fileName, `# Vocabulary List\n${contentToAppend}`);
			}
			new Notice(`"${result.query}" saved to ${fileName}`);
		} catch (err) {
			console.error(err);
			new Notice('Failed to save to note.');
		}
	}

	private async saveTranslationToVocabulary(result: TranslationResult) {
		const fileName = this.vocabularyNote;
		const vault = this.app.vault;
		let file = vault.getAbstractFileByPath(fileName);

		const line = `\n- **${result.query}**: ${result.translatedText} *(${result.provider})*\n`;
		try {
			if (file instanceof TFile) {
				await vault.append(file, line);
			} else {
				await vault.create(fileName, `# Vocabulary List\n${line}`);
			}
			new Notice(`Saved to ${fileName}`);
		} catch (err) {
			console.error(err);
			new Notice('Failed to save to note.');
		}
	}
}
