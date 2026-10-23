(function () {
  "use strict";

  var TO = "artist@zigflames.com";
  var SUBJECT = "Casting Inquiry";

  var form = document.getElementById("casting-form");
  if (!form) return;
  var errorBox = document.getElementById("cf-error");
  var statusBox = document.getElementById("cf-status");
  var fallback = document.getElementById("cf-mailto");

  function val(name) {
    var el = form.elements[name];
    return el && el.value ? el.value.trim() : "";
  }

  function handle(raw) {
    var h = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[\/?#].*$/, "").replace(/^@+/, "").trim();
    return h ? "@" + h : "";
  }

  function interests() {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="interests"]:checked'))
      .map(function (el) { return el.value; });
  }

  function buildBody() {
    var picked = interests();
    var lines = [
      "Casting Inquiry from zigflames.com/casting",
      "",
      "Name: " + val("name"),
      "Instagram: " + handle(val("instagram")),
      "Email: " + val("email"),
      "Phone: " + (val("phone") || "(not provided)"),
      "City: " + val("city"),
      "Interests: " + (picked.length ? picked.join(", ") : "(none selected)"),
      "Age: I confirm I am 21 or older.",
      "",
      "Photo links:",
      val("photos") || "(none)",
      "",
      "Message:",
      val("message") || "(none)"
    ];
    return lines.join("\r\n");
  }

  function buildMailto() {
    return "mailto:" + TO +
      "?subject=" + encodeURIComponent(SUBJECT) +
      "&body=" + encodeURIComponent(buildBody());
  }

  function fail(msg, el) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    if (el) {
      el.setAttribute("aria-invalid", "true");
      el.focus();
    }
    return false;
  }

  function validate() {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    errorBox.hidden = true;
    var checks = [
      ["name", "Please add your name."],
      ["instagram", "Please add your Instagram handle."],
      ["email", "Please add your email."],
      ["city", "Please add your city."]
    ];
    for (var i = 0; i < checks.length; i++) {
      var el = form.elements[checks[i][0]];
      if (!el.value.trim()) return fail(checks[i][1], el);
    }
    var email = form.elements.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      return fail("Please check your email address.", email);
    }
    var age = form.elements.age;
    if (!age.checked) return fail("Please confirm you are 21 or older.", age);
    return true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) return;
    var href = buildMailto();
    fallback.href = href;
    form.setAttribute("data-mailto", href);
    statusBox.hidden = false;
    window.location.href = href;
  });

  window.ZFCasting = { buildMailto: buildMailto, buildBody: buildBody };
})();
