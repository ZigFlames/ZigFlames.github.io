/* Listen band ticker: pause while touched (iPad), resume shortly after. Hover/focus pause is CSS. */
(function () {
  "use strict";
  var t = document.querySelector("[data-ticker]");
  if (!t) return;
  var timer = null;
  function pause() { clearTimeout(timer); t.classList.add("is-paused"); }
  function resume(delay) { clearTimeout(timer); timer = setTimeout(function () { t.classList.remove("is-paused"); }, delay); }
  t.addEventListener("touchstart", pause, { passive: true });
  t.addEventListener("touchend", function () { resume(2500); }, { passive: true });
  t.addEventListener("touchcancel", function () { resume(2500); }, { passive: true });
  t.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") pause(); });
})();
