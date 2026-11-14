# Research and evidence

Every number has a source. Where a source is missing or sources disagree, we say so. As of 14 Nov 2026. (Czech version: [research_cz.md](research_cz.md).)

## 1. How many people this affects

Dysarthria isn't a disease on its own. It is a speech disorder caused by other conditions. We **did not find** a direct worldwide figure for "how many people have dysarthria". So we list the number of people with the conditions that cause it, and the share of them who develop dysarthria.

| Condition | People (worldwide) | How many of them have dysarthria |
|---|---|---|
| Stroke | 93.8 million living after a stroke, 11.9 million new cases per year (2021) [1] | 22–58% in the acute phase [3] |
| Parkinson's disease | over 8.5 million (2019) [2] | roughly 44–88% [3] |
| Multiple sclerosis | 2.8 million (2020) [4] | figure not found |
| ALS | figure not found | figure not found (ALS is among the typical causes [3]) |
| Cerebral palsy | no verified figure found | figure not found |

**Czech Republic (our home country):**
- About 25,000 people a year have a stroke [5].
- About 50,000 people live with Parkinson's disease [5] (an older 2023 estimate from the same hospital says 30–50 thousand [6]).
- We didn't find official national figures for dysarthria.

The ranges vary with how long after onset it is measured and how dysarthria is assessed, so a range is more honest than a single number.

## 2. How badly regular speech recognition works on atypical speech

- **Cloud services on TORGO (the same dataset we use):** De Russis and Corno (2019) tested IBM Watson, Google Cloud Speech and Microsoft Azure Bing Speech. For people with low speech intelligibility, the word error rate (WER) was about **80–90%**; for people without intelligibility problems, about 15–25% [7].
- **Parkinson's disease (Speech Accessibility Project, 2024):** the base model had a WER of 3.4% for typical speakers but **36.3%** for speakers with dysarthria. After fine-tuning on dysarthric speech, WER dropped to 23.7% [8].
- **Google Euphonia (Green et al., Interspeech 2021):** 432 people with speech impairments. A general model (the same for everyone) had a median WER of **31%**, a personalised model **4.6%** [9]. The people with the most severe impairments improved the most. Personalisation clearly works. Google's version, however, needs hundreds of recorded phrases (each participant recorded at least 300).

Our own measurement (Whisper on TORGO single words: 42% correct for people with dysarthria, 73% for people without) is in the notebook and in `outputs/results.json`.

## 3. Existing solutions and how we differ

| | Google Project Relate / Euphonia | Voiceitt | Utter (us) |
|---|---|---|---|
| What it is | Android app, personalised model for transcription and Google Assistant commands [10] | App with Alexa integration, personalised commands and phrases [11] | Research prototype: notebook and a local web app |
| Recordings needed | A set of phrases during setup; in research, 3–4 minutes of speech [12] | Each phrase must be recorded several times [11] | 3 recordings per word or sound |
| Open source | no | no | yes |
| Where it runs | Google's cloud | app and cloud | locally, on a laptop (CPU or GPU) |
| When unsure | — | — | says "not sure, say it again" instead of guessing |
| Languages | English | English and others | English for now (data); Czech is the next step |

**To be fair:** Relate and Voiceitt are finished products with a much larger scope. They handle free speech and whole sentences, not just commands, and they are backed by years of development and large datasets. We do none of that. We show one narrow thing: a small open model can recognise a person's own **fixed set of words or sounds** after a few examples, runs locally, and can say when it isn't sure. We have not checked whether Relate or Voiceitt are available in the Czech Republic or in Czech.

## 4. Why commands

- People who struggle to use a phone or computer because of limited hand movement can get by with a small set of commands: yes/no, up/down, select, back, menu. TORGO contains the same commands (yes, no, up, down, left, right, forward, back, select, menu).
- Voice can control a smart home (Voiceitt does this through Alexa [11]) and, according to the literature, an electric wheelchair. We have **not yet found** a specific study with numbers for wheelchairs.
- A fixed set of commands can be checked safely. The system can reject an uncertain input, which is much harder with free transcription. A wrong action, such as a wheelchair turning left instead of right, is worse than no action.

## Sources

1. GBD 2021 Stroke Risk Factor Collaborators. *Global, regional, and national burden of stroke and its risk factors, 1990–2021.* Lancet Neurology 23(10):973–1003, 2024. doi:10.1016/S1474-4422(24)00369-7. https://eprints.whiterose.ac.uk/218276/1/PIIS1474442224003697.pdf
2. WHO. *Parkinson disease* (fact sheet). https://www.who.int/news-room/fact-sheets/detail/parkinson-disease
3. ASHA Practice Portal. *Dysarthria in Adults.* https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/
4. MSIF. *Atlas of MS, 3rd edition* (2020). https://www.msif.org/news/2020/09/11/the-atlas-of-ms-is-live/
5. General University Hospital in Prague (VFN), press release *100 let neurologie* (15 Apr 2026, in Czech). https://www.vfn.cz/wp-content/uploads/2026/04/TZ_neurologie_100_let_15_4_2026.pdf
6. VFN Prague, press release *Poruchy mozku a řeči na vzestupu* (21 Nov 2023, in Czech). https://www.vfn.cz/wp-content/uploads/2023/11/TZ-Poruchy-mozku-a-řeči-na-vzestupu_21_11_2023.pdf
7. De Russis, L., Corno, F. *On the impact of dysarthric speech on contemporary ASR cloud platforms.* Journal of Reliable Intelligent Environments 5:163–172, 2019. doi:10.1007/s40860-019-00085-y
8. Hasegawa-Johnson, M. et al. *Community-Supported Shared Infrastructure in Support of Speech Accessibility* (Speech Accessibility Project). JSLHR 2024. doi:10.1044/2024_JSLHR-24-00122
9. Green, J. R. et al. *Automatic Speech Recognition of Disordered Speech: Personalized models outperforming human listeners on short phrases.* Interspeech 2021, 4778–4782. doi:10.21437/Interspeech.2021-1384
10. Google Research, *Project Euphonia.* https://sites.research.google/euphonia/about
11. Amazon UK, *Voiceitt launches speech recognition app with Alexa integration* (2021). https://www.aboutamazon.co.uk/news/innovation/voiceitt-launches-innovative-speech-recognition-app-with-alexa-integration-to-improve-communication-for-individuals-with-speech-impairments
12. Google Research blog, *Responsible AI at Google Research: AI for Social Good* (2023). https://research.google/blog/responsible-ai-at-google-research-ai-for-social-good/
13. Rudzicz, F., Namasivam, A. K., Wolff, T. *The TORGO database of acoustic and articulatory speech from speakers with dysarthria.* Language Resources and Evaluation 46(4):523–541, 2012. Hugging Face: `abnerh/TORGO-database`.

> Note: the numbers from [7] and [8] are taken from the papers' abstracts (checked on 14 Nov 2026), not from the full texts.
