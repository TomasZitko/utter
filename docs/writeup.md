# Utter: voice control that learns *your* speech

**Team Slyším tě** (Tomáš + Jonáš) · Veritas AI Hackathon 2026 · Track: AI + Languages
Code, notebook and app: https://github.com/TomasZitko/slysim-te

## The problem
Dysarthria (slurred, slow or hard-to-understand speech) is common after a stroke and in Parkinson's, ALS and cerebral palsy ([sources](research.md)). Many of these people also have limited hand movement, so voice should be how they control a phone, smart home or wheelchair. Standard speech recognition is trained on typical speech. On the TORGO database, Whisper recognises single words from people with dysarthria only **42%** of the time (vs. 73% for speakers without dysarthria).

## Our idea
Don't make the person speak like everyone else; learn how *they* speak. In Utter you pick a meaning (water, pain, help…), record your own sound for it **three times**, and from then on Utter recognises it and says the full sentence aloud. If it isn't sure, it asks you to repeat instead of guessing, because a wrong action is worse than no action. It also works for sounds that aren't words at all.

## How it works
1. A small open speech model, **WavLM Base+**, turns each recording into a sequence of vectors (layer 12, chosen on healthy speakers only).
2. A new recording is matched against the stored examples with **dynamic time warping**; the closest word wins. When the same word exists in recordings of other people, those are used too.
3. If the best word isn't clearly ahead of the second best, Utter says **"Not sure, say it again"**. The threshold is calibrated on *other* people with dysarthria so that at most 5% of actions are wrong.
4. Confirmed recordings become new examples, so Utter improves with use. Everything runs locally on a laptop, in about 0.1–0.3 s per recording.

The app shows its work: an Engine panel draws the alignment, the distance to every word and the lead it needs before acting. A **Real voices** mode teaches the app the words of a real TORGO speaker and recognises their unheard recordings live, next to Whisper.

## Results (TORGO, 7 people with dysarthria, 8-word sets, 50 random repeats)
| Model | Accuracy |
|---|---|
| Whisper (small), generous homophone matching | 42% |
| Same matching, other people's recordings only | 79% |
| Utter, the person's own 2 recordings only | 74% |
| **Utter, own + other people's recordings** | **84%** |

With "not sure" enabled: 71% correct, 5% wrong, 24% asked to repeat. Chance is 12.5%; with shuffled labels accuracy drops to 10%, so there is no leakage. Each recording is used once (TORGO records with two microphones), and every design choice was made on healthy speakers or on other people, never on the person being tested.

We also tested the app itself end to end. A script taught it 5 words with 3 TORGO recordings each and then sent it held-out recordings over HTTP: for 4 people with dysarthria, the top guess was correct 77% of the time and wrong actions were 5% (chance is 20%).

The biggest gains are for the hardest-to-understand speakers. For two people with severe dysarthria, Whisper got 20% of words and Utter 87%.

**What we learned honestly:** for common English words, other people's recordings already help a lot, and combining them with the person's own is best. Personal recordings matter where others fail. For F01, the speaker Whisper understood least (8%), a single own recording per word beat other people's recordings (73% vs. 55%). They also matter for sounds a person invents, where nobody else's recordings exist; that is what the app relies on.

## Limits and next steps
Only 8 speakers with dysarthria (cerebral palsy, ALS), English, single words, lab recordings; the app was tested only by us. Next: Czech (the method doesn't depend on language), testing with real users and speech therapists, short phrases, and an on-device phone app.

**Data:** TORGO, Rudzicz et al. (2012), *Language Resources and Evaluation* 46(4), 523–541.
