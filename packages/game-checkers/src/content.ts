/**
 * Checkers learnability content: rules and tutorial steps per rule variant,
 * in English and Swahili. Each variant states its board, king movement,
 * capture directions, maximal-capture rule, promotion timing and draw rules.
 */

import type { CheckersVariant } from "./state";

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

export type CheckersContent = Record<
  CheckersVariant,
  { rules: RulesSection[]; tutorial: TutorialStep[] }
>;

// ---- English -------------------------------------------------------------------

const goalEn: RulesSection = {
  heading: "Goal",
  body: ["Capture all of your opponent's pieces, or leave them with no legal move."],
};

const winEn: RulesSection = {
  heading: "Winning",
  body: [
    "You win when your opponent has no pieces left, or cannot move at the start of their turn.",
  ],
};

const difficultyEn: RulesSection = {
  heading: "Bot difficulty",
  body: [
    "Easy plays any legal move at random — good for learning.",
    "Normal looks a couple of moves ahead and avoids simple traps.",
    "Hard searches deeper and weighs material, kings, mobility and threats.",
  ],
};

const rulesEn: Record<CheckersVariant, RulesSection[]> = {
  drafti: [
    goalEn,
    {
      heading: "Board and setup",
      body: [
        "Drafti is Tanzanian checkers on an 8×8 board, played on the dark squares only.",
        "Each player starts with 12 men on the three rows nearest them. You move first.",
      ],
    },
    {
      heading: "Moving",
      body: [
        "Men move one square diagonally forward, never backward.",
        "Kings are flying: they move any number of empty squares along a diagonal, forward or backward.",
      ],
    },
    {
      heading: "Capturing",
      body: [
        "Capturing is compulsory. Men capture forward only; kings capture in every direction and from a distance, landing on any empty square beyond.",
        "You may choose any capture — there is no need to take the most pieces, and kings have no priority.",
        "Once you start a sequence you must finish it, and captured pieces are removed as they are jumped.",
      ],
    },
    {
      heading: "Promotion",
      body: [
        "A man that reaches the far row becomes a king. If it gets there during a capture, the move ends there.",
      ],
    },
    {
      heading: "Draws",
      body: [
        "One king each, or two kings each, is an immediate draw.",
        "Three kings against one must win within 12 of their own moves, or the game is drawn.",
        "The same position with the same player to move three times is a draw.",
      ],
    },
    winEn,
    difficultyEn,
  ],
  english: [
    goalEn,
    {
      heading: "Board and setup",
      body: [
        "English/American checkers is played on an 8×8 board, on the dark squares only.",
        "Each player starts with 12 men on the three rows nearest them. You move first.",
      ],
    },
    {
      heading: "Moving",
      body: [
        "Men move one square diagonally forward, never backward.",
        "Kings are short: they move exactly one square diagonally, forward or backward.",
      ],
    },
    {
      heading: "Capturing",
      body: [
        "Capturing is compulsory. Men capture forward only; kings capture forward and backward, one jump at a time.",
        "You may choose any capture — there is no need to take the most pieces.",
        "Once you start a sequence you must finish it.",
      ],
    },
    {
      heading: "Promotion",
      body: [
        "A man that reaches the far row is crowned a king. Crowning during a capture ends the move.",
      ],
    },
    {
      heading: "Draws",
      body: [
        "The same position with the same player to move three times is a draw.",
        "Forty moves by each player with no capture and no man move is a draw.",
      ],
    },
    winEn,
    difficultyEn,
  ],
  international: [
    goalEn,
    {
      heading: "Board and setup",
      body: [
        "International draughts is played on a 10×10 board, on the dark squares only.",
        "Each player starts with 20 men on the four rows nearest them. You move first.",
      ],
    },
    {
      heading: "Moving",
      body: [
        "Men move one square diagonally forward, never backward.",
        "Kings are flying: they move any number of empty squares along a diagonal, forward or backward.",
      ],
    },
    {
      heading: "Capturing",
      body: [
        "Capturing is compulsory. Men capture both forward and backward; kings capture in every direction and from a distance.",
        "You must take the maximum number of pieces available, choosing freely only between sequences that take that many.",
        "Jumped pieces stay on the board until the move ends: you cannot jump a piece twice or pass over it again.",
      ],
    },
    {
      heading: "Promotion",
      body: [
        "A man becomes a king only when its move stops on the far row. Passing over it during a capture keeps it a man, and it keeps capturing as a man.",
      ],
    },
    {
      heading: "Draws",
      body: [
        "The same position with the same player to move three times is a draw.",
        "Twenty-five moves by each player with only king moves and no capture is a draw.",
        "King against king is a draw.",
        "Three kings, two kings and a man, or a king and two men against a lone king must win within 16 moves each, or the game is drawn.",
      ],
    },
    winEn,
    difficultyEn,
  ],
};

const tutorialEn = (board: string): TutorialStep[] => [
  {
    target: '[data-tour="checkers-board"]',
    title: "Move forward",
    content: `Your men move one square diagonally forward on the dark squares of the ${board} board. Tap a piece, then a highlighted square.`,
  },
  {
    target: '[data-tour="checkers-capture"]',
    title: "Captures come first",
    content:
      "When you can jump an enemy piece you must. The board shows the capture path and the pieces you will take.",
  },
  {
    target: '[data-tour="checkers-board"]',
    title: "Keep jumping",
    content:
      "If another jump is possible after landing, the capture continues — the whole sequence is one move.",
  },
  {
    target: '[data-tour="checkers-board"]',
    title: "Crown a king",
    content: "Reach the far row to promote your man to a king, marked with a crown.",
  },
];

// ---- Swahili -------------------------------------------------------------------

const goalSw: RulesSection = {
  heading: "Lengo",
  body: ["Kula kete zote za mpinzani wako, au mwache bila hatua halali."],
};

const winSw: RulesSection = {
  heading: "Kushinda",
  body: [
    "Unashinda mpinzani wako asipobaki na kete yoyote, au asipoweza kusogea mwanzoni mwa zamu yake.",
  ],
};

const difficultySw: RulesSection = {
  heading: "Ugumu wa roboti",
  body: [
    "Rahisi hucheza hatua yoyote halali kwa nasibu — nzuri kwa kujifunza.",
    "Kawaida huangalia hatua mbili mbele na huepuka mitego rahisi.",
    "Ngumu hutafuta kwa kina zaidi na kupima kete, wafalme, uhuru wa kusogea na vitisho.",
  ],
};

const rulesSw: Record<CheckersVariant, RulesSection[]> = {
  drafti: [
    goalSw,
    {
      heading: "Ubao na maandalizi",
      body: [
        "Drafti ni mchezo wa Tanzania kwenye ubao wa 8×8, unaochezwa kwenye miraba myeusi tu.",
        "Kila mchezaji anaanza na kete 12 kwenye safu tatu zilizo karibu naye. Wewe unaanza.",
      ],
    },
    {
      heading: "Kusogea",
      body: [
        "Kete husogea mraba mmoja kimshazari kwenda mbele, kamwe si nyuma.",
        "Wafalme hupaa: husogea miraba mitupu yoyote kimshazari, mbele au nyuma.",
      ],
    },
    {
      heading: "Kula",
      body: [
        "Kula ni lazima. Kete hula kwenda mbele tu; wafalme hula pande zote na kutoka mbali, wakitua kwenye mraba wowote mtupu baada yake.",
        "Unaweza kuchagua kula yoyote — si lazima kula kete nyingi zaidi, na wafalme hawana kipaumbele.",
        "Ukianza mfululizo lazima uumalize, na kete zinazoliwa huondolewa papo hapo zinaporukwa.",
      ],
    },
    {
      heading: "Kupandishwa",
      body: [
        "Kete inayofika safu ya mwisho inakuwa mfalme. Ikifika huko katikati ya kula, hatua inaishia hapo.",
      ],
    },
    {
      heading: "Sare",
      body: [
        "Mfalme mmoja kila upande, au wafalme wawili kila upande, ni sare papo hapo.",
        "Wafalme watatu dhidi ya mmoja lazima washinde ndani ya hatua zao 12, la sivyo ni sare.",
        "Hali ile ile ya ubao ikijirudia mara tatu na mchezaji yule yule akicheza ni sare.",
      ],
    },
    winSw,
    difficultySw,
  ],
  english: [
    goalSw,
    {
      heading: "Ubao na maandalizi",
      body: [
        "Drafti ya Kiingereza/Kimarekani huchezwa kwenye ubao wa 8×8, kwenye miraba myeusi tu.",
        "Kila mchezaji anaanza na kete 12 kwenye safu tatu zilizo karibu naye. Wewe unaanza.",
      ],
    },
    {
      heading: "Kusogea",
      body: [
        "Kete husogea mraba mmoja kimshazari kwenda mbele, kamwe si nyuma.",
        "Wafalme ni wafupi: husogea mraba mmoja tu kimshazari, mbele au nyuma.",
      ],
    },
    {
      heading: "Kula",
      body: [
        "Kula ni lazima. Kete hula kwenda mbele tu; wafalme hula mbele na nyuma, mruko mmoja kwa wakati.",
        "Unaweza kuchagua kula yoyote — si lazima kula kete nyingi zaidi.",
        "Ukianza mfululizo lazima uumalize.",
      ],
    },
    {
      heading: "Kupandishwa",
      body: [
        "Kete inayofika safu ya mwisho inavikwa taji kuwa mfalme. Kuvikwa taji katikati ya kula kunamaliza hatua.",
      ],
    },
    {
      heading: "Sare",
      body: [
        "Hali ile ile ya ubao ikijirudia mara tatu na mchezaji yule yule akicheza ni sare.",
        "Hatua arobaini za kila mchezaji bila kula wala kusogeza kete ya kawaida ni sare.",
      ],
    },
    winSw,
    difficultySw,
  ],
  international: [
    goalSw,
    {
      heading: "Ubao na maandalizi",
      body: [
        "Drafti ya Kimataifa huchezwa kwenye ubao wa 10×10, kwenye miraba myeusi tu.",
        "Kila mchezaji anaanza na kete 20 kwenye safu nne zilizo karibu naye. Wewe unaanza.",
      ],
    },
    {
      heading: "Kusogea",
      body: [
        "Kete husogea mraba mmoja kimshazari kwenda mbele, kamwe si nyuma.",
        "Wafalme hupaa: husogea miraba mitupu yoyote kimshazari, mbele au nyuma.",
      ],
    },
    {
      heading: "Kula",
      body: [
        "Kula ni lazima. Kete hula mbele na nyuma; wafalme hula pande zote na kutoka mbali.",
        "Lazima ule idadi kubwa zaidi ya kete inayowezekana, ukichagua kwa uhuru tu kati ya mifululizo inayokula kiasi hicho.",
        "Kete zilizorukwa hubaki ubaoni hadi hatua iishe: huwezi kuruka kete mara mbili wala kupita juu yake tena.",
      ],
    },
    {
      heading: "Kupandishwa",
      body: [
        "Kete inakuwa mfalme tu hatua yake ikisimama kwenye safu ya mwisho. Ikipita juu yake katikati ya kula inabaki kete ya kawaida, na inaendelea kula kama kete ya kawaida.",
      ],
    },
    {
      heading: "Sare",
      body: [
        "Hali ile ile ya ubao ikijirudia mara tatu na mchezaji yule yule akicheza ni sare.",
        "Hatua ishirini na tano za kila mchezaji za wafalme tu bila kula ni sare.",
        "Mfalme dhidi ya mfalme ni sare.",
        "Wafalme watatu, wafalme wawili na kete, au mfalme na kete mbili dhidi ya mfalme pekee lazima washinde ndani ya hatua 16 za kila upande, la sivyo ni sare.",
      ],
    },
    winSw,
    difficultySw,
  ],
};

const tutorialSw = (board: string): TutorialStep[] => [
  {
    target: '[data-tour="checkers-board"]',
    title: "Sogea mbele",
    content: `Kete zako husogea mraba mmoja kimshazari kwenda mbele kwenye miraba myeusi ya ubao wa ${board}. Gusa kete, kisha mraba ulioangaziwa.`,
  },
  {
    target: '[data-tour="checkers-capture"]',
    title: "Kula kwanza",
    content:
      "Ukiweza kuruka kete ya adui lazima uruke. Ubao unaonyesha njia ya kula na kete utakazokula.",
  },
  {
    target: '[data-tour="checkers-board"]',
    title: "Endelea kuruka",
    content:
      "Mruko mwingine ukiwezekana baada ya kutua, kula kunaendelea — mfululizo mzima ni hatua moja.",
  },
  {
    target: '[data-tour="checkers-board"]',
    title: "Pata mfalme",
    content:
      "Fika safu ya mwisho kupandisha kete yako kuwa mfalme, mwenye alama ya taji.",
  },
];

export const checkersContent: CheckersContent = {
  drafti: { rules: rulesEn.drafti, tutorial: tutorialEn("8×8") },
  english: { rules: rulesEn.english, tutorial: tutorialEn("8×8") },
  international: { rules: rulesEn.international, tutorial: tutorialEn("10×10") },
};

export const checkersContentSw: CheckersContent = {
  drafti: { rules: rulesSw.drafti, tutorial: tutorialSw("8×8") },
  english: { rules: rulesSw.english, tutorial: tutorialSw("8×8") },
  international: { rules: rulesSw.international, tutorial: tutorialSw("10×10") },
};
