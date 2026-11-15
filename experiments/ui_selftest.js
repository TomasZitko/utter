// Utter UI self-test with a fake microphone.
// It drives the real app in the browser (the same clicks a person makes) and replaces the microphone
// with real recordings, so teaching, listening, auto-stop, confirming, the log and forgetting a word
// are all exercised without a human voice.
//
// How to run: copy this file to app/static/_selftest.js, open the app, and in the browser console run
//   const s = document.createElement("script"); s.src = "/_selftest.js"; document.head.appendChild(s);
// Results appear in window.__T (and in the console). It teaches a temporary word and forgets it again.
(async () => {
  const T = (window.__T = { steps: [], done: false, ok: true });
  const log = (name, ok, info = "") => { T.steps.push({ name, ok: !!ok, info: String(info) }); if (!ok) T.ok = false; console.log(ok ? "PASS" : "FAIL", name, info); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; };
  const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); };

  // the fake microphone: plays `url` into a MediaStream, then stays silent
  let micUrl = null;
  navigator.mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await (await fetch(micUrl)).arrayBuffer());
    const dst = ctx.createMediaStreamDestination(), src = ctx.createBufferSource();
    src.buffer = buf; src.connect(dst); src.start(ctx.currentTime + 0.35);
    T.clipSeconds = buf.duration;
    return dst.stream;
  };
  const realConfirm = window.confirm; window.confirm = () => true;
  const realSpeak = speechSynthesis.speak.bind(speechSynthesis); let spoken = [];
  speechSynthesis.speak = (u) => { spoken.push(u.text); };

  try {
    const ex = await (await fetch("/api/examples")).json();
    const A = ex[0].audio_url, B = ex.find((e) => e.word !== ex[0].word && e.speaker !== ex[0].speaker).audio_url;
    P.onboarded = true; P.lang = "en"; P.confirm = true; P.autoStop = true; applyPrefs();
    const before = S.words.length;
    ACT.goHome(); await sleep(200);

    // 1. teach a new word with three recordings from the fake microphone
    click('#nav [data-arg="teach1"]'); await sleep(200);
    const input = document.querySelector("#custom"); input.value = "Selftest"; input.dispatchEvent(new Event("input"));
    click('[data-act="teachContinue"]');
    log("teach: opens the recording screen", await until(() => S.screen === "teach2"));
    micUrl = A;
    const stops = [];
    for (let i = 0; i < S.cfg.takes; i++) {
      const t0 = performance.now();
      click(".rec");
      await until(() => S.teach.recording, 5000);
      await until(() => !S.teach.recording && !S.teach.busy && (S.teach.count > i || S.screen === "teach3"), 15000);
      stops.push((performance.now() - t0) / 1000);
    }
    log("teach: three recordings saved", await until(() => S.screen === "teach3"), `screen=${S.screen} count=${S.teach.count}`);
    log("teach: recording stops by itself before the time limit", stops.every((s) => s < TAKE_SECONDS + 0.8) && stops.some((s) => s < TAKE_SECONDS - 0.3),
      `clip ${T.clipSeconds.toFixed(2)} s, stopped after ${stops.map((s) => s.toFixed(2)).join(", ")} s (limit ${TAKE_SECONDS} s)`);
    const w = S.words.find((x) => x.label === "Selftest");
    log("teach: the word is in My language with 3 recordings", w && w.takes === 3, w ? `takes=${w.takes}` : "missing");

    // 2. say it: listen -> recognise -> confirm -> speak
    click('[data-act="startListen"]');
    log("listen: opens", await until(() => S.screen === "listen"));
    log("listen: stops by itself and shows a result", await until(() => S.screen === "result" && S.result, 20000), `screen=${S.screen}`);
    const r = S.result;
    log("recognise: the same sound is recognised as the new word", r && r.guesses[0].label === "Selftest" && r.accepted, r ? `${r.guesses[0].label} accepted=${r.accepted} lead=${r.margin.toFixed(3)} in ${r.timing.total_ms} ms` : "");
    log("engine: panel shows the alignment and the decision", !!document.querySelector("#eng-al0") && /Act|Ask again/.test(document.querySelector("#engine").textContent));
    await until(() => S.heard != null, 15000);
    log("compare: the regular assistant's transcript arrives", S.heard != null, `"${S.heard}"`);
    spoken = [];
    click('[data-act="confirm"]');
    log("confirm: the sentence screen opens", await until(() => S.screen === "speak"), S.speak ? S.speak.phrase : "");
    log("confirm: the sentence is sent to the voice", spoken.length === 1 && spoken[0] === "Selftest.", JSON.stringify(spoken));
    await sleep(600);
    const w2 = S.words.find((x) => x.label === "Selftest");
    log("learn: the confirmed recording became a 4th example", w2 && w2.takes === 4, w2 ? `takes=${w2.takes}` : "");
    click('[data-act="goHome"]'); await sleep(200);

    // 3. a different sound must not be taken for the new word
    micUrl = B;
    click('[data-act="startListen"]');
    await until(() => S.screen === "result" && S.result, 25000);
    const r2 = S.result;
    log("recognise: a different sound is not accepted as the new word", r2 && !(r2.accepted && r2.guesses[0].label === "Selftest"), r2 ? `${r2.guesses[0].label} accepted=${r2.accepted} lead=${r2.margin.toFixed(3)}` : "no result");
    click('[data-act="goHome"]'); await sleep(200);

    // 4. quick reply, tap to say, the log
    spoken = [];
    click('[data-act="quick"][data-arg="yes"]'); await sleep(300);
    log("quick reply: Yes is spoken", S.screen === "speak" && spoken.includes("Yes."), JSON.stringify(spoken));
    click('[data-act="goHome"]'); await sleep(200);
    click('#nav [data-arg="today"]'); await until(() => S.screen === "today"); await sleep(500);
    log("today: the log has the confirmed sentence and the quick reply", S.log.some((l) => l.phrase === "Selftest." && l.source === "voice") && S.log.some((l) => l.phrase === "Yes."), `${S.log.length} entries`);

    // 5. word detail: edit the sentence, remove a recording
    click('#nav [data-arg="words"]'); await until(() => S.screen === "words"); await sleep(300);
    click(`.wcard[data-arg="${w.id}"]`); await until(() => S.screen === "detail");
    click('[data-act="editPhrase"]'); await sleep(150);
    document.querySelector("#phrase-edit").value = "This is a self test.";
    click('[data-act="savePhrase"]');
    log("detail: the sentence can be edited", await until(() => (S.words.find((x) => x.id === w.id) || {}).phrase === "This is a self test.", 5000));
    click(".take-x");
    log("detail: a recording can be removed", await until(() => (S.words.find((x) => x.id === w.id) || {}).takes === 3, 5000));

    // 6. language: Czech and back
    ACT.setPref("lang:cs"); ACT.goHome(); await sleep(200);
    log("language: the home screen is in Czech", /Co potřebuješ\?/.test(document.querySelector("#view").textContent) && /Mluvit/.test(document.querySelector("#nav").textContent));
    spoken = []; click('[data-act="quick"][data-arg="help"]'); await sleep(1300);
    log("language: Help is spoken in Czech", spoken.some((s) => /Potřebuji pomoc/.test(s)), JSON.stringify(spoken));
    ACT.setPref("lang:en"); ACT.goHome(); await sleep(200);
    log("language: back to English", /What do you need\?/.test(document.querySelector("#view").textContent));

    // 7. setting: speak without asking
    P.confirm = false; micUrl = A; spoken = [];
    click('[data-act="startListen"]');
    log("setting: with 'Ask before speaking' off, a clear guess is spoken at once", await until(() => S.screen === "speak", 25000) && spoken.length === 1, JSON.stringify(spoken));
    P.confirm = true; ACT.goHome(); await sleep(300);

    // 8. guide and profile open
    ACT.openGuide(); await sleep(200);
    for (let i = 0; i < 4; i++) { click('[data-act="guideNext"]'); await sleep(120); }
    click('[data-act="guideDone"]'); await sleep(200);
    log("guide: five steps, then home", S.screen === "home");
    await ACT.openSettings(); await sleep(300);
    log("profile: opens with settings", S.screen === "profile" && document.querySelectorAll(".row-toggle").length >= 4);
    ACT.goHome();

    // 9. clean up: forget the temporary word
    S.detailId = w.id; go("detail"); await sleep(200);
    click('[data-act="archiveWord"]');
    log("cleanup: the temporary word is forgotten", await until(() => !S.words.some((x) => x.label === "Selftest"), 8000) && S.words.length === before, `${S.words.length} words (was ${before})`);
  } catch (e) {
    log("self-test crashed", false, e.stack || e.message);
  } finally {
    window.confirm = realConfirm; speechSynthesis.speak = realSpeak; P.confirm = true; savePrefs();
    T.done = true;
    console.log(T.ok ? "SELF-TEST PASSED" : "SELF-TEST FAILED", T.steps.filter((s) => s.ok).length + "/" + T.steps.length);
  }
})();
