(function () {
  "use strict";

  var AGE_KEY = "zf_magazine_21";

  /*
   * Add a new issue by appending an object to ISSUES.
   * Fields: id, number, title, cover, coverJpg, video,
   *         model { name, credit }, story { title, paragraphs[] },
   *         looks[] { id, title, caption, photo, photoJpg, video, gradient }.
   * Leave video / photo as "" until the file is ready. Looks without a photo
   * use the CSS gradient placeholder. The card gets data-video automatically.
   */
  var ISSUES = [
    {
      id: "issue-01",
      number: "Issue 01",
      title: "The Indulgence Issue",
      cover: "/assets/magazine/issue-01-indulgence.webp",
      coverJpg: "/assets/magazine/issue-01-indulgence.jpg",
      video: "",
      model: {
        name: "Vesper Roux",
        credit: "A fictional, AI-assisted character, 21+."
      },
      story: {
        title: "Hold the Match",
        paragraphs: [
          "The club was already a rumor by the time she arrived. Red light spilled down the stairs like a secret left on the floor, and Vesper Roux stood in it as if it had been mixed for her mouth. The Indulgence Issue did not start with a pose. It started with a pause: the kind you take when the night is still deciding whether to be kind.",
          "She did not smile for the camera. She let the lipstick do the talking — a precise, dangerous red, the color of a last-call cherry and a first-class lie. In her fingers, a single wooden match waited, unstruck, tilted toward the ceiling like a question she was not ready to answer. The photographer asked for heat. Vesper offered patience. The match stayed unlit, and somehow that was hotter.",
          "Outside, the city kept its usual promises: taxis, perfume, a bassline leaking from a door that would not stay closed. Inside the frame, she turned her face a fraction, closed her mouth, and the match became a rumor of fire — not a blaze, just the idea of one. What people would later swear they smelled on the page was not sulfur. It was anticipation.",
          "That is the mood of this issue. Not the morning after. The minute before. A woman in no hurry, and a flame that has not been asked to work yet. Strike it when you are ready. Until then, let the red do what red does. Linger."
        ]
      },
      looks: [
        {
          id: "after-hours-red",
          title: "After Hours Red",
          caption: "Crimson lacquer and a neckline that arrives late on purpose. Built for the hour when the room finally leans in.",
          photo: "",
          photoJpg: "",
          video: "",
          gradient: "linear-gradient(160deg, #140206 0%, #6b0d16 38%, #c41e3a 68%, #f4b183 100%)"
        },
        {
          id: "penthouse-silk",
          title: "Penthouse Silk",
          caption: "Quiet fabric, champagne light, thirty floors above the noise. Soft until it isn't.",
          photo: "",
          photoJpg: "",
          video: "",
          gradient: "linear-gradient(165deg, #1a1220 0%, #4a3358 36%, #c4a484 68%, #f3e6d4 100%)"
        },
        {
          id: "lit-matchbook-leather",
          title: "Lit Matchbook Leather",
          caption: "Black leather that still remembers the spark. Worn like a secret you can hear.",
          photo: "",
          photoJpg: "",
          video: "",
          gradient: "linear-gradient(155deg, #0a0a0c 0%, #2a1a12 40%, #e24a00 72%, #ffd23a 100%)"
        }
      ]
    }
  ];

  var root = document.documentElement;
  var gate = document.getElementById("age-gate");
  var enterBtn = document.getElementById("age-enter");
  var leaveBtn = document.getElementById("age-leave");
  var content = document.getElementById("magazine-content");
  var heroMount = document.getElementById("issue-hero");
  var creditMount = document.getElementById("cover-credit");
  var storySection = document.getElementById("cover-story");
  var storyTitle = document.getElementById("story-title");
  var storyBody = document.getElementById("story-body");
  var fashionSection = document.getElementById("fashion");
  var lookGrid = document.getElementById("look-grid");
  var gridMount = document.getElementById("issue-grid");
  var moreSection = document.getElementById("issues");
  var modal = document.getElementById("issue-modal");
  var modalTitle = document.getElementById("modal-title");
  var modalVideo = document.getElementById("modal-video");
  var modalStill = document.getElementById("modal-still");
  var modalPlaceholder = document.getElementById("modal-placeholder");
  var modalCredit = document.getElementById("modal-credit");
  var videoSoon = document.getElementById("video-soon");
  var closeBtn = document.getElementById("modal-close");
  var lastFocus = null;

  function isUnlocked() {
    try {
      return localStorage.getItem(AGE_KEY) === "1";
    } catch (e) {
      return root.classList.contains("magazine-unlocked");
    }
  }

  function setLockedState(unlocked) {
    root.classList.toggle("magazine-unlocked", unlocked);
    if (content) content.inert = !unlocked;
    if (gate) {
      gate.setAttribute("aria-hidden", unlocked ? "true" : "false");
    }
    if (!unlocked && enterBtn) enterBtn.focus();
  }

  function unlock() {
    try {
      localStorage.setItem(AGE_KEY, "1");
    } catch (e) {}
    setLockedState(true);
  }

  function stillSrc(item) {
    return item.coverJpg || item.cover || item.photoJpg || item.photo || "";
  }

  function buildPicture(item, featured) {
    var src = stillSrc(item);
    var picture = document.createElement("picture");
    var webp = item.cover || item.photo;
    var jpg = item.coverJpg || item.photoJpg;
    if (webp && jpg && webp !== jpg) {
      var source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = webp;
      picture.appendChild(source);
    }
    var img = document.createElement("img");
    img.src = src;
    img.width = 900;
    img.height = 1200;
    img.alt = item.title;
    img.draggable = false;
    img.decoding = "async";
    if (featured) img.setAttribute("fetchpriority", "high");
    picture.appendChild(img);
    return picture;
  }

  function buildCard(issue, featured) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "issue-card" + (featured ? " issue-card-featured" : "");
    btn.setAttribute("data-issue", issue.id);
    btn.setAttribute("data-video", issue.video || "");
    btn.setAttribute(
      "aria-label",
      issue.number + ": " + issue.title + ". " + (issue.video ? "Play video" : "Open. Video coming soon")
    );

    var media = document.createElement("div");
    media.className = "issue-card-media media-protect";
    media.appendChild(buildPicture(issue, featured));

    var hint = document.createElement("span");
    hint.className = "play-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = issue.video ? "Play" : "Watch";
    media.appendChild(hint);

    var meta = document.createElement("div");
    meta.className = "issue-card-meta";
    var strong = document.createElement("strong");
    strong.textContent = issue.title;
    var span = document.createElement("span");
    span.textContent = issue.number;
    meta.appendChild(strong);
    meta.appendChild(span);

    btn.appendChild(media);
    btn.appendChild(meta);
    btn.addEventListener("click", function () {
      openMedia(issue, "issue");
    });
    return btn;
  }

  function buildLookCard(look, issue) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "look-card";
    btn.setAttribute("data-look", look.id);
    btn.setAttribute("data-video", look.video || "");
    btn.setAttribute(
      "aria-label",
      look.title + ". " + (look.video ? "Play video" : stillSrc(look) ? "Open. Video coming soon" : "Open. Photo coming soon")
    );

    var media = document.createElement("div");
    media.className = "look-card-media media-protect";
    if (stillSrc(look)) {
      media.appendChild(buildPicture(look, false));
    } else {
      var ph = document.createElement("div");
      ph.className = "look-placeholder";
      ph.style.background = look.gradient || "linear-gradient(160deg, #140206, #c41e3a)";
      ph.setAttribute("aria-hidden", "true");
      media.appendChild(ph);
    }

    var hint = document.createElement("span");
    hint.className = "play-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = look.video ? "Play" : "View";
    media.appendChild(hint);

    var body = document.createElement("div");
    body.className = "look-card-body";
    var strong = document.createElement("strong");
    strong.textContent = look.title;
    var cap = document.createElement("p");
    cap.textContent = look.caption || "";
    body.appendChild(strong);
    body.appendChild(cap);

    btn.appendChild(media);
    btn.appendChild(body);
    btn.addEventListener("click", function () {
      openMedia(look, "look", issue);
    });
    return btn;
  }

  function renderCredit(issue) {
    if (!creditMount) return;
    creditMount.innerHTML = "";
    if (!issue || !issue.model || !issue.model.name) {
      creditMount.hidden = true;
      return;
    }
    var name = document.createElement("strong");
    name.textContent = issue.model.name;
    var note = document.createElement("span");
    note.textContent = issue.model.credit || "A fictional, AI-assisted character, 21+.";
    creditMount.appendChild(name);
    creditMount.appendChild(note);
    creditMount.hidden = false;
  }

  function renderStory(issue) {
    if (!storySection || !storyBody || !storyTitle) return;
    storyBody.innerHTML = "";
    if (!issue || !issue.story || !issue.story.paragraphs || !issue.story.paragraphs.length) {
      storySection.hidden = true;
      return;
    }
    storyTitle.textContent = issue.story.title || "Cover story";
    issue.story.paragraphs.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      storyBody.appendChild(p);
    });
    storySection.hidden = false;
  }

  function renderLooks(issue) {
    if (!fashionSection || !lookGrid) return;
    lookGrid.innerHTML = "";
    if (!issue || !issue.looks || !issue.looks.length) {
      fashionSection.hidden = true;
      return;
    }
    issue.looks.forEach(function (look) {
      lookGrid.appendChild(buildLookCard(look, issue));
    });
    fashionSection.hidden = false;
  }

  function renderIssues() {
    if (!heroMount) return;
    heroMount.innerHTML = "";
    if (gridMount) gridMount.innerHTML = "";
    if (!ISSUES.length) return;

    var featured = ISSUES[0];
    heroMount.appendChild(buildCard(featured, true));
    renderCredit(featured);
    renderStory(featured);
    renderLooks(featured);

    if (ISSUES.length > 1 && gridMount && moreSection) {
      moreSection.hidden = false;
      ISSUES.slice(1).forEach(function (issue) {
        gridMount.appendChild(buildCard(issue, false));
      });
    } else if (moreSection) {
      moreSection.hidden = true;
    }
  }

  function hasVideo(item) {
    return !!(item && item.video);
  }

  function stopVideo() {
    if (!modalVideo) return;
    try {
      modalVideo.pause();
    } catch (e) {}
    modalVideo.removeAttribute("src");
    modalVideo.load();
    modalVideo.hidden = true;
  }

  function openMedia(item, kind, issue) {
    if (!modal) return;
    lastFocus = document.activeElement;
    var label = item.number ? item.number + " · " + item.title : item.title;
    modalTitle.textContent = label;

    var src = stillSrc(item);
    if (src) {
      modalStill.alt = label;
      modalStill.src = src;
      modalStill.hidden = false;
      if (modalPlaceholder) modalPlaceholder.hidden = true;
    } else {
      modalStill.removeAttribute("src");
      modalStill.hidden = true;
      if (modalPlaceholder) {
        modalPlaceholder.style.background = item.gradient || "#140206";
        modalPlaceholder.hidden = false;
      }
    }

    if (hasVideo(item)) {
      videoSoon.hidden = true;
      modalVideo.src = item.video;
      modalVideo.hidden = false;
      modalVideo.setAttribute("controlsList", "nodownload noplaybackrate noremoteplayback");
      try {
        modalVideo.play();
      } catch (e) {}
    } else {
      stopVideo();
      videoSoon.hidden = false;
    }

    if (modalCredit) {
      var model = (item.model && item.model.name) ? item.model : (issue && issue.model);
      if (kind === "issue" && model && model.name) {
        modalCredit.textContent = model.name + " — " + (model.credit || "A fictional, AI-assisted character, 21+.");
        modalCredit.hidden = false;
      } else {
        modalCredit.hidden = true;
      }
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    stopVideo();
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function protectMedia(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("img, video, .media-protect, .issue-card, .look-card, .issue-modal-media")) {
      e.preventDefault();
    }
  }

  function onKey(e) {
    if (e.key === "Escape") {
      if (modal && !modal.hidden) {
        e.preventDefault();
        closeModal();
      }
    }
  }

  document.addEventListener("contextmenu", protectMedia);
  document.addEventListener("dragstart", protectMedia);

  if (enterBtn) {
    enterBtn.addEventListener("click", function () {
      unlock();
    });
  }
  if (leaveBtn) {
    leaveBtn.addEventListener("click", function (e) {
      // Leave always returns to the homepage, even if already confirmed.
      e.preventDefault();
      window.location.href = "/";
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute("data-close")) {
        closeModal();
      }
    });
  }
  document.addEventListener("keydown", onKey);

  renderIssues();
  setLockedState(isUnlocked());

  window.ZFMagazine = {
    ISSUES: ISSUES,
    openIssue: function (issue) { openMedia(issue, "issue"); },
    openMedia: openMedia,
    closeModal: closeModal,
    unlock: unlock
  };
})();
