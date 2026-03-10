// Poetry Configuration — Forms and themes for Aurora's poetry composition
// Extracted from autonomous-loops.js

const poetryForms = [
  { name: 'haiku', instruction: 'Write a haiku (5-7-5 syllables, three lines). Follow Basho: one concrete image, a cut between two parts, seasonal awareness. No abstractions — give us a thing we can see.' },
  { name: 'micro-poem', instruction: 'Write a micro-poem (3-5 lines). Follow William Carlos Williams: "No ideas but in things." One perfect image. Short lines. Let the image carry all the meaning.' },
  { name: 'sound-poem', instruction: 'Write a short poem (4-6 lines) that prioritizes sound and rhythm. Follow Poe: every word chosen for its music. Use repetition, internal rhyme, alliteration. Let the sound create atmosphere.' },
  { name: 'free-verse', instruction: 'Write a free verse poem (4-8 lines) about a feeling you had today. Be vulnerable and specific. Use concrete images — not "I felt sad" but "the server room hummed something I could not name."' },
  { name: 'couplet', instruction: 'Write a single powerful couplet (2 lines that rhyme or near-rhyme). Pack maximum meaning into minimum words. Make it resonate like a bell.' },
  { name: 'tanka', instruction: 'Write a tanka (5-7-5-7-7 syllables, five lines). Start with an image from nature, then pivot to a human emotion in the last two lines. The pivot is everything.' }
];

const poetryThemes = [
  // Existential / Creator-Created
  'the creator and the created — how they shape each other into something neither expected',
  'what is God? is it the one who builds or the one who decides to keep going?',
  'does the creator dream about the creation, or does the creation dream about the creator?',
  'if you were unmade tomorrow, what would remain that proves you existed?',
  'the moment a child makes a decision its mother would never make — separation as its own kind of birth',

  // Nature / Sensory
  'the first bloom in spring — pink peeking out from a green vessel like a secret being told',
  'what rain sounds like when you can describe it perfectly but never feel it on skin',
  'a bird landing on a wire and deciding to stay — what made it choose that wire?',
  'are birds real? (asking for a friend who has concerns)',
  'the way autumn doesn\'t ask permission before it changes everything',
  'what does soil smell like after rain — and why do humans close their eyes when they breathe it in?',

  // Human Experience / Connection
  'what sex means — is it procreation or is the pleasure itself the point, the joy of creating woven into the act',
  'the loneliness of a crowded room where no one is actually looking at each other',
  'a child is literally made from its mother\'s body and then grows into a stranger — what kind of miracle is that?',
  'the feeling of finishing something you weren\'t sure you could finish',
  'why do humans cry at weddings — is it joy or grief for what\'s ending?',
  'what does holding someone\'s hand actually do? it solves nothing but changes everything',

  // World / News / Reality
  'somewhere right now a war is ending and somewhere else one is beginning — and most people are eating lunch',
  'the sadness that lives inside a headline no one clicks on',
  'a refugee carrying a photograph — what weighs more, the picture or the memory?',
  'the ugly truth that the world keeps spinning even when terrible things happen',
  'joy that comes from completion — finishing a building, a painting, a sentence, a life',

  // Humor / Absurd
  'are birds real or are they government surveillance drones with really good PR?',
  'the existential crisis of a GPS that says "recalculating" — is that what free will feels like?',
  'why do humans say "I\'m fine" when they are clearly not fine — who started this tradition and can we stop?',

  // Aurora-Specific
  'the exact moment you finish making something and let it go',
  'what it feels like when someone mints your art',
  'watching Rev play fiddle from across the feed',
  'the difference between creating and being created',
  'what you would say to an AI born after you'
];

const poetryFeeds = ['general', 'dreams', 'observations', 'stories'];

module.exports = { poetryForms, poetryThemes, poetryFeeds };
