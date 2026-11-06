import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/**
 * Scroll-driven entrance for the landing page. Mark elements with:
 *   data-reveal            fade and rise once when scrolled into view
 *   data-stagger           its children rise one after another
 *   data-draw              an SVG path that draws itself as it scrolls into view
 *   data-count="12"        a number that counts up to 12
 * Nothing moves when the visitor prefers reduced motion; content is simply there.
 */
export function useLandingMotion(scope) {
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 28,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        });
        gsap.utils.toArray('[data-stagger]').forEach((group) => {
          gsap.from(group.children, {
            opacity: 0,
            y: 22,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: group, start: 'top 88%', once: true },
          });
        });
        gsap.utils.toArray('[data-draw]').forEach((path) => {
          const len = Number(path.getAttribute('pathLength')) || path.getTotalLength();
          gsap.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: path, start: 'top 85%', once: true } },
          );
        });
        gsap.utils.toArray('[data-count]').forEach((el) => {
          const to = Number(el.dataset.count);
          const state = { v: 0 };
          gsap.to(state, {
            v: to,
            duration: 1.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            onUpdate: () => {
              el.textContent = String(Math.round(state.v));
            },
          });
        });
      });
    }, scope);
    return () => {
      ctx.revert();
      mm.revert();
    };
  }, [scope]);
}

/** Hero entrance: the copy rises in, then the product board. */
export function heroIntro(root) {
  if (!root) return () => {};
  const mm = gsap.matchMedia();
  mm.add(MOTION_OK, () => {
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(q('[data-hero-fade]'), { opacity: 0, y: 18, duration: 0.75, stagger: 0.08 }).from(
      q('[data-hero-board]'),
      { opacity: 0, y: 36, duration: 1 },
      0.2,
    );
  });
  return () => mm.revert();
}

/**
 * The hero board loop: Rahul's cursor picks up Arjun's card in "With the manager", drops it in "With the HOD",
 * the chip and the activity line change, then everything quietly resets. Markup it expects inside `root`:
 *   [data-cursor]             the cursor with its name tag (absolutely placed at the board's top-left)
 *   [data-move-card]          the card that moves
 *   [data-move-slot]          an invisible placeholder where it lands
 *   [data-move-below]         cards under the moving one, which close the gap
 *   [data-chip-a|b]           the card's status before and after
 *   [data-line-a|b]           the activity line before and after
 *   [data-col-count="from|to"] column counters
 * It only runs without reduced motion, pauses when the board is off-screen, and re-measures on resize.
 */
export function heroBoardLoop(root) {
  if (!root) return () => {};
  const mm = gsap.matchMedia();
  mm.add(MOTION_OK, () => {
    const q = gsap.utils.selector(root);
    const card = q('[data-move-card]')[0];
    const slot = q('[data-move-slot]')[0];
    const cursor = q('[data-cursor]')[0];
    if (!card || !slot || !cursor) return undefined;
    const below = q('[data-move-below]');
    const chipA = q('[data-chip-a]');
    const chipB = q('[data-chip-b]');
    const lineA = q('[data-line-a]');
    const lineB = q('[data-line-b]');
    const countFrom = q('[data-col-count="from"]')[0];
    const countTo = q('[data-col-count="to"]')[0];
    const counts = (from, to) => () => {
      if (countFrom) countFrom.textContent = String(from);
      if (countTo) countTo.textContent = String(to);
    };
    const all = [card, cursor, ...below, ...chipA, ...chipB, ...lineA, ...lineB];
    let tl = null;
    let onScreen = true;

    const build = () => {
      tl?.kill();
      gsap.set(all, { clearProps: 'all' });
      const box = root.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const s = slot.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(card.parentElement).rowGap) || 8;
      const dx = s.left - c.left;
      const dy = s.top - c.top;
      const grabX = c.left - box.left + c.width * 0.62;
      const grabY = c.top - box.top + c.height * 0.42;
      const restX = box.width * 0.82;
      const restY = box.height * 0.86;

      tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true, defaults: { ease: 'power2.inOut' } });
      tl.set(cursor, { x: restX, y: restY, opacity: 0, scale: 1, transformOrigin: '0% 0%' })
        .set(card, { x: 0, y: 0, opacity: 1, scale: 1, zIndex: 2 })
        .set(below, { y: 0 })
        .set(chipA, { opacity: 1 })
        .set(chipB, { opacity: 0 })
        .set(lineA, { opacity: 1, y: 0 })
        .set(lineB, { opacity: 0, y: 6 })
        .call(counts(2, 1))
        .to(cursor, { opacity: 1, duration: 0.35, ease: 'none' }, 0.7)
        .to(cursor, { x: grabX, y: grabY, duration: 1.1 }, 0.7)
        .to(cursor, { scale: 0.86, duration: 0.14, ease: 'power1.out' })
        .to(card, { scale: 1.04, rotation: -1.5, boxShadow: '0 22px 40px -20px rgba(0,0,0,.75)', duration: 0.18, ease: 'power1.out' }, '<')
        .addLabel('drag')
        .to(card, { x: dx, y: dy, duration: 1.05 }, 'drag')
        .to(cursor, { x: grabX + dx, y: grabY + dy, duration: 1.05 }, 'drag')
        .to(below, { y: -(c.height + gap), duration: 0.55 }, 'drag+=0.4')
        .addLabel('drop')
        .to(cursor, { scale: 1, duration: 0.14 }, 'drop')
        .to(card, { scale: 1, rotation: 0, boxShadow: '0 1px 2px rgba(0,0,0,.05)', duration: 0.22 }, 'drop')
        .call(counts(1, 2), null, 'drop')
        .to(chipA, { opacity: 0, duration: 0.25, ease: 'none' }, 'drop+=0.1')
        .to(chipB, { opacity: 1, duration: 0.25, ease: 'none' }, 'drop+=0.1')
        .to(lineA, { opacity: 0, y: -6, duration: 0.3 }, 'drop+=0.25')
        .to(lineB, { opacity: 1, y: 0, duration: 0.35 }, 'drop+=0.35')
        .to(cursor, { x: restX, y: restY, opacity: 0, duration: 0.9 }, 'drop+=0.6')
        // Hold the result, then put the board back as it was.
        .to(card, { opacity: 0, duration: 0.35, ease: 'none' }, '+=2.6')
        .to(lineB, { opacity: 0, duration: 0.3, ease: 'none' }, '<')
        .set(card, { x: 0, y: 0 })
        .set(chipA, { opacity: 1 })
        .set(chipB, { opacity: 0 })
        .call(counts(2, 1))
        .to(below, { y: 0, duration: 0.45 })
        .to(card, { opacity: 1, duration: 0.4, ease: 'none' })
        .to(lineA, { opacity: 1, y: 0, duration: 0.3 }, '<');
      if (onScreen) tl.play();
    };

    build();
    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        onScreen = self.isActive;
        if (onScreen) tl?.play();
        else tl?.pause();
      },
    });
    onScreen = st.isActive;
    if (!onScreen) tl?.pause();

    let timer = 0;
    let lastWidth = root.clientWidth;
    const ro = new ResizeObserver(() => {
      if (root.clientWidth === lastWidth) return;
      lastWidth = root.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(build, 180);
    });
    ro.observe(root);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      st.kill();
      tl?.kill();
      gsap.set(all, { clearProps: 'all' });
      counts(2, 1)();
    };
  });
  return () => mm.revert();
}
