import { Notice, Platform, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PDFDictionarySettings, PDFDictionarySettingTab } from './settings';
import { FloatingToolbar } from './ui/floating-toolbar';
import { ReaderCard } from './ui/reader-card';

export default class PDFDictionaryPlugin extends Plugin {
	settings!: PDFDictionarySettings;
	toolbar!: FloatingToolbar;
	readerCard!: ReaderCard;
	private lastSelectedText: string = '';
	private lastSelectionRect: DOMRect | null = null;
	private lastPointerPos: { x: number; y: number } | null = null;
	private selectionTimeout: number | null = null;

	async onload() {
		await this.loadSettings();

		this.toolbar = new FloatingToolbar();
		this.readerCard = new ReaderCard(this.app);
		this.updateReaderCardSettings();

		this.addSettingTab(new PDFDictionarySettingTab(this.app, this));

		// Selection events (Mouse + Touch)
		this.registerDomEvent(document, 'mouseup', (evt: MouseEvent) => {
			this.lastPointerPos = { x: evt.clientX, y: evt.clientY };
			this.debouncedHandleSelection();
		});

		this.registerDomEvent(document, 'touchend', (evt: TouchEvent) => {
			const touch = evt.changedTouches?.[0];
			if (touch) {
				this.lastPointerPos = {
					x: touch.clientX,
					y: touch.clientY
				};
			}
			this.debouncedHandleSelection();
		});

		// Dismiss toolbar on outside tap/click
		const dismissHandler = (evt: Event) => {
			const target = evt.target as HTMLElement | null;
			if (
				target &&
				!target.closest('.pdf-dict-floating-toolbar') &&
				!target.closest('.pdf-dict-modal') &&
				!target.closest('.pdf-plus-action-palette')
			) {
				this.toolbar.destroy();
			}
		};

		this.registerDomEvent(document, 'mousedown', dismissHandler);
		this.registerDomEvent(document, 'touchstart', dismissHandler);

		// Commands
		this.addCommand({
			id: 'lookup-dictionary',
			name: 'Look up selection in Dictionary',
			callback: () => {
				const text = this.getCurrentSelectionText();
				if (!text) {
					new Notice('Please select a word first.');
					return;
				}
				const rect = this.lastSelectionRect || this.getSelectionRect(window.getSelection());
				this.openDictionary(text, rect);
			}
		});

		this.addCommand({
			id: 'translate-selection',
			name: 'Translate selected text',
			callback: () => {
				const text = this.getCurrentSelectionText();
				if (!text) {
					new Notice('Please select text first.');
					return;
				}
				const rect = this.lastSelectionRect || this.getSelectionRect(window.getSelection());
				this.openTranslate(text, rect);
			}
		});

		console.log('[PDF Dictionary & Translator] Multi-provider loaded.');
	}

	onunload() {
		this.toolbar.destroy();
		this.readerCard.destroy();
		if (this.selectionTimeout) window.clearTimeout(this.selectionTimeout);
	}

	updateReaderCardSettings() {
		this.readerCard.setSettings(
			this.settings.dictionaryProvider,
			this.settings.translationProvider,
			this.settings.targetLanguage,
			this.settings.sourceLanguage,
			this.settings.vocabularyNoteName,
			this.settings.deeplApiKey
		);
	}

	private getDictionaryButtonLabel(): string {
		switch (this.settings.dictionaryProvider) {
			case 'oxford-learner':
				return '📖 Oxford';
			case 'dictionary-com':
				return '📖 Dict.com';
			case 'cambridge-learner':
			default:
				return '📖 Cambridge';
		}
	}

	private getTranslationButtonLabel(): string {
		switch (this.settings.translationProvider) {
			case 'cambridge-id':
				return '🌐 Cambridge ID';
			case 'deepl':
				return '🌐 DeepL';
			case 'mymemory':
			default:
				return '🌐 Translate';
		}
	}

	private debouncedHandleSelection() {
		if (this.selectionTimeout) {
			window.clearTimeout(this.selectionTimeout);
		}

		const delay = Platform.isMobile ? 220 : 100;
		this.selectionTimeout = window.setTimeout(() => {
			this.handleSelection();
		}, delay);
	}

	private handleSelection() {
		const selection = window.getSelection();
		const selectedText = selection?.toString()?.trim() || '';

		if (!selectedText || selectedText.length === 0) {
			this.toolbar.destroy();
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(Object as any) as any;
		const viewType = activeView?.getViewType?.() || '';

		const isPdf =
			viewType === 'pdf' ||
			Boolean(document.querySelector('.pdf-container:hover')) ||
			Boolean(document.querySelector('.pdf-container'));
		const isMarkdown = viewType === 'markdown';

		if (!isPdf && (!isMarkdown || !this.settings.enableInMarkdown)) {
			if (!Platform.isMobile) return;
		}

		// Calculate precise selection bounding box
		const rect = this.getSelectionRect(selection);
		this.lastSelectedText = selectedText;
		this.lastSelectionRect = rect;

		// Check PDF++ palette injection (if present)
		const pdfPlusPalette = document.querySelector('.pdf-plus-action-palette');
		if (pdfPlusPalette) {
			this.injectIntoPDFPlusPalette(pdfPlusPalette as HTMLElement, selectedText, rect);
		}

		// ALWAYS show our floating toolbar (floating on desktop, bottom dock on mobile)
		if (this.settings.autoShowToolbar) {
			this.toolbar.show(
				rect,
				this.getDictionaryButtonLabel(),
				this.getTranslationButtonLabel(),
				selectedText,
				() => this.openDictionary(selectedText, rect),
				() => this.openTranslate(selectedText, rect)
			);
		}
	}

	private getSelectionRect(selection: Selection | null): DOMRect {
		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const rects = range.getClientRects();

			// 1. Check individual client rects (multi-line or PDF text spans)
			if (rects.length > 0) {
				let minX = Infinity;
				let minY = Infinity;
				let maxX = -Infinity;
				let maxY = -Infinity;
				let hasValid = false;

				for (let i = 0; i < rects.length; i++) {
					const r = rects.item(i);
					if (r && r.width > 0 && r.height > 0 && r.left > 0 && r.top > 0) {
						minX = Math.min(minX, r.left);
						minY = Math.min(minY, r.top);
						maxX = Math.max(maxX, r.right);
						maxY = Math.max(maxY, r.bottom);
						hasValid = true;
					}
				}

				if (hasValid && maxX > minX && maxY > minY) {
					return new DOMRect(minX, minY, Math.max(maxX - minX, 10), Math.max(maxY - minY, 10));
				}
			}

			// 2. Check bounding client rect
			const bRect = range.getBoundingClientRect();
			if (bRect.width > 0 && bRect.height > 0 && bRect.left > 20) {
				return bRect;
			}
		}

		// 3. Fallback to exact pointer release position (avoids sidebar)
		if (this.lastPointerPos && this.lastPointerPos.x > 50) {
			return new DOMRect(
				this.lastPointerPos.x - 40,
				this.lastPointerPos.y - 15,
				80,
				30
			);
		}

		// 4. Fallback to active editor / view bounds
		const activeLeaf =
			document.querySelector('.workspace-leaf.mod-active') ||
			document.querySelector('.workspace-split.mod-root');
		if (activeLeaf) {
			const lRect = activeLeaf.getBoundingClientRect();
			return new DOMRect(lRect.left + lRect.width / 2 - 50, lRect.top + 80, 100, 30);
		}

		return new DOMRect(window.innerWidth / 2 - 50, 100, 100, 30);
	}

	private injectIntoPDFPlusPalette(palette: HTMLElement, text: string, anchorRect: DOMRect) {
		if (palette.querySelector('.pdf-dict-injected-btn')) return;

		const dictBtn = palette.createEl('button', {
			cls: 'pdf-plus-action-palette-item pdf-dict-injected-btn',
			text: '📖'
		});
		dictBtn.title = `Dictionary (${this.getDictionaryButtonLabel()})`;
		dictBtn.onclick = (e) => {
			e.stopPropagation();
			this.openDictionary(text, anchorRect);
		};

		const transBtn = palette.createEl('button', {
			cls: 'pdf-plus-action-palette-item pdf-dict-injected-btn',
			text: '🌐'
		});
		transBtn.title = `Translate (${this.getTranslationButtonLabel()})`;
		transBtn.onclick = (e) => {
			e.stopPropagation();
			this.openTranslate(text, anchorRect);
		};
	}

	private openDictionary(word: string, rect: DOMRect) {
		this.toolbar.destroy();
		this.updateReaderCardSettings();
		this.readerCard.open(word, 'dictionary', rect);
	}

	private openTranslate(text: string, rect: DOMRect) {
		this.toolbar.destroy();
		this.updateReaderCardSettings();
		this.readerCard.open(text, 'translate', rect);
	}

	private getCurrentSelectionText(): string {
		const sel = window.getSelection()?.toString().trim();
		return sel || this.lastSelectedText;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateReaderCardSettings();
	}
}
