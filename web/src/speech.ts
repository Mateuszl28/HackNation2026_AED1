// Głosowe prowadzenie w trybie ratunkowym: natywna synteza mowy na Androidzie (WebView jej nie gwarantuje),
// Web Speech API w przeglądarce. Błędy są ciche — głos to dodatek, nie warunek działania.
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const VOICE_LANG: Record<string, string> = { pl: 'pl-PL', en: 'en-GB', uk: 'uk-UA' };

export function say(text: string, lang: string) {
  const l = VOICE_LANG[lang] || 'pl-PL';
  try {
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {}).finally(() => { TextToSpeech.speak({ text, lang: l, rate: 1.0, volume: 1.0, category: 'playback' }).catch(() => {}); });
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = l;
      window.speechSynthesis.speak(u);
    }
  } catch { /* brak syntezy mowy — działamy bez głosu */ }
}

export function stopSpeech() {
  try {
    if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => {});
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch { /* ignoruj */ }
}
