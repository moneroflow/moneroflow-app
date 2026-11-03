/**
 * Universal clipboard copy utility.
 *
 * The Clipboard API (`navigator.clipboard.writeText`) only works in secure
 * contexts (HTTPS / localhost) and can silently fail in iframes, embedded
 * webviews, or when the page doesn't have focus. This utility provides a
 * reliable fallback using the textarea + execCommand technique.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Try modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API failed — fall through to fallback
    }
  }

  // 2. Fallback: create a temporary textarea and use execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Make it invisible but still functional
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    // Prevent iOS zoom
    textarea.style.fontSize = '16px';

    document.body.appendChild(textarea);

    // Select the text
    textarea.focus();
    textarea.select();

    // For iOS
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, text.length);
    }

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    return success;
  } catch {
    return false;
  }
}
