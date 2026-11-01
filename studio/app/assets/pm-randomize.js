/* Zig's Prompt Machine — 🎲 Randomize (v20261031b)
   window.PMRand: small 🎲 buttons next to each section.
   - One cheap Grok call per press (worker action "randomize": xAI grok non-reasoning, ~$0.001, counted in the daily $3 cap;
     over cap / xAI error -> free OpenRouter; offline -> free local pools below). Toast says which one answered.
   - Every press differs from recent picks (localStorage "pm.rand.hist.v1").
   - Adults 21+ only, never teen/school/family wording, no real people.
   - Zig's own words win: a field set to one of his typed (+ Add) chips is locked for section rolls, and his chips go to the AI as must_keep.
   - Cast free-text (role / outfit / pose / notes) is never touched. */
(function () {
  "use strict";
  var V = "20261031b", HK = "pm.rand.hist.v1", XK = "pm.rand.extra.v1", CV = "flux-character-builder:custom-options";
  var BAD = /\b(?:teen\w*|tweens?|young(?:er|est|ish)?|youthful|jail[\s-]?bait|baby[\s-]?fac\w*|child\w*|kids?|girlish|school\w*|college|student|under[\s-]?age\w*|minors?|barely[\s-]+legal|loli\w*|shota\w*|petite[\s-]?young|step[\s-]?(?:mom|mother|sis|bro|dad|father|daughter|son)\w*|famil(?:y|ies)|sisters?|brothers?|daughters?|sons?|mommy|daddy|incest|taboo|celebrit\w*|look[\s-]?alike|in the style of)\b|\b(?:1[0-9]|20)\s*(?:yo|y\/o|years?\s*old)\b/i;
  var ADULT_W = /nsfw|xxx|porn|nude|naked|sex|explicit|fetish|kink|strip|boudoir|burlesque|lingerie|pole|adult content|centerfold|milf|cougar|bbw|futanari|thirst|twerk|booty|hentai|onlyfans/i;
  function J(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function lc(x) { return String(x == null ? "" : x).toLowerCase().trim(); }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { var k = lc(x); if (x && !s[k]) { s[k] = 1; o.push(x); } }); return o; }
  function ctx() { try { return window.PMCtx ? window.PMCtx.read() : {}; } catch (e) { return {}; } }
  function adultOn(c) { c = c || ctx(); if (c.adult) return true; var s = st(); return !!(s && s.nsfwEnabled && s.ageConfirmed); }
  function ok(x, adult) { x = String(x == null ? "" : x); return !!x.trim() && !BAD.test(x) && (adult || !ADULT_W.test(x)); }
  function st() { var c = window.__pmChar; return c && c.state ? c.state : J("flux-character-builder:draft", {}); }
  var DEF = {"bodyType": {"p": "details", "l": "Body Type", "sk": "bodyType", "m": false, "c": "te", "o": ["slim", "athletic", "curvy", "muscular", "petite", "plus-size", "androgynous", "tall lean", "short stocky", "voluptuous", "hourglass", "pear", "apple", "rectangular", "inverted triangle"]}, "gender": {"p": "details", "l": "Gender", "sk": "", "m": false, "c": "tr", "o": ["female", "male", "non-binary", "androgynous"]}, "ethnicity": {"p": "details", "l": "Ethnicity / Heritage", "sk": "ethnicity", "m": false, "c": "te", "o": ["european", "east asian", "south asian", "southeast asian", "middle eastern", "african", "african american", "latina", "latino", "native american", "pacific islander", "mixed heritage", "nordic", "mediterranean", "slavic"]}, "skinTone": {"p": "details", "l": "Skin Tone", "sk": "", "m": false, "c": "tr", "o": ["fair", "light", "medium", "olive", "tan", "bronze", "dark", "deep", "porcelain", "ebony"]}, "skinDetails": {"p": "details", "l": "Skin Details (multi-select)", "sk": "skinDetails", "m": true, "c": "te", "o": ["freckles", "beauty mark", "dimples", "rosy cheeks", "glossy skin", "matte skin", "dewy skin", "smooth skin", "sun-kissed", "pale complexion", "tanned", "scattered freckles", "cheek mole"]}, "faceShape": {"p": "details", "l": "Face Shape", "sk": "", "m": false, "c": "tr", "o": ["oval", "round", "square", "heart", "diamond", "oblong", "triangular", "rectangular"]}, "eyeColor": {"p": "details", "l": "Eye Color", "sk": "", "m": false, "c": "tr", "o": ["brown", "dark brown", "blue", "sky blue", "green", "emerald", "hazel", "grey", "amber", "violet", "gold", "heterochromia"]}, "eyeShape": {"p": "details", "l": "Eye Shape", "sk": "", "m": false, "c": "tr", "o": ["almond", "round", "hooded", "monolid", "upturned", "downturned", "wide-set", "close-set", "deep-set", "protruding"]}, "makeup": {"p": "details", "l": "Makeup", "sk": "makeup", "m": false, "c": "te", "o": ["none", "natural", "no-makeup makeup", "soft glam", "glam", "smoky eye", "cat eye", "winged liner", "red lips", "nude lips", "glossy lips", "bold blush", "dewy", "gothic", "cyberpunk", "editorial", "theatrical", "fantasy", "metallic eyeshadow", "glitter"]}, "facialHair": {"p": "details", "l": "Facial Hair", "sk": "facialHair", "m": false, "c": "te", "o": ["clean shaven", "stubble", "short beard", "full beard", "long beard", "goatee", "mustache", "handlebar mustache", "soul patch", "sideburns", "mutton chops", "van dyke", "circle beard", "designer stubble"]}, "height": {"p": "body", "l": "Height", "sk": "", "m": false, "c": "tr", "o": ["very short", "short", "below average", "average", "above average", "tall", "very tall", "towering"]}, "build": {"p": "body", "l": "Build", "sk": "build", "m": false, "c": "te", "o": ["slim", "lean", "toned", "athletic", "muscular", "average", "curvy", "voluptuous", "full-figured", "bodybuilder", "wiry", "stocky", "bulky", "soft", "svelte"]}, "breastSize": {"p": "body", "l": "Chest / Bust Size", "sk": "", "m": false, "c": "tr", "o": ["flat", "small", "medium", "large", "very large"]}, "hipRatio": {"p": "body", "l": "Hip Ratio", "sk": "", "m": false, "c": "tr", "o": ["narrow", "slim", "average", "wide", "very wide"]}, "waist": {"p": "body", "l": "Waist", "sk": "", "m": false, "c": "tr", "o": ["cinched", "slim", "defined", "average", "fuller", "soft"]}, "posture": {"p": "body", "l": "Posture & Stance", "sk": "posture", "m": false, "c": "te", "o": ["upright", "relaxed", "confident", "regal", "casual", "slouched", "powerful stance", "graceful", "tense", "inviting", "closed off", "contrapposto"]}, "bodyMarkings": {"p": "body", "l": "Body Markings (multi-select)", "sk": "bodyMarkings", "m": true, "c": "te", "o": ["no markings", "sleeve tattoo", "back tattoo", "chest tattoo", "small tattoo", "tribal tattoo", "floral tattoo", "geometric tattoo", "birthmark", "scar across cheek", "scar on eyebrow", "battle scars", "freckled shoulders", "ear piercings", "nose ring", "septum piercing", "lip ring", "eyebrow piercing"]}, "nailStyle": {"p": "body", "l": "Nail Style", "sk": "nailStyle", "m": false, "c": "te", "o": ["short natural", "manicured", "french tip", "long sharp", "stiletto nails", "almond nails", "square nails", "painted black", "red nails", "glitter nails", "chrome nails", "art nails", "bare nails"]}, "hairLength": {"p": "hair", "l": "Length", "sk": "", "m": false, "c": "tr", "o": ["bald", "buzz cut", "very short", "short", "chin length", "shoulder length", "medium", "long", "very long", "waist length", "floor length"]}, "hairStyle": {"p": "hair", "l": "Style", "sk": "hairStyle", "m": false, "c": "te", "o": ["straight", "wavy", "curly", "kinky", "coily", "braided", "french braid", "dutch braid", "box braids", "cornrows", "dreadlocks", "afro", "crimped", "beachy waves"]}, "hairCut": {"p": "hair", "l": "Cut", "sk": "hairCut", "m": false, "c": "te", "o": ["pixie", "bob", "lob", "layered", "blunt", "bangs", "curtain bangs", "wispy bangs", "side swept", "undercut", "faux hawk", "mohawk", "shag", "wolf cut", "mullet", "taper fade"]}, "hairTexture": {"p": "hair", "l": "Texture", "sk": "", "m": false, "c": "tr", "o": ["silky", "glossy", "matte", "voluminous", "fine", "thick", "frizzy", "sleek", "tousled", "windswept"]}, "hairSpecial": {"p": "hair", "l": "Special Styles / Updos", "sk": "hairSpecial", "m": false, "c": "te", "o": ["twin tails", "ponytail", "high ponytail", "low ponytail", "side ponytail", "high bun", "low bun", "messy bun", "space buns", "half-up", "top knot", "french twist", "chignon", "crown braid", "milkmaid braid", "flower crown", "hair pinned back"]}, "clothingCategory": {"p": "clothing", "l": "Category", "sk": "clothingCategory", "m": false, "c": "te", "o": ["casual", "streetwear", "formal", "business", "evening wear", "fantasy", "high fantasy", "medieval", "sci-fi", "cyberpunk", "steampunk", "historical", "victorian", "edwardian", "1920s", "1950s", "1980s", "uniform", "military", "athletic", "swimwear", "lingerie", "traditional", "kimono", "kpop", "goth", "punk", "cottagecore", "dark academia", "y2k"]}, "top": {"p": "clothing", "l": "Tops", "sk": "top", "m": false, "c": "te", "o": ["t-shirt", "tank top", "crop top", "blouse", "shirt", "button-up", "hoodie", "sweater", "turtleneck", "cardigan", "blazer", "suit jacket", "leather jacket", "denim jacket", "trench coat", "corset", "bustier", "bralette", "armor", "breastplate", "chainmail", "robe", "cloak", "kimono", "cheongsam", "bodysuit", "jumpsuit", "tunic"]}, "bottom": {"p": "clothing", "l": "Bottoms", "sk": "bottom", "m": false, "c": "te", "o": ["jeans", "skinny jeans", "wide-leg pants", "cargo pants", "leggings", "tights", "shorts", "short shorts", "denim shorts", "mini skirt", "pencil skirt", "pleated skirt", "maxi skirt", "dress", "mini dress", "maxi dress", "cocktail dress", "ballgown", "sundress", "pants", "trousers", "armor skirt", "hakama"]}, "footwear": {"p": "clothing", "l": "Footwear", "sk": "footwear", "m": false, "c": "te", "o": ["sneakers", "high tops", "combat boots", "ankle boots", "thigh-high boots", "heels", "stilettos", "platform heels", "flats", "ballet flats", "oxfords", "loafers", "sandals", "gladiator sandals", "barefoot", "armor boots", "geta", "tabi socks"]}, "accessories": {"p": "clothing", "l": "Accessories (multi-select)", "sk": "accessories", "m": true, "c": "te", "o": ["glasses", "sunglasses", "cat-eye glasses", "hat", "fedora", "beret", "beanie", "cap", "crown", "tiara", "circlet", "necklace", "choker", "pearl necklace", "jewelry", "earrings", "rings", "bracelet", "scarf", "gloves", "fingerless gloves", "cape", "cloak", "wings", "tail", "animal ears", "horns", "halo", "mask", "eyepatch", "backpack", "belt", "tie", "bow tie", "suspenders"]}, "outfitMaterial": {"p": "clothing", "l": "Fabric / Material", "sk": "outfitMaterial", "m": false, "c": "te", "o": ["cotton", "linen", "silk", "satin", "velvet", "velour", "lace", "denim", "leather", "patent leather", "suede", "wool", "cashmere", "tweed", "chiffon", "tulle", "mesh", "fishnet", "PVC", "latex", "metallic", "sequined", "embroidered", "knit", "fur", "faux fur"]}, "expression": {"p": "expression", "l": "Facial Expression", "sk": "expression", "m": false, "c": "te", "o": ["neutral", "soft smile", "smile", "grin", "smirk", "laugh", "giggle", "serious", "pensive", "thoughtful", "sad", "melancholy", "angry", "furious", "surprised", "shocked", "shy", "blushing", "seductive", "sultry", "determined", "fierce", "mischievous", "tired", "dreamy", "crying", "tearful", "concentrated", "bored", "curious"]}, "eyeContact": {"p": "expression", "l": "Eye Contact", "sk": "", "m": false, "c": "tr", "o": ["looking at viewer", "looking away", "looking up", "looking down", "looking back", "closed eyes", "half-closed eyes", "winking", "side glance"]}, "pose": {"p": "expression", "l": "Pose", "sk": "pose", "m": false, "c": "te", "o": ["standing", "standing tall", "leaning", "sitting", "sitting cross-legged", "kneeling", "crouching", "lying down", "lying on stomach", "lying on back", "walking", "running", "jumping", "action pose", "dancing", "spinning", "fighting stance", "arms crossed", "hands on hips", "arms raised", "holding weapon", "casting spell", "twirling hair", "arched back", "hugging knees"]}, "handGesture": {"p": "expression", "l": "Hand Gesture", "sk": "handGesture", "m": false, "c": "te", "o": ["relaxed hands", "peace sign", "finger guns", "thumbs up", "pointing", "waving", "hand on chin", "hand on cheek", "hand on hip", "hand through hair", "hands clasped", "hands in pockets", "open palms", "fist clenched", "praying hands", "finger to lips", "holding something"]}, "cameraAngle": {"p": "expression", "l": "Camera Angle / Framing", "sk": "cameraAngle", "m": false, "c": "te", "o": ["front view", "side view", "profile view", "3/4 view", "from above", "bird's eye view", "from below", "worm's eye view", "over the shoulder", "dutch angle", "close-up portrait", "extreme close-up", "full body", "upper body", "bust shot", "cowboy shot", "wide shot", "extreme wide shot"]}, "setting": {"p": "expression", "l": "Setting / Background", "sk": "setting", "m": false, "c": "te", "o": ["plain white background", "plain black background", "gradient background", "studio", "bokeh background", "outdoor nature", "forest", "meadow", "mountains", "desert", "jungle", "city street", "rooftop", "alleyway", "subway", "cafe", "library", "bedroom", "living room", "kitchen", "bathroom", "beach", "underwater", "space", "fantasy landscape", "enchanted forest", "medieval castle", "throne room", "tavern", "dungeon", "cyberpunk city", "neon street", "spaceship interior", "apocalyptic ruins", "abstract", "flower field", "cherry blossoms", "snowy landscape"]}, "timeOfDay": {"p": "scene", "l": "Time of Day", "sk": "timeOfDay", "m": false, "c": "te", "o": ["sunrise", "dawn", "early morning", "morning", "midday", "afternoon", "late afternoon", "golden hour", "sunset", "dusk", "twilight", "blue hour", "evening", "night", "midnight", "witching hour", "pre-dawn"]}, "weather": {"p": "scene", "l": "Weather", "sk": "weather", "m": false, "c": "te", "o": ["clear sky", "sunny", "partly cloudy", "overcast", "cloudy", "foggy", "misty", "hazy", "rainy", "light rain", "heavy rain", "thunderstorm", "lightning", "snowy", "blizzard", "flurries", "windy", "sandstorm", "aurora borealis", "rainbow", "humid"]}, "season": {"p": "scene", "l": "Season", "sk": "season", "m": false, "c": "te", "o": ["spring", "early spring", "late spring", "summer", "high summer", "autumn", "late autumn", "winter", "deep winter"]}, "atmosphere": {"p": "scene", "l": "Atmosphere", "sk": "atmosphere", "m": false, "c": "te", "o": ["ethereal", "dreamy", "mystical", "magical", "cinematic", "epic", "serene", "peaceful", "tense", "foreboding", "ominous", "eerie", "whimsical", "romantic", "nostalgic", "melancholic", "hopeful", "triumphant", "haunting", "cozy", "intimate", "oppressive", "liberating", "dystopian", "utopian"]}, "mood": {"p": "scene", "l": "Mood / Emotional Tone", "sk": "mood", "m": false, "c": "te", "o": ["joyful", "somber", "mysterious", "playful", "serious", "dramatic", "lighthearted", "dark", "moody", "vibrant", "melancholic", "pensive", "tranquil", "energetic", "sensual", "powerful", "vulnerable", "confident", "wistful", "reflective"]}, "environmentDetail": {"p": "scene", "l": "Environment Detail (multi-select)", "sk": "environmentDetail", "m": true, "c": "te", "o": ["falling leaves", "falling cherry blossoms", "falling snow", "rain droplets", "floating embers", "fireflies", "butterflies", "sparkles", "dust particles", "glowing pollen", "fog rolling in", "smoke", "steam", "crashing waves", "rippling water", "reflections", "puddles", "stars overhead", "full moon", "crescent moon", "meteor shower", "lanterns", "fairy lights", "candles", "neon signs", "holographic displays", "wind in hair", "tall grass", "flower petals", "autumn leaves on ground"]}, "medium": {"p": "style", "l": "Medium", "sk": "medium", "m": false, "c": "te", "o": ["photograph", "film photograph", "polaroid", "professional photoshoot", "editorial photograph", "oil painting", "acrylic painting", "watercolor painting", "gouache", "ink wash", "pencil drawing", "charcoal drawing", "pastel drawing", "digital painting", "digital illustration", "matte painting", "3D render", "sculpture", "mixed media", "collage", "screen print", "lithograph", "woodcut", "comic panel", "storyboard"]}, "artistRefs": {"p": "style", "l": "Artist References (multi-select)", "sk": "artistRefs", "m": true, "c": "te", "o": ["Greg Rutkowski", "Artgerm", "Ross Tran", "WLOP", "Loish", "Ilya Kuvshinov", "Alphonse Mucha", "Gustav Klimt", "John Singer Sargent", "Caravaggio", "Rembrandt", "Vincent van Gogh", "Claude Monet", "Edgar Degas", "Studio Ghibli", "Makoto Shinkai", "Hayao Miyazaki", "Yoshitaka Amano", "H.R. Giger", "Zdzislaw Beksinski", "Frank Frazetta", "Boris Vallejo", "Norman Rockwell", "James Jean", "Moebius", "Syd Mead", "Annie Leibovitz", "Helmut Newton", "Mario Testino", "Tim Walker", "Beeple", "Simon Stalenhag", "Craig Mullins"]}, "colorPalette": {"p": "style", "l": "Color Palette", "sk": "colorPalette", "m": false, "c": "te", "o": ["warm tones", "cool tones", "muted", "desaturated", "vibrant", "high saturation", "pastel palette", "monochrome", "sepia", "black and white", "duotone", "split complementary", "analogous", "triadic", "jewel tones", "earth tones", "neon palette", "pastel pink and blue", "orange and teal", "red and black", "gold and ivory", "forest greens", "ocean blues", "sunset palette", "cyberpunk palette", "film noir grayscale", "Wes Anderson palette"]}, "renderEngine": {"p": "style", "l": "Render Engine / Technique", "sk": "renderEngine", "m": false, "c": "te", "o": ["octane render", "unreal engine 5", "unity render", "blender render", "arnold render", "redshift render", "vray render", "ray tracing", "path tracing", "global illumination", "subsurface scattering", "physically based rendering", "PBR materials", "photogrammetry", "volumetric rendering", "cycles render"]}, "era": {"p": "style", "l": "Era / Period", "sk": "era", "m": false, "c": "te", "o": ["prehistoric", "ancient", "classical antiquity", "medieval", "renaissance", "baroque", "rococo", "georgian", "regency", "victorian", "edwardian", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "modern", "near future", "far future", "post-apocalyptic", "retrofuturistic", "atompunk", "dieselpunk"]}, "lens": {"p": "style", "l": "Lens", "sk": "lens", "m": false, "c": "te", "o": ["24mm wide angle", "35mm", "50mm", "85mm portrait", "105mm", "135mm", "200mm telephoto", "macro lens", "fisheye lens", "tilt-shift", "anamorphic lens", "vintage lens"]}, "filmStock": {"p": "style", "l": "Film Stock / Look", "sk": "filmStock", "m": false, "c": "te", "o": ["Kodak Portra 400", "Kodak Gold 200", "Fuji Pro 400H", "Cinestill 800T", "Ilford HP5", "Tri-X 400", "Velvia 50", "Ektar 100", "expired film", "cross-processed", "pushed film", "35mm grain", "medium format", "large format", "digital clean", "super 8 footage", "16mm film", "VHS aesthetic", "lo-fi"]}, "composition": {"p": "style", "l": "Composition", "sk": "composition", "m": false, "c": "te", "o": ["rule of thirds", "centered composition", "symmetrical", "asymmetrical", "leading lines", "golden ratio", "fibonacci spiral", "frame within a frame", "negative space", "minimalist composition", "busy composition", "diagonal composition", "triangular composition", "low horizon", "high horizon", "dutch tilt"]}, "depthOfField": {"p": "style", "l": "Depth of Field / Focus", "sk": "depthOfField", "m": false, "c": "te", "o": ["shallow depth of field", "deep depth of field", "bokeh background", "creamy bokeh", "tilt-shift miniature", "rack focus", "soft focus", "sharp focus throughout", "foreground blur", "background blur"]}, "aspectRatio": {"p": "style", "l": "Aspect Ratio", "sk": "aspectRatio", "m": false, "c": "te", "o": ["1:1 square", "4:5 portrait", "2:3 portrait", "3:4 portrait", "9:16 vertical", "16:9 widescreen", "2.39:1 cinematic", "21:9 ultrawide", "4:3 classic", "3:2 photo"]}, "hotScenario": {"p": "dance", "l": "Hot-Algorithm / TikTok Scenarios", "sk": "dance.scenario", "m": false, "c": "te", "o": ["TikTok thirst-trap pose, phone POV, vertical 9:16 framing", "TikTok dance challenge, mirror selfie, ring-light glow", "get-ready-with-me", "Hot algorithm", "Of-course", "Savage", "WAP", "Buss it", "Renegade", "Up", "Body", "Permission to dance", "POV bedroom mirror selfie, phone flash", "POV car selfie, golden hour, lip-bite", "POV elevator mirror, full-length outfit-of-the-day", "POV bathroom mirror, steam, towel", "POV gym selfie, sweaty, post-workout", "POV beach boomerang, hair flip", "POV pool jump, freeze-frame mid-splash", "Try-on haul, lingerie reveal", "Outfit transition trend, before/after", "Slow-mo hair flip in wind machine", "Caught you staring", "Tell me you're a baddie", "Walking-toward-camera runway strut, slow-mo", "Money-counting on bed, hip-hop video staple", "Champagne pour over body, slow-mo", "Rain-dance under sprinklers, wet clothes", "Yacht-deck bikini boomerang", "Strip-club money-rain shower", "Nightclub VIP-booth bottle service moment", "Festival outfit shoot, glitter and rhinestones", "Coachella desert sunset pose", "Met Gala steps editorial pose", "Influencer balcony pose, infinity pool behind", "Mansion pool-edge wet bikini pose", "Lambo door-up posing, gold chains", "Private jet stairs, designer luggage, sunglasses", "Backstage rap-video pose, blunt and gold cup", "Bottle-pop sparkler moment, slow-mo", "In my feelings", "Toosie Slide", "Jiggle jiggle", "Material Girl", "Y2K disposable-camera flash, party group", "Polaroid-style intimate snapshot vibe", "Sugar-daddy date-night shot, ring lighting"]}, "danceStyle": {"p": "dance", "l": "Dance Style", "sk": "dance.style", "m": false, "c": "te", "o": ["twerk", "booty pop", "butterfly twerk", "split twerk", "handstand twerk", "hip-hop choreography", "memphis jookin", "krump", "turfing", "jerkin", "tutting", "flexing", "bone-breaking", "wave", "voguing (old way)", "voguing (new way)", "vogue femme", "duckwalk", "death-drop", "whacking / punking", "litefeet", "b-boy power moves", "breakdance", "top rock", "shuffle dance", "cutting shapes", "jumpstyle", "salsa cubana", "salsa on-2", "bachata sensual", "merengue", "reggaeton perreo", "dembow", "mambo", "cha-cha-cha", "rumba", "cumbia", "kizomba", "zouk", "samba no pé", "passinho", "funk carioca twerk", "azonto", "shaku shaku", "gwara gwara", "amapiano shuffle", "zanku / legwork", "kuduro", "ndombolo", "soukous", "pantsula", "gqom shuffle", "afrobeats wine", "gum-boot dance", "kpanlogo", "makossa", "dancehall wining", "whine-up", "bogle", "gully creeper", "soca wine", "chutney", "belly dance (raqs sharqi)", "shamadan candelabra", "khaleegi hair toss", "dabke line dance", "shaabi", "k-pop choreography", "point dance", "j-pop idol choreo", "parapara", "classical bharatanatyam", "bollywood item-number choreo", "bhangra", "gidda", "garba", "lavani", "chinese fan dance", "lion dance", "tinikling", "gangnam horse dance", "tecktonik", "hula", "tahitian ʻori", "siva samoa", "haka", "māori poi", "pole dance", "pole tricks", "aerial silks", "aerial hoop (lyra)", "chair dance", "burlesque", "neo-burlesque", "striptease", "fan dance", "feather boa tease", "lap dance", "floor work", "cabaret", "go-go dance", "tango argentino", "milonga", "waltz", "viennese waltz", "foxtrot", "quickstep", "paso doble", "jive", "lindy hop", "east coast swing", "west coast swing", "jitterbug", "rockabilly bop", "jazz funk", "heels choreography", "contemporary lyrical", "modern dance", "tap dance", "broadway musical theater", "ballet variations", "house dance", "jacking", "footwork (chicago)", "melbourne shuffle", "hardstyle jumpstyle", "techno strut", "liquid arms", "gloving", "rave hardstyle", "tecktonik electro"]}, "danceRegion": {"p": "dance", "l": "City / Region Flavor", "sk": "dance.region", "m": false, "c": "te", "o": ["Atlanta strip-club", "Houston (chopped & screwed)", "New Orleans bounce", "Memphis jookin", "Chicago footwork", "Detroit jit", "New York harlem shake", "New York vogue ballroom", "Bay Area turf", "LA krump", "Miami booty bass", "New Orleans Mardi Gras", "Las Vegas residency", "Kingston dancehall", "Port-of-Spain Carnival", "Havana salsa", "San Juan reggaeton", "Santo Domingo merengue", "Rio de Janeiro funk", "São Paulo passinho", "Buenos Aires tango", "Medellín reggaeton", "Mexico City cumbia", "Cali salsa", "Lima festejo", "Lagos afrobeats", "Accra azonto", "Johannesburg pantsula", "Cape Town gqom", "Nairobi gengetone", "Luanda kuduro", "Kinshasa ndombolo", "Dakar mbalax", "Paris cabaret", "Berlin techno", "London grime", "Manchester house", "Ibiza beach club", "Mykonos club", "Amsterdam hardstyle", "Moscow nightclub", "Madrid flamenco tablao", "Sevilla flamenco", "Lisbon kizomba", "Cairo belly dance cabaret", "Beirut nightclub", "Marrakech riad", "Dubai mega-club", "Istanbul rooftop", "Seoul K-pop stage", "Tokyo idol stage", "Mumbai Bollywood set", "Punjab bhangra field", "Bangkok go-go bar", "Manila OPM stage", "Bali beach club", "Shanghai nightclub", "Honolulu hula stage", "Tahiti beach", "Auckland haka stage", "Sydney club"]}, "hairColor": {"p": "hair", "l": "Hair Color", "sk": "", "m": false, "c": "grid", "o": ["natural black", "jet black", "dark brown", "chestnut brown", "auburn", "strawberry blonde", "blonde", "platinum blonde", "red", "copper", "grey", "silver", "white", "salt and pepper", "blue", "teal", "pink", "pastel pink", "purple", "lavender", "green", "mint", "rainbow", "ombre", "balayage", "highlights", "split dye", "galaxy hair"]}, "role": {"p": "roles", "l": "Role / archetype", "sk": "", "m": false, "c": "te", "o": ["civilian", "office worker", "teacher", "chef", "nurse", "doctor", "police", "warrior", "mage", "rogue", "paladin", "ranger", "bard", "necromancer", "royalty", "elf", "vampire", "witch", "cyberpunk", "android", "space pilot", "scientist", "hacker", "soldier", "alien", "samurai", "knight", "viking", "geisha", "gladiator", "pirate", "artist", "musician", "dancer", "idol", "model", "streamer", "athlete", "fighter", "gymnast", "swimmer"]}};
  var ROLES = DEF.role.o.slice();
  var POOLS_CAST = {"gender": ["female", "male", "non-binary", "futanari", "trans woman", "trans man"], "age": ["early 20s", "mid 20s", "late 20s", "30s", "40s MILF age", "50s cougar age", "college age (21+)", "mature 21+"], "ethnicity": ["white", "black", "latina", "latino", "asian", "east asian", "south asian", "middle eastern", "mixed", "native american", "pacific islander", "mediterranean"], "bodyType": ["slim", "athletic", "curvy", "voluptuous", "thick", "BBW", "petite", "tall slender", "hourglass", "pear", "apple", "rectangle", "inverted triangle", "muscular", "bodybuilder", "dad-bod", "twink", "bear", "jock"], "build": ["slim", "lean", "toned", "athletic", "muscular", "average", "curvy", "voluptuous", "full-figured", "bodybuilder", "soft", "stocky"], "breastSize": ["flat", "small", "medium", "large", "very large", "huge"], "hipRatio": ["narrow", "slim", "average", "wide", "very wide"], "hairLength": ["buzz", "short", "shoulder", "long", "very long", "ponytail", "bun"], "hairColor": ["black", "brown", "blonde", "platinum blonde", "red", "auburn", "silver", "pastel pink", "pastel blue", "jet black", "highlights"]};
  // ---- expanded pools (added to each field's built-in defaults; all adult 21+, no real people) ----
  var MORE = {
    bodyType: ["hourglass", "pear-shaped", "toned athletic", "soft curvy", "statuesque", "slim-thick", "broad-shouldered", "willowy", "full-figured", "fit and lean"],
    ethnicity: ["afro-latina", "west african", "east african", "caribbean", "brazilian", "filipino", "korean", "japanese", "vietnamese", "persian", "ethiopian", "puerto rican", "dominican", "colombian", "polynesian", "mixed black and asian", "italian", "irish", "scandinavian", "lebanese"],
    makeup: ["glossy nude lip", "graphic liner", "bronzed sun-kissed glow", "berry-stained lips", "glitter inner corner", "sculpted contour", "dewy skin-first makeup", "red carpet glam", "smoked-out liner", "brown lip liner with clear gloss", "y2k frosted shimmer", "editorial bold blush"],
    skinDetails: ["sun-kissed glow", "natural skin texture", "subtle highlighter sheen", "dewy skin", "light body glitter"],
    facialHair: ["designer stubble", "sculpted goatee", "lined-up beard", "thin mustache", "chin strap beard"],
    build: ["sculpted", "lean muscular", "thick and toned", "dancer's build", "swimmer's build", "powerlifter build", "slim-thick", "curvy athletic", "long-limbed", "compact and strong"],
    posture: ["hip popped", "shoulders back, chin up", "leaning back on one heel", "relaxed lean", "runway-ready", "contrapposto", "power stance", "slouched cool", "poised and elegant", "playful weight shift"],
    bodyMarkings: ["fine-line floral tattoo", "script tattoo on collarbone", "thigh tattoo", "ornamental hand tattoo", "minimal arm tattoos", "spine script tattoo", "belly chain", "navel piercing", "nose ring", "septum ring", "ear stack piercings", "beauty mark"],
    nailStyle: ["chrome almond", "glazed donut nails", "long coffin acrylics", "short square red", "airbrushed y2k nails", "gold-foil french", "black stiletto", "milky white almond", "rhinestone accent nails", "neon tips", "cat-eye magnetic nails"],
    hairStyle: ["knotless braids", "box braids", "butterfly locs", "faux locs", "silk press", "90s blowout", "finger waves", "bantu knots", "tight coils", "defined twist-out", "sleek middle part", "beach waves", "baby-free laid edges", "wet look"],
    hairCut: ["curtain bangs", "wolf cut", "shag", "blunt bob", "asymmetrical bob", "tapered cut", "high fade", "butterfly cut", "long layers", "sleek lob", "mullet", "pixie with undercut"],
    hairSpecial: ["high sleek ponytail", "half-up half-down", "space buns", "claw-clip twist", "slicked-back bun", "crimped strands", "braided crown", "bubble ponytail", "cornrows into ponytail", "scarf-tied bun", "jeweled hair pins", "flower behind the ear"],
    expression: ["smirk", "knowing half-smile", "fierce stare", "laughing mid-shot", "soft confident gaze", "bitten lower lip", "unbothered cool", "playful wink", "sultry look over the shoulder", "lost in the music", "carefree laugh", "focused and determined"],
    pose: ["walking toward camera", "looking back over shoulder", "leaning on a vintage car", "sitting on a stool, one knee up", "mid-twirl", "hand on hip", "crouched streetwear pose", "lying on the hood of a car", "mirror selfie", "dancing mid-step", "sitting on stairs", "leaning in a doorway", "arms up stretch"],
    handGesture: ["hand in hair", "adjusting sunglasses", "fingertips on chin", "holding a phone", "pointing at camera", "holding a drink", "framing face with hands", "touching necklace", "hands in pockets", "fanning money", "blowing a kiss"],
    cameraAngle: ["low angle hero shot", "high angle selfie", "dutch tilt", "over-the-shoulder", "waist-up medium shot", "full-body wide", "tight close-up", "mirror reflection shot", "POV phone angle", "worm's eye view", "bird's eye view"],
    setting: ["neon-lit rooftop", "late-night bodega", "vintage roller rink", "luxury penthouse", "parking garage at night", "hotel hallway", "rainy city street", "palm-lined boulevard at dusk", "underground club", "recording studio booth", "Miami beach at golden hour", "Atlanta strip mall lot", "subway platform", "desert highway", "graffiti alley", "rooftop pool", "car wash", "basketball court at night", "velvet lounge", "backstage dressing room"],
    clothingCategory: ["y2k", "old-money", "techwear", "athleisure", "90s hip hop", "festival", "clubwear", "western", "luxury streetwear", "resort wear", "grunge", "bombshell glam"],
    top: ["corset top", "cropped hoodie", "mesh long-sleeve", "vintage band tee", "satin cami", "oversized blazer", "halter top", "baby tee", "leather bustier", "off-shoulder knit", "jersey dress top", "cropped puffer"],
    bottom: ["low-rise cargo pants", "leather mini skirt", "baggy jeans", "biker shorts", "satin maxi skirt", "flared jeans", "tennis skirt", "tailored trousers", "denim cutoffs", "parachute pants", "pleated mini"],
    footwear: ["chunky platform sneakers", "knee-high boots", "strappy heels", "retro high-top sneakers", "cowboy boots", "clear heels", "slides with socks", "mary janes", "thigh-high boots", "loafers"],
    accessories: ["gold chains", "hoop earrings", "bucket hat", "tinted sunglasses", "body chain", "chunky rings", "durag", "silk scarf", "mini bag", "grillz", "arm cuffs", "choker", "fur shrug"],
    outfitMaterial: ["vinyl", "mesh", "crochet", "metallic lamé", "sequins", "faux fur", "distressed denim", "nylon", "ribbed knit", "suede", "patent leather"],
    timeOfDay: ["blue hour", "after midnight", "golden hour", "high noon", "magic hour"],
    weather: ["light drizzle", "humid heat haze", "after the rain, wet streets", "fog rolling in", "warm breezy night"],
    atmosphere: ["electric", "smoky and moody", "cinematic", "nostalgic", "luxurious", "gritty", "glamorous", "intimate", "chaotic party energy"],
    mood: ["confident", "flirty", "carefree", "unbothered", "triumphant", "nostalgic", "rebellious", "seductive", "euphoric"],
    environmentDetail: ["neon signs reflecting in puddles", "smoke machine haze", "confetti in the air", "lens flare from headlights", "fairy lights", "spinning disco ball light", "steam from street grates", "laser beams"],
    medium: ["editorial fashion photo", "music video still", "paparazzi flash photo", "disposable camera snapshot", "35mm street photo", "magazine cover shoot", "behind-the-scenes still", "iPhone candid", "film still", "album cover art", "billboard campaign photo"],
    colorPalette: ["neon magenta and teal", "gold and black", "y2k chrome and baby blue", "sunset orange and purple", "red and black noir", "candy pastel", "earthy browns and gold", "icy blue and silver", "emerald and gold", "monochrome red", "washed-out film colors"],
    renderEngine: ["cinematic color grade", "photoreal raw", "redshift render", "arnold render", "hyperreal skin rendering"],
    era: ["late 90s", "early 2000s y2k", "2010s tumblr", "70s disco", "80s miami", "90s golden era hip hop", "near-future 2040", "roaring twenties"],
    lens: ["14mm ultra wide", "28mm street", "40mm pancake", "70-200mm telephoto", "fisheye", "100mm macro", "anamorphic"],
    filmStock: ["Kodak Ektar 100", "Ilford HP5", "Fuji Superia 400", "Kodak Tri-X 400", "Lomography 800", "Kodak Vision3 500T", "Agfa Vista 200"],
    composition: ["leading lines", "negative space", "frame within a frame", "low horizon", "tight crop", "golden ratio", "diagonal energy"],
    depthOfField: ["f/1.4 dreamy blur", "everything in focus", "tilt-shift", "subject pop, soft background"],
    aspectRatio: ["9:16 vertical", "21:9 cinematic", "16:9 widescreen"],
    hotScenario: [],
    danceStyle: [],
    danceRegion: ["São Paulo baile funk", "Rio favela funk", "Newark Jersey club", "Philly club", "Lagos afrobeats", "Johannesburg amapiano", "Santo Domingo dembow", "San Juan reggaeton", "Seoul K-pop studio", "Paris afro-trap", "Kingston dancehall", "Accra azonto", "London UK drill", "Gujarat garba"]
  };
  // Dance & viral trends people are actually posting (TikTok / IG Reels / X, researched late Oct 2026). No artist names.
  var TRENDS = [
    ["Six Seven (67) finger-count shrug", "Brazilian funk counting trend, hands bouncing 6-7, vertical 9:16 phone video", "São Paulo baile funk"],
    ["DIP ON EM dip-and-pose", "TikTok trend, beat-drop dip, ring-light mirror selfie", "Atlanta strip-club"],
    ["POU IN BRAZIL funk footwork", "Brazilian funk footwork challenge, street corner at night", "Rio favela funk"],
    ["Party Funk bounce", "group party funk bounce, house party, phone flash", "São Paulo baile funk"],
    ["Judas dance challenge", "search-driven dance challenge, dramatic hair whip on the drop", "Newark Jersey club"],
    ["Pray For Me challenge", "slow build to beat drop, hands up, moody club light", "Lagos afrobeats"],
    ["REDRED K-pop choreo", "K-pop dance cover, studio mirror, synced crew", "Seoul K-pop studio"],
    ["Old Technology pose-sway", "y2k pose-sway trend, flip phone props, flash photo look", "Newark Jersey club"],
    ["Gas Station dance", "gas station at night duo dance, neon canopy light", "Houston (chopped & screwed)"],
    ["Hotel Lobby duo", "two friends dancing in a hotel lobby, luxury marble, phone POV", "Atlanta strip-club"],
    ["Boo Challenge claps", "Halloween costume dance, claps and arm chops, spooky decor", "Philly club"],
    ["Parking Lot dance", "slowed Jersey club dance in a parking lot at night, car headlights", "Newark Jersey club"],
    ["Copines routine", "afro-pop girls' night routine, friends in a line, club booth", "Paris afro-trap"],
    ["In a Minute Wassup sway and point", "sway and point trend, bedroom mirror, ring light", "Philly club"],
    ["WYW My Sweetie duo bounce", "Jersey club duo bounce, matching fits", "Newark Jersey club"],
    ["Puerto Rican Mami routine", "reggaeton hip routine, beach boardwalk at sunset", "San Juan reggaeton"],
    ["Dame Hombro shoulder bounce", "dembow shoulder bounce, colmado street party", "Santo Domingo dembow"],
    ["Garba spin-clap", "festival garba spin and clap, mirror-work outfits", "Gujarat garba"],
    ["C-Walk", "west coast c-walk, lowrider backdrop, golden hour", "Los Angeles (C-walk/krump)"],
    ["Fancy Footwork", "old-school fancy footwork, basketball court", "Chicago footwork"],
    ["It's Friday dance", "Friday night dance, getting ready then out the door", "Atlanta strip-club"],
    ["Housewife POV dance", "POV kitchen dance trend, playful glam, phone propped on counter", "Newark Jersey club"],
    ["angel runway walk", "runway walk anywhere trend, feathered wings, catwalk strut", "Seoul K-pop studio"],
    ["Hottieween strut", "Halloween costume strut, hot-girl energy, party lights", "Houston (chopped & screwed)"],
    ["Vibin duo dance", "dances for two, friends synced in a living room", "Lagos afrobeats"],
    ["slow-motion hair flip", "slow-mo hair flip transition, wind machine, beat drop", "Atlanta strip-club"],
    ["amapiano log drum shuffle", "amapiano shuffle, sunset rooftop", "Johannesburg amapiano"],
    ["dancehall wine", "dancehall wine, street dance, sound system", "Kingston dancehall"]
  ];
  // Style recipes: a coherent look across the Style & Artist fields. tags: hh = hip hop, real = realism, dark = after dark+, art = stylized
  var RECIPES = [
    ["Atlanta Flash Night", "hh real", "paparazzi flash photo", "gold and black", "", "early 2000s y2k", "28mm street", "Fuji Superia 400", "centered composition", "everything in focus", "4:5 portrait"],
    ["90s Golden Era Cover", "hh real", "magazine cover shoot", "earthy browns and gold", "", "90s golden era hip hop", "50mm", "Kodak Gold 200", "centered composition", "shallow depth of field", "4:5 portrait"],
    ["Miami Vice Neon", "hh real", "music video still", "neon magenta and teal", "", "80s miami", "35mm", "Cinestill 800T", "rule of thirds", "bokeh background", "16:9 widescreen"],
    ["Y2K Chrome Pop", "hh art", "album cover art", "y2k chrome and baby blue", "octane render", "early 2000s y2k", "fisheye", "", "centered composition", "everything in focus", "1:1 square"],
    ["Houston Slab Sunset", "hh real", "35mm street photo", "sunset orange and purple", "", "2010s tumblr", "40mm pancake", "Kodak Portra 400", "low horizon", "shallow depth of field", "16:9 widescreen"],
    ["Bronx Disposable", "hh real", "disposable camera snapshot", "washed-out film colors", "", "late 90s", "28mm street", "Fuji Superia 400", "tight crop", "everything in focus", "3:4 portrait"],
    ["Velvet Noir", "real dark", "film still", "red and black noir", "", "roaring twenties", "85mm portrait", "Kodak Vision3 500T", "negative space", "f/1.4 dreamy blur", "21:9 cinematic"],
    ["Penthouse After Hours", "real dark", "editorial fashion photo", "gold and black", "", "near-future 2040", "50mm", "Cinestill 800T", "frame within a frame", "creamy bokeh", "4:5 portrait"],
    ["Rooftop Golden Hour", "hh real", "editorial fashion photo", "warm tones", "", "2010s tumblr", "85mm portrait", "Kodak Portra 400", "rule of thirds", "creamy bokeh", "4:5 portrait"],
    ["Jersey Club Strobe", "hh real", "behind-the-scenes still", "icy blue and silver", "", "early 2000s y2k", "24mm wide angle", "Ilford HP5", "diagonal energy", "everything in focus", "9:16 vertical"],
    ["Lagos Night Market", "hh real", "35mm street photo", "emerald and gold", "", "near-future 2040", "35mm", "Kodak Ektar 100", "leading lines", "bokeh background", "4:5 portrait"],
    ["Black & White Legend", "hh real", "film photograph", "monochrome", "", "90s golden era hip hop", "50mm", "Kodak Tri-X 400", "centered composition", "deep depth of field", "3:4 portrait"],
    ["Candy Pastel Pop", "art", "album cover art", "candy pastel", "blender render", "2010s tumblr", "50mm", "", "symmetrical", "everything in focus", "1:1 square"],
    ["Desert Highway Western", "real", "film still", "sunset orange and purple", "", "70s disco", "70-200mm telephoto", "Kodak Vision3 500T", "low horizon", "shallow depth of field", "21:9 cinematic"],
    ["Club Bathroom Mirror", "hh real dark", "iPhone candid", "neon magenta and teal", "", "2010s tumblr", "24mm wide angle", "", "frame within a frame", "everything in focus", "9:16 vertical"],
    ["Hotel Hallway Fisheye", "hh real", "music video still", "warm tones", "", "late 90s", "fisheye", "Fuji Pro 400H", "centered composition", "deep depth of field", "1:1 square"],
    ["Disco Mirrorball", "real", "film photograph", "gold and black", "", "70s disco", "35mm", "Kodak Gold 200", "symmetrical", "bokeh background", "4:5 portrait"],
    ["Cyber Seoul Night", "art", "film still", "icy blue and silver", "unreal engine 5", "near-future 2040", "anamorphic", "", "leading lines", "bokeh background", "21:9 cinematic"],
    ["Billboard Campaign", "real", "billboard campaign photo", "monochrome red", "", "near-future 2040", "85mm portrait", "", "negative space", "subject pop, soft background", "16:9 widescreen"],
    ["Basement Studio Session", "hh real", "behind-the-scenes still", "warm tones", "", "90s golden era hip hop", "35mm", "Cinestill 800T", "rule of thirds", "shallow depth of field", "4:5 portrait"],
    ["Low-Rider Sunday", "hh real", "35mm street photo", "sunset orange and purple", "", "90s golden era hip hop", "28mm street", "Kodak Portra 400", "leading lines", "deep depth of field", "16:9 widescreen"],
    ["Silk Boudoir Glow", "real dark", "editorial fashion photo", "warm tones", "", "roaring twenties", "85mm portrait", "Kodak Portra 400", "negative space", "f/1.4 dreamy blur", "4:5 portrait"],
    ["Red Light Lounge", "real dark", "film still", "monochrome red", "", "80s miami", "50mm", "Kodak Vision3 500T", "frame within a frame", "creamy bokeh", "21:9 cinematic"],
    ["Rainy Neon Alley", "real dark", "film still", "neon magenta and teal", "", "near-future 2040", "35mm", "Cinestill 800T", "leading lines", "bokeh background", "21:9 cinematic"],
    ["Paparazzi Exit", "hh real", "paparazzi flash photo", "washed-out film colors", "", "early 2000s y2k", "70-200mm telephoto", "", "tight crop", "everything in focus", "3:4 portrait"],
    ["Beach Resort Editorial", "real", "editorial fashion photo", "candy pastel", "", "2010s tumblr", "85mm portrait", "Fuji Pro 400H", "low horizon", "creamy bokeh", "4:5 portrait"],
    ["Graffiti Wall Portrait", "hh real", "35mm street photo", "neon magenta and teal", "", "late 90s", "35mm", "Fuji Superia 400", "centered composition", "shallow depth of field", "4:5 portrait"],
    ["Comic Cel Hero", "hh art", "anime screencap", "neon", "", "near-future 2040", "24mm wide angle", "", "diagonal energy", "everything in focus", "16:9 widescreen"],
    ["Oil Portrait Royalty", "art", "oil painting", "gold and black", "", "classical antiquity", "85mm portrait", "", "centered composition", "shallow depth of field", "3:4 portrait"],
    ["Vaporwave Mall", "art", "digital art", "candy pastel", "octane render", "80s miami", "fisheye", "", "symmetrical", "everything in focus", "1:1 square"],
    ["Strip-Mall Midnight", "hh real dark", "iPhone candid", "icy blue and silver", "", "2010s tumblr", "24mm wide angle", "", "rule of thirds", "everything in focus", "9:16 vertical"],
    ["Car Wash Summer", "hh real", "music video still", "warm tones", "", "early 2000s y2k", "35mm", "Kodak Gold 200", "rule of thirds", "shallow depth of field", "9:16 vertical"],
    ["Sneaker Ad Hero", "hh real", "billboard campaign photo", "monochrome red", "", "near-future 2040", "14mm ultra wide", "", "diagonal energy", "deep depth of field", "4:5 portrait"],
    ["Velvet Rope VIP", "hh real dark", "paparazzi flash photo", "gold and black", "", "early 2000s y2k", "28mm street", "Lomography 800", "frame within a frame", "everything in focus", "4:5 portrait"],
    ["Afro-Futurist Gold", "hh art", "digital art", "emerald and gold", "octane render", "near-future 2040", "50mm", "", "symmetrical", "bokeh background", "3:4 portrait"],
    ["Tokyo Street Snap", "real", "35mm street photo", "washed-out film colors", "", "2010s tumblr", "40mm pancake", "Fuji Superia 400", "leading lines", "deep depth of field", "3:4 portrait"],
    ["Courtside Night Game", "hh real", "behind-the-scenes still", "gold and black", "", "near-future 2040", "70-200mm telephoto", "", "tight crop", "subject pop, soft background", "16:9 widescreen"],
    ["Dancehall Sound System", "hh real", "music video still", "emerald and gold", "", "90s golden era hip hop", "28mm street", "Kodak Ektar 100", "diagonal energy", "everything in focus", "16:9 widescreen"],
    ["Roller Rink Retro", "real", "film photograph", "candy pastel", "", "70s disco", "35mm", "Kodak Gold 200", "rule of thirds", "bokeh background", "4:5 portrait"],
    ["Midnight Pool Party", "hh real dark", "music video still", "icy blue and silver", "", "2010s tumblr", "24mm wide angle", "Cinestill 800T", "low horizon", "bokeh background", "9:16 vertical"],
    ["Chrome Runway", "real", "editorial fashion photo", "icy blue and silver", "", "near-future 2040", "85mm portrait", "", "symmetrical", "subject pop, soft background", "2:3 portrait"],
    ["Polaroid Party Wall", "hh real", "polaroid", "warm tones", "", "late 90s", "40mm pancake", "", "centered composition", "everything in focus", "1:1 square"],
    ["Gritty Doc Verité", "hh real", "film photograph", "desaturated", "", "late 90s", "28mm street", "Ilford HP5", "asymmetrical", "deep depth of field", "3:4 portrait"],
    ["Luxury Yacht Deck", "real", "editorial fashion photo", "warm tones", "", "near-future 2040", "50mm", "Kodak Portra 400", "low horizon", "creamy bokeh", "16:9 widescreen"],
    ["Smoke & Laser Club", "hh real dark", "music video still", "neon magenta and teal", "", "near-future 2040", "anamorphic", "Kodak Vision3 500T", "diagonal energy", "bokeh background", "21:9 cinematic"]
  ];
  // Character archetypes for 🎲 New character (role). Adults 21+, invented people only.
  var ARCH = ["Atlanta rooftop DJ", "Miami yacht-party host", "Lagos fashion stylist", "Harlem jazz-lounge singer", "Houston slab-car show host", "Tokyo street-fashion model", "Brooklyn tattoo artist", "Vegas pool-party host", "Seoul dance-crew captain", "Rio samba queen", "Kingston dancehall queen", "Paris runway model", "Dubai luxury concierge", "New Orleans bounce dancer", "Chicago footwork battler", "LA fitness coach", "Bay Area sideshow racer", "Johannesburg amapiano dancer", "London grime MC", "Toronto R&B singer", "Medellín reggaeton dancer", "Havana salsa instructor", "Memphis jookin dancer", "Bronx sneakerhead", "Compton lowrider club queen", "Ibiza club promoter", "Monaco casino dealer", "Cape Town surfer", "Sydney lifeguard", "Honolulu fire dancer", "boxing gym owner", "pro wrestler", "roller-rink DJ", "yacht captain", "rodeo rider", "stunt driver", "flight attendant", "luxury real-estate agent", "tattooed barber", "vinyl record-store owner", "art-gallery curator", "recording-studio engineer", "music-video director", "streetwear designer", "red-carpet stylist", "nightclub bartender", "neo-noir private eye", "cyberpunk courier", "vampire nightclub owner", "space-station pilot", "desert nomad warrior", "masquerade ball host"];
  var ARCH_ADULT = ["burlesque headliner", "boudoir model", "strip-club headliner", "pin-up centerfold model", "after-hours lounge hostess", "pole fitness champion", "adult content creator"];
  // ---------- field table ----------
  Object.keys(MORE).forEach(function (k) { if (DEF[k]) DEF[k].x = uniq(MORE[k]).filter(function (v) { return DEF[k].o.map(lc).indexOf(lc(v)) < 0; }); });
  DEF.role.x = ARCH.concat(ARCH_ADULT);
  DEF.hotScenario.x = TRENDS.map(function (t) { return t[0] + " — " + t[1]; });
  DEF.danceStyle.x = TRENDS.map(function (t) { return t[0]; });
  function okF(f, x, adult) { return DEF[f].o.map(lc).indexOf(lc(x)) >= 0 || custom(f).map(lc).indexOf(lc(x)) >= 0 ? !BAD.test(x) : ok(x, adult); }
  function fixed(f) { return DEF[f].c !== "te"; }
  function hist() { return J(HK, {}); }
  function recent(f) { return (hist()[f] || []).slice(0, 8); }
  function pushHist(f, vals) { var h = hist(); h[f] = uniq([].concat(vals).concat(h[f] || [])).slice(0, 8); W(HK, h); }
  function extra(sk) { var x = J(XK, {}); return Array.isArray(x[sk]) ? x[sk] : []; }
  function addExtra(sk, v) { if (!sk) return; var x = J(XK, {}); x[sk] = uniq([v].concat(x[sk] || [])).slice(0, 8); W(XK, x); }
  function custom(f) { var d = DEF[f]; if (!d || !d.sk) return []; var c = J(CV, {}); return Array.isArray(c[d.sk]) ? c[d.sk] : []; }
  // a field is locked when its current value is one of Zig's own typed chips
  function locked(f, s) {
    var mine = custom(f).map(lc); if (!mine.length) return false;
    var v = (s || st())[f]; v = Array.isArray(v) ? v : v ? [v] : [];
    return v.some(function (x) { return mine.indexOf(lc(x)) >= 0; });
  }
  function myWords(fs) {
    var w = []; fs.forEach(function (f) { if (locked(f)) { var v = st()[f]; w = w.concat(Array.isArray(v) ? v : [v]); } });
    return uniq(w).filter(function (x) { return ok(x, true); }).slice(0, 8);
  }
  function cands(f, adult) {
    var d = DEF[f], s = st(), cur = s[f], curA = (Array.isArray(cur) ? cur : cur ? [cur] : []).map(lc), rec = recent(f).map(lc);
    var base = d.o.filter(function (v) { return !BAD.test(v); });
    var all = uniq(base.concat((d.x || []).filter(function (v) { return ok(v, adult); })).concat(custom(f)));
    if (f === "facialHair" && /female|woman/i.test(s.gender || "")) all = ["clean shaven"];
    if (f === "breastSize" && /^male$|^man$/i.test(s.gender || "")) all = ["flat"];
    var fresh = all.filter(function (v) { return curA.indexOf(lc(v)) < 0 && rec.indexOf(lc(v)) < 0; });
    if (!fresh.length) fresh = all.filter(function (v) { return curA.indexOf(lc(v)) < 0; });
    return fresh.length ? fresh : all;
  }
  function localPick(f, adult) {
    var d = DEF[f], c = cands(f, adult);
    if (d.m) { var n = 1 + (Math.random() < 0.5 ? 1 : 0); return shuffle(c).slice(0, n); }
    // 60% from the new expansions so presses feel fresh, 40% from the built-in pool
    var nx = c.filter(function (v) { return (d.x || []).map(lc).indexOf(lc(v)) >= 0; });
    return nx.length && Math.random() < 0.6 ? rnd(nx) : rnd(c);
  }
  function spec(f, adult) {
    var d = DEF[f], c = cands(f, adult), s = st(), cur = s[f];
    var avoid = uniq(recent(f).concat(Array.isArray(cur) ? cur : cur ? [cur] : [])).slice(0, 10);
    return { k: f, label: d.l.replace(/\s*\(multi-select\)/i, ""), options: shuffle(c).slice(0, f === "danceStyle" || f === "hotScenario" ? 30 : 24), avoid: avoid, fixed: fixed(f), multi: !!d.m, count: d.m ? 2 : 1, free: f === "hotScenario" };
  }
  function aiCtx(c) { return { tier: c.tierLabel || c.tier || "sfw", style: c.styleLabel || c.style || "", realism: c.realism ? "photoreal camera realism" : "stylized ok", platform: c.platform || "", mood: c.mood || "" }; }

  // ---------- toast ----------
  function toast(msg) {
    var n = document.querySelector("[data-pm=rand-toast]");
    if (!n) { n = document.createElement("div"); n.setAttribute("data-pm", "rand-toast"); n.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;max-width:min(520px,92vw);padding:9px 13px;border-radius:11px;background:rgba(8,10,18,.95);border:1px solid rgba(125,211,252,.45);color:#e2e8f0;font:12px/1.35 ui-monospace,Menlo,monospace;box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:none"; document.body.appendChild(n); }
    n.textContent = msg; n.style.display = "block"; clearTimeout(n._t); n._t = setTimeout(function () { n.style.display = "none"; }, 5200);
  }
  function srcLabel(j) { if (!j) return "🎲 local pools (free, offline)"; var p = String(j.provider || ""); return /xai|grok/i.test(p + (j.model || "")) ? "🎲 Grok AI" + (j.est_usd ? " · ~$" + Number(j.est_usd).toFixed(4) : "") : "🎲 free AI (" + (j.model || p || "fallback") + ")"; }
  var COST = J("pm.rand.cost.v1", { usd: 0, n: 0 });

  // ---------- AI ----------
  function ai(kind, fields, opts) {
    opts = opts || {};
    if (!window.PMAI || !window.PMAI.call || J("pm.rand.offline", false)) return Promise.resolve(null);
    var c = opts.ctx || ctx(), adult = adultOn(c);
    var body = { kind: kind, name: !!opts.name, fields: fields, ctx: aiCtx(c), words: opts.words || [], mode: adult ? "18+" : "sfw" };
    return window.PMAI.call("randomize", body, { timeout: 10000 }).then(function (j) {
      if (!j || j._offline || j.error || !j.pick) return null;
      COST.usd += Number(j.est_usd || 0); COST.n++; W("pm.rand.cost.v1", COST);
      return j;
    }, function () { return null; });
  }

  // ---------- apply ----------
  function patchOf(fs, pick, adult) {
    var s = st(), out = {}, names = [];
    fs.forEach(function (f) {
      var d = DEF[f], v = pick && pick[f], all = d.o.concat(d.x || []).concat(custom(f)).concat(extra(d.sk)), allL = all.map(lc);
      var vals = (Array.isArray(v) ? v : v ? [v] : []).map(function (x) { return window.PMAI && window.PMAI.safe ? window.PMAI.safe(String(x)) : String(x); })
        .filter(function (x) { return okF(f, x, adult) && (!fixed(f) || allL.indexOf(lc(x)) >= 0); })
        .map(function (x) { var i = allL.indexOf(lc(x)); return i >= 0 ? all[i] : x; });
      var rec = recent(f).map(lc), cur = s[f], curA = (Array.isArray(cur) ? cur : cur ? [cur] : []).map(lc);
      vals = vals.filter(function (x) { return d.m || (curA.indexOf(lc(x)) < 0 && rec.indexOf(lc(x)) < 0); });
      if (!vals.length) { var lp = localPick(f, adult); vals = Array.isArray(lp) ? lp : [lp]; }
      vals = uniq(vals);
      if (d.c === "te") vals.forEach(function (x) { if (allL.indexOf(lc(x)) < 0 || extra(d.sk).map(lc).indexOf(lc(x)) >= 0) addExtra(d.sk, x); });
      out[f] = d.m ? vals.slice(0, 3) : vals[0];
      pushHist(f, vals);
      names.push(Array.isArray(out[f]) ? out[f].join(" + ") : out[f]);
    });
    return { patch: out, names: names };
  }
  function setState(patch, castFn) {
    var c = window.__pmChar;
    if (!c || !c.set) { var d = J("flux-character-builder:draft", {}); Object.assign(d, patch, { pmLookPrompt: "" }); W("flux-character-builder:draft", d); return; }
    c.set(function (m) { var n = Object.assign({}, m, patch, { pmLookPrompt: "" }); if (castFn) n.sceneCast = castFn(m.sceneCast || []); return n; });
    window.__pmRandTick = (window.__pmRandTick || 0) + 1;
  }
  // roll a list of fields: one AI call, local fill-in for anything missing
  function roll(kind, fs, opts) {
    opts = opts || {};
    var c = ctx(), adult = adultOn(c), s = st();
    fs = fs.filter(function (f) { return DEF[f] && (opts.force || !locked(f, s)); });
    if (!fs.length) { toast("🎲 Everything here is set to your own words — nothing to change."); return Promise.resolve(null); }
    var words = myWords(opts.lockFrom || fs);
    return ai(kind, fs.map(function (f) { return spec(f, adult); }), { name: opts.name, words: words, ctx: c }).then(function (j) {
      var r = patchOf(fs, j && j.pick, adult);
      if (opts.extra) Object.assign(r.patch, opts.extra(j, adult));
      setState(r.patch, opts.cast);
      var nm = j && j.name ? "“" + j.name + "” · " : opts.label ? opts.label + " · " : "";
      toast(srcLabel(j) + " → " + nm + r.names.slice(0, 4).join(", ") + (r.names.length > 4 ? " +" + (r.names.length - 4) + " more" : ""));
      return { ai: j, patch: r.patch };
    });
  }

  // ---------- sections ----------
  var SEC = {
    body: ["height", "build", "breastSize", "hipRatio", "waist", "posture", "bodyMarkings", "nailStyle"],
    hair: ["hairLength", "hairStyle", "hairCut", "hairTexture", "hairSpecial", "hairColor"],
    expression: ["expression", "eyeContact", "pose", "handGesture", "cameraAngle", "setting"],
    clothing: ["clothingCategory", "top", "bottom", "footwear", "accessories", "outfitMaterial"],
    scene: ["timeOfDay", "weather", "season", "atmosphere", "mood", "environmentDetail"],
    style: ["medium", "colorPalette", "renderEngine", "era", "lens", "filmStock", "composition", "depthOfField", "aspectRatio"],
    dance: ["hotScenario", "danceStyle", "danceRegion"],
    character: ["ethnicity", "skinTone", "faceShape", "eyeColor", "eyeShape", "bodyType", "makeup", "skinDetails", "facialHair"]
  };
  var SWITCHES = SEC.hair.concat(SEC.expression, SEC.clothing, ["makeup", "nailStyle"]);
  var DICE_PAGES = { body: 1, hair: 1, expression: 1, clothing: 1, scene: 1, style: 1, dance: 1 };

  function genderPick(s) { if (s.gender) return s.gender; var r = Math.random(); return r < 0.65 ? "female" : r < 0.9 ? "male" : "non-binary"; }
  function character() {
    var s = st(), g = genderPick(s), fs = SEC.character.concat(["role"]);
    if (!/^male$/i.test(g)) fs = fs.filter(function (f) { return f !== "facialHair"; });
    return roll("character (adult 21+, invented person, never a real one)", fs, {
      name: true,
      extra: function () {
        var age = 21 + Math.floor(Math.random() * 38);
        var p = { gender: g, age: Math.min(58, age) };
        if (!/^male$/i.test(g)) p.facialHair = "";
        return p;
      }, label: "New character"
    });
  }
  // cast: local, distinct per member; never touches role / outfit / pose / notes free text
  var CAST = POOLS_CAST;
  function castRoll(list, adult) {
    var used = { ethnicity: [], hairColor: [], bodyType: [] };
    return list.map(function (m) {
      var g = m.gender || (Math.random() < 0.65 ? "female" : Math.random() < 0.7 ? "male" : rnd(["non-binary", "trans woman", "trans man"]));
      if (!adult && g === "futanari") g = "female";
      function p(k) {
        var safeV = CAST[k].filter(function (v) { return !BAD.test(v) && (adult || !/futanari|bbw|milf|cougar/i.test(v)); });
        var o = safeV.filter(function (v) { return v !== m[k] && (!used[k] || used[k].indexOf(v) < 0); });
        var v = rnd(o.length ? o : safeV); if (used[k]) used[k].push(v); return v;
      }
      var fem = /female|woman|futanari/i.test(g);
      var eth = p("ethnicity"); if (eth === "latina" && !fem) eth = "latino"; else if (eth === "latino" && fem) eth = "latina";
      var ages = CAST.age.filter(function (a) { return !BAD.test(a) && !/early 20s|college/i.test(a) && (adult || !/milf|cougar/i.test(a)); });
      return Object.assign({}, m, { gender: g, age: rnd(ages.filter(function (a) { return a !== m.age; })) || "mid 20s", ethnicity: eth, bodyType: p("bodyType"), build: p("build"),
        breastSize: fem ? rnd(CAST.breastSize.filter(function (b) { return adult || b !== "huge"; })) : (m.breastSize ? "flat" : ""), hipRatio: p("hipRatio"), hairLength: p("hairLength"), hairColor: p("hairColor") });
    });
  }
  function bodyCast() {
    var adult = adultOn(), s = st(), n = (s.sceneCast || []).length;
    return roll("body and build", SEC.body, { label: "Body + cast", cast: n ? function (list) { return castRoll(list, adult); } : null }).then(function (r) {
      if (n) setTimeout(function () { toast("🎲 Body + " + n + " cast member" + (n > 1 ? "s" : "") + " re-rolled (names, roles, outfits & notes kept)"); }, 1800);
      return r;
    });
  }
  function styleRoll() {
    var c = ctx(), adult = adultOn(c), want = [];
    var sty = lc((c.styles || []).join(" ") + " " + (c.style || "")), mode = lc(c.mode || "");
    if (/hip|street|music|rap|trap/.test(sty + mode)) want.push("hh");
    if (c.realism) want.push("real");
    if (adult || /afterdark|nsfw|xxx/.test(c.tier || "")) want.push("dark");
    var rec = recent("_recipe").map(lc);
    var pool = RECIPES.filter(function (r) { return (adult || r[1].indexOf("dark") < 0 || r[1].indexOf("real") >= 0) && rec.indexOf(lc(r[0])) < 0; });
    var fit = pool.filter(function (r) { return want.every(function (w) { return w === "dark" || r[1].indexOf(w) >= 0; }); });
    var R = rnd(fit.length ? fit : pool.length ? pool : RECIPES);
    var F = ["medium", "colorPalette", "renderEngine", "era", "lens", "filmStock", "composition", "depthOfField", "aspectRatio"];
    var loc = {}; F.forEach(function (f, i) { if (R[i + 2]) loc[f] = R[i + 2]; });
    if (c.realism) loc.renderEngine = "";
    var fs = F.filter(function (f) { return !(c.realism && f === "renderEngine"); });
    if (!window.PMAI || J("pm.rand.offline", false)) return Promise.resolve(applyRecipe(R[0], loc, null));
    return ai("style recipe (hip hop / realism aware; invent a fresh named look)", fs.map(function (f) { return spec(f, adult); }), { name: true, words: myWords(F), ctx: c }).then(function (j) {
      if (!j) return applyRecipe(R[0], loc, null);
      var r = patchOf(fs.filter(function (f) { return !locked(f); }), j.pick, adult);
      if (c.realism) r.patch.renderEngine = "";
      var nm = j.name || R[0]; pushHist("_recipe", [nm]); setState(r.patch);
      toast(srcLabel(j) + " → “" + nm + "” · " + r.names.slice(0, 4).join(", ")); return { ai: j, patch: r.patch };
    });
  }
  function applyRecipe(name, loc, j) {
    var p = {}; Object.keys(loc).forEach(function (f) { if (!locked(f)) { p[f] = loc[f]; if (loc[f]) { pushHist(f, [loc[f]]); var d = DEF[f]; if (d.o.map(lc).indexOf(lc(loc[f])) < 0) addExtra(d.sk, loc[f]); } } });
    pushHist("_recipe", [name]); setState(p); toast(srcLabel(j) + " → “" + name + "” · " + [p.medium, p.colorPalette, p.lens].filter(Boolean).join(", ")); return { ai: null, patch: p };
  }
  function danceRoll() {
    var adult = adultOn(), rec = recent("_trend").map(lc);
    var T = TRENDS.filter(function (t) { return rec.indexOf(lc(t[0])) < 0; }), t = rnd(T.length ? T : TRENDS);
    var fs = ["hotScenario", "danceStyle", "danceRegion"].filter(function (f) { return !locked(f); });
    return ai("dance trend (real current TikTok / IG Reels / X trends; no artist names)", fs.map(function (f) { return spec(f, adult); }), { name: true, words: myWords(SEC.dance) }).then(function (j) {
      var r, nm;
      if (j) { r = patchOf(fs, j.pick, adult); nm = j.name || ""; }
      else {
        var p = {}; if (fs.indexOf("hotScenario") >= 0) p.hotScenario = t[0] + " — " + t[1]; if (fs.indexOf("danceStyle") >= 0) p.danceStyle = t[0]; if (fs.indexOf("danceRegion") >= 0) p.danceRegion = t[2];
        Object.keys(p).forEach(function (f) { pushHist(f, [p[f]]); var d = DEF[f]; if (d.o.map(lc).indexOf(lc(p[f])) < 0) addExtra(d.sk, p[f]); });
        r = { patch: p, names: [t[0]] }; nm = t[0];
      }
      pushHist("_trend", [nm || t[0]]); setState(r.patch);
      toast(srcLabel(j) + " → " + (nm ? "“" + nm + "” · " : "") + r.names.slice(0, 3).join(", ")); return { ai: j, patch: r.patch };
    });
  }

  // ---------- page wiring ----------
  function pageOf() { var c = window.__pmChar; return c && c.currentPage || ""; }
  var TITLE_PAGE = [[/character details/i, "details"], [/roles/i, "roles"], [/body/i, "body"], [/hair/i, "hair"], [/expression|pose/i, "expression"], [/cloth|outfit|wardrobe/i, "clothing"], [/scene|environment/i, "scene"], [/style|artist/i, "style"], [/dance|tiktok|trend/i, "dance"]];
  function titlePage(t) { t = String(t || ""); for (var i = 0; i < TITLE_PAGE.length; i++) if (TITLE_PAGE[i][0].test(t)) return TITLE_PAGE[i][1]; return ""; }
  function B(id, label, title, run) { return { id: id, label: label, title: title, run: run }; }
  function bar(title) {
    var p = titlePage(title);
    var allSw = B("switches", "🎲 All look switches", "Re-roll hair, expression, pose, clothing, makeup and nails at once (Grok AI, never repeats recent picks; your own typed chips stay)", function () { return roll("look switches (hair, expression, clothing, makeup, nails)", SWITCHES, { label: "All look switches" }); });
    switch (p) {
      case "details": case "roles": return [B("character", "🎲 Random character", "A fresh adult (21+) invented character: identity, look, age and role (Grok AI, never a real person)", character)];
      case "body": return [B("bodycast", "🎲 Body + cast", "Randomize every body field and every cast member at once (names, roles, outfits and notes are kept)", bodyCast)];
      case "hair": return [B("hair", "🎲 Hair", "Randomize all hair switches", function () { return roll("hair", SEC.hair, { label: "Hair" }); }), allSw];
      case "expression": return [B("expression", "🎲 Expression & pose", "Randomize expression, eye contact, pose, hands, camera angle and setting", function () { return roll("expression and pose", SEC.expression, { label: "Expression & pose" }); }), allSw];
      case "clothing": return [B("clothing", "🎲 Outfit", "Randomize the whole outfit", function () { return roll("outfit", SEC.clothing, { label: "Outfit" }); }), allSw];
      case "scene": return [B("scene", "🎲 Scene", "Randomize time, weather, season, atmosphere, mood and details", function () { return roll("scene and environment", SEC.scene, { label: "Scene" }); })];
      case "style": return [B("style", "🎲 Random style", "A fresh named style recipe that fits your tier, hip hop and realism picks (AI can invent new ones)", styleRoll)];
      case "dance": return [B("dance", "🎲 Random trend", "A real current TikTok / IG / X dance trend: scenario + style + city flavor", danceRoll)];
    }
    return [];
  }
  function norm(x) { return lc(x).replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, ""); }
  var FCACHE = {};
  function fieldFor(k, pool, label) {
    var key = k + "|" + (pool || []).slice(0, 3).join("|"); if (key in FCACHE) return FCACHE[key];
    var hit = null, sig = (pool || []).slice(0, 4).map(lc);
    Object.keys(DEF).forEach(function (f) {
      if (hit) return; var d = DEF[f];
      var byKey = d.sk && d.sk === k, byLab = !d.sk && (norm(d.l) === norm(k) || norm(k).indexOf(norm(d.l)) === 0 || norm(d.l).indexOf(norm(k)) === 0);
      if (!byKey && !byLab) return;
      var o = d.o.map(lc), same = sig.filter(function (v) { return o.indexOf(v) >= 0; }).length;
      if (byKey || same >= Math.min(3, sig.length)) hit = f;
    });
    return (FCACHE[key] = hit);
  }
  function fieldOn(k, pool, label) { var f = fieldFor(k, pool, label); return !!(f && DICE_PAGES[DEF[f].p] && f !== "artistRefs"); }
  function field(k, pool, label) { var f = fieldFor(k, pool, label); if (!f) return Promise.resolve(null); return roll(DEF[f].p + " · " + DEF[f].l, [f], { force: true, label: DEF[f].l.replace(/\s*\(.*\)/, "") }); }

  // ---------- Hashtag Engine / Vocab ----------
  var HE_CAP = { x: 2, tiktok: 5, instagram: 5, threads: 3 };
  function noirSet(o) {
    var N = window.PMNoir; if (!N) { toast("Noir pool not loaded"); return null; }
    var plat = o.platform || "all", n = Math.max(1, Math.min(HE_CAP[plat] || o.count || 8, o.count || 8));
    var tags = N.pick(n, { adult: !!o.adult });
    if (!tags.length) return null;
    var set = { theme: "🎲 Noir pool (Zig's " + N.size + " tags)", platform: plat, sensitivity: o.sensitivity || "edgy", hashtags: tags, rationale: n + " fresh tags from Zig's own Noir list, exact spelling, none of your recent picks" + (HE_CAP[plat] ? " · capped for " + plat : ""), createdAt: Date.now() };
    if (o.add) o.add(set);
    toast("🎲 Noir → " + tags.join(" ")); return set;
  }
  var THEME_A = ["Air Jordan 1", "chrome lowrider", "rooftop", "velvet lounge", "gas station at night", "hotel hallway", "neon bodega", "rainy alley", "courtside", "roller rink", "yacht deck", "strip-mall parking lot", "recording booth", "car wash", "desert highway"];
  var THEME_B = ["street photography", "music video", "editorial portrait", "after-dark flash photo", "dance challenge", "fit check", "noir film still", "y2k disposable snap", "golden hour shoot", "luxury campaign"];
  function theme(o) {
    var cats = (o.cats || []).filter(function (c) { return c && c.chips && c.chips.length; });
    var rec = recent("_theme").map(lc), chips = [];
    cats.forEach(function (c) { chips.push(rnd(c.chips).text); });
    chips = chips.filter(function (x) { return ok(x, !!o.adult); });
    var local = function () { var t, i = 0; do { t = (chips.length >= 2 && Math.random() < 0.6 ? rnd(chips) + " " + rnd(THEME_B) : rnd(THEME_A.concat(chips)) + " " + rnd(THEME_B)); } while (rec.indexOf(lc(t)) >= 0 && ++i < 12); return t; };
    return ai("hashtag theme (one short phrase, 3-7 words)", [{ k: "theme", label: "theme phrase for a hashtag set on " + (o.platform || "all platforms"), options: shuffle(chips.concat(THEME_A)).slice(0, 16), avoid: recent("_theme").concat(o.cur ? [o.cur] : []).slice(0, 10), free: true, count: 1 }], {}).then(function (j) {
      var t = j && j.pick && j.pick.theme; t = Array.isArray(t) ? t[0] : t;
      if (t) t = String(t).replace(/#/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\s]+/g, " ").trim().toLowerCase();
      if (!t || !ok(t, !!o.adult) || rec.indexOf(lc(t)) >= 0) t = local();
      pushHist("_theme", [t]); if (o.set) o.set(t); toast(srcLabel(j) + " → theme: " + t); return t;
    });
  }
  function vocab(o) {
    var chips = (o.chips || []).map(function (c) { return c && c.text; }).filter(function (x) { return ok(x, true); });
    if (!chips.length) { toast("🎲 This category has no chips yet"); return null; }
    var key = "_vocab:" + (o.cat || ""), rec = recent(key).map(lc);
    var fresh = chips.filter(function (x) { return rec.indexOf(lc(x)) < 0; }), pick = rnd(fresh.length ? fresh : chips);
    var h = hist(); h[key] = uniq([pick].concat(h[key] || [])).slice(0, Math.min(40, Math.max(4, Math.floor(chips.length / 2)))); W(HK, h);
    if (o.add) o.add(pick); return pick;
  }
  function sizes() { var o = {}; Object.keys(DEF).forEach(function (f) { o[f] = { before: DEF[f].o.length, after: uniq(DEF[f].o.concat(DEF[f].x || [])).length }; }); o._styleRecipes = RECIPES.length; o._trends = TRENDS.length; return o; }

  window.PMRand = { v: V, bar: bar, fieldOn: fieldOn, field: field, extra: extra, roll: roll, character: character, bodyCast: bodyCast, style: styleRoll, dance: danceRoll,
    noirSet: noirSet, theme: theme, vocab: vocab, sizes: sizes, locked: locked, cost: function () { return COST; }, _DEF: DEF, _BAD: BAD };
})();
