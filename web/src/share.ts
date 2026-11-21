// Udostępnianie: natywny arkusz Androida (SMS, WhatsApp, Messenger…) w aplikacji,
// Web Share API w przeglądarce, a gdy brak obu — kopiowanie do schowka.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type ShareResult = 'shared' | 'copied' | 'cancelled';

export async function shareText(o: { title: string; text: string; url?: string }): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: o.title, text: o.text, url: o.url, dialogTitle: o.title });
      return 'shared';
    }
    if (navigator.share) { await navigator.share(o); return 'shared'; }
    await navigator.clipboard.writeText(o.url ? `${o.text}\n${o.url}` : o.text);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
