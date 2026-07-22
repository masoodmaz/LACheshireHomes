document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initCarousels();
  initVideoLightbox();
  initReveal();
  initCountUp();
  initHeroParallax();
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach(el => el.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach(el => observer.observe(el));
}

function initHeroParallax() {
  const hero = document.querySelector(".hero");
  if (!hero || prefersReducedMotion) return;

  const art = hero.querySelector(".hero-art");
  const postcodes = hero.querySelector(".hero-postcodes");
  const inner = hero.querySelector(".hero-inner");
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY;
    if (y > hero.offsetHeight) return;
    if (art) art.style.transform = `translateY(${y * 0.22}px)`;
    if (postcodes) postcodes.style.setProperty("--py", `${y * 0.38}px`);
    if (inner) {
      inner.style.transform = `translateY(${y * 0.12}px)`;
      inner.style.opacity = String(Math.max(0, 1 - y / (hero.offsetHeight * 0.9)));
    }
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
}

function initCountUp() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  const finish = el => { el.textContent = `${el.dataset.count}+`; };

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    counters.forEach(finish);
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count) || 0;
      const start = performance.now();
      (function tick(now) {
        const progress = Math.min(1, (now - start) / 1100);
        el.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}+`;
        if (progress < 1) requestAnimationFrame(tick);
      })(start);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initCarousels() {
  document.querySelectorAll("[data-carousel]").forEach(carousel => {
    const track = carousel.querySelector(".carousel-track");
    const slides = carousel.querySelectorAll(".carousel-slide");
    const prevBtn = carousel.querySelector("[data-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-carousel-next]");
    const dots = carousel.querySelectorAll("[data-carousel-dot]");
    if (!track || slides.length <= 1) return;

    let index = 0;

    function render() {
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
    }

    function goTo(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      render();
    }

    prevBtn?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      goTo(index - 1);
    });
    nextBtn?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      goTo(index + 1);
    });
    dots.forEach((dot, i) => {
      dot.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        goTo(i);
      });
    });

    const auto = Number(carousel.dataset.carouselAuto);
    if (auto && !prefersReducedMotion) {
      let timer = setInterval(() => goTo(index + 1), auto);
      carousel.addEventListener("mouseenter", () => clearInterval(timer));
      carousel.addEventListener("mouseleave", () => {
        timer = setInterval(() => goTo(index + 1), auto);
      });
    }
  });
}

function initVideoLightbox() {
  const lightbox = document.getElementById("videoLightbox");
  const frame = document.getElementById("videoLightboxFrame");
  const closeBtn = document.getElementById("videoLightboxClose");
  if (!lightbox || !frame || !closeBtn) return;

  function openWithEmbed(embedUrl) {
    frame.innerHTML = `<iframe src="${embedUrl}" title="Project video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    lightbox.classList.add("open");
  }

  function close() {
    lightbox.classList.remove("open");
    frame.innerHTML = "";
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-video-embed], [data-video-url]");
    if (!trigger) return;
    event.preventDefault();

    const embedUrl = trigger.dataset.videoEmbed;
    const rawUrl = trigger.dataset.videoUrl;

    if (embedUrl) {
      openWithEmbed(embedUrl);
    } else if (rawUrl) {
      window.open(rawUrl, "_blank", "noopener,noreferrer");
    }
  });

  closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && lightbox.classList.contains("open")) close();
  });
}
