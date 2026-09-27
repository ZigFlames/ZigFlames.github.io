/* Zig Flames Prompt Machine — CARTOON MAKER (inside Cinema Looks; in-browser, no backend, no uploads).
 * The user uploads the sketch directly in Grok / ChatGPT (or an image-to-image tool) and pastes our prompt next to it.
 * Two modes: "From my sketch" (finish the attached sketch) and "From prompt" (write a full cartoon scene).
 * Scene by scene: a locked character sheet (localStorage) is restated in every scene prompt; copy all as a numbered storyboard.
 * Rules: SFW (Cinema Looks' SFW filter + Platform Looks' blocklist + BANNED_MINOR), human characters are adults (21+),
 * studio / show names appear on the UI cards only — prompts describe visual traits.
 */
(function () {
  "use strict";
  var V = "20260927c";
  var STORE = "pm.cartoon.v1", SHEET_STORE = "pm.cartoon.sheet.v1", BOARD_STORE = "pm.cartoon.board.v1";
  var K = null, X = null; // K: kit from Cinema Looks, X: PMLooks.shared

  // ---- Styles: name / tag are UI only; every other field goes into prompts (visual traits, no names) ----------------
  // dim: 2d | 3d | hand | pixel | print   look: matching Cinema Looks id (Comics & Animation) when there is one
  var STYLES = [
    { id: "saturday-90s", name: "90s Saturday Morning", tag: "90s TV cartoon", grp: "TV", look: "saturday-90s", dim: "2d", ar: "4:3",
      medium: "1990s Saturday-morning TV cartoon, hand-painted cel animation",
      line: "bold uniform black outlines, simple rounded shapes, big expressive eyes and exaggerated mouths",
      color: "bright flat primary cel colors", shade: "one hard-edged shadow tone per color with small white highlights",
      bg: "gouache-painted backgrounds with soft edges behind crisp cel characters", texture: "slight film grain, faint cel dust, soft 4:3 TV look",
      palette: "primary red, yellow, blue, grass green, sky cyan", mood: "zany, high-energy" },
    { id: "cel-80s", name: "80s Cel Animation", tag: "80s toy-line action cartoon", grp: "Retro", look: "toy-cartoon-80s", dim: "2d", ar: "4:3",
      medium: "1980s action TV cartoon, hand-painted cel animation",
      line: "detailed black ink outlines, heroic muscular adult proportions, square jaws, dramatic poses",
      color: "saturated cel colors with chrome and laser accents", shade: "two-tone hard cel shading with airbrushed highlights on metal",
      bg: "airbrushed sci-fi fortresses and gradient skies", texture: "visible film grain, slight registration wobble, VHS-era softness",
      palette: "laser red, chrome silver, royal purple, electric blue", mood: "epic, heroic" },
    { id: "anime-90s", name: "90s Anime Cel", tag: "90s TV / OVA anime", grp: "Anime", look: "anime-90s", dim: "2d", ar: "4:3",
      medium: "1990s hand-painted anime cel frame",
      line: "fine tapered ink lines, large detailed eyes, angular adult faces, flowing hair shapes",
      color: "rich cel colors", shade: "hard two-tone cel shading with glossy hair highlights",
      bg: "detailed hand-painted backgrounds, neon cityscapes and dramatic skies", texture: "35mm film grain, slight color bleed, crisp cel shadow edges",
      palette: "neon magenta, dusk purple, deep blue, warm amber", mood: "moody, cinematic" },
    { id: "anime-modern", name: "Modern Anime", tag: "2010s-2020s digital anime", grp: "Anime", look: "", dim: "2d", ar: "16:9",
      medium: "modern digital anime key frame",
      line: "crisp thin digital lines, expressive large eyes, detailed hair strands",
      color: "vivid saturated digital color", shade: "soft gradient cel shading with bloom and glowing light",
      bg: "photoreal painted backgrounds, glowing skies and volumetric light rays", texture: "clean digital finish, subtle glow and particle effects",
      palette: "sky blue, sunset orange, blossom pink, emerald", mood: "emotional, luminous" },
    { id: "disney-2d", name: "Classic Disney-style 2D", tag: "90s hand-drawn feature", grp: "Feature & 3D", look: "disney-2d", dim: "2d", ar: "1.85:1",
      medium: "classic hand-drawn 2D feature animation frame",
      line: "elegant flowing hand-drawn lines with thick-thin variation, appealing rounded designs, graceful squash-and-stretch poses",
      color: "rich painted color", shade: "soft two-tone shading with warm rim light",
      bg: "lush painterly backgrounds with depth haze and multiplane layering", texture: "hand-inked cels over painted backgrounds, gentle film grain",
      palette: "royal gold, jewel teal, crimson, forest green", mood: "magical, warm" },
    { id: "pixar-3d", name: "Pixar-style 3D", tag: "3D CG feature animation", grp: "Feature & 3D", look: "pixar-3d", dim: "3d", ar: "1.85:1",
      medium: "3D CG animated feature film frame",
      finish: "rebuild it as a polished 3D CG render, turning every drawn shape into a clean sculpted 3D form that matches each silhouette, pose and camera angle",
      line: "no outlines, stylized appealing 3D forms, slightly oversized heads and big expressive eyes, soft rounded shapes",
      color: "saturated warm color", shade: "soft global illumination, gentle subsurface glow on skin, rim lights",
      bg: "a richly detailed 3D set with shallow depth of field", texture: "clean physically based render with fine fabric and surface detail",
      palette: "warm orange, teal, cream, candy red", mood: "heartfelt, playful" },
    { id: "adult-swim", name: "Adult Swim Flat", tag: "late-night adult cartoon", grp: "TV", look: "adult-swim", dim: "2d", ar: "16:9",
      medium: "late-night adult TV cartoon, limited 2D digital animation",
      line: "thin wobbly uniform outlines, simple deadpan faces, tiny pupils, minimal detail",
      color: "muted flat colors with no gradients", shade: "no shading or a single flat shadow",
      bg: "plain flat backgrounds and sparse suburban interiors", texture: "flat vector finish",
      palette: "muted olive, beige, dusty pink, pale blue", mood: "deadpan, absurd" },
    { id: "spider-verse", name: "Spider-Verse Halftone", tag: "comic-book 3D animation", grp: "Feature & 3D", look: "spider-verse", dim: "3d", ar: "2.39:1",
      medium: "stylized 3D animation frame rendered to look like a printed comic book",
      finish: "rebuild it as a stylized 3D comic render, keeping the sketch's lines as hand-drawn ink over 3D forms and matching every silhouette, pose and camera angle",
      line: "hand-drawn ink lines and hatching over 3D forms, bold graphic shapes",
      color: "punchy neon color", shade: "halftone dot shading, offset color misregistration, stepped low-frame-rate motion feel",
      bg: "a graphic city skyline at night with painterly speed lines", texture: "print halftone, CMYK offset fringes, glitchy edges",
      palette: "neon magenta, cyan, acid yellow, deep black", mood: "kinetic, bold" },
    { id: "boondocks", name: "Boondocks / Anime-Urban", tag: "anime-influenced urban 2D", grp: "TV", look: "boondocks", dim: "2d", ar: "16:9",
      medium: "anime-influenced 2D urban TV cartoon",
      line: "clean confident digital lines, anime-style action framing, stylized adult proportions, detailed natural hair shapes like afros, braids and cornrows",
      color: "earthy flat color", shade: "hard cel shadows with dramatic anime lighting",
      bg: "clean suburban and city backgrounds", texture: "crisp digital cels with occasional speed lines",
      palette: "suburb green, warm brown, brick red, dusk orange", mood: "sharp, satirical, cool" },
    { id: "yellow-flat", name: "Simpsons-style Yellow Flat", tag: "prime-time sitcom cartoon", grp: "TV", look: "", dim: "2d", ar: "16:9",
      medium: "prime-time 2D sitcom cartoon",
      line: "thin even black outlines, round bulging eyes with dot pupils, overbites, four-fingered hands, simple rounded shapes",
      color: "flat bright colors with bright yellow skin for every human character", shade: "flat color with almost no shading",
      bg: "simple flat suburban backgrounds with clear shapes", texture: "clean digital ink and paint",
      palette: "bright yellow, sky blue, pink, lime green", mood: "comedic, cozy" },
    { id: "claymation", name: "Claymation", tag: "stop-motion clay", grp: "Handmade", look: "claymation", dim: "hand", ar: "16:9",
      medium: "stop-motion claymation frame",
      finish: "rebuild it as a stop-motion clay scene, sculpting each drawn character and prop in plasticine to match the sketch's silhouettes, poses and camera angle",
      line: "no outlines, chunky rounded plasticine characters with wide mouths and tool marks",
      color: "soft matte clay colors", shade: "real miniature-set lighting with soft shadows",
      bg: "a handmade miniature set with tiny props", texture: "thumbprints in the clay, shallow macro depth of field",
      palette: "clay pastels, warm tan, soft red, moss green", mood: "charming, handmade" },
    { id: "stop-motion", name: "Stop-Motion Puppet", tag: "puppet stop-motion feature", grp: "Handmade", look: "", dim: "hand", ar: "1.85:1",
      medium: "stop-motion puppet animation frame",
      finish: "rebuild it as a stop-motion puppet scene, building each drawn character as a handmade puppet and each background element as a miniature set, matching the sketch's silhouettes, poses and camera angle",
      line: "no outlines, articulated puppets with fabric costumes and slender stylized adult proportions",
      color: "moody rich color", shade: "dramatic practical miniature lighting with rim lights and pools of shadow",
      bg: "handcrafted miniature sets, painted backdrops and tiny handmade props", texture: "felt, wool, carved wood and resin textures, macro-lens depth of field",
      palette: "midnight blue, pumpkin orange, moss, bone white", mood: "whimsical, eerie" },
    { id: "comic-halftone", name: "Comic Book Ink & Halftone", tag: "classic American comics", grp: "Comics & Print", look: "comic-halftone", dim: "print", ar: "2:3",
      medium: "classic American comic book panel",
      line: "bold brush-and-pen inks, feathered hatching, heroic adult anatomy, dynamic foreshortening",
      color: "flat four-color print color", shade: "halftone dot shading and solid black shadows",
      bg: "detailed inked backgrounds with speed lines", texture: "newsprint paper, halftone dots, slight offset misregistration",
      palette: "primary red, yellow, blue, black ink", mood: "punchy, dramatic" },
    { id: "manga-bw", name: "Manga Black & White", tag: "Japanese manga page", grp: "Comics & Print", look: "", dim: "print", ar: "2:3",
      medium: "black-and-white manga panel",
      line: "fine pen-nib ink lines, expressive large eyes, dramatic speed lines and impact lines",
      color: "pure black and white, no color", shade: "screentone gradients and dot patterns with solid spot blacks",
      bg: "detailed pen-drawn backgrounds or screentone gradients", texture: "crisp print on white paper",
      palette: "black ink, white paper, grey screentone", mood: "intense, dramatic" },
    { id: "graffiti", name: "Graffiti Cartoon", tag: "spray-paint street-art characters", grp: "Comics & Print", look: "", dim: "2d", ar: "16:9",
      medium: "graffiti-style cartoon character mural",
      line: "thick bold outlines with a white highlight edge and a drop shadow, exaggerated b-boy proportions, big sneakers and hands",
      color: "vivid spray-paint fills with fades", shade: "spray gradients, glossy highlights and paint drips",
      bg: "a brick wall or train-yard backdrop with abstract wildstyle shapes and no readable letters", texture: "spray-paint overspray, drips, rough brick",
      palette: "electric green, hot pink, chrome, orange, black outline", mood: "loud, street" },
    { id: "rubber-hose", name: "1930s Rubber-Hose", tag: "early black-and-white theatrical cartoon", grp: "Retro", look: "", dim: "2d", ar: "4:3",
      medium: "1930s black-and-white rubber-hose theatrical cartoon",
      line: "bendy rubber-hose limbs with no elbows, pie-cut eyes, white gloves, round bodies, bouncy poses",
      color: "black and white with grey tones", shade: "flat greys with no gradients",
      bg: "simple ink-and-wash backgrounds", texture: "heavy film grain, gate weave, dust, scratches and slight flicker",
      palette: "black, white, silver grey", mood: "bouncy, jaunty" },
    { id: "looney", name: "Looney-style Theatrical", tag: "40s-50s theatrical shorts", grp: "Retro", look: "", dim: "2d", ar: "4:3",
      medium: "1940s-50s theatrical cartoon short",
      line: "energetic squash-and-stretch, exaggerated wild takes, smear frames, expressive eyebrows",
      color: "saturated vintage three-strip-film color", shade: "flat cel color with soft painted shadows",
      bg: "lush painted watercolor backgrounds, desert mesas or stylized towns", texture: "vintage film softness, light grain",
      palette: "desert orange, sky blue, warm red, cream", mood: "slapstick, manic" },
    { id: "chibi", name: "Chibi / Super-Deformed", tag: "cute SD anime", grp: "Anime", look: "", dim: "2d", ar: "1:1",
      medium: "chibi super-deformed anime illustration",
      line: "clean rounded lines, grown-up characters drawn super-deformed about 2-3 heads tall, huge sparkly eyes, tiny hands",
      color: "soft pastel flat color", shade: "soft cel shading",
      bg: "simple pastel backgrounds with sparkles and small icons", texture: "clean digital finish",
      palette: "pastel pink, mint, lavender, butter yellow", mood: "cute, playful" },
    { id: "noir-ink", name: "Noir Comic Ink", tag: "Sin City-style noir comic", grp: "Comics & Print", look: "noir-ink", dim: "print", ar: "2.39:1",
      medium: "high-contrast noir comic illustration",
      line: "heavy brush inks, stark silhouettes, sharp angular adult faces",
      color: "black and white with a single crimson accent", shade: "pure black shadows with no mid-tones and white rain streaks",
      bg: "rain-soaked city streets and venetian-blind light", texture: "ink splatter, rough paper",
      palette: "black, white, one crimson accent", mood: "hard-boiled, moody" },
    { id: "painterly-fantasy", name: "Ghibli-style Painterly", tag: "hand-drawn fantasy feature", grp: "Anime", look: "", dim: "2d", ar: "1.85:1",
      medium: "hand-drawn Japanese fantasy feature animation frame",
      line: "soft natural pencil-like lines, gentle realistic adult proportions, understated faces",
      color: "soft natural watercolor-like color", shade: "gentle cel shading with soft sunlight and cloud shadows",
      bg: "lush hand-painted watercolor landscapes, towering clouds and overgrown villages", texture: "gouache and watercolor texture, gentle film grain",
      palette: "meadow green, sky blue, warm cream, terracotta", mood: "peaceful, wondrous" },
    { id: "thick-line-00s", name: "2000s Thick-Line TV", tag: "Powerpuff / Dexter-era TV", grp: "TV", look: "", dim: "2d", ar: "4:3",
      medium: "late-90s / 2000s TV cartoon with graphic mid-century design",
      line: "very thick black outlines, bold geometric character shapes, oversized heads, stubby limbs",
      color: "flat bold colors", shade: "no shading",
      bg: "flat geometric backgrounds and simple skylines", texture: "clean vector-like finish",
      palette: "hot pink, lime green, sky blue, black", mood: "hyper, graphic" },
    { id: "mid-century", name: "60s Mid-Century TV", tag: "Flintstones / Jetsons-era", grp: "Retro", look: "", dim: "2d", ar: "4:3",
      medium: "1960s limited-animation TV cartoon",
      line: "clean mid-century modern character design, angular stylized adults, collars and ties at the neck",
      color: "flat color", shade: "minimal shading",
      bg: "stylized mid-century modern backgrounds with atomic-age shapes and textured color blocks", texture: "slight cel grain",
      palette: "turquoise, mustard, coral, avocado", mood: "breezy, retro" },
    { id: "webtoon", name: "Webtoon / Digital Comic", tag: "vertical-scroll digital comic", grp: "Comics & Print", look: "", dim: "print", ar: "4:5",
      medium: "vertical-scroll digital comic panel",
      line: "clean thin digital lines, attractive stylized adult characters, expressive faces",
      color: "soft digital color", shade: "soft cel shading with airbrushed glow",
      bg: "simplified or softly blurred backgrounds with light effects", texture: "clean digital finish",
      palette: "soft pastels with one saturated accent", mood: "romantic, dramatic" },
    { id: "paper-cutout", name: "Paper Cut-Out", tag: "construction-paper cartoon (South Park look)", grp: "Handmade", look: "", dim: "hand", ar: "16:9",
      medium: "construction-paper cut-out cartoon",
      finish: "rebuild it as a paper cut-out scene, cutting each drawn character and object from construction paper while keeping the sketch's layout, poses and proportions",
      line: "simple geometric paper shapes, round heads, dot eyes, stiff flat poses",
      color: "flat construction-paper color", shade: "slight paper drop shadows",
      bg: "a flat paper-cut backdrop of a small mountain town", texture: "paper fibers and cut edges",
      palette: "bright construction-paper colors", mood: "crude, comedic" },
    { id: "pixel-art", name: "16-bit Pixel Art", tag: "retro console game art", grp: "Retro", look: "", dim: "pixel", ar: "4:3",
      medium: "16-bit retro video game pixel art scene",
      finish: "redraw it as 16-bit pixel art on a strict pixel grid, keeping every shape, pose and element where the sketch puts it",
      line: "crisp pixel outlines, chunky sprite proportions",
      color: "a limited 32-color palette", shade: "dithered shading and hard pixel highlights",
      bg: "parallax-layered pixel backgrounds", texture: "clean pixels with no anti-aliasing, faint CRT scanlines",
      palette: "deep blue, magenta, lime, sunset orange", mood: "nostalgic, adventurous" },
    { id: "storybook", name: "Storybook Watercolor", tag: "picture-book illustration", grp: "Handmade", look: "", dim: "2d", ar: "3:2",
      medium: "storybook watercolor illustration",
      line: "loose ink and colored-pencil lines",
      color: "transparent watercolor washes", shade: "soft wet-on-wet shading",
      bg: "airy painted backgrounds with white paper showing through", texture: "cold-press watercolor paper grain and pigment blooms",
      palette: "soft sage, rose, ochre, cerulean", mood: "gentle, whimsical" },
    { id: "toon-3d", name: "Cel-Shaded 3D", tag: "toon-shaded game 3D", grp: "Feature & 3D", look: "", dim: "3d", ar: "16:9",
      medium: "cel-shaded 3D render with toon shading",
      finish: "rebuild it as a cel-shaded 3D scene, turning each drawn shape into a toon-shaded 3D model that matches every silhouette, pose and camera angle",
      line: "clean ink outlines on 3D models, stylized proportions",
      color: "bright flat-shaded color", shade: "hard two-step toon shading with a crisp rim light",
      bg: "a stylized 3D environment under a painterly sky", texture: "clean game-engine render",
      palette: "grass green, ocean blue, sunlit yellow, coral", mood: "adventurous, bright" },
    { id: "ligne-claire", name: "Ligne Claire (Euro Comic)", tag: "Tintin-style Franco-Belgian", grp: "Comics & Print", look: "", dim: "print", ar: "4:3",
      medium: "Franco-Belgian clear-line comic panel",
      line: "uniform clean ink lines of a single weight, no hatching, simple readable faces",
      color: "flat even color with no gradients", shade: "no rendered shading, only clean flat shadow shapes",
      bg: "highly detailed realistic backgrounds with architecture and vehicles", texture: "clean print on paper",
      palette: "clear primaries, sand, sky blue", mood: "adventurous, clear" },
    { id: "dark-deco", name: "Dark Deco 90s Action", tag: "Batman: The Animated Series style", grp: "TV", look: "", dim: "2d", ar: "4:3",
      medium: "1990s dark art-deco action TV cartoon",
      line: "angular art-deco character shapes, broad shoulders, square jaws, minimal interior lines",
      color: "deep muted colors", shade: "hard black shadow shapes, backgrounds painted on black",
      bg: "a towering art-deco skyline with searchlights and a red sky", texture: "painted-on-black backgrounds, light film grain",
      palette: "blood-red sky, charcoal, slate blue, gold windows", mood: "brooding, noir" }
  ];
  var GROUPS = ["All", "TV", "Retro", "Anime", "Feature & 3D", "Handmade", "Comics & Print"];
  var TARGETS = [["grok", "Grok"], ["chatgpt", "ChatGPT"], ["generic", "Generic"]];
  var FAITH = {
    strict: { label: "Strict trace", strength: "0.30", cn: "1.0",
      text: "Strict trace: keep every line and shape exactly where it is, and do not move, add or remove characters, objects or background elements; only clean, ink and color what is drawn.",
      bg: function (st) { return "Background: color and finish only what is drawn in the sketch, using " + st.bg + " as the treatment."; } },
    balanced: { label: "Balanced", strength: "0.50", cn: "0.8",
      text: "Balanced: stay true to the sketch, but smooth wobbly lines, fix small anatomy slips and fill empty background areas with detail that fits the scene.",
      bg: function (st) { return "Background: finish it as " + st.bg + ", built around what is sketched."; } },
    creative: { label: "Creative", strength: "0.65", cn: "0.6",
      text: "Creative: treat the sketch as the blueprint; keep the layout, poses and character designs recognizable, but you may refine anatomy and add props, effects and a fully rendered background.",
      bg: function (st) { return "Background: fully render it as " + st.bg + ", adding depth and detail."; } }
  };
  var SHOTS = ["wide establishing shot", "medium shot", "low-angle hero shot", "over-the-shoulder shot", "close-up on the main character's face",
    "dynamic three-quarter action shot", "high-angle bird's-eye view", "two-shot with both characters in frame", "tilted dutch-angle action shot", "silhouettes against the sky"];
  var LIGHTS = {
    night: ["neon night light", "moonlit blue night light", "streetlight glow with deep shadows", "city-glow night light"],
    dusk: ["golden-hour light", "sunset rim light", "warm dusk glow"],
    indoor: ["warm interior lamplight", "cool fluorescent interior light", "moody practical lamps", "soft window light"],
    day: ["bright midday light", "soft overcast light", "dramatic backlight", "crisp morning light"]
  };
  function lightFor(t) {
    t = String(t || "");
    var k = /\b(night|midnight|neon|moon\w*|dark|3 ?a\.?m|after hours|late-night|stars?)\b/i.test(t) ? "night" : /\b(sunset|sunrise|dusk|dawn|golden hour|evening)\b/i.test(t) ? "dusk"
      : /\b(studio|room|kitchen|store|shop|lab|subway|barbershop|office|bar|club|garage|bedroom|living room|inside|indoors?|stockroom|hallway|diner|arcade|basement|van)\b/i.test(t) ? "indoor"
      : /\b(day|daytime|noon|morning|afternoon|sunny|beach|desert)\b/i.test(t) ? "day" : "";
    return pk("light:" + (k || "any"), k ? LIGHTS[k] : LIGHTS.day.concat(LIGHTS.dusk));
  }
  var POLISH = ["extra polish on faces, hands and expressions", "confident line weight with thicker outer contours", "clear color separation between characters and background",
    "crisp readable silhouettes", "rich texture in the background", "one consistent light direction across the frame", "clean color fills with no gaps or smudges"];
  var IDEAS = ["two friends racing shopping carts through an empty neon parking lot", "a street DJ spinning records on a rooftop at sunset",
    "a detective cat interrogating a nervous pigeon in a rainy alley", "a beat-maker hunched over a sampler in a cluttered home studio at 3 a.m.",
    "a food-truck chef flipping burgers during the lunch rush", "a giant robot stuck under a city bridge", "a pickup basketball game on a cracked court at dusk",
    "an astronaut dog planting a flag on a candy-colored moon", "a sneaker reseller surrounded by towers of shoe boxes", "a band loading gear into a beat-up van in the rain",
    "a knight and a dragon sharing tea on a mountaintop", "a skateboarder grinding a rail past a giant mural", "a road trip in a vintage convertible through the desert",
    "a barbershop debate with everyone talking at once", "a superhero stuck in traffic on the way to save the day", "a wizard running a corner store for monsters",
    "a lowrider hopping at a summer car show", "two rival chefs in a kitchen cook-off", "a mad scientist whose experiment turns the lab into jelly", "a late-night subway ride with strange passengers"];
  var ADULT_AGE_RE = /\b(1?\d|20)\s*-?\s*(years?|yrs?)\s*-?\s*old\b|\b(1?\d|20)\s*(y\/o|yo)\b|\b(age|aged)\s+(1?\d|20)\b/i;

  // ---- State ---------------------------------------------------------------------------------------
  var S = { el: null, api: null, mode: "sketch", target: "grok", style: "saturday-90s", grp: "All", faith: "balanced", frame: "auto",
    idea: "", desc: "", scene: 1, result: null, notice: "", resetArm: false };
  var SAVE_KEYS = ["mode", "target", "style", "grp", "faith", "frame", "idea", "desc", "scene", "result"];
  var SH = { chars: [], palette: "", lock: false };
  var BD = [];
  var HIST = {};
  function load() {
    try { var j = JSON.parse(localStorage.getItem(STORE) || "{}"); SAVE_KEYS.forEach(function (k) { if (j[k] !== undefined) S[k] = j[k]; }); } catch (e) {}
    try { var s = JSON.parse(localStorage.getItem(SHEET_STORE) || "{}"); SH.chars = Array.isArray(s.chars) ? s.chars.slice(0, 6) : []; SH.palette = String(s.palette || ""); SH.lock = !!s.lock; } catch (e) {}
    try { var b = JSON.parse(localStorage.getItem(BOARD_STORE) || "[]"); BD = Array.isArray(b) ? b : []; } catch (e) { BD = []; }
    if (!styleById(S.style, true)) S.style = STYLES[0].id;
    if (!(S.scene >= 1)) S.scene = 1;
  }
  function save() { try { var o = {}; SAVE_KEYS.forEach(function (k) { o[k] = S[k]; }); localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} }
  function saveSheet() { try { localStorage.setItem(SHEET_STORE, JSON.stringify(SH)); } catch (e) {} }
  function saveBoard() { try { localStorage.setItem(BOARD_STORE, JSON.stringify(BD.slice(0, 60))); } catch (e) {} }
  function styleById(id, strict) { var s = STYLES.find(function (x) { return x.id === id; }); return s || (strict ? null : STYLES[0]); }
  function toast(t, d) { try { S.api.current.toast(t, d); } catch (e) {} }
  function pk(k, arr) { var v = X.pick(arr, HIST[k]); var a = HIST[k] || (HIST[k] = []); a.push(v); if (a.length > 3) a.shift(); return v; }
  function art(t) { return (/^[aeiou]/i.test(t) || /^(1[18]|8)\d*/.test(t) ? "an " : "a ") + t; }
  function cap(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function boardMax() { return BD.reduce(function (m, b) { return Math.max(m, b.n); }, 0); }
  function boardStyle() { var b = BD.slice().sort(function (a, c) { return a.n - c.n; })[0]; return b ? b.style : null; }
  function locked() { return !!SH.lock; }

  // ---- Safety: blocklist, SFW, BANNED_MINOR, adult wording ---------------------------------------------
  function cleanText(raw, max) {
    var b = X.stripBlocked(String(raw || "")), s = K.stripSfw(b.text);
    var t = K.adultWords(X.sanitizeIdea(s.text)).replace(/[<>]/g, "").replace(/\s{2,}/g, " ")
      .replace(/\b(an?|the)\s+(?=(on|in|at|with|and|of|to|by|for|from|into|a|an|the)\b|[,.;]|$)/gi, "").replace(/\s{2,}/g, " ").trim().slice(0, max || 240);
    return { text: t, blocked: b.removed, sfw: s.removed };
  }
  function refusal(t) {
    var r = X.reuseBannedMinor(t);
    if (r) return r;
    if (ADULT_AGE_RE.test(t)) return "Adults 21+ only.";
    return null;
  }
  function isPerson(t) { return K.PERSON_RE.test(t) || /\b(human|lady|guy|chick|homie|rapper|dj|mc|producer|fighter|ninja|cowboy|pirate|wizard|witch|knight|princess|prince|queen|king|chef|nurse|doctor|teacher|mom|dad|grandma|grandpa|twins?)\b/i.test(t); }
  function sheetChars(msgs) {
    var out = [];
    SH.chars.forEach(function (c) {
      var n = cleanText(c.name, 40), d = cleanText(c.desc, 220);
      [n, d].forEach(function (x) { if (x.blocked.length) msgs.blocked = msgs.blocked.concat(x.blocked); if (x.sfw.length) msgs.sfw = msgs.sfw.concat(x.sfw); });
      if (!n.text && !d.text) return;
      var ref = refusal(n.text + " " + d.text); if (ref) msgs.refused = true;
      var person = isPerson(d.text + " " + n.text);
      out.push({ name: n.text, desc: d.text, person: person });
    });
    return out;
  }
  function charText(chars) {
    return chars.map(function (c) {
      var d = c.desc || "same design as in the earlier scenes";
      if (c.person && !/\badults?\b/i.test(d)) d += " (adult, 21+)";
      return (c.name ? c.name + ": " : "") + d;
    }).join("; ");
  }

  // ---- Prompt assembly ---------------------------------------------------------------------------------
  function ratioNum(r) { var m = String(r).split(":"); return (parseFloat(m[0]) || 1) / (parseFloat(m[1]) || 1); }
  function frameInfo(st) {
    if (S.mode === "sketch" && S.frame === "auto") return { sketch: true };
    var r = S.frame === "wide" ? "16:9" : S.frame === "square" ? "1:1" : S.frame === "tall" ? "9:16" : st.ar;
    var n = ratioNum(r), orient = n > 1.05 ? "landscape" : n < 0.95 ? "portrait" : "square";
    return { r: r, orient: orient, gpt: orient === "landscape" ? "landscape (3:2)" : orient === "portrait" ? "portrait (2:3)" : "square (1:1)" };
  }
  function finishSentence(st) {
    if (st.finish) return cap(st.finish) + ". Design: " + st.line + ". Color and shading: " + st.color + ", " + st.shade + ".";
    if (st.dim === "print") return "Clean up and ink the lines: " + st.line + ". Color and shading: " + st.color + ", " + st.shade + ".";
    return "Clean up and ink the lines: " + st.line + ". Color: " + st.color + ", " + st.shade + ".";
  }
  function faithText(f, key, st) {
    if (key === "strict" && (st.dim === "3d" || st.dim === "hand" || st.dim === "pixel"))
      return "Strict: match every shape, pose, position and element in the sketch exactly, and do not move, add or remove characters, objects or background elements.";
    return f.text;
  }
  function verb(st) { return st.dim === "3d" ? "Render it as " : st.dim === "hand" ? "Build it as " : "Draw it as "; }
  var NO_TEXT = "No text, captions, speech bubbles, signatures, logos or watermarks.";
  function negFor(st, sketch) {
    var n = ["text", "captions", "speech bubbles", "watermark", "signature", "logo", "photorealistic", "photo", "extra limbs", "extra fingers", "deformed hands", "blurry", "low quality"];
    if (st.dim === "2d" || st.dim === "print") n.push("3D render");
    if (st.dim === "3d" || st.dim === "hand") n.push("flat 2D drawing");
    if (sketch) n.push("changed pose", "changed composition", "rough sketch lines", "pencil smudges");
    return n.join(", ");
  }
  function build(inp) {
    // inp: { mode, target, style, faith, frame, text (idea or sketch description), scene }
    var st = styleById(inp.style), T = inp.target, n = inp.scene || 1, sketch = inp.mode === "sketch";
    var msgs = { blocked: [], sfw: [], refused: false };
    var c = cleanText(inp.text, sketch ? 300 : 240);
    msgs.blocked = msgs.blocked.concat(c.blocked); msgs.sfw = msgs.sfw.concat(c.sfw);
    var main = c.text;
    var pal0 = cleanText(SH.palette, 120); msgs.sfw = msgs.sfw.concat(pal0.sfw); msgs.blocked = msgs.blocked.concat(pal0.blocked);
    var pal = pal0.text || st.palette;
    var chars = sheetChars(msgs);
    if (refusal(main) || refusal(pal) || msgs.refused) return { refused: true, msgs: msgs };
    if (!sketch && !main) return { needIdea: true, msgs: msgs };
    var people = chars.some(function (x) { return x.person; }) || isPerson(main);
    var fr = frameInfo(st), f = FAITH[inp.faith] || FAITH.balanced;
    var polish = pk("polish", POLISH);
    var light = sketch && inp.faith === "strict" ? "" : lightFor(main);
    var shot = sketch ? "" : pk("shot", SHOTS);
    var adultLine = people ? "All human characters are adults (21+) with adult proportions." : (sketch ? "If the sketch shows people, draw them as adults (21+) with adult proportions." : "");
    var board = n > 1 ? "Storyboard scene " + n + ": keep the character designs, outfits, colors, palette and art style identical to the earlier scenes."
      : (chars.length || locked() ? "Storyboard scene 1: this frame sets the character designs, palette and style for the scenes that follow." : "");
    var charsTxt = chars.length ? charText(chars) : "";
    var text;
    if (sketch) {
      var open = (T === "generic" ? "Using the input sketch as the exact base (image-to-image or image edit), finish it into " : "Using the attached sketch as the exact base, finish it into ") +
        art(st.medium) + ": keep the original linework, character proportions, poses, composition and layout.";
      var frS = fr.sketch ? null : fr;
      if (T === "grok") {
        text = [open, faithText(f, inp.faith, st), finishSentence(st), f.bg(st), "Palette: " + pal + ". Texture: " + st.texture + ".",
          "Mood: " + st.mood + (light ? ", " + light : "") + ". Polish: " + polish + ".",
          main ? "The sketch shows: " + main + "." : "",
          charsTxt ? "Characters (keep exactly the same in every scene): " + charsTxt + "." : "",
          adultLine, board,
          frS ? "Reframe to " + frS.r + " " + frS.orient + " by extending the background; don't crop the characters." : "Keep the sketch's aspect ratio and framing.",
          NO_TEXT].filter(Boolean).join(" ");
      } else if (T === "chatgpt") {
        text = [open + " Generate the image directly; don't ask follow-up questions.",
          "Keep: the original linework, character proportions, poses, facial expressions, composition, camera angle and layout. Don't redesign the characters" + (inp.faith === "creative" ? " or change the layout." : " and don't add or remove characters."),
          "Faithfulness: " + faithText(f, inp.faith, st),
          "Linework and color: " + finishSentence(st),
          f.bg(st),
          "Palette: " + pal + ". Texture: " + st.texture + ".",
          "Mood" + (light ? " and lighting" : "") + ": " + st.mood + (light ? ", " + light : "") + ".",
          "Polish: " + polish + ".",
          main ? "What the sketch shows: " + main + "." : "",
          charsTxt ? "Characters (identical in every scene): " + charsTxt + "." : "",
          adultLine, board,
          "Output: one finished image, " + (frS ? frS.gpt + ", extending the background rather than cropping the characters" : "same aspect ratio as the sketch") + ". " + NO_TEXT].filter(Boolean).join("\n");
      } else {
        var tags = X.dedupe([main, "finished " + st.medium, st.line, st.color, st.shade, st.bg, "palette " + pal, st.texture, st.mood + " mood", light, polish,
          "clean inked linework", "same composition, same poses, same character proportions as the sketch", charsTxt ? "characters: " + charsTxt : "",
          people ? "all human characters adults 21+" : "any people drawn as adults 21+", n > 1 ? "storyboard scene " + n + ", same character designs and palette as earlier scenes" : ""].filter(Boolean).join(", "));
        text = [open, "Prompt: " + tags, "Negative prompt: " + negFor(st, true),
          "Settings: strength / denoise " + f.strength + "; lineart or scribble ControlNet weight " + f.cn + " if your tool has it; aspect ratio " + (frS ? frS.r : "same as the sketch") + "."].join("\n");
      }
    } else {
      if (T === "grok") {
        text = ["Cartoon scene: " + main + ".", verb(st) + art(st.medium) + ".", cap(shot) + ", " + light + ".",
          "Style: " + st.line + "; " + st.color + ", " + st.shade + ".", "Background: " + st.bg + ".",
          "Palette: " + pal + ". Texture: " + st.texture + ". Mood: " + st.mood + ". Polish: " + polish + ".",
          charsTxt ? "Characters (keep exactly the same in every scene): " + charsTxt + "." : "",
          adultLine, board, "Aspect ratio " + fr.r + " (" + fr.orient + ").", NO_TEXT].filter(Boolean).join(" ");
      } else if (T === "chatgpt") {
        text = ["Create one image: " + main + ". Generate it directly; don't ask follow-up questions.",
          "Style: " + st.medium + ". " + cap(st.line) + ". " + cap(st.color) + ", " + st.shade + ".",
          "Composition: " + shot + ", " + light + ".",
          "Background: " + st.bg + ".",
          "Palette: " + pal + ". Texture: " + st.texture + ". Mood: " + st.mood + ".",
          "Polish: " + polish + ".",
          charsTxt ? "Characters (identical in every scene): " + charsTxt + "." : "",
          adultLine, board,
          "Format: " + fr.gpt + ". " + NO_TEXT].filter(Boolean).join("\n");
      } else {
        var tg = X.dedupe([main, st.medium, shot, light, st.line, st.color, st.shade, st.bg, "palette " + pal, st.texture, st.mood + " mood", polish,
          charsTxt ? "characters: " + charsTxt : "", people ? "all human characters adults 21+" : "", n > 1 ? "storyboard scene " + n + ", same character designs and palette as earlier scenes" : ""].filter(Boolean).join(", "));
        text = ["Prompt: " + tg, "Negative prompt: " + negFor(st, false), "Aspect ratio: " + fr.r + "."].join("\n");
      }
    }
    text = text.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/\.\./g, ".");
    return { text: text, msgs: msgs, input: main, people: people };
  }

  // ---- Actions -----------------------------------------------------------------------------------------
  function curInput() { return S.mode === "sketch" ? S.desc : S.idea; }
  function noticeFrom(m) {
    var out = [];
    if (m.blocked.length) out.push("Adults 21+ only \u2014 removed: " + uniq(m.blocked).join(", ") + ".");
    if (m.sfw.length) out.push("Cartoon Maker is SFW \u2014 removed: " + uniq(m.sfw).join(", ") + ".");
    return out.join(" ");
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { x = String(x).toLowerCase(); if (s[x]) return false; s[x] = 1; return true; }); }
  function generate() {
    readInputs();
    if (locked() && BD.length && boardStyle() && boardStyle() !== S.style) S.style = boardStyle();
    var r = build({ mode: S.mode, target: S.target, style: S.style, faith: S.faith, frame: S.frame, text: curInput(), scene: S.scene });
    if (r.refused) { setNotice("Refused: people in Cartoon Maker are adults 21+. Rewrite without minors or ages under 21 (animals, robots and creatures are fine)."); return; }
    if (r.needIdea) { setNotice("Type a scene idea first (or tap \ud83c\udfb2 Idea)."); return; }
    if (S.mode === "sketch") S.desc = r.input; else S.idea = r.input;
    S.result = { text: r.text, n: S.scene, target: S.target, mode: S.mode, style: S.style };
    var entry = { n: S.scene, mode: S.mode, target: S.target, style: S.style, faith: S.faith, input: r.input, text: r.text, at: Date.now() };
    BD = BD.filter(function (b) { return b.n !== S.scene; }); BD.push(entry); BD.sort(function (a, b) { return a.n - b.n; });
    saveBoard(); S.notice = noticeFrom(r.msgs); S.resetArm = false; save();
    try { S.api.current.setPrompt(r.text); } catch (e) {}
    render();
    toast("Scene " + S.scene + " prompt ready", styleById(S.style).name + " \u00b7 " + tName(S.target) + " \u00b7 written to Prompt Output");
  }
  function tName(t) { var x = TARGETS.find(function (a) { return a[0] === t; }); return x ? x[1] : t; }
  function nextScene() {
    readInputs();
    if (!BD.some(function (b) { return b.n === S.scene; })) { setNotice("Make scene " + S.scene + "'s prompt first, then tap Next scene."); return; }
    S.scene = boardMax() + 1; S.result = null; S.idea = ""; S.desc = ""; S.notice = "";
    if (!SH.lock) { SH.lock = true; saveSheet(); toast("Character sheet locked", "Every scene restates the same characters, style and palette. Tap \ud83d\udd12 to unlock and edit."); }
    save(); render();
    focusInput();
  }
  function openScene(b) {
    S.scene = b.n; S.mode = b.mode; S.target = b.target; S.style = b.style; if (b.faith) S.faith = b.faith;
    if (b.mode === "sketch") S.desc = b.input || ""; else S.idea = b.input || "";
    S.result = { text: b.text, n: b.n, target: b.target, mode: b.mode, style: b.style }; S.notice = ""; save(); render();
  }
  function storyboardText() {
    var list = BD.slice().sort(function (a, b) { return a.n - b.n; });
    return "Storyboard \u2014 " + list.length + " scene" + (list.length === 1 ? "" : "s") + "\n\n" + list.map(function (b) { return b.n + ". Scene " + b.n + "\n" + b.text; }).join("\n\n");
  }
  function clearCurrent() {
    S.result = null; S.idea = ""; S.desc = ""; S.notice = ""; save();
    try { S.api.current.setPrompt(""); } catch (e) {}
    render();
  }
  function resetBoard() {
    if (!S.resetArm) { S.resetArm = true; render(); return; }
    BD = []; saveBoard(); S.scene = 1; S.result = null; S.idea = ""; S.desc = ""; S.resetArm = false; S.notice = ""; save();
    toast("New storyboard", "Scene counter back to 1. Your character sheet is kept.");
    render();
  }
  function readInputs() {
    if (R.desc && R.desc.isConnected) S.desc = R.desc.value;
    if (R.idea && R.idea.isConnected) S.idea = R.idea.value;
  }
  function focusInput() { setTimeout(function () { try { var el = S.mode === "sketch" ? R.desc : R.idea; if (el && window.innerWidth >= 700) el.focus(); } catch (e) {} }, 0); }

  // ---- UI -----------------------------------------------------------------------------------------------
  var CSS = "" +
    ".pmk-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".pmk-title{font-size:18px;font-weight:800;color:#f8fafc}" +
    ".pmk-badge{font:800 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;padding:4px 6px;border-radius:5px;background:var(--acc);color:#05070d}" +
    ".pmk-sub{margin-top:4px;color:#94a3b8;font-size:12.5px;line-height:1.45}" +
    ".pmk-seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}" +
    ".pmk-seg>.pml-k{flex:0 0 92px}" +
    ".pmk-seg .pml-btn{min-height:44px}" +
    ".pmk .pml-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));max-height:min(40vh,340px)}" +
    ".pmk-style.on .pml-g{color:#bae6fd}" +
    ".pmk-sel{margin-top:6px;font-size:12px;line-height:1.45;color:#94a3b8}.pmk-sel b{color:#e2e8f0}" +
    ".pmk-ta{display:block;width:100%;min-height:76px;resize:vertical;font-size:16px;line-height:1.4;font-family:inherit;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;outline:none;margin-top:10px}" +
    ".pmk-ta:focus{border-color:var(--acc)}" +
    ".pmk-field{margin-top:10px}" +
    ".pmk-sheet{margin-top:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;background:rgba(0,0,0,.2)}" +
    ".pmk-sheet summary{cursor:pointer;min-height:40px;display:flex;align-items:center;gap:8px;color:#e2e8f0;font-size:13px;font-weight:700}" +
    ".pmk-char{display:grid;grid-template-columns:minmax(90px,.32fr) 1fr 44px;gap:6px;margin-top:6px;align-items:stretch}" +
    ".pmk-char .pml-in,.pmk-pal .pml-in{min-width:0;width:100%;flex:none}" +
    ".pmk-char .pml-in[readonly],.pmk-pal .pml-in[readonly]{opacity:.7}" +
    ".pmk-x{min-width:44px;min-height:44px;padding:0}" +
    ".pmk-pal{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;margin-top:8px}" +
    ".pmk-scene{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-top:12px;padding:8px 10px;border:1px dashed rgba(125,211,252,.35);border-radius:10px}" +
    ".pmk-sn{font:800 14px ui-monospace,Menlo,monospace;letter-spacing:.2em;color:#fff}" +
    ".pmk-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.pmk-actions .pml-btn{min-height:44px}" +
    ".pmk-tip{margin-top:6px;color:#94a3b8;font-size:12px;line-height:1.45}" +
    ".pmk-board{margin-top:12px}.pmk-board summary{cursor:pointer;min-height:40px;display:flex;align-items:center;color:#e2e8f0;font-size:13px;font-weight:700}" +
    ".pmk-bi{display:flex;gap:8px;align-items:flex-start;margin-top:6px}" +
    ".pmk-bi>button:first-child{flex:1 1 auto;text-align:left;min-height:44px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#cbd5e1;font-size:12px;line-height:1.35;cursor:pointer}" +
    ".pmk-bi>button.on{border-color:var(--acc);color:#fff}" +
    ".pmk-bi b{font-family:ui-monospace,Menlo,monospace;color:#fff;margin-right:6px}" +
    ".pmk-danger{border-color:rgba(248,113,113,.5)!important;color:#fecaca!important}" +
    "@media (max-width:640px){.pmk-seg>.pml-k{flex:1 0 100%}.pmk-seg>.pml-btn{flex:1 1 0;padding:8px 6px}.pmk .pml-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}" +
    ".pmk-char{grid-template-columns:1fr 44px}.pmk-char .pmk-cd{grid-column:1/-1}.pmk-actions .pml-btn{flex:1 1 calc(50% - 8px)}.pmk-scene .pml-btn{flex:1 1 auto}}";
  var R = {};
  function h() { return X.h.apply(null, arguments); }
  function seg(label, key, opts, pm, onPick) {
    var row = h("div", { cls: "pmk-seg", role: "radiogroup", "aria-label": label, "data-pm": pm }, [h("span", { cls: "pml-k", text: label })]);
    opts.forEach(function (o) {
      var at = { cls: "pml-btn pml-cam" + (S[key] === o[0] ? " on" : ""), type: "button", role: "radio", "aria-checked": S[key] === o[0] ? "true" : "false", text: o[1],
        on: { click: function () { readInputs(); S[key] = o[0]; if (onPick) onPick(o[0]); save(); render(); } } };
      at["data-" + key] = o[0];
      row.appendChild(h("button", at));
    });
    return row;
  }
  function setNotice(msg) { S.notice = msg || ""; if (R.note) { R.note.textContent = S.notice; R.note.style.display = S.notice ? "" : "none"; } }
  function render() {
    var el = S.el; if (!el) return;
    if (!document.getElementById("pmk-css")) document.head.appendChild(h("style", { id: "pmk-css", text: CSS }));
    el.innerHTML = "";
    var st = styleById(S.style), lockStyle = locked() && BD.length > 0 && boardStyle();
    el.appendChild(h("div", { cls: "pmk-head" }, [h("span", { cls: "pmk-title", text: "\u270f\ufe0f Cartoon Maker" }), h("span", { cls: "pmk-badge", text: "NEW" }),
      h("span", { cls: "pml-k", text: STYLES.length + " styles" })]));
    el.appendChild(h("div", { cls: "pmk-sub", text: "Finish your own sketch into a cartoon, or write a cartoon scene from an idea, scene by scene. No upload here: attach your sketch in Grok or ChatGPT and paste this prompt with it." }));
    el.appendChild(seg("Mode", "mode", [["sketch", "\u270f\ufe0f From my sketch"], ["prompt", "\ud83d\udcac From prompt"]], "cartoon-mode"));
    el.appendChild(seg("For", "target", TARGETS, "cartoon-target"));

    // Style picker
    var chips = h("div", { cls: "pml-chips", role: "tablist", "data-pm": "cartoon-groups" });
    GROUPS.forEach(function (g) {
      var n = g === "All" ? STYLES.length : STYLES.filter(function (s) { return s.grp === g; }).length;
      chips.appendChild(h("button", { cls: "pml-chip" + (S.grp === g ? " on" : ""), type: "button", "data-kgrp": g, on: { click: function () { readInputs(); S.grp = g; save(); render(); } } },
        [g, h("span", { cls: "pmc-n", text: String(n) })]));
    });
    el.appendChild(h("div", { cls: "pml-k", style: "margin-top:12px", text: "Drawing style" + (lockStyle ? " \u00b7 locked to this storyboard" : "") }));
    el.appendChild(chips);
    R.grid = h("div", { cls: "pml-grid", "data-pm": "cartoon-styles", role: "radiogroup", "aria-label": "Drawing style" });
    STYLES.forEach(function (s) {
      if (S.grp !== "All" && s.grp !== S.grp) return;
      var dis = lockStyle && s.id !== S.style;
      R.grid.appendChild(h("button", { cls: "pml-look pmk-style" + (S.style === s.id ? " on" : ""), type: "button", role: "radio", "aria-checked": S.style === s.id ? "true" : "false",
        "data-style": s.id, disabled: dis ? true : null, title: dis ? "Locked to this storyboard's style \u2014 unlock the sheet or start a new storyboard" : s.medium,
        on: { click: function () { pickStyle(s); } } },
        [s.name, s.look ? h("span", { cls: "pml-tag pmc-style", title: "Also a Cinema look (Comics & Animation)", text: "LOOK" }) : null, h("span", { cls: "pml-g", text: s.grp + " \u00b7 " + s.tag })]));
    });
    el.appendChild(R.grid);
    R.sel = h("div", { cls: "pmk-sel", "data-pm": "cartoon-style-sel" });
    fillSel(st);
    el.appendChild(R.sel);

    // Mode inputs
    if (S.mode === "sketch") {
      R.idea = null;
      R.desc = h("textarea", { cls: "pmk-ta", placeholder: "What's in your sketch? (optional) e.g. a rapper and his robot dog on a rooftop, city behind them", "aria-label": "Describe your sketch (optional)",
        "data-pm": "cartoon-desc", maxlength: "300", rows: "3", on: { input: function (e) { S.desc = e.target.value; save(); } } });
      R.desc.value = S.desc;
      el.appendChild(R.desc);
      el.appendChild(seg("Faithfulness", "faith", [["strict", "Strict trace"], ["balanced", "Balanced"], ["creative", "Creative"]], "cartoon-faith"));
    } else {
      R.desc = null;
      R.idea = h("input", { cls: "pml-in", type: "text", placeholder: "Scene idea (e.g. two friends racing shopping carts through a neon parking lot)", "aria-label": "Scene idea",
        "data-pm": "cartoon-idea", autocomplete: "off", enterkeyhint: "go", maxlength: "240", on: {
          input: function (e) { S.idea = e.target.value; save(); },
          keydown: function (e) { if (e.key === "Enter") { e.preventDefault(); generate(); } } } });
      R.idea.value = S.idea;
      el.appendChild(h("div", { cls: "pml-row pmk-field" }, [R.idea,
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-dice", style: "min-height:44px", title: "Random scene idea", text: "\ud83c\udfb2 Idea",
          on: { click: function () { S.idea = pk("idea", IDEAS); R.idea.value = S.idea; save(); } } })]));
    }
    el.appendChild(seg("Frame", "frame", [["auto", S.mode === "sketch" ? "Match sketch" : "Style default"], ["wide", "Wide"], ["square", "Square"], ["tall", "Tall"]], "cartoon-frame"));

    // Character sheet
    var sheet = h("details", { cls: "pmk-sheet", "data-pm": "cartoon-sheet", open: SH.chars.length || window.innerWidth >= 900 ? true : null });
    sheet.appendChild(h("summary", {}, ["\ud83e\uddfe Character sheet", h("span", { cls: "pml-k", text: SH.chars.length + " character" + (SH.chars.length === 1 ? "" : "s") + (locked() ? " \u00b7 locked" : "") })]));
    sheet.appendChild(h("div", { cls: "pmk-tip", style: "margin-top:0", text: "Restated in every scene prompt so the same characters, style and palette carry through. People are drawn as adults (21+); animals, robots and creatures are fine." }));
    SH.chars.forEach(function (c, i) {
      var nm = h("input", { cls: "pml-in", type: "text", placeholder: "Name", "aria-label": "Character " + (i + 1) + " name", "data-pm": "cartoon-char-name", maxlength: "40", value: c.name || "",
        readonly: locked() ? true : null, on: { input: function (e) { SH.chars[i].name = e.target.value; saveSheet(); } } });
      var ds = h("input", { cls: "pml-in pmk-cd", type: "text", placeholder: "Look: adult woman, tall, box braids, red bomber jacket, gold hoops", "aria-label": "Character " + (i + 1) + " description",
        "data-pm": "cartoon-char-desc", maxlength: "220", value: c.desc || "", readonly: locked() ? true : null, on: { input: function (e) { SH.chars[i].desc = e.target.value; saveSheet(); } } });
      var del = h("button", { cls: "pml-btn pmk-x", type: "button", "data-pm": "cartoon-char-del", "aria-label": "Remove character " + (i + 1), text: "\u2715", disabled: locked() ? true : null,
        on: { click: function () { SH.chars.splice(i, 1); saveSheet(); render(); } } });
      sheet.appendChild(h("div", { cls: "pmk-char" }, [nm, del, ds]));
    });
    var pal = h("input", { cls: "pml-in", type: "text", placeholder: st.palette, "aria-label": "Palette (optional)", "data-pm": "cartoon-palette", maxlength: "120", value: SH.palette,
      readonly: locked() ? true : null, on: { input: function (e) { SH.palette = e.target.value; saveSheet(); } } });
    sheet.appendChild(h("div", { cls: "pmk-pal" }, [h("span", { cls: "pml-k", text: "Palette" }), pal]));
    sheet.appendChild(h("div", { cls: "pml-row", style: "margin-top:8px" }, [
      h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-add-char", style: "min-height:44px", disabled: locked() || SH.chars.length >= 6 ? true : null, text: "+ Add character",
        on: { click: function () { SH.chars.push({ name: "", desc: "" }); saveSheet(); render(); var n = S.el.querySelectorAll("[data-pm=cartoon-char-name]"); try { n[n.length - 1].focus(); } catch (e) {} } } }),
      h("button", { cls: "pml-toggle" + (locked() ? " on" : ""), type: "button", "data-pm": "cartoon-lock", "aria-pressed": locked() ? "true" : "false", style: "min-height:44px",
        title: "Locked: characters, palette and style stay fixed for every scene", on: { click: function () { SH.lock = !SH.lock; saveSheet(); render(); } } },
        [h("span", { cls: "pml-sw" }), locked() ? "\ud83d\udd12 Locked" : "\ud83d\udd13 Unlocked"])
    ]));
    el.appendChild(sheet);

    // Scene bar
    el.appendChild(h("div", { cls: "pmk-scene", "data-pm": "cartoon-scenebar" }, [
      h("span", { cls: "pmk-sn", "data-pm": "cartoon-scene-n", text: "SCENE " + S.scene }),
      h("span", { cls: "pml-k", text: BD.length + " in storyboard" }),
      h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-next", style: "min-height:44px", text: "Next scene \u25b6", on: { click: nextScene } })
    ]));
    R.note = h("div", { cls: "pml-note", "data-pm": "cartoon-notice", style: S.notice ? "" : "display:none", text: S.notice });
    el.appendChild(R.note);
    var hasCur = S.result && S.result.n === S.scene;
    el.appendChild(h("button", { cls: "pml-remix", type: "button", "data-pm": "cartoon-go", style: "margin-top:12px", text: hasCur ? "REMIX AGAIN" : "MAKE SCENE " + S.scene + " PROMPT", on: { click: generate } }));

    if (S.result) {
      var res = S.result;
      el.appendChild(h("div", { cls: "pml-k", style: "margin-top:12px", text: "Scene " + res.n + " \u00b7 " + tName(res.target) + " \u00b7 " + (res.mode === "sketch" ? "from sketch" : "from prompt") + " \u00b7 " + styleById(res.style).name + " \u00b7 in Prompt Output" }));
      el.appendChild(h("div", { cls: "pmk-actions", "data-pm": "cartoon-actions" }, [
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-copy", text: "Copy", on: { click: function () { X.copyText(res.text, function () { toast("Prompt copied", tipText(res)); }); } } }),
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-again", text: "Remix again", on: { click: generate } }),
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-open", text: "Open in Prompt Output", on: { click: function () { try { S.api.current.setPrompt(res.text); S.api.current.go("output"); } catch (e) {} } } }),
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-clear", text: "Clear", on: { click: clearCurrent } })
      ]));
      el.appendChild(h("div", { cls: "pml-out", "data-pm": "cartoon-result", text: res.text }));
      el.appendChild(h("div", { cls: "pmk-tip", "data-pm": "cartoon-tip", text: tipText(res) }));
    }

    // Storyboard
    if (BD.length) {
      var bd = h("details", { cls: "pmk-board", "data-pm": "cartoon-board", open: true }, [h("summary", { text: "\ud83c\udf9e Storyboard \u00b7 " + BD.length + " scene" + (BD.length === 1 ? "" : "s") })]);
      BD.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (b) {
        var label = (b.input || (b.mode === "sketch" ? "sketch" : "scene")).slice(0, 80);
        bd.appendChild(h("div", { cls: "pmk-bi" }, [
          h("button", { type: "button", cls: b.n === S.scene ? "on" : "", "data-pm": "cartoon-board-item", "data-n": String(b.n), title: "Open scene " + b.n, on: { click: function () { openScene(b); } } },
            [h("b", { text: b.n + "." }), label + " \u00b7 " + styleById(b.style).name + " \u00b7 " + tName(b.target)]),
          h("button", { cls: "pml-btn", type: "button", style: "min-height:44px", "aria-label": "Copy scene " + b.n, text: "Copy", on: { click: function () { X.copyText(b.text, function () { toast("Scene " + b.n + " copied", ""); }); } } })
        ]));
      });
      bd.appendChild(h("div", { cls: "pmk-actions" }, [
        h("button", { cls: "pml-btn", type: "button", "data-pm": "cartoon-copy-board", text: "\ud83d\udccb Copy storyboard (" + BD.length + ")",
          on: { click: function () { X.copyText(storyboardText(), function () { toast("Storyboard copied", BD.length + " numbered scene prompts"); }); } } }),
        h("button", { cls: "pml-btn" + (S.resetArm ? " pmk-danger" : ""), type: "button", "data-pm": "cartoon-reset-board", text: S.resetArm ? "Tap again to reset" : "New storyboard", on: { click: resetBoard } })
      ]));
      el.appendChild(bd);
    }
  }
  function tipText(res) {
    if (res.mode === "sketch") return res.target === "grok" ? "In Grok: attach your sketch (paperclip), paste this prompt in the same message, send."
      : res.target === "chatgpt" ? "In ChatGPT: tap + to attach your sketch, paste this prompt in the same message, send."
      : "In an image-to-image tool: load your sketch as the init / reference image, paste the prompt and negative prompt, use the suggested strength.";
    return res.target === "grok" ? "Paste into Grok (chat or Imagine) and send." : res.target === "chatgpt" ? "Paste into ChatGPT and send." : "Paste the prompt and negative prompt into any image model.";
  }
  function fillSel(st) {
    R.sel.innerHTML = "";
    R.sel.appendChild(h("b", { text: st.name }));
    R.sel.appendChild(document.createTextNode(" \u2014 " + st.medium + "; " + st.line + "; " + st.color + "."));
  }
  function pickStyle(s) {
    if (locked() && BD.length && boardStyle() && s.id !== boardStyle()) { setNotice("Style is locked to this storyboard. Unlock the character sheet or start a New storyboard to switch."); return; }
    S.style = s.id; save();
    [].forEach.call(R.grid.querySelectorAll("[data-style]"), function (b) { var on = b.getAttribute("data-style") === s.id; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
    fillSel(s);
    var p = S.el.querySelector("[data-pm=cartoon-palette]"); if (p) p.setAttribute("placeholder", s.palette);
  }
  function onClearAll() { S.result = null; S.notice = ""; save(); if (S.el) render(); }

  window.PMCartoon = {
    version: V,
    styles: STYLES,
    mount: function (el, apiRef, kit) {
      K = kit; X = kit.X; S.el = el; S.api = apiRef; load(); render();
    },
    unmount: function (el) { if (S.el === el) S.el = null; },
    // Test hooks
    _build: function (o) {
      o = o || {};
      var keep = SH; if (o.sheet) SH = { chars: o.sheet.chars || [], palette: o.sheet.palette || "", lock: !!o.sheet.lock };
      var r = build({ mode: o.mode || "sketch", target: o.target || "grok", style: o.style || "saturday-90s", faith: o.faith || "balanced", frame: o.frame || "auto", text: o.text || "", scene: o.scene || 1 });
      SH = keep;
      return { text: r.text || "", refused: !!r.refused, needIdea: !!r.needIdea, notice: noticeFrom(r.msgs) };
    },
    _state: function () { return { S: JSON.parse(JSON.stringify({ mode: S.mode, target: S.target, style: S.style, scene: S.scene })), sheet: JSON.parse(JSON.stringify(SH)), board: BD.length }; },
    _storyboard: storyboardText
  };
  window.addEventListener("pm:clear-all", onClearAll);
})();
