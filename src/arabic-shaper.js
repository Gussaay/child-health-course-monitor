/**
 * @license
 * Arabic Shaper v0.1.2
 * https://github.com/amir-s/arabic-shaper
 *
 * Copyright 2012, 2015 Amir Salihefendic
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 * Date: 2015-08-16
 */

// --- START OF LIBRARY CODE ---
"use strict";

var shaper = {};

var letters = {
    0x0621: [0, 0, 0, 0, "HAMZA"],
    0x0622: [0, 0, 0, 1, "ALEF_MADDA"],
    0x0623: [0, 0, 0, 1, "ALEF_HAMZA_ABOVE"],
    0x0624: [0, 0, 1, 1, "WAW_HAMZA"],
    0x0625: [0, 0, 0, 1, "ALEF_HAMZA_BELOW"],
    0x0626: [1, 1, 1, 1, "YEH_HAMZA"],
    0x0627: [0, 0, 0, 1, "ALEF"],
    0x0628: [1, 1, 0, 1, "BEH"],
    0x0629: [0, 0, 0, 1, "TEH_MARBUTA"],
    0x062A: [1, 1, 0, 1, "TEH"],
    0x062B: [1, 1, 0, 1, "THEH"],
    0x062C: [1, 1, 0, 1, "JEEM"],
    0x062D: [1, 1, 0, 1, "HAH"],
    0x062E: [1, 1, 0, 1, "KHAH"],
    0x062F: [0, 0, 0, 1, "DAL"],
    0x0630: [0, 0, 0, 1, "THAL"],
    0x0631: [0, 0, 0, 1, "REH"],
    0x0632: [0, 0, 0, 1, "ZAIN"],
    0x0633: [1, 1, 0, 1, "SEEN"],
    0x0634: [1, 1, 0, 1, "SHEEN"],
    0x0635: [1, 1, 0, 1, "SAD"],
    0x0636: [1, 1, 0, 1, "DAD"],
    0x0637: [1, 1, 0, 1, "TAH"],
    0x0638: [1, 1, 0, 1, "ZAH"],
    0x0639: [1, 1, 1, 1, "AIN"],
    0x063A: [1, 1, 1, 1, "GHAIN"],
    0x0640: [1, 1, 1, 1, "TATWEEL"],
    0x0641: [1, 1, 1, 1, "FEH"],
    0x0642: [1, 1, 1, 1, "QAF"],
    0x0643: [1, 1, 1, 1, "KAF"],
    0x0644: [1, 1, 1, 1, "LAM"],
    0x0645: [1, 1, 0, 1, "MEEM"],
    0x0646: [1, 1, 0, 1, "NOON"],
    0x0647: [1, 1, 1, 1, "HEH"],
    0x0648: [0, 0, 0, 1, "WAW"],
    0x0649: [0, 0, 1, 1, "ALEF_MAKSURA"],
    0x064A: [1, 1, 1, 1, "YEH"],
    0x064B: [1, 1, 0, 1, "TANWEEN_FATH"],
    0x064C: [1, 1, 0, 1, "TANWEEN_DAMM"],
    0x064D: [1, 1, 0, 1, "TANWEEN_KASR"],
    0x064E: [1, 1, 1, 1, "FATHA"],
    0x064F: [1, 1, 1, 1, "DAMMA"],
    0x0650: [1, 1, 1, 1, "KASRA"],
    0x0651: [1, 1, 1, 1, "SHADDA"],
    0x0652: [1, 1, 1, 1, "SUKUN"],
    0x0653: [0, 0, 0, 1, "MADDAH_ABOVE"],
    0x0654: [0, 0, 0, 1, "HAMZA_ABOVE"],
    0x0655: [0, 0, 0, 1, "HAMZA_BELOW"],

    // Ligatures
    0xFBEA: [1, 1, 0, 1, "HEH_DOACHASHMEE"],
    0x0679: [1, 1, 0, 1, "TEH_MARBUTA_GOAL"],
    0x0686: [1, 1, 0, 1, "TCHEH"],
    0x067E: [1, 1, 0, 1, "PEH"],
    0x06A9: [1, 1, 1, 1, "KEHEH"],
    0x06AF: [1, 1, 0, 1, "GAF"],
    0x06CC: [1, 1, 1, 1, "FARSI_YEH"]
};

var supported_chars = Object.keys(letters);

var letters_map = {};
for (var i = 0, len = supported_chars.length; i < len; i++) {
    var letter_char = supported_chars[i];
    letters_map[letter_char] = letters[letter_char];
}
supported_chars = null;


var forms = {
    // FEH
    0x0641: [0xFB50, 0xFB51, 0xFE91, 0xFE92],

    // QAF
    0x0642: [0xFB54, 0xFB55, 0xFE95, 0xFE96],

    // KAF
    0x0643: [0xFB58, 0xFB59, 0xFE99, 0xFE9A],

    // LAM
    0x0644: [0xFB5C, 0xFB5D, 0xFE9D, 0xFE9E],

    // MEEM
    0x0645: [0xFB60, 0xFB61, 0xFEA1, 0xFEA2],

    // NOON
    0x0646: [0xFB64, 0xFB65, 0xFEA5, 0xFEA6],

    // HEH
    0x0647: [0xFB68, 0xFB69, 0xFEA9, 0xFEAA],

    // YEH
    0x064A: [0xFB72, 0xFB73, 0xFEF1, 0xFEF2],

    // AIN
    0x0639: [0, 0, 0xFEC9, 0xFECA],

    // GHAIN
    0x063A: [0, 0, 0xFECD, 0xFECE],

    // BEH
    0x0628: [0, 0, 0xFE90, 0xFE8F],

    // TEH
    0x062A: [0, 0, 0xFE98, 0xFE97],

    // THEH
    0x062B: [0, 0, 0xFE9C, 0xFE9B],

    // JEEM
    0x062C: [0, 0, 0xFEA0, 0xFE9F],

    // HAH
    0x062D: [0, 0, 0xFEA4, 0xFEA3],

    // KHAH
    0x062E: [0, 0, 0xFEA8, 0xFEA7],

    // SEEN
    0x0633: [0, 0, 0xFEB2, 0xFEB1],

    // SHEEN
    0x0634: [0, 0, 0xFEB6, 0xFEB5],

    // SAD
    0x0635: [0, 0, 0xFEBA, 0xFEB9],

    // DAD
    0x0636: [0, 0, 0xFEBE, 0xFEBD],

    // TAH
    0x0637: [0, 0, 0xFEC2, 0xFEC1],

    // ZAH
    0x0638: [0, 0, 0xFEC6, 0xFEC5],

    // YEH_HAMZA
    0x0626: [0, 0, 0xFE8A, 0xFE89],

    // FARSI_YEH
    0x06CC: [0, 0, 0xFBFC, 0xFBFD],

    // HEH_DOACHASHMEE
    0xFBEA: [0, 0, 0xFBE8, 0xFBE9],

    // TEH_MARBUTA_GOAL
    0x0679: [0, 0, 0xFB93, 0xFB92],

    // TCHEH
    0x0686: [0, 0, 0xFBD8, 0xFBD7],

    // PEH
    0x067E: [0, 0, 0xFB57, 0xFB56],

    // KEHEH
    0x06A9: [0, 0, 0xFBD4, 0xFBD3],

    // GAF
    0x06AF: [0, 0, 0xFB91, 0xFB90]
};

var ligatures = {
    0xFEEA: {
        0xFEFC: 0xFDF2
    }
};

var special_ligatures = {
    // LAM_ALEF
    0x0644: {
        0x0622: 0xFEF5,
        0x0623: 0xFEF7,
        0x0625: 0xFEF9,
        0x0627: 0xFEFB
    }
};


function is_supported(letter) {
    return (letter in letters_map);
}

function is_ligature(letter) {
    return (letter in ligatures);
}

function is_special_ligature(letter) {
    return (letter in special_ligatures);
}

function get_letter_form(letter, form) {
    if (is_supported(letter) === false) {
        return letter;
    }

    var letter_forms = forms[letter];
    if (!letter_forms) {
        return letter;
    }

    return letter_forms[form];
}

function get_ligature(letter, next_letter) {
    if (is_ligature(letter) === false) {
        return undefined;
    }

    var letter_ligatures = ligatures[letter];
    if (next_letter in letter_ligatures) {
        return letter_ligatures[next_letter];
    } else {
        return undefined;
    }
}

function get_special_ligature(letter, next_letter) {
    if (is_special_ligature(letter) === false) {
        return undefined;
    }

    var letter_ligatures = special_ligatures[letter];
    if (next_letter in letter_ligatures) {
        return letter_ligatures[next_letter];
    } else {
        return undefined;
    }
}


shaper.shape = function(text) {
    var text_length = text.length;
    if (text_length === 0) {
        return "";
    }

    var result = "";

    for (var i = 0; i < text_length; i++) {
        var current_char = text.charCodeAt(i);

        if (is_supported(current_char) === false) {
            result += String.fromCharCode(current_char);
            continue;
        }

        var prev_char = (i === 0) ? 0 : text.charCodeAt(i - 1);
        var next_char = (i === text_length - 1) ? 0 : text.charCodeAt(i + 1);

        var prev_letter = letters_map[prev_char];
        var current_letter = letters_map[current_char];
        var next_letter = letters_map[next_char];

        var form = 0;

        if (prev_letter && prev_letter[2] === 1 && current_letter[3] === 1) {
            // Initial
            if (next_letter && next_letter[3] === 1 && current_letter[2] === 1) {
                form = 1;
            }
            // Medial
            else {
                form = 2;
            }
        }
        // Final
        else {
            // Isolated
            if (next_letter && next_letter[3] === 1 && current_letter[2] === 1) {
                form = 3;
            }
        }

        var shaped_char = get_letter_form(current_char, form);
        if (shaped_char === 0) {
            shaped_char = current_char;
        }

        var special_ligature = get_special_ligature(current_char, next_char);
        if (special_ligature) {
            shaped_char = special_ligature;

            // Skip next char
            i += 1;
        } else {
            var ligature = get_ligature(shaped_char, next_char);
            if (ligature) {
                shaped_char = ligature;

                // Skip next char
                i += 1;
            }
        }

        result += String.fromCharCode(shaped_char);
    }

    return result;
};

// --- END OF LIBRARY CODE ---

// This is the new line that fixes the error
export default shaper;
