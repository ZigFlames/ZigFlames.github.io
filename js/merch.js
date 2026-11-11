(function () {
  "use strict";

  var TO = "artist@zigflames.com";
  var SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

  /*
   * Drop product photos into assets/merch/ and list them on `images`:
   *   { webp: "/assets/merch/name.webp", jpg: "/assets/merch/name.jpg", alt: "..." }
   * Leave images: [] to show the CSS gradient placeholder.
   * Set buyUrl to a Stripe/Printful checkout link when you have one;
   * an empty buyUrl opens a prefilled email to artist@zigflames.com.
   * Price lives here so it is easy to change in one place.
   *
   * Source photos (not yet on the box when this page was drafted):
   *   Vinyl Roots — navy tee mockup (vinyl-tree art)
   *   Sneaker Crest — black tee mockup
   *   It's Over — black tee mockup
   *   Money Moves lookbook lifestyle photos for M1 and $ Ringer
   *   Zig Flame Studio Tee — alley lifestyle (blue) + patch logos (blue/orange)
   *   Blank black tee mockup was skipped on purpose.
   */
  var PRODUCTS = [
    {
      id: "money-moves-m1",
      name: "Money Moves M1 Tee",
      price: 35,
      colors: ["Black"],
      description: "The Money Moves M1 mark, built for the street and the studio.",
      gradient: "linear-gradient(160deg, #0a0a0c 0%, #1a1208 42%, #c9a84c 100%)",
      images: [],
      buyUrl: ""
    },
    {
      id: "money-moves-ringer",
      name: "Money Moves $ Ringer Tee",
      price: 35,
      colors: ["Black"],
      description: "Ringer cut with the Money Moves dollar mark. Lifestyle shots go in the gallery.",
      gradient: "linear-gradient(165deg, #100806 0%, #3a2010 45%, #e24a00 100%)",
      images: [],
      buyUrl: ""
    },
    {
      id: "zig-flame-studio",
      name: "Zig Flame Studio Tee",
      price: 35,
      colors: ["Blue", "Orange"],
      description: "The studio patch on a heavy tee. Pick blue or orange.",
      gradient: "linear-gradient(155deg, #061018 0%, #0b3a6a 48%, #e24a00 100%)",
      images: [],
      buyUrl: ""
    },
    {
      id: "sneaker-crest",
      name: "Sneaker Crest Tee",
      price: 35,
      colors: ["Black"],
      description: "Black tee with the sneaker crest graphic.",
      gradient: "linear-gradient(160deg, #0a0a0c 0%, #222 50%, #8a8a8a 100%)",
      images: [],
      buyUrl: ""
    },
    {
      id: "its-over",
      name: "It's Over Tee",
      price: 35,
      colors: ["Black"],
      description: "Black tee. IT'S OVER.",
      gradient: "linear-gradient(160deg, #050506 0%, #1a1a1a 55%, #ffd23a 100%)",
      images: [],
      buyUrl: ""
    },
    {
      id: "vinyl-roots",
      name: "Vinyl Roots Tee",
      price: 35,
      colors: ["Navy"],
      description: "Navy tee with the vinyl-tree art.",
      gradient: "linear-gradient(160deg, #070b14 0%, #15244a 48%, #c4a484 100%)",
      images: [],
      buyUrl: ""
    }
  ];

  var CARS = [
    {
      id: "concept-01",
      name: "Night Route",
      tagline: "Coming soon",
      gradient: "linear-gradient(120deg, #05070c 0%, #1a2744 52%, #c9a84c 100%)",
      image: "",
      imageJpg: "",
      specs: {
        Class: "Concept",
        Body: "TBD",
        Power: "TBD",
        Status: "Coming soon — photos and full specs drop in here."
      }
    },
    {
      id: "concept-02",
      name: "Ember Line",
      tagline: "Coming soon",
      gradient: "linear-gradient(125deg, #0a0504 0%, #4a1408 50%, #ff8a1f 100%)",
      image: "",
      imageJpg: "",
      specs: {
        Class: "Concept",
        Body: "TBD",
        Power: "TBD",
        Status: "Coming soon — photos and full specs drop in here."
      }
    },
    {
      id: "concept-03",
      name: "After Hours",
      tagline: "Coming soon",
      gradient: "linear-gradient(130deg, #08060a 0%, #2a1030 48%, #f3e6d4 100%)",
      image: "",
      imageJpg: "",
      specs: {
        Class: "Concept",
        Body: "TBD",
        Power: "TBD",
        Status: "Coming soon — photos and full specs drop in here."
      }
    }
  ];

  var productGrid = document.getElementById("product-grid");
  var carGrid = document.getElementById("car-grid");
  var modal = document.getElementById("car-modal");
  var modalTitle = document.getElementById("car-modal-title");
  var modalTag = document.getElementById("car-modal-tag");
  var modalMedia = document.getElementById("car-modal-media");
  var modalSpecs = document.getElementById("car-modal-specs");
  var closeBtn = document.getElementById("car-modal-close");
  var lastFocus = null;
  var state = {};

  function money(n) {
    return "$" + Number(n).toFixed(0);
  }

  function still(img) {
    return (img && (img.jpg || img.webp)) || "";
  }

  function setMedia(holder, item, alt) {
    holder.innerHTML = "";
    var src = still(item);
    if (src) {
      var picture = document.createElement("picture");
      if (item.webp && item.jpg && item.webp !== item.jpg) {
        var source = document.createElement("source");
        source.type = "image/webp";
        source.srcset = item.webp;
        picture.appendChild(source);
      }
      var img = document.createElement("img");
      img.src = src;
      img.alt = alt || item.alt || "";
      img.width = 1000;
      img.height = 1000;
      img.draggable = false;
      img.decoding = "async";
      picture.appendChild(img);
      holder.appendChild(picture);
    } else {
      var ph = document.createElement("div");
      ph.className = holder.classList.contains("car-modal-media") || holder.classList.contains("car-card-media")
        ? "car-placeholder"
        : "product-placeholder";
      ph.style.background = item.gradient || "#14080a";
      ph.textContent = "Photo coming soon";
      holder.appendChild(ph);
    }
  }

  function orderSubject(product, size, color) {
    var name = product.name;
    if (color && product.colors && product.colors.length > 1) {
      name = name + " (" + color + ")";
    }
    return "Order: " + name + " size " + size;
  }

  function buyHref(product, size, color) {
    if (product.buyUrl) return product.buyUrl;
    return "mailto:" + TO + "?subject=" + encodeURIComponent(orderSubject(product, size, color));
  }

  function buildProduct(product) {
    state[product.id] = {
      size: "",
      color: (product.colors && product.colors[0]) || "",
      imageIndex: 0
    };

    var card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("data-product", product.id);

    var media = document.createElement("div");
    media.className = "product-media";
    function showImage(i) {
      state[product.id].imageIndex = i;
      if (product.images && product.images[i]) {
        setMedia(media, product.images[i], product.images[i].alt || product.name);
      } else {
        setMedia(media, { gradient: product.gradient }, product.name);
      }
      if (thumbs) {
        Array.prototype.forEach.call(thumbs.querySelectorAll("button"), function (btn, idx) {
          btn.setAttribute("aria-current", idx === i ? "true" : "false");
        });
      }
    }

    var thumbs = null;
    if (product.images && product.images.length > 1) {
      thumbs = document.createElement("div");
      thumbs.className = "product-thumbs";
      product.images.forEach(function (img, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "View photo " + (i + 1));
        if (still(img)) {
          var im = document.createElement("img");
          im.src = img.jpg || img.webp;
          im.alt = "";
          im.draggable = false;
          b.appendChild(im);
        } else {
          var sw = document.createElement("span");
          sw.className = "thumb-swatch";
          sw.style.background = product.gradient;
          b.appendChild(sw);
        }
        b.addEventListener("click", function () { showImage(i); });
        thumbs.appendChild(b);
      });
    }

    showImage(0);

    var body = document.createElement("div");
    body.className = "product-body";

    var h3 = document.createElement("h3");
    h3.textContent = product.name;
    var price = document.createElement("p");
    price.className = "product-price";
    price.textContent = money(product.price);
    var desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = product.description || "";
    body.appendChild(h3);
    body.appendChild(price);
    if (product.description) body.appendChild(desc);

    if (product.colors && product.colors.length) {
      var cl = document.createElement("p");
      cl.className = "option-label";
      cl.textContent = "Color";
      var row = document.createElement("div");
      row.className = "swatch-row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", product.name + " color");
      product.colors.forEach(function (color) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "color-swatch";
        b.textContent = color;
        b.setAttribute("aria-pressed", color === state[product.id].color ? "true" : "false");
        b.addEventListener("click", function () {
          state[product.id].color = color;
          Array.prototype.forEach.call(row.querySelectorAll(".color-swatch"), function (el) {
            el.setAttribute("aria-pressed", el.textContent === color ? "true" : "false");
          });
        });
        row.appendChild(b);
      });
      body.appendChild(cl);
      body.appendChild(row);
    }

    var sl = document.createElement("p");
    sl.className = "option-label";
    sl.textContent = "Size";
    var sizes = document.createElement("div");
    sizes.className = "size-row";
    sizes.setAttribute("role", "group");
    sizes.setAttribute("aria-label", product.name + " size");
    SIZES.forEach(function (sz) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "size-chip";
      b.textContent = sz;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        state[product.id].size = sz;
        err.hidden = true;
        Array.prototype.forEach.call(sizes.querySelectorAll(".size-chip"), function (el) {
          el.setAttribute("aria-pressed", el.textContent === sz ? "true" : "false");
        });
      });
      sizes.appendChild(b);
    });
    body.appendChild(sl);
    body.appendChild(sizes);

    var err = document.createElement("p");
    err.className = "buy-error";
    err.hidden = true;
    err.setAttribute("role", "alert");

    var buy = document.createElement("a");
    buy.className = "btn btn-primary buy-btn";
    buy.href = "#";
    buy.textContent = "Buy";
    buy.addEventListener("click", function (e) {
      var sz = state[product.id].size;
      if (!sz) {
        e.preventDefault();
        err.textContent = "Pick a size first.";
        err.hidden = false;
        return;
      }
      buy.href = buyHref(product, sz, state[product.id].color);
      if (!product.buyUrl) {
        // Let the mailto navigate.
        return;
      }
    });

    var note = document.createElement("p");
    note.className = "buy-note";
    note.textContent = product.buyUrl
      ? "Secure checkout opens in a new step."
      : "Buy opens an email to artist@zigflames.com with your size. Checkout links can be added later.";

    body.appendChild(err);
    body.appendChild(buy);
    body.appendChild(note);

    card.appendChild(media);
    if (thumbs) card.appendChild(thumbs);
    card.appendChild(body);
    return card;
  }

  function buildCar(car) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "car-card";
    btn.setAttribute("data-car", car.id);
    btn.setAttribute("aria-label", car.name + ". " + (car.tagline || "Coming soon") + ". View details.");

    var media = document.createElement("div");
    media.className = "car-card-media";
    if (car.image || car.imageJpg) {
      setMedia(media, { webp: car.image, jpg: car.imageJpg, gradient: car.gradient }, car.name);
    } else {
      var ph = document.createElement("div");
      ph.className = "car-placeholder";
      ph.style.background = car.gradient;
      ph.textContent = "Coming soon";
      media.appendChild(ph);
    }

    var body = document.createElement("div");
    body.className = "car-card-body";
    var strong = document.createElement("strong");
    strong.textContent = car.name;
    var span = document.createElement("span");
    span.textContent = car.tagline || "Coming soon";
    body.appendChild(strong);
    body.appendChild(span);

    btn.appendChild(media);
    btn.appendChild(body);
    btn.addEventListener("click", function () { openCar(car); });
    return btn;
  }

  function openCar(car) {
    if (!modal) return;
    lastFocus = document.activeElement;
    modalTitle.textContent = car.name;
    modalTag.textContent = car.tagline || "Coming soon";
    modalMedia.innerHTML = "";
    if (car.image || car.imageJpg) {
      setMedia(modalMedia, { webp: car.image, jpg: car.imageJpg, gradient: car.gradient }, car.name);
    } else {
      var ph = document.createElement("div");
      ph.className = "car-placeholder";
      ph.style.background = car.gradient;
      ph.textContent = "Coming soon";
      modalMedia.appendChild(ph);
    }
    modalSpecs.innerHTML = "";
    var specs = car.specs || {};
    Object.keys(specs).forEach(function (key) {
      var dt = document.createElement("dt");
      dt.textContent = key;
      var dd = document.createElement("dd");
      dd.textContent = specs[key];
      modalSpecs.appendChild(dt);
      modalSpecs.appendChild(dd);
    });
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  if (productGrid) {
    PRODUCTS.forEach(function (p) { productGrid.appendChild(buildProduct(p)); });
  }
  if (carGrid) {
    CARS.forEach(function (c) { carGrid.appendChild(buildCar(c)); });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute("data-close")) closeModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  window.ZFMerch = {
    PRODUCTS: PRODUCTS,
    CARS: CARS,
    buyHref: buyHref,
    orderSubject: orderSubject,
    openCar: openCar,
    closeModal: closeModal
  };
})();
