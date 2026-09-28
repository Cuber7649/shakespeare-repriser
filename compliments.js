// Compliments for random.html, one list per repriser style.
//
// This is AUTHORED content, not derived data, so unlike the dictionaries that
// tools/build-dashboard.mjs pulls out of the style pages, there is no in-repo
// source for it anywhere else. It therefore lives in the repo rather than in
// the external tools directory: tools/build-random.mjs reads and inlines this
// file, so random.html still ships as ONE self-contained file with no shared
// runtime, but the 72 reviewed lines have a recoverable source of truth.
//
// Content standard: Christian virtue, in each style's own religious idiom.
// Yoda is a fictional character and is deliberately held to the virtue reading
// only -- no God, grace or saints in his lines, since "the Force" and "the
// light" already serve as his own religious vocabulary.
//
// Family-friendly throughout. tools/test-random-data.mjs enforces this.

const COMPLIMENTS = {
  shakespeare: [
    "God keep thee, goodly sir",
    "Heaven shine upon thy countenance",
    "Thou art a soul of gentle worth",
    "Thy tongue is honest, thy heart is true",
    "Thou dost adorn the company thou keepest",
    "Grace and good conscience attend thee",
    "Thou art as welcome as the month of May",
    "Thy virtues are a crown that cannot tarnish",
    "Let heaven's favour rest upon thee",
    "Thou hast a faithful heart and a willing hand",
    "Thou art the honour of thine own house",
    "Blessings on thee, thou worthy soul",
  ],
  pirate: [
    "God bless thee, stout-hearted matey",
    "May God keep thee safe at sea",
    "Ye be a fair hand and an honest one",
    "Heaven grant ye a favourable wind",
    "Ye be a credit to every ship ye sail",
    "God speed thee well, good mate",
    "Saint Christopher watch o'er ye at sea",
    "Ye carry honour in the salt and sun",
    "The Lord grant ye a peaceful harbour",
    "Ye be the best mate a captain ever had",
    "God give ye health and a merry heart",
    "May the good saints smile upon ye",
  ],
  victorian: [
    "A Christian gentleman, and a credit to his county",
    "Your charity is a living thing",
    "Your honesty is beyond all praise",
    "Providence has been good to you, and you have honoured it",
    "You are a steady light in your household",
    "Blessed be your patience, for it has served you well",
    "Your courtesy puts others at ease",
    "You are a lamp of good breeding",
    "A true Christian, and known to be one",
    "Your goodness is a comfort to the poor",
    "You have lived a life of quiet good works",
    "God has plainly blessed your labours",
  ],
  chaucer: [
    "Blessed be thy goodness, and thy gentilesse",
    "The goostly grace of God be with thee",
    "Thou art worthy of honour among alle men",
    "thy herte is trewe, and thyn hond therto",
    "Thou hast a clere judgement in alle thynges",
    "God gyve thee solas and Ioye",
    "Thou art the beste felaw that ever I knew",
    "Thy soule shal have the joye of blisse",
    "Thou doost good to alle that thee seyn",
    "Maystow walke in pees upon thi wey",
    "Thy vois is swete and thi wordes trewe",
    "Goostly hire go with thee, and have evermore",
  ],
  yoda: [
    "Strong with the Force, you are",
    "Wise and patient, you are",
    "A Jedi true, you are",
    "Your heart is pure, it is",
    "Much to learn, you have",
    "Ready and steady, you are",
    "One who brings calm, you are",
    "The light was always within you",
    "Powerful and gentle, you are",
    "Patient and watchful, you are",
    "A worthy pupil indeed, you are",
    "Much strength in you, there is",
  ],
  norse: [
    "Odin hold thy hand, and Christ keep thee",
    "A brave heart, and God's grace with it",
    "Thou art worthy of the mead hall and of heaven",
    "May the gods' favour and God's blessing rest on thee",
    "Thou keepest thy oath before God and man",
    "A true warrior, and a righteous one",
    "Valhalla's hall is fair, but heaven is fairer",
    "Thou art a shield to thy clan, and a light to them",
    "The gods have marked thee, and heaven has kept thee",
    "May thy name be spoken in honour in song and in church",
    "Thy courage is thy inheritance, thy faith is thy shield",
    "God grant thee glory in this life and rest beyond",
  ],
};

// The order the style axis is presented in; also the display order on the page.
const STYLE_ORDER = [
  'shakespeare', 'pirate', 'victorian', 'chaucer', 'yoda', 'norse',
];

const CATEGORY_ORDER = ['roast', 'compliment', 'quote'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COMPLIMENTS, STYLE_ORDER, CATEGORY_ORDER };
}
