(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (!reduce && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    document.querySelectorAll(".section .reveal-on-scroll, .art-invite .reveal-on-scroll").forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal-on-scroll").forEach(function (el) {
      el.classList.add("in-view");
    });
  }

  var pieces = Array.prototype.slice.call(document.querySelectorAll(".piece"));
  var lightbox = document.querySelector(".lightbox");
  if (pieces.length && lightbox) {
    var lbImg = lightbox.querySelector("img");
    var lbCap = lightbox.querySelector("figcaption");
    var idx = 0;

    function show(i) {
      idx = (i + pieces.length) % pieces.length;
      var piece = pieces[idx];
      var src = piece.getAttribute("data-full");
      var cap = (piece.querySelector("figcaption") || {}).textContent || "";
      lbImg.src = src;
      lbImg.alt = cap;
      lbCap.textContent = cap;
      lightbox.hidden = false;
      document.body.classList.add("lightbox-open");
      lightbox.querySelector(".lightbox-close").focus();
    }

    function hide() {
      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      lbImg.removeAttribute("src");
    }

    pieces.forEach(function (piece, i) {
      var btn = piece.querySelector(".piece-open");
      if (!btn) return;
      btn.addEventListener("click", function () { show(i); });
    });

    lightbox.querySelector(".lightbox-close").addEventListener("click", hide);
    lightbox.querySelector(".lightbox-prev").addEventListener("click", function () { show(idx - 1); });
    lightbox.querySelector(".lightbox-next").addEventListener("click", function () { show(idx + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) hide();
    });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") hide();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }
})();
