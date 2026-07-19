import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

function isWebRuntime() {
  return Platform.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');
}

function copyOnWebSync(text: string): boolean {
  if (typeof document === 'undefined') return false;

  let copied = false;
  const onCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/plain', text);
    event.preventDefault();
    copied = true;
  };

  document.addEventListener('copy', onCopy);
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.removeEventListener('copy', onCopy);
  }

  if (copied) return true;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const savedRanges: Range[] = [];
  if (selection) {
    for (let i = 0; i < selection.rangeCount; i += 1) {
      savedRanges.push(selection.getRangeAt(i));
    }
  }

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);

  if (selection) {
    selection.removeAllRanges();
    savedRanges.forEach((range) => selection.addRange(range));
  }

  return copied;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (isWebRuntime()) {
    return copyOnWebSync(text);
  }

  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
