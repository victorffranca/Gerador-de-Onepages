(() => {
  const IMG_SELECTOR = 'img[data-precise-src]';
  const VIDEO_SELECTOR = 'video[data-precise-load]';
  const IMG_ROOT_MARGIN = '300px 0px';
  const VIDEO_ROOT_MARGIN = '600px 0px';

  const swapImage = (img) => {
    const src = img.dataset.preciseSrc;
    const srcset = img.dataset.preciseSrcset;
    if (srcset) {
      img.srcset = srcset;
      delete img.dataset.preciseSrcset;
    }
    if (src) {
      img.src = src;
      delete img.dataset.preciseSrc;
    }
  };

  const swapVideo = (video) => {
    const sources = video.querySelectorAll('source[data-precise-src]');
    for (const source of sources) {
      source.src = source.dataset.preciseSrc;
      delete source.dataset.preciseSrc;
    }
    delete video.dataset.preciseLoad;
    video.load();
    if (video.autoplay) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  const eagerFallback = () => {
    for (const img of document.querySelectorAll(IMG_SELECTOR)) swapImage(img);
    for (const v of document.querySelectorAll(VIDEO_SELECTOR)) swapVideo(v);
  };

  // Graceful degradation: no IntersectionObserver, or user prefers reduced
  // motion (we still load everything, just eagerly so they don't miss content).
  if (!('IntersectionObserver' in window)) {
    eagerFallback();
    return;
  }

  const imgObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        swapImage(entry.target);
        imgObserver.unobserve(entry.target);
      }
    },
    { rootMargin: IMG_ROOT_MARGIN },
  );

  const videoObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        swapVideo(entry.target);
        videoObserver.unobserve(entry.target);
      }
    },
    { rootMargin: VIDEO_ROOT_MARGIN },
  );

  const attach = (root) => {
    for (const img of root.querySelectorAll(IMG_SELECTOR)) imgObserver.observe(img);
    for (const v of root.querySelectorAll(VIDEO_SELECTOR)) videoObserver.observe(v);
  };

  attach(document);

  // Pick up nodes that arrive later (e.g. the contributor wire fetch).
  if ('MutationObserver' in window) {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(IMG_SELECTOR)) imgObserver.observe(node);
          else if (node.matches && node.matches(VIDEO_SELECTOR)) videoObserver.observe(node);
          else if (node.querySelectorAll) attach(node);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
