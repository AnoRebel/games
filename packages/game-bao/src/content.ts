/**
 * Bao learnability content: rules and tutorial steps per rule variant, in
 * English and Swahili. Consumed by the platform's rules panel and tour.
 */

import type { BaoVariant } from "./state";

export interface RulesSection {
  heading: string;
  body: string[];
}

export interface TutorialStep {
  /** CSS selector the tour highlights. */
  target: string;
  title: string;
  content: string;
}

export type BaoContent = Record<
  BaoVariant,
  { rules: RulesSection[]; tutorial: TutorialStep[] }
>;

// ---- English -------------------------------------------------------------------

const boardEn: RulesSection = {
  heading: "The board",
  body: [
    "Bao is played on a board of 4 rows of 8 pits. You own the two rows nearest you: the front row faces your opponent, the back row is behind it.",
    "The end pits of your front row are your kichwa; the pits beside them are your kimbi. Each of your front pits faces one of your opponent's front pits.",
    "You only ever sow around your own 16 pits — clockwise or anticlockwise.",
  ],
};

const sowingEn: RulesSection = {
  heading: "Sowing and relay",
  body: [
    "Pick up the seeds of a pit and drop them one at a time into the following pits.",
    "If the last seed lands in an empty pit, your turn ends.",
    "If it lands in a pit that already had seeds and nothing is captured, pick that pit up and keep sowing in the same direction (relay).",
  ],
};

const capturesEn: RulesSection = {
  heading: "Captures (compulsory)",
  body: [
    "When your sowing ends in one of your front pits that already had seeds, and the facing pit of your opponent is not empty, you capture every seed in that facing pit.",
    "Captured seeds are sown straight away from one of your kichwa. If you captured with a kichwa or kimbi, use the kichwa on that side; otherwise keep the direction you were sowing in, or choose either kichwa if no direction is set yet.",
    "Capturing is compulsory: if any capturing turn exists, you must take one. A turn that starts without a capture (kutakata) never captures.",
  ],
};

const winEn: RulesSection = {
  heading: "Winning",
  body: [
    "You win when your opponent's front row is empty at the end of your turn.",
    "You also win when your opponent cannot make a legal move at the start of their turn.",
    "A turn that sows more than 192 seeds and still needs to relay is endless — the player making it loses.",
  ],
};

const scopeEn: RulesSection = {
  heading: "About these rules",
  body: [
    "This is Bao la Kiswahili as played in Zanzibar, following Alex de Voogt's description.",
    "Two disputed optional rules are not used: blocking a pit (kutakatia) and taking two seeds from the nyumba as a tax.",
  ],
};

const difficultyEn: RulesSection = {
  heading: "Bot difficulty",
  body: [
    "Easy plays any legal turn at random — good for learning the moves.",
    "Normal looks a couple of turns ahead and grabs safe captures.",
    "Hard searches deeper and weighs seeds, front-row strength and threats.",
  ],
};

const kiswahiliRulesEn: RulesSection[] = [
  {
    heading: "Goal",
    body: ["Empty your opponent's front row, or leave them with no legal move."],
  },
  boardEn,
  {
    heading: "Setup",
    body: [
      "Each player has 32 seeds: 6 in the nyumba (the fifth front pit from your left), 2 in each of the two pits to its right, and 22 held in reserve.",
      "Reserves are public. The first player starts.",
    ],
  },
  sowingEn,
  capturesEn,
  {
    heading: "Namua: playing from your reserve",
    body: [
      "While you hold reserve seeds, every turn starts by placing one reserve seed into an occupied pit of your front row.",
      "If a placement can capture, you must place it where it captures, then sow the captured seeds.",
      "Otherwise sow the whole pit you placed into (kutakata), choosing any occupied front pit except a working nyumba.",
      "When both reserves are used up, the game moves on to mtaji.",
    ],
  },
  {
    heading: "The nyumba",
    body: [
      "Your nyumba keeps its house status until it is captured or you pick it up and sow it. It is working while it holds 6 or more seeds.",
      "During namua, a kutakata sowing that ends in your working nyumba stops there.",
      "On a capturing turn that ends in your working nyumba without capturing, choose to stop or to go on safari: pick the nyumba up and keep sowing. A capture from the nyumba always comes first.",
      "During mtaji the nyumba is an ordinary pit.",
    ],
  },
  {
    heading: "Mtaji: playing from the board",
    body: [
      "Start from any of your pits holding 2 or more seeds and sow it in either direction.",
      "A capture is compulsory when a pit of 2 to 15 seeds can end its sowing in a capture. A pit of 16 or more seeds never starts a capture.",
      "Without a capture, start from your front row if any front pit holds 2 or more seeds. If your only occupied front pit is a kichwa, sow it toward the centre.",
      "You may not relay from your back row while your front row is empty.",
    ],
  },
  winEn,
  difficultyEn,
  scopeEn,
];

const kujifunzaRulesEn: RulesSection[] = [
  {
    heading: "Goal",
    body: [
      "Empty your opponent's front row, or leave them with no legal move.",
      "Bao la Kujifunza is the learner's game: the same sowing and captures without the opening phase.",
    ],
  },
  boardEn,
  {
    heading: "Setup",
    body: [
      "Every one of the 32 pits starts with 2 seeds.",
      "There are no reserve seeds, no nyumba and no namua phase — play starts directly from the board (mtaji).",
    ],
  },
  sowingEn,
  capturesEn,
  {
    heading: "Your turn",
    body: [
      "Start from any of your pits holding 2 or more seeds and sow it in either direction.",
      "A capture is compulsory when a pit of 2 to 15 seeds can end its sowing in a capture. A pit of 16 or more seeds never starts a capture.",
      "Without a capture, start from your front row if any front pit holds 2 or more seeds. If your only occupied front pit is a kichwa, sow it toward the centre.",
      "You may not relay from your back row while your front row is empty.",
    ],
  },
  winEn,
  difficultyEn,
  {
    heading: "About these rules",
    body: [
      "These are the Bao la Kiswahili mtaji rules from Alex de Voogt's description, played from a full board.",
    ],
  },
];

const tutorialEn: TutorialStep[] = [
  {
    target: '[data-tour="bao-own-rows"]',
    title: "Your two rows",
    content:
      "These 16 pits are yours. You sow only around them — along the front row, then back along the back row.",
  },
  {
    target: '[data-tour="bao-board"]',
    title: "Sow and relay",
    content:
      "Tap a pit to pick it up, then choose a direction. If the last seed lands in an occupied pit you pick it up and keep going.",
  },
  {
    target: '[data-tour="bao-opponent-front"]',
    title: "Compulsory capture",
    content:
      "End a sowing in one of your occupied front pits opposite an occupied pit here and you capture those seeds. When a capture is possible you must take it.",
  },
];

const kiswahiliTutorialEn: TutorialStep[] = [
  ...tutorialEn,
  {
    target: '[data-tour="bao-reserve"]',
    title: "Reserve seeds",
    content:
      "While you hold reserve seeds, each turn starts by placing one of them into an occupied front pit.",
  },
  {
    target: '[data-tour="bao-nyumba"]',
    title: "The nyumba",
    content:
      "Your house pit. While it holds 6 or more seeds it can stop a sowing — or send it on safari.",
  },
];

// ---- Swahili -------------------------------------------------------------------

const boardSw: RulesSection = {
  heading: "Ubao",
  body: [
    "Bao huchezwa kwenye ubao wenye safu 4 za mashimo 8. Safu mbili zilizo karibu nawe ni zako: safu ya mbele inamkabili mpinzani wako, safu ya nyuma iko nyuma yake.",
    "Mashimo ya pembeni ya safu yako ya mbele ni kichwa chako; yaliyo kando yake ni kimbi. Kila shimo lako la mbele linakabiliana na shimo moja la mbele la mpinzani.",
    "Unapanda kete kwenye mashimo yako 16 tu — kwa mwelekeo wa saa au kinyume chake.",
  ],
};

const sowingSw: RulesSection = {
  heading: "Kupanda na kuendeleza",
  body: [
    "Chukua kete za shimo moja na uziweke moja moja kwenye mashimo yanayofuata.",
    "Kete ya mwisho ikiangukia shimo tupu, zamu yako inaisha.",
    "Ikiangukia shimo lenye kete na hakuna kinacholiwa, chukua shimo hilo na uendelee kupanda kwa mwelekeo ule ule.",
  ],
};

const capturesSw: RulesSection = {
  heading: "Kula (ni lazima)",
  body: [
    "Upandaji wako ukiishia kwenye shimo lako la mbele lililokuwa na kete, na shimo la mpinzani linalolikabili lina kete, unakula kete zote za shimo hilo.",
    "Kete ulizokula zinapandwa papo hapo kuanzia kichwa chako kimoja. Ukila kwa kichwa au kimbi, tumia kichwa cha upande huo; vinginevyo endelea na mwelekeo uliokuwa ukipanda, au chagua kichwa chochote kama mwelekeo bado haujawekwa.",
    "Kula ni lazima: ikiwa kuna zamu yoyote ya kula, lazima uichague. Zamu inayoanza bila kula (kutakata) haili kamwe.",
  ],
};

const winSw: RulesSection = {
  heading: "Kushinda",
  body: [
    "Unashinda ikiwa safu ya mbele ya mpinzani wako iko tupu mwishoni mwa zamu yako.",
    "Unashinda pia mpinzani wako asipokuwa na hatua halali mwanzoni mwa zamu yake.",
    "Zamu inayopanda zaidi ya kete 192 na bado inahitaji kuendelea haina mwisho — mchezaji wake anashindwa.",
  ],
};

const scopeSw: RulesSection = {
  heading: "Kuhusu sheria hizi",
  body: [
    "Huu ni Bao la Kiswahili kama linavyochezwa Zanzibar, kwa mujibu wa maelezo ya Alex de Voogt.",
    "Sheria mbili za hiari zinazobishaniwa hazitumiki: kuzuia shimo (kutakatia) na kutoza kete mbili kutoka nyumba.",
  ],
};

const difficultySw: RulesSection = {
  heading: "Ugumu wa roboti",
  body: [
    "Rahisi hucheza zamu yoyote halali kwa nasibu — nzuri kwa kujifunza hatua.",
    "Kawaida huangalia zamu mbili mbele na hula kete pale ilipo salama.",
    "Ngumu hutafuta kwa kina zaidi na kupima kete, nguvu ya safu ya mbele na vitisho.",
  ],
};

const kiswahiliRulesSw: RulesSection[] = [
  {
    heading: "Lengo",
    body: ["Maliza kete za safu ya mbele ya mpinzani wako, au mwache bila hatua halali."],
  },
  boardSw,
  {
    heading: "Maandalizi",
    body: [
      "Kila mchezaji ana kete 32: 6 kwenye nyumba (shimo la tano la mbele kutoka kushoto kwako), 2 kwenye kila moja ya mashimo mawili ya kulia kwake, na 22 mkononi kama akiba.",
      "Akiba zinaonekana kwa wote. Mchezaji wa kwanza huanza.",
    ],
  },
  sowingSw,
  capturesSw,
  {
    heading: "Namua: kucheza kwa akiba",
    body: [
      "Ukiwa bado na kete za akiba, kila zamu huanza kwa kuweka kete moja ya akiba kwenye shimo lenye kete katika safu yako ya mbele.",
      "Uwekaji ukiweza kula, lazima uiweke mahali inapokula, kisha upande kete ulizokula.",
      "Vinginevyo panda shimo zima ulilowekea (kutakata), ukichagua shimo lolote la mbele lenye kete isipokuwa nyumba inayofanya kazi.",
      "Akiba za wote zikiisha, mchezo unaingia mtaji.",
    ],
  },
  {
    heading: "Nyumba",
    body: [
      "Nyumba yako inabaki nyumba hadi kete zake zile au uichukue na kuipanda. Inafanya kazi ikiwa na kete 6 au zaidi.",
      "Wakati wa namua, upandaji wa kutakata unaoishia kwenye nyumba yako inayofanya kazi husimama hapo.",
      "Katika zamu ya kula inayoishia kwenye nyumba inayofanya kazi bila kula, chagua kusimama au kwenda safari: chukua nyumba na uendelee kupanda. Kula kutoka nyumba hutangulia kila mara.",
      "Wakati wa mtaji nyumba ni shimo la kawaida.",
    ],
  },
  {
    heading: "Mtaji: kucheza kutoka ubaoni",
    body: [
      "Anza na shimo lako lolote lenye kete 2 au zaidi na ulipande upande wowote.",
      "Kula ni lazima pale shimo lenye kete 2 hadi 15 linapoweza kumaliza upandaji kwa kula. Shimo lenye kete 16 au zaidi halianzishi kula.",
      "Bila kula, anza na safu ya mbele ikiwa shimo lolote la mbele lina kete 2 au zaidi. Ikiwa shimo lako pekee la mbele lenye kete ni kichwa, lipande kuelekea katikati.",
      "Huwezi kuendeleza kutoka safu ya nyuma wakati safu yako ya mbele iko tupu.",
    ],
  },
  winSw,
  difficultySw,
  scopeSw,
];

const kujifunzaRulesSw: RulesSection[] = [
  {
    heading: "Lengo",
    body: [
      "Maliza kete za safu ya mbele ya mpinzani wako, au mwache bila hatua halali.",
      "Bao la Kujifunza ni mchezo wa wanaojifunza: kupanda na kula kule kule bila hatua ya mwanzo.",
    ],
  },
  boardSw,
  {
    heading: "Maandalizi",
    body: [
      "Kila moja ya mashimo 32 huanza na kete 2.",
      "Hakuna kete za akiba, hakuna nyumba wala namua — mchezo unaanza moja kwa moja kutoka ubaoni (mtaji).",
    ],
  },
  sowingSw,
  capturesSw,
  {
    heading: "Zamu yako",
    body: [
      "Anza na shimo lako lolote lenye kete 2 au zaidi na ulipande upande wowote.",
      "Kula ni lazima pale shimo lenye kete 2 hadi 15 linapoweza kumaliza upandaji kwa kula. Shimo lenye kete 16 au zaidi halianzishi kula.",
      "Bila kula, anza na safu ya mbele ikiwa shimo lolote la mbele lina kete 2 au zaidi. Ikiwa shimo lako pekee la mbele lenye kete ni kichwa, lipande kuelekea katikati.",
      "Huwezi kuendeleza kutoka safu ya nyuma wakati safu yako ya mbele iko tupu.",
    ],
  },
  winSw,
  difficultySw,
  {
    heading: "Kuhusu sheria hizi",
    body: [
      "Hizi ni sheria za mtaji za Bao la Kiswahili kutoka maelezo ya Alex de Voogt, zikichezwa kuanzia ubao uliojaa.",
    ],
  },
];

const tutorialSw: TutorialStep[] = [
  {
    target: '[data-tour="bao-own-rows"]',
    title: "Safu zako mbili",
    content:
      "Mashimo haya 16 ni yako. Unapanda kuyazunguka tu — kwenye safu ya mbele, kisha kurudi kwenye safu ya nyuma.",
  },
  {
    target: '[data-tour="bao-board"]',
    title: "Panda na uendeleze",
    content:
      "Gusa shimo kulichukua, kisha chagua mwelekeo. Kete ya mwisho ikiangukia shimo lenye kete, unalichukua na kuendelea.",
  },
  {
    target: '[data-tour="bao-opponent-front"]',
    title: "Kula ni lazima",
    content:
      "Maliza upandaji kwenye shimo lako la mbele lenye kete linalokabili shimo lenye kete hapa, nawe unakula kete hizo. Kula kukiwezekana lazima ule.",
  },
];

const kiswahiliTutorialSw: TutorialStep[] = [
  ...tutorialSw,
  {
    target: '[data-tour="bao-reserve"]',
    title: "Kete za akiba",
    content:
      "Ukiwa bado na akiba, kila zamu huanza kwa kuweka kete moja kwenye shimo la mbele lenye kete.",
  },
  {
    target: '[data-tour="bao-nyumba"]',
    title: "Nyumba",
    content:
      "Shimo lako la nyumba. Likiwa na kete 6 au zaidi linaweza kusimamisha upandaji — au kuupeleka safari.",
  },
];

export const baoContent: BaoContent = {
  "bao-la-kiswahili": { rules: kiswahiliRulesEn, tutorial: kiswahiliTutorialEn },
  "bao-la-kujifunza": { rules: kujifunzaRulesEn, tutorial: tutorialEn },
};

export const baoContentSw: BaoContent = {
  "bao-la-kiswahili": { rules: kiswahiliRulesSw, tutorial: kiswahiliTutorialSw },
  "bao-la-kujifunza": { rules: kujifunzaRulesSw, tutorial: tutorialSw },
};
