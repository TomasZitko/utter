# Utter: voice control that learns *your* speech

**Track:** Languages · **Team:** Tomáš + Jonáš
Code, notebook and app: https://github.com/TomasZitko/utter

## The problem
Dysarthria (slurred, slow or hard-to-understand speech) is common after a stroke and in Parkinson's, ALS and cerebral palsy ([sources](research.md)). Many of these people also have limited hand movement, so voice should be how they control a phone, smart home or wheelchair. But speech recognition is trained on typical speech: on the TORGO database, Whisper recognises single words from people with dysarthria only **42%** of the time (73% for speakers without dysarthria). Our user is one person with dysarthria who wants to be understood at home.

## What we built
**In:** a short recording of the person's own sound for a word. **Out:** the recognised meaning, spoken aloud as a full sentence, or "Not sure, say it again". The person picks a meaning (water, pain, help…), records their sound for it **three times**, and from then on Utter recognises it. It doesn't have to be a real word.

## What we added
Our own idea. The closest suggested project is 4.4.3 (speech recognition across accents); we use its Whisper-small as the baseline. Ours: the **user** (people with dysarthria), the **data** (TORGO), the **question** (can 2–3 personal recordings beat a general recogniser, and when should the tool refuse to act?), and a working app that shows the model's decision live.

## How it works
**Data:** TORGO, 8 speakers with dysarthria and 7 without, English. We use single words only, one microphone per recording, and only words a person said at least twice: 2,952 recordings of 136 words.
**Model:** a pretrained neural speech model, **WavLM Base+** (layer 12, chosen on speakers without dysarthria), turns each recording into a sequence of vectors. A new recording is matched to the stored examples with **dynamic time warping**; the closest word wins. This is few-shot learning: no training, so it works from 2–3 examples. If the best word isn't clearly ahead of the second, Utter asks again; the threshold is calibrated on *other* people so that at most 5% of actions are wrong. Everything runs locally in about 0.1 s.

## Results
Held-out recordings of 7 people with dysarthria, sets of 8 words, 50 random repeats. Chance is 12.5%.

| Model | Correct |
|---|---|
| Baseline: Whisper small (homophones count as correct) | 42% |
| Other people's recordings only (no personalisation) | 79% |
| Utter, the person's own 2 recordings only | 74% |
| **Utter, own + other people's recordings** | **84%** |

With "not sure" on: 71% correct, 5% wrong, 24% asks again. With shuffled labels accuracy falls to 10%, so there is no leakage; every choice was made on other speakers, never on the person tested.

**Per person, in the running app** (own recordings only, 508 unheard recordings, all 8 people): top guess right 74% on average, from 56% (M04) to 91% (M03); Whisper 36%, from 11% (F01) to 70% (M03). Full table in the [README](../README.md).

| Person said | Whisper heard | Utter |
|---|---|---|
| sigh (M02) | "Five." ✗ | sigh ✓ |
| read (F01) | "Wee" ✗ | read ✓ |
| know (M04) | "No." ✓ (homophone) | knew ✗ |
| storm (F01) | "Bye." ✗ | warm ✗ |

**Where it fails.** Words that sound alike (know/knew, storm/warm): matching sound alone cannot separate them. For M04 (severe) the app acts on only 17% of recordings and asks again for 82%; we think his repeats of one word differ too much for 2 examples. And for common English words, other people's recordings alone (79%) beat the person's own two (74%); personal recordings matter most for the hardest speakers and for invented sounds.

## What we'd do next
Czech (the method doesn't depend on language), tests with real users and speech therapists, short phrases, and a phone app that runs on the device. Limits today: 8 speakers, English, single words, lab recordings, tested only by us.

## Sources
- **Data:** TORGO, Rudzicz, Namasivam & Wolff (2012), *Language Resources and Evaluation* 46(4), 523–541; copy used: [abnerh/TORGO-database](https://huggingface.co/datasets/abnerh/TORGO-database).
- **Pretrained models:** [microsoft/wavlm-base-plus](https://huggingface.co/microsoft/wavlm-base-plus), [openai/whisper-small](https://huggingface.co/openai/whisper-small).
- **Libraries:** PyTorch, Hugging Face Transformers, Numba, FastAPI; Phosphor icons; Familjen Grotesk and Instrument Sans fonts.
- **AI tools:** [Claude Code](https://claude.com/claude-code) as the coding assistant (code, tests, texts); [Claude](https://claude.ai), [ChatGPT](https://chatgpt.com), [Gemini](https://gemini.google.com) and [Perplexity](https://www.perplexity.ai) for research, ideas and checking explanations. Background facts and their sources: [research.md](research.md).

This project is a prototype and is not medical advice.
