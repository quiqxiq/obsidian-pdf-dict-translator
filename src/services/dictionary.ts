import { requestUrl } from 'obsidian';

export type DictionaryProvider = 'cambridge-learner' | 'oxford-learner' | 'dictionary-com';

export interface DictDefinition {
	definition: string;
	examples: string[];
}

export interface DictEntry {
	word: string;
	pos?: string;
	ukIpa?: string;
	usIpa?: string;
	ukAudioUrl?: string;
	usAudioUrl?: string;
	definitions: DictDefinition[];
}

export interface DictResult {
	query: string;
	provider: string;
	providerKey: DictionaryProvider;
	entries: DictEntry[];
	sourceUrl: string;
}

export async function fetchDictionaryEntry(
	word: string,
	provider: DictionaryProvider = 'cambridge-learner'
): Promise<DictResult | null> {
	switch (provider) {
		case 'oxford-learner':
			return fetchOxfordLearner(word);
		case 'dictionary-com':
			return fetchDictionaryCom(word);
		case 'cambridge-learner':
		default:
			return fetchCambridgeLearner(word);
	}
}

// --------------------------------------------------------------------------
// 1. Cambridge Learner's Dictionary
// --------------------------------------------------------------------------
export async function fetchCambridgeLearner(word: string): Promise<DictResult | null> {
	const cleanWord = word.trim().toLowerCase();
	if (!cleanWord) return null;

	const sourceUrl = `https://dictionary.cambridge.org/dictionary/learner-english/${encodeURIComponent(cleanWord)}`;

	try {
		const response = await requestUrl({
			url: sourceUrl,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(response.text, 'text/html');

		const entryBlocks = doc.querySelectorAll('.entry-body__el');
		const blocks = entryBlocks.length > 0 ? entryBlocks : [doc.querySelector('.entry-body')!];

		const entries: DictEntry[] = [];

		blocks.forEach((el) => {
			if (!el) return;

			const wordEl = el.querySelector('.hw.dhw') || el.querySelector('.hw');
			const posEl = el.querySelector('.posgram .pos') || el.querySelector('.pos.dpos');
			const ukIpaEl = el.querySelector('.uk .ipa');
			const usIpaEl = el.querySelector('.us .ipa');

			let ukAudioUrl: string | undefined;
			let usAudioUrl: string | undefined;

			const ukAudioSrc = el.querySelector('.uk source[type="audio/mpeg"]') as HTMLSourceElement | null;
			if (ukAudioSrc?.getAttribute('src')) {
				const src = ukAudioSrc.getAttribute('src')!;
				ukAudioUrl = src.startsWith('http') ? src : `https://dictionary.cambridge.org${src}`;
			}

			const usAudioSrc = el.querySelector('.us source[type="audio/mpeg"]') as HTMLSourceElement | null;
			if (usAudioSrc?.getAttribute('src')) {
				const src = usAudioSrc.getAttribute('src')!;
				usAudioUrl = src.startsWith('http') ? src : `https://dictionary.cambridge.org${src}`;
			}

			const defBlocks = el.querySelectorAll('.def-block.ddef_block');
			const definitions: DictDefinition[] = [];

			defBlocks.forEach((dBlock) => {
				const defTextEl = dBlock.querySelector('.def.ddef_d');
				if (!defTextEl) return;
				const rawDef = defTextEl.textContent?.trim().replace(/:$/, '') || '';
				if (!rawDef) return;

				const examples: string[] = [];
				const exampEls = dBlock.querySelectorAll('.examp.dexamp .eg');
				exampEls.forEach((eg) => {
					const t = eg.textContent?.trim();
					if (t) examples.push(t);
				});

				definitions.push({
					definition: rawDef,
					examples: examples.slice(0, 3)
				});
			});

			if (definitions.length > 0) {
				entries.push({
					word: wordEl?.textContent?.trim() || cleanWord,
					pos: posEl?.textContent?.trim() || '',
					ukIpa: ukIpaEl?.textContent?.trim(),
					usIpa: usIpaEl?.textContent?.trim(),
					ukAudioUrl,
					usAudioUrl,
					definitions: definitions.slice(0, 4)
				});
			}
		});

		if (entries.length === 0) return null;

		return {
			query: cleanWord,
			provider: "Cambridge Learner's",
			providerKey: 'cambridge-learner',
			entries,
			sourceUrl
		};
	} catch (error) {
		console.error('[Dict] Cambridge fetch error:', error);
		return null;
	}
}

// --------------------------------------------------------------------------
// 2. Oxford Learner's Dictionaries
// --------------------------------------------------------------------------
export async function fetchOxfordLearner(word: string): Promise<DictResult | null> {
	const cleanWord = word.trim().toLowerCase();
	if (!cleanWord) return null;

	const sourceUrl = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;

	try {
		const response = await requestUrl({
			url: sourceUrl,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(response.text, 'text/html');

		const headwordEl = doc.querySelector('h1.headword') || doc.querySelector('.headword');
		if (!headwordEl) return null;

		const posEl = doc.querySelector('span.pos');
		const ukPhonEl = doc.querySelector('.phons_br .phon') || doc.querySelector('.pron-uk .phon');
		const usPhonEl = doc.querySelector('.phons_n_am .phon') || doc.querySelector('.pron-us .phon');

		let ukAudioUrl: string | undefined;
		let usAudioUrl: string | undefined;

		const ukAudioEl = doc.querySelector('.phons_br [data-src-mp3]') || doc.querySelector('.pron-uk[data-src-mp3]');
		if (ukAudioEl) ukAudioUrl = ukAudioEl.getAttribute('data-src-mp3') || undefined;

		const usAudioEl = doc.querySelector('.phons_n_am [data-src-mp3]') || doc.querySelector('.pron-us[data-src-mp3]');
		if (usAudioEl) usAudioUrl = usAudioEl.getAttribute('data-src-mp3') || undefined;

		const senseEls = doc.querySelectorAll('li.sense');
		const definitions: DictDefinition[] = [];

		senseEls.forEach((sense) => {
			const defEl = sense.querySelector('.def');
			if (!defEl) return;
			const defText = defEl.textContent?.trim().replace(/:$/, '') || '';
			if (!defText) return;

			const examples: string[] = [];
			const exEls = sense.querySelectorAll('.examples .x');
			exEls.forEach((ex) => {
				const t = ex.textContent?.trim();
				if (t) examples.push(t);
			});

			definitions.push({
				definition: defText,
				examples: examples.slice(0, 3)
			});
		});

		// Fallback for single definition without sense list
		if (definitions.length === 0) {
			const singleDef = doc.querySelector('.def');
			if (singleDef) {
				definitions.push({
					definition: singleDef.textContent?.trim().replace(/:$/, '') || '',
					examples: []
				});
			}
		}

		if (definitions.length === 0) return null;

		const entries: DictEntry[] = [
			{
				word: headwordEl.textContent?.trim() || cleanWord,
				pos: posEl?.textContent?.trim() || '',
				ukIpa: ukPhonEl?.textContent?.trim().replace(/^\/|\/$/g, ''),
				usIpa: usPhonEl?.textContent?.trim().replace(/^\/|\/$/g, ''),
				ukAudioUrl,
				usAudioUrl,
				definitions: definitions.slice(0, 5)
			}
		];

		return {
			query: cleanWord,
			provider: "Oxford Learner's",
			providerKey: 'oxford-learner',
			entries,
			sourceUrl
		};
	} catch (error) {
		console.error('[Dict] Oxford fetch error:', error);
		return null;
	}
}

// --------------------------------------------------------------------------
// 3. Dictionary.com
// --------------------------------------------------------------------------
export async function fetchDictionaryCom(word: string): Promise<DictResult | null> {
	const cleanWord = word.trim().toLowerCase();
	if (!cleanWord) return null;

	const sourceUrl = `https://www.dictionary.com/browse/${encodeURIComponent(cleanWord)}`;

	try {
		const response = await requestUrl({
			url: sourceUrl,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(response.text, 'text/html');

		const headwordEl = doc.querySelector('h1') || doc.querySelector('[data-type="word-title"]');
		if (!headwordEl) return null;

		const posEl = doc.querySelector('.box-pos-label') || doc.querySelector('span.pos');
		const phoneticEl = doc.querySelector('.txt-phonetic') || doc.querySelector('.pron-spell-content');

		let audioUrl: string | undefined;
		const audioBtn = doc.querySelector('button.js-play-word-audio') as HTMLElement | null;
		if (audioBtn) {
			const origin = audioBtn.getAttribute('data-audioorigin') || 'https://audio.dictionary.com';
			const src = audioBtn.getAttribute('data-audiosrc');
			if (src) {
				audioUrl = src.startsWith('http') ? src : `${origin}/${src}`;
			}
		}

		const defItems = doc.querySelectorAll('.item-definition');
		const definitions: DictDefinition[] = [];

		defItems.forEach((item) => {
			const pDef = item.querySelector('p.txt-variant-label-short') || item.querySelector('p');
			if (!pDef) return;
			const defText = pDef.textContent?.trim().replace(/:$/, '') || '';
			if (!defText) return;

			const examples: string[] = [];
			const exEls = item.querySelectorAll('.txt-example');
			exEls.forEach((ex) => {
				const t = ex.textContent?.trim();
				if (t) examples.push(t);
			});

			definitions.push({
				definition: defText,
				examples: examples.slice(0, 3)
			});
		});

		if (definitions.length === 0) return null;

		const entries: DictEntry[] = [
			{
				word: headwordEl.textContent?.trim() || cleanWord,
				pos: posEl?.textContent?.trim() || '',
				usIpa: phoneticEl?.textContent?.trim(),
				usAudioUrl: audioUrl,
				definitions: definitions.slice(0, 5)
			}
		];

		return {
			query: cleanWord,
			provider: 'Dictionary.com',
			providerKey: 'dictionary-com',
			entries,
			sourceUrl
		};
	} catch (error) {
		console.error('[Dict] Dictionary.com fetch error:', error);
		return null;
	}
}
