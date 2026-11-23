import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './BrandIntro.css';

const INTRO_SEEN = 'togro.brand-intro.seen';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const INTRO_DURATION_MS = 1800;

export function useBrandIntro() {
  const [showIntro, setShowIntro] = useState(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return false;
    try {
      return sessionStorage.getItem(INTRO_SEEN) !== '1';
    } catch {
      return true;
    }
  });

  const dismissIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN, '1');
    } catch {
      // Continue when the browser has disabled session storage.
    }
    setShowIntro(false);
  }, []);

  return { showIntro, dismissIntro };
}

export function BrandIntro({ onDismiss }: { onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const motionPreference = window.matchMedia(REDUCED_MOTION);
    const onMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) onDismiss();
    };
    motionPreference.addEventListener('change', onMotionChange);
    const timer = window.setTimeout(onDismiss, INTRO_DURATION_MS + 100);

    return () => {
      window.clearTimeout(timer);
      motionPreference.removeEventListener('change', onMotionChange);
      dialog?.close();
    };
  }, [onDismiss]);

  return (
    <dialog
      ref={dialogRef}
      className="tg-brand-intro"
      aria-label="TO-GRO 인트로"
      onClick={onDismiss}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      style={{ '--tg-intro-duration': `${INTRO_DURATION_MS}ms` } as CSSProperties}
    >
      <div className="tg-intro-wordmark" aria-hidden="true">
        <span className="tg-intro-word tg-intro-together">
          <span className="tg-intro-kept">to</span>
          <span className="tg-intro-tail"><span>gether</span></span>
        </span>
        <span className="tg-intro-hyphen"><span>-</span></span>
        <span className="tg-intro-word tg-intro-grow">
          <span className="tg-intro-kept">gro</span>
          <span className="tg-intro-tail"><span>w</span></span>
        </span>
      </div>
      <button type="button" className="tg-intro-skip tg-btn-secondary">건너뛰기</button>
    </dialog>
  );
}
