# Scénář videa (do 2:00)

Video je anglicky (porota a track AI + Languages), titulky nejsou nutné. Mluví Tomáš nebo Jonáš, klidně a pomalu.
Čísla jsou z `outputs/results.json` (běh notebooku 14. 11. 2026). **Když se notebook spustí znovu, zkontroluj, že sedí.**

| Čas | Na obrazovce | Co se říká (voiceover) |
|---|---|---|
| 0:00–0:12 | Černá obrazovka, pak záběr na Proof → „Hear it yourself“. Přehraje se nahrávka člověka s dysartrií z TORGO (např. M01 „sigh“). Pod ní titulek: *Regular assistant heard: “Ciao!”* | “This is a real recording of a person with dysarthria saying one word. A regular voice assistant heard… ‘Ciao’.” |
| 0:12–0:27 | Proof: velká čísla. Zvýraznit dlaždici Whisper **42%**. | “After a stroke, Parkinson's, ALS or cerebral palsy, speech often becomes hard to understand. Millions of people are affected, and their hands often don't work well either. Voice should be their way in, but standard speech recognition, here Whisper, understands these single words only 42% of the time.” |
| 0:27–0:50 | Aplikace Utter (desktop, telefon v rámečku). Teach → vybrat „Water“ → 3× nahrát svůj zvuk (tečky se plní) → „Water is now part of your language“. | “Utter flips the problem. Instead of asking the person to speak like everyone else, it learns their way of speaking. Pick a meaning, record your own sound three times. That's it.” |
| 0:50–1:12 | Speak → Start listening → říct zvuk → obrazovka „Water?“ s odhady a „A regular assistant heard ‘…’“ → Yes, say it → barevná obrazovka „Can I have some water, please?“ + hlas. | “Now just say it. Utter shows its guess and what a normal assistant would have heard. Nothing is spoken until you confirm. Then Utter says the full sentence out loud for you.” |
| 1:12–1:22 | Speak → zahuhlat něco nejasného → obrazovka „Not sure…“ | “And when it isn't sure, it doesn't guess. A wrong action is worse than asking again.” |
| 1:22–1:42 | Proof → graf `1_per_speaker.png` (každý člověk zvlášť), pak dlaždice 84% (Utter) a 5% (wrong actions). | “We tested this on the TORGO database: real recordings of 7 people with dysarthria. With just 2 of the person's own recordings per word, plus recordings of the same word by others, Utter picks the right word 84% of the time, versus 42% for Whisper. With the ‘not sure’ option, wrong actions drop to 5%.” |
| 1:42–1:58 | Úvodní panel vlevo (principy) nebo README. Text: *Open source · runs locally · next: Czech*. | “It's a small open model that runs on a laptop, so the voice never leaves the device. Limits: eight speakers, English, single words, lab recordings. Next: Czech, more people, and a phone app. Utter. Your voice, your language.” |

## Co musí Tomáš natočit

1. **Záznam obrazovky aplikace** (OBS nebo Win+Alt+R v Xbox Game Bar), okno prohlížeče na celou obrazovku, `http://localhost:8000`:
   - Teach → „Water“ → 3 nahrávky → hotovo (0:27–0:50),
   - naučit ještě aspoň 2 další slova předem (např. Pain, Bathroom), ať je z čeho vybírat,
   - Speak → rozpoznání → „Yes, say it“ → obrazovka s větou a hlasem (0:50–1:12),
   - Speak → nejasný zvuk → „Not sure…“ (1:12–1:22). Když se to nepovede napoprvé, zkus zamumlat něco mezi dvěma slovy.
2. **Záznam obrazovky Proof tabu**: přehrání ukázky, velká čísla, graf (0:00–0:27 a 1:22–1:42).
3. **Voiceover**: nahrát text ze sloupce vpravo, klidně po jednotlivých řádcích.
4. **Volitelně**: krátký záběr na obličej nebo ruce u notebooku, ať je vidět, že je to skutečný člověk.

**Tipy:** Zvuk aplikace (hlas „Can I have some water“) nech ve videu nahlas. Mikrofon co nejblíž, v tichu. Pokud v aplikaci něco selže, stačí znovu načíst stránku: naučená slova zůstávají uložená v `data/app_state/`.
