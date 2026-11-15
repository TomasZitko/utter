# Scénář videa (do 2:00)

Video je anglicky (porota a track AI + Languages), titulky nejsou nutné. Mluví Tomáš nebo Jonáš, klidně a pomalu.
Čísla v textu jsou z `outputs/results.json`. Čísla v režimu **Real voices** se počítají živě a při každém běhu vyjdou trochu jinak, proto je ve voiceoveru neříkej zpaměti: řekni to, co je ve tvém záznamu vidět na obrazovce.

Okno prohlížeče na celou obrazovku (F11), `http://localhost:8000`. Jsou vidět tři panely: vlevo Real voices, uprostřed telefon, vpravo Engine.

| Čas | Na obrazovce | Co se říká (voiceover) |
|---|---|---|
| 0:00–0:15 | Vlevo klikni na **M02** (severe). Telefon: „Learning M02's way of speaking…“ → „Learned 8 of M02's words“. Klikni **Play an unheard recording**. Je slyšet skutečná nahrávka, telefon ukáže slovo a pod ním „A regular assistant heard ‘…’ ✗“. | “This is a real person with severe dysarthria saying one word. A regular voice assistant heard… this. Utter got it right, and it had never heard this recording before.” |
| 0:15–0:30 | Klikni **Auto-run**. Vlevo naskakují čárky skóre (Utter vs. Regular assistant), vpravo se u každé nahrávky překreslí Engine. | “After a stroke, Parkinson's, ALS or cerebral palsy, speech often becomes hard to understand, and hands often don't work well either. Voice should be the way in. But on these recordings, standard speech recognition understands only 42% of single words.” |
| 0:30–0:50 | Klikni ✕ (zpět na vlastní hlas). Teach → „Water“ → 3× nahrát svůj zvuk (tečky se plní, nahrávání se samo zastaví) → „Water is now part of your language“. | “Utter flips the problem. Instead of asking the person to speak like everyone else, it learns their way of speaking. Pick a meaning, record your own sound three times. It doesn't even have to be a word.” |
| 0:50–1:10 | Speak → Start listening → říct zvuk → „Water?“ + „A regular assistant heard ‘…’“ → Yes, say it → barevná obrazovka s větou + hlas. | “Now just say it. Utter shows its guess, and what a normal assistant would have heard. Nothing is spoken until you confirm. Then it says the full sentence out loud for you.” |
| 1:10–1:25 | Znovu Start listening → zamumlat něco nejasného → „Not sure…“. Kamera na panel Engine: dva obrázky zarovnání, pruhy vzdáleností, značka pod prahem, „Ask again“. | “And when it isn't sure, it doesn't guess, because a wrong action is worse than asking again. On the right you can see why: this is the model's real decision, the alignment with your stored recordings and the lead it needs before it acts.” |
| 1:25–1:45 | Tab **Proof**: velká čísla 42 % → 84 %, graf „Each person, before and after“, graf „It asks instead of guessing“. | “We measured it on the TORGO database, on 7 people with dysarthria. With 2 of the person's own recordings per word, plus other people's recordings of the same word, Utter picks the right word 84% of the time, versus 42% for Whisper. When it may say ‘not sure’, wrong actions drop to 5%.” |
| 1:45–2:00 | Celá obrazovka se třemi panely, nakonec logo (Blub) vlevo nahoře. | “It's a small open model that runs on a laptop in a fraction of a second, so the voice never leaves the device. Limits: eight speakers, English, single words, lab recordings. Next: Czech, real users, and a phone app. Utter. Say it your way.” |

## Co musí Tomáš natočit

1. **Záznam celé obrazovky** (OBS nebo Win+Alt+R), prohlížeč na F11, se zvukem systému (ať jsou slyšet nahrávky z TORGO i hlas aplikace).
2. **Před natáčením** nauč vlastním hlasem aspoň 3 slova (Water, Pain, Bathroom), ať je z čeho vybírat. V profilu (kolečko vlevo nahoře v telefonu) si nastav jméno a vyber hlas. Aplikace umí anglicky a česky; video toč v angličtině.
3. **Real voices** (0:00–0:30): M02 nebo M01 (těžká dysartrie) dávají největší rozdíl proti běžnému asistentovi. M04 je nejtěžší mluvčí: aplikace se u něj často „zeptá znovu“, což je taky dobrý záběr na poctivost. Když první nahrávka nevyjde hezky, klikni na ikonu „shuffle“ (jiná slova) a zkus to znovu. Nic nepřetáčej tak, aby vypadla chyba aplikace ze skóre: skóre vlevo je živé a poctivé, to je naše síla.
4. **Vlastní hlas** (0:30–1:25): Teach, rozpoznání, „Yes, say it“, a jednou „Not sure…“ (zamumlej něco mezi dvěma slovy).
5. **Proof** (1:25–1:45): pomalu sjeď přes velká čísla a první dva grafy.
6. **Voiceover**: text ze sloupce vpravo, klidně po řádcích.

**Tipy:** Mikrofon co nejblíž, v tichu. Mezerník spouští a zastavuje poslech. Když něco selže, stačí znovu načíst stránku: naučená slova zůstávají v `data/app_state/`. Notebook a server nepouštěj zároveň (dojde paměť).
