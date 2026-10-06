import { computePosition, offset, flip, shift } from '@floating-ui/dom';
import { Platform } from 'obsidian';

export class FloatingToolbar {
	private el: HTMLElement | null = null;

	destroy() {
		if (this.el) {
			this.el.remove();
			this.el = null;
		}
	}

	show(
		targetRect: DOMRect,
		dictLabel: string,
		transLabel: string,
		selectedWordPreview: string,
		onDictionaryClick: () => void,
		onTranslateClick: () => void
	) {
		this.destroy();

		const isMobile = Platform.isMobile;

		this.el = document.createElement('div');
		this.el.className = `pdf-dict-floating-toolbar ${
			isMobile ? 'is-mobile-bottom-dock' : 'is-desktop-floating'
		}`;

		// Word preview badge on mobile (shows user what text was captured)
		if (isMobile && selectedWordPreview) {
			const previewBadge = this.el.createDiv({ cls: 'pdf-dict-toolbar-word-preview' });
			const displayWord =
				selectedWordPreview.length > 18
					? selectedWordPreview.slice(0, 16) + '…'
					: selectedWordPreview;
			previewBadge.textContent = `“${displayWord}”`;
		}

		// Button 1: Dictionary
		const dictBtn = this.el.createEl('button', {
			cls: 'pdf-dict-toolbar-pill-btn',
			text: dictLabel
		});
		dictBtn.title = `Look up in ${dictLabel}`;
		dictBtn.onclick = (e) => {
			e.stopPropagation();
			onDictionaryClick();
		};

		// Divider
		this.el.createDiv({ cls: 'pdf-dict-toolbar-divider' });

		// Button 2: Translation
		const transBtn = this.el.createEl('button', {
			cls: 'pdf-dict-toolbar-pill-btn',
			text: transLabel
		});
		transBtn.title = `Translate with ${transLabel}`;
		transBtn.onclick = (e) => {
			e.stopPropagation();
			onTranslateClick();
		};

		document.body.appendChild(this.el);

		if (isMobile) {
			// On Mobile: Dock at bottom screen (thumb zone, zero collision with Android native ActionMode)
			this.el.classList.add('is-positioned');
		} else {
			// On Desktop: Float accurately above/below the selection
			const virtualEl = {
				getBoundingClientRect: () => targetRect
			};

			computePosition(virtualEl, this.el, {
				strategy: 'fixed',
				placement: 'top',
				middleware: [
					offset(8),
					flip({ fallbackPlacements: ['bottom', 'top-start', 'bottom-start'] }),
					shift({ padding: 12, boundary: document.body })
				]
			}).then(({ x, y }) => {
				if (!this.el) return;
				Object.assign(this.el.style, {
					left: `${Math.round(x)}px`,
					top: `${Math.round(y)}px`
				});
				this.el.classList.add('is-positioned');
			}).catch((err) => {
				console.error('[PDF-Dict] Toolbar positioning error:', err);
			});
		}
	}
}
