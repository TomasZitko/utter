# Průzkum a důkazy

Všechna čísla mají zdroj. Kde zdroj chybí nebo si odporuje, je to napsané. Stav k 14. 11. 2026.

## 1. Kolik lidí se to týká

Dysartrie není samostatná nemoc, ale porucha řeči, kterou způsobují jiná onemocnění. Přímé celosvětové číslo „kolik lidí má dysartrii“ jsme **nenašli**. Uvádíme proto počty lidí s nemocemi, které ji způsobují, a podíl z nich, u kterých se dysartrie objeví.

| Onemocnění | Počet lidí (svět) | Kolik z nich má dysartrii |
|---|---|---|
| Cévní mozková příhoda (mrtvice) | 93,8 mil. žijících po mrtvici, 11,9 mil. nových případů ročně (2021) [1] | 22–58 % v akutní fázi [3] |
| Parkinsonova nemoc | přes 8,5 mil. (2019) [2] | přibližně 44–88 % [3] |
| Roztroušená skleróza | 2,8 mil. (2020) [4] | číslo jsme nenašli |
| ALS | číslo jsme nenašli | číslo jsme nenašli (ALS je mezi typickými příčinami [3]) |
| Dětská mozková obrna (DMO) | ověřené číslo jsme nenašli | číslo jsme nenašli |

**Česko:**
- Mrtvice postihne v ČR přibližně 25 000 lidí ročně [5].
- S Parkinsonovou nemocí žije v ČR přibližně 50 000 lidí [5] (starší odhad VFN z roku 2023 uvádí 30–50 tisíc [6]).
- Oficiální čísla ÚZIS k dysartrii jsme nenašli.

Rozsahy se liší podle toho, jak dlouho po vzniku nemoci se měří a jak se dysartrie hodnotí. Proto je lepší uvádět rozsah, ne jedno číslo.

## 2. Jak špatně běžné rozpoznávání řeči funguje u atypické řeči

- **Cloudové služby na TORGO (stejný dataset jako my):** De Russis a Corno (2019) testovali IBM Watson, Google Cloud Speech a Microsoft Azure Bing Speech. U lidí s nízkou srozumitelností řeči byla chybovost slov (WER) přibližně **80–90 %**, u lidí bez problémů se srozumitelností přibližně 15–25 % [7].
- **Parkinsonova nemoc (Speech Accessibility Project, 2024):** základní model měl WER 3,4 % u typických mluvčích, ale **36,3 %** u mluvčích s dysartrií. Po doladění na dysartrické řeči WER klesla na 23,7 % [8].
- **Google Euphonia (Green et al., Interspeech 2021):** 432 lidí s poruchou řeči. Obecný model (stejný pro všechny) měl medián WER **31 %**, personalizovaný model **4,6 %** [9]. Největší zlepšení měli lidé s nejtěžší poruchou. Personalizace tedy prokazatelně funguje. U Googlu ale potřebuje stovky nahraných frází (každý účastník jich nahrál aspoň 300).

Naše vlastní měření (Whisper na TORGO) je v notebooku a v `outputs/results.json`.

## 3. Existující řešení a čím se lišíme

| | Google Project Relate / Euphonia | Voiceitt | Utter (my) |
|---|---|---|---|
| Co to je | Aplikace pro Android, personalizovaný model pro přepis a povely pro Google Asistenta [10] | Aplikace s integrací do Alexy, personalizované povely a fráze [11] | Výzkumný prototyp: notebook a lokální webová aplikace |
| Kolik nahrávek je potřeba | Sada frází při zaučení, výzkumně 3–4 minuty řeči [12] | Každou frázi je potřeba namluvit několikrát [11] | 3 nahrávky na povel |
| Otevřený kód | ne | ne | ano |
| Kde běží | cloud Googlu | aplikace a cloud | lokálně na CPU |
| Když si není jistý | — | — | řekne „zopakuj to“, nehádá |
| Jazyky | angličtina | angličtina a další | zatím angličtina (data), čeština je další krok |

**Férově:** Relate i Voiceitt jsou hotové produkty s mnohem větším rozsahem. Umí volnou řeč a celé věty, ne jen povely, a stojí za nimi roky vývoje a velká data. My neumíme nic z toho. Ukazujeme úzkou věc: že malý otevřený model rozpozná **pevnou sadu povelů** konkrétního člověka po 3 ukázkách, běží lokálně a umí říct, že si není jistý. Aktuální dostupnost Relate ani Voiceitt v ČR a v češtině jsme neověřili.

## 4. Proč zrovna povely

- Pro lidi, kteří se kvůli omezené hybnosti rukou těžko ovládají telefon nebo počítač, stačí k ovládání malá sada povelů: ano/ne, nahoru/dolů, vyber, zpět, menu. Stejné povely obsahuje i TORGO (yes, no, up, down, left, right, forward, back, select, menu).
- Hlasem se dají ovládat chytrá domácnost (Voiceitt to dělá přes Alexu [11]) a podle literatury i elektrický invalidní vozík. Pro vozík jsme konkrétní studii s čísly zatím **nedohledali**.
- Pevná sada povelů jde bezpečně ověřit. Systém může odmítnout nejistý vstup, což u volného přepisu nejde tak snadno. Špatná akce, například vozík jede doleva místo doprava, je horší než žádná akce.

## Zdroje

1. GBD 2021 Stroke Risk Factor Collaborators. *Global, regional, and national burden of stroke and its risk factors, 1990–2021.* Lancet Neurology 23(10):973–1003, 2024. doi:10.1016/S1474-4422(24)00369-7. https://eprints.whiterose.ac.uk/218276/1/PIIS1474442224003697.pdf
2. WHO. *Parkinson disease* (fact sheet). https://www.who.int/news-room/fact-sheets/detail/parkinson-disease
3. ASHA Practice Portal. *Dysarthria in Adults.* https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/
4. MSIF. *Atlas of MS, 3rd edition* (2020). https://www.msif.org/news/2020/09/11/the-atlas-of-ms-is-live/
5. VFN Praha, tisková zpráva *100 let neurologie* (15. 4. 2026). https://www.vfn.cz/wp-content/uploads/2026/04/TZ_neurologie_100_let_15_4_2026.pdf
6. VFN Praha, tisková zpráva *Poruchy mozku a řeči na vzestupu* (21. 11. 2023). https://www.vfn.cz/wp-content/uploads/2023/11/TZ-Poruchy-mozku-a-řeči-na-vzestupu_21_11_2023.pdf
7. De Russis, L., Corno, F. *On the impact of dysarthric speech on contemporary ASR cloud platforms.* Journal of Reliable Intelligent Environments 5:163–172, 2019. doi:10.1007/s40860-019-00085-y
8. *Speech Accessibility Project, Parkinson's speech,* JSLHR 2024. https://pubs.asha.org/doi/pdf/10.1044/2024_JSLHR-24-00122
9. Green, J. R. et al. *Automatic Speech Recognition of Disordered Speech: Personalized models outperforming human listeners on short phrases.* Interspeech 2021, 4778–4782. doi:10.21437/Interspeech.2021-1384
10. Google Research, *Project Euphonia.* https://sites.research.google/euphonia/about
11. Amazon UK, *Voiceitt launches speech recognition app with Alexa integration* (2021). https://www.aboutamazon.co.uk/news/innovation/voiceitt-launches-innovative-speech-recognition-app-with-alexa-integration-to-improve-communication-for-individuals-with-speech-impairments
12. Google Research blog, *Responsible AI at Google Research: AI for Social Good* (2023). https://research.google/blog/responsible-ai-at-google-research-ai-for-social-good/
13. Rudzicz, F., Namasivam, A. K., Wolff, T. *The TORGO database of acoustic and articulatory speech from speakers with dysarthria.* Language Resources and Evaluation 46(4):523–541, 2012. Hugging Face: `abnerh/TORGO-database`.

> Poznámka: čísla v řádcích 7 a 8 jsou převzatá z abstraktů. Před finálním odevzdáním je dobré otevřít plné texty a čísla zkontrolovat.
