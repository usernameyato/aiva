#!/usr/bin/env python3
"""
Script: input a Russian word, output its 'phonemes' (fallback to letters) and corresponding visemes.
It uses a simple letter-based approach if phonemizer isn't available.
"""

import shutil
# Mapping of Russian phonemes/letters to viseme targets
PHONEME_TO_VISEME = {
    # Vowels
    "а":  "viseme_aa",
    "о":  "viseme_oh",
    "у":  "viseme_uu",
    "ы":  "viseme_ih",
    "э":  "viseme_eh",
    "и":  "viseme_iy",
    "е":  "viseme_ey",
    "ё":  "viseme_oh",
    "ю":  "viseme_uw",
    "я":  "viseme_aa",
    # Sonorants
    "л":  "viseme_l",
    "р":  "viseme_r",
    "й":  "viseme_y",
    "м":  "viseme_m",
    "н":  "viseme_n",
    # Plosives
    "п":  "viseme_pp",
    "б":  "viseme_pp",
    "т":  "viseme_t",
    "д":  "viseme_t",
    "к":  "viseme_k",
    "г":  "viseme_k",
    # Fricatives
    "ф":  "viseme_fv",
    "в":  "viseme_fv",
    "с":  "viseme_s",
    "з":  "viseme_s",
    "ш":  "viseme_sh",
    "ж":  "viseme_sh",
    "х":  "viseme_k",
    "ц":  "viseme_s",
    "ч":  "viseme_ch",
    "щ":  "viseme_ch",
    # Soft signs/punctuation
    "ь":  "mouthOpen",
    "ъ":  "mouthOpen",
    " ":  "mouthOpen",
    ",":  "mouthOpen",
    ".":  "mouthOpen",
}

def map_phoneme_to_viseme(phoneme):
    """Return viseme name for a given phoneme/letter."""
    return PHONEME_TO_VISEME.get(phoneme.lower(), "mouthOpen")


def get_phonemes(word):
    """
    Obtain phonemes for a Russian word using phonemizer if available; fallback to letters.
    """
    # Try phonemizer if installed
    try:
        from phonemizer import phonemize
        # detect backend
        if shutil.which("espeak-ng"):
            backend = "espeak-ng"
        elif shutil.which("espeak"):
            backend = "espeak"
        else:
            raise ImportError
        phones_str = phonemize(
            word,
            language='ru',
            backend=backend,
            strip=True,
            preserve_punctuation=False
        )
        phonemes = phones_str.split()
        if phonemes:
            return phonemes
    except Exception:
        pass
    # Fallback to letter-by-letter
    return list(word)


def main():
    print("Введите слово для конвертации в visemes:")
    word = input().strip()
    phonemes = get_phonemes(word)
    visemes = [map_phoneme_to_viseme(ph) for ph in phonemes]
    print("Фонемы:", phonemes)
    print("Visemes:", visemes)


if __name__ == "__main__":
    main()
