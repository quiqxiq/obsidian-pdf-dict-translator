import { requestUrl } from 'obsidian';

export type TranslationProvider = 'cambridge-id' | 'mymemory' | 'deepl';

export interface TranslationSense {
	pos?: string;
	indonesianMeaning: string;
	englishDef?: string;
	example?: string;
}

export interface TranslationResult {
	query: string;
	translatedText: string;
	sourceLang: string;
	targetLang: string;
	provider: string;
	providerKey: TranslationProvider;
	senses?: TranslationSense[];
}

export async function translateText(
	text: string,
	provider: TranslationProvider = 'cambridge-id',
	targetLang: string = 'id',
	sourceLang: string = 'en',
	deeplApiKey: string = ''
): Promise<TranslationResult | null> {
	switch (provider) {
		case 'cambridge-id':
			return translateWithCambridge(text, targetLang, sourceLang);
		case 'deepl':
			return translateWithDeepL(text, targetLang, sourceLang, deeplApiKey);
		case 'mymemory':
		default:
			return translateWithMyMemory(text, targetLang, sourceLang);
	}
}

// --------------------------------------------------------------------------
// 1. Cambridge English–Indonesian Dictionary / Translate
// --------------------------------------------------------------------------
export async function translateWithCambridge(
	text: string,
	targetLang: string = 'id',
	sourceLang: string = 'en'
): Promise<TranslationResult | null> {
	const cleanText = text.trim();
	if (!cleanText) return null;

	// If it's a single word or short phrase, query Cambridge English-Indonesian
	const isShort = cleanText.split(/\s+/).length <= 3;
	if (isShort && targetLang === 'id') {
		const sourceUrl = `https://dictionary.cambridge.org/dictionary/english-indonesian/${encodeURIComponent(cleanText.toLowerCase())}`;
		try {
			const res = await requestUrl({
				url: sourceUrl,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
				}
			});

			const parser = new DOMParser();
			const doc = parser.parseFromString(res.text, 'text/html');

			const transEls = doc.querySelectorAll('.trans.dtrans[lang="id"], .trans.dtrans');
			if (transEls.length > 0) {
				const senses: TranslationSense[] = [];
				const meaningsSet = new Set<string>();

				// Extract sense blocks
				const senseBlocks = doc.querySelectorAll('.sense-block');
				senseBlocks.forEach((sb) => {
					const transSpan = sb.querySelector('.trans.dtrans');
					const defSpan = sb.querySelector('.def.ddef_d');
					const exSpan = sb.querySelector('.examp.dexamp .eg');
					const posSpan = doc.querySelector('.posgram .pos') || doc.querySelector('.pos.dpos');

					const trans = transSpan?.textContent?.trim();
					if (trans && !meaningsSet.has(trans)) {
						meaningsSet.add(trans);
						senses.push({
							pos: posSpan?.textContent?.trim(),
							indonesianMeaning: trans,
							englishDef: defSpan?.textContent?.trim().replace(/:$/, ''),
							example: exSpan?.textContent?.trim()
						});
					}
				});

				// Primary translation string
				const primaryList = Array.from(meaningsSet);
				const primaryTranslation = primaryList.slice(0, 3).join(', ');

				return {
					query: cleanText,
					translatedText: primaryTranslation,
					sourceLang,
					targetLang,
					provider: 'Cambridge English–Indonesian',
					providerKey: 'cambridge-id',
					senses: senses.slice(0, 5)
				};
			}
		} catch (err) {
			console.log('[Translator] Cambridge bilingual fallback triggered:', err);
		}
	}

	// For sentences or when not found in Cambridge, fallback to MyMemory
	const fallback = await translateWithMyMemory(cleanText, targetLang, sourceLang);
	if (fallback) {
		return {
			...fallback,
			provider: 'Cambridge (Fallback: Web Translator)',
			providerKey: 'cambridge-id'
		};
	}
	return null;
}

// --------------------------------------------------------------------------
// 2. Web Translator (MyMemory API - Fast, High Reliability)
// --------------------------------------------------------------------------
export async function translateWithMyMemory(
	text: string,
	targetLang: string = 'id',
	sourceLang: string = 'en'
): Promise<TranslationResult | null> {
	const cleanText = text.trim();
	if (!cleanText) return null;

	const langPair = `${sourceLang}|${targetLang}`;
	const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${langPair}`;

	try {
		const res = await requestUrl({
			url: apiUrl,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			}
		});

		const data = res.json;
		if (data?.responseData?.translatedText) {
			return {
				query: cleanText,
				translatedText: data.responseData.translatedText,
				sourceLang,
				targetLang,
				provider: 'Web Translator (MyMemory)',
				providerKey: 'mymemory'
			};
		}
		return null;
	} catch (error) {
		console.error('[Translator] MyMemory error:', error);
		return null;
	}
}

// --------------------------------------------------------------------------
// 3. DeepL API (Free / Pro)
// --------------------------------------------------------------------------
export async function translateWithDeepL(
	text: string,
	targetLang: string = 'id',
	_sourceLang: string = 'en',
	apiKey: string = ''
): Promise<TranslationResult | null> {
	const cleanText = text.trim();
	if (!cleanText) return null;

	if (!apiKey) {
		// Fallback to MyMemory if key missing
		return translateWithMyMemory(text, targetLang, _sourceLang);
	}

	const isFree = apiKey.endsWith(':fx');
	const endpoint = isFree
		? 'https://api-free.deepl.com/v2/translate'
		: 'https://api.deepl.com/v2/translate';

	try {
		const res = await requestUrl({
			url: endpoint,
			method: 'POST',
			headers: {
				'Authorization': `DeepL-Auth-Key ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: [cleanText],
				target_lang: targetLang.toUpperCase()
			})
		});

		const data = res.json;
		if (data?.translations?.[0]?.text) {
			return {
				query: cleanText,
				translatedText: data.translations[0].text,
				sourceLang: data.translations[0].detected_source_language || 'EN',
				targetLang,
				provider: 'DeepL',
				providerKey: 'deepl'
			};
		}
		return null;
	} catch (error) {
		console.error('[Translator] DeepL error:', error);
		return translateWithMyMemory(text, targetLang, _sourceLang);
	}
}
