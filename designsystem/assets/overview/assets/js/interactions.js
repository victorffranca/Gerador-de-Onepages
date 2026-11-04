(() => {
  // ds: the live GitHub REST calls (stars, latest release, contributors) are off in the design
  // system: the page keeps the static values already rendered in its markup, so it never depends
  // on api.github.com and the contributor wire keeps its Lorem copy.
  const LIVE_GITHUB = false;

  const formatStars = (count) => {
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count < 1000) return String(count);
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  };

  // Pull a clean 'v0.3.0'-style label from a GitHub release record.
  // We prefer release.name (e.g. 'Open Design 0.3.0') because that's
  // what we hand-author; fall back to tag_name (e.g.
  // 'open-design-v0.3.0') with the project prefix stripped.
  //
  // Expected input shapes (release.name / release.tag_name):
  //   { name: 'Open Design 0.3.0',  tag_name: 'v0.3.0' }            → 'v0.3.0'
  //   { name: 'Open Design v0.3.0', tag_name: 'open-design-v0.3.0' } → 'v0.3.0'
  //   { name: '0.3.0-beta.1',       tag_name: 'open-design_0.3.0' }  → 'v0.3.0-beta.1' (name wins)
  //   { name: null,                 tag_name: 'open-design-v0.3.0' } → 'v0.3.0' (tag fallback)
  //   { name: null,                 tag_name: null }                  → null (caller skips)
  const formatVersion = (release) => {
    const fromTag = (tag) => {
      if (typeof tag !== 'string') return null;
      const cleaned = tag.replace(/^open-design[-_]?v?/i, '').trim();
      return cleaned ? `v${cleaned.replace(/^v/, '')}` : null;
    };
    const fromName = (name) => {
      if (typeof name !== 'string') return null;
      const m = name.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
      return m ? `v${m[1]}` : null;
    };
    return fromName(release?.name) ?? fromTag(release?.tag_name) ?? null;
  };

  const enhanceHeader = () => {
    const chrome = document.querySelector('[data-chrome-headroom]');
    if (chrome) {
      let lastY = window.scrollY;
      const showTopThreshold = 100;
      const scrollDelta = 6;
      window.addEventListener(
        'scroll',
        () => {
          const y = window.scrollY;
          const delta = y - lastY;
          if (y <= showTopThreshold) chrome.classList.remove('is-hidden');
          else if (delta > scrollDelta) chrome.classList.add('is-hidden');
          else if (delta < -scrollDelta) chrome.classList.remove('is-hidden');
          lastY = y;
        },
        { passive: true },
      );
    }

    const stars = document.querySelector('[data-github-stars]');
    if (stars && LIVE_GITHUB) {
      fetch('https://api.github.com/repos/nexu-io/open-design', {
        headers: { Accept: 'application/vnd.github+json' },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http error'))))
        .then((data) => {
          if (typeof data?.stargazers_count === 'number') {
            stars.textContent = formatStars(data.stargazers_count);
          }
        })
        .catch(() => {});
    }

    // Latest stable release powers every "v0.x.y" badge on the page
    // (topbar pulse, hero CTA-foot, footer download). Hits one
    // unauthenticated API call per page view; the static fallback in
    // each slot keeps the layout sane if the request fails or 403s.
    const versionSlots = document.querySelectorAll('[data-github-version]');
    if (versionSlots.length === 0 || !LIVE_GITHUB) return;
    fetch('https://api.github.com/repos/nexu-io/open-design/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http error'))))
      .then((data) => {
        const label = formatVersion(data);
        if (!label) return;
        for (const slot of versionSlots) slot.textContent = label;
      })
      .catch(() => {});
  };

  const enhanceWire = () => {
    const track = document.querySelector('[data-wire-contributors-track]');
    const count = document.querySelector('[data-wire-contributors-count]');
    if (!track || !LIVE_GITHUB) return;

    const roleOverrides = {
      tw93: 'kami',
      op7418: 'guizang',
      alchaincyf: 'huashu',
      OpenCoworkAI: 'codesign',
      'nexu-io': 'studio',
      lewislulu: 'html-ppt',
    };
    const roleFor = (login, contributions) =>
      roleOverrides[login] ?? `${contributions} ${contributions === 1 ? 'commit' : 'commits'}`;
    const isContributor = (value) =>
      value &&
      typeof value.login === 'string' &&
      typeof value.html_url === 'string' &&
      typeof value.type === 'string' &&
      typeof value.contributions === 'number';
    const renderContributor = (contributor, index) => {
      const link = document.createElement('a');
      link.className = 'wire-item is-link';
      link.href = contributor.href;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.setAttribute('aria-label', `Open ${contributor.handle} on GitHub`);
      link.dataset.liveWireItem = String(index);

      const dot = document.createElement('span');
      dot.className = 'wire-dot';
      dot.textContent = '·';
      const handle = document.createElement('span');
      handle.className = 'wire-handle';
      handle.textContent = `@${contributor.handle}`;
      const role = document.createElement('span');
      role.className = 'wire-role';
      role.textContent = contributor.role;

      link.append(dot, handle, role);
      return link;
    };

    fetch('https://api.github.com/repos/nexu-io/open-design/contributors?per_page=12', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http error'))))
      .then((data) => {
        if (!Array.isArray(data)) return;
        const live = data
          .filter(isContributor)
          .filter((c) => c.type !== 'Bot' && !c.login.endsWith('[bot]'))
          .slice(0, 12)
          .map((c) => ({
            handle: c.login,
            role: roleFor(c.login, c.contributions),
            href: c.html_url,
          }));
        if (live.length === 0) return;
        live.push({
          handle: 'you',
          role: 'be next',
          href: 'https://github.com/nexu-io/open-design/graphs/contributors',
        });
        if (count) count.textContent = String(Math.max(0, live.length - 1));
        track.replaceChildren(
          ...[...live, ...live].map((contributor, index) => renderContributor(contributor, index)),
        );
      })
      .catch(() => {});
  };

  const elements = document.querySelectorAll('[data-reveal]:not([data-revealed])');
  enhanceHeader();
  enhanceWire();
  if (elements.length === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    for (const el of elements) el.dataset.revealed = 'true';
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.revealed = 'true';
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  for (const el of elements) observer.observe(el);
})();
