/**
 * 浏览器中文语音播报。Chrome 等需要先加载 voices，且 cancel 后立刻 speak 可能无声。
 */

function pickZhVoice(synth) {
  const voices = synth.getVoices?.() || [];
  return (
    voices.find((v) => v.lang && /^zh(?:[-_])/i.test(v.lang)) ||
    voices.find((v) => /Chinese|普通话|简体中文/i.test(v.name || '')) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith('zh')) ||
    null
  );
}

/**
 * @param {string} text
 * @param {{ enabled?: boolean, afterCancelMs?: number, skipCancel?: boolean }} [opts]
 */
export function speakScenario(text, opts = {}) {
  if (opts.enabled === false) return;
  if (typeof window === 'undefined' || !text) return;

  const synth = window.speechSynthesis;
  if (!synth) return;

  const speakUtterance = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.volume = 1;
    u.rate = 0.92;
    u.pitch = 1;
    const voice = pickZhVoice(synth);
    if (voice) u.voice = voice;
    synth.resume?.();
    synth.speak(u);
    window.setTimeout(() => {
      if (synth.paused) synth.resume?.();
    }, 50);
  };

  const run = () => {
    try {
      if (opts.skipCancel) {
        speakUtterance();
        return;
      }
      synth.cancel();
      const delay = opts.afterCancelMs ?? 0;
      if (delay > 0) {
        window.setTimeout(speakUtterance, delay);
      } else {
        synth.resume?.();
        speakUtterance();
      }
    } catch {
      /* ignore */
    }
  };

  try {
    if (synth.getVoices?.().length) {
      run();
      return;
    }
    const onVoices = () => {
      synth.removeEventListener?.('voiceschanged', onVoices);
      run();
    };
    synth.addEventListener?.('voiceschanged', onVoices);
    window.setTimeout(() => {
      synth.removeEventListener?.('voiceschanged', onVoices);
      run();
    }, 600);
  } catch {
    run();
  }
}
