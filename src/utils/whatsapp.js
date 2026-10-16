// WhatsApp click-to-chat links (https://wa.me/<number>?text=...). The number
// must be in international form with digits only. Most saved numbers are
// Sudanese and written locally (0912345678 or 912345678), so those get the
// 249 country code.
const SUDAN_CODE = '249';

export function whatsappNumber(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = SUDAN_CODE + digits.slice(1);
    else if (digits.length === 9) digits = SUDAN_CODE + digits;
    if (digits.length < 10 || digits.length > 15) return null;
    return digits;
}

export function whatsappLink(phone, text) {
    const number = whatsappNumber(phone);
    if (!number) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent(text || '')}`;
}
