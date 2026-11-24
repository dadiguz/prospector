/** Estilos de la plantilla del brochure (1080×1350 por página). */
export const ESTILOS = `
  :root {
    --bg: #f5f2ea;
    --ink: #13241d;
    --ink-2: #4a5a52;
    --ink-3: #87938c;
    --green: #1f5a43;
    --green-2: #2e7a5b;
    --aqua: #3fa7b5;
    --aqua-soft: #dff1f2;
    --sun: #e8a23a;
    --line: #e2ddd0;
    --card: #ffffff;
    --bad: #b5523b;
    --gold: #d4a564;
    --sage: #6b9e8a;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #d9d4c7; }
  body { font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
  .page {
    width: 1080px; height: 1350px; margin: 40px auto; background: var(--bg);
    position: relative; overflow: hidden; padding: 96px 88px; display: flex; flex-direction: column;
  }
  body.solo .page { margin: 0; }
  body.solo .page:not(.on) { display: none; }
  @page { size: 1080px 1350px; margin: 0; }
  @media print { html, body { background: none; } .page { margin: 0; break-after: page; } .cover .phone { box-shadow: 0 0 0 2px #2a322f inset; } }

  .kicker { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 17px; font-weight: 500; letter-spacing: .32em; text-transform: uppercase; color: var(--ink-2); }
  .kicker::after { content: ""; display: block; width: 72px; height: 6px; background: var(--gold); margin-top: 26px; }
  .mark { position: absolute; top: 92px; right: 88px; width: 30px; height: 30px; }
  h1 { font-size: 84px; line-height: 1.02; font-weight: 800; letter-spacing: -.035em; }
  h2 { font-size: 64px; line-height: 1.05; font-weight: 800; letter-spacing: -.03em; }
  .lead { font-size: 30px; line-height: 1.4; color: var(--ink-2); font-weight: 500; }
  .foot { margin-top: auto; padding-top: 26px; border-top: 1px solid #d8d2c4; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
  .foot .logo { height: 30px; display: block; }
  .foot .meta-r { display: flex; align-items: center; gap: 18px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--ink-3); }
  .pg { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 600; font-size: 17px; letter-spacing: .04em; background: var(--gold); color: #0b0b0c; padding: 9px 13px; line-height: 1; }
  .foot .note { font-family: "Plus Jakarta Sans", sans-serif; letter-spacing: 0; text-transform: none; font-size: 15px; }
  .note { font-size: 18px; color: var(--ink-3); }

  /* Teléfono */
  .phone {
    width: 420px; border-radius: 58px; background: #0f1513; padding: 14px;
    box-shadow: 0 40px 80px -30px rgba(19,36,29,.45), 0 0 0 2px #2a322f inset;
  }
  .screen { border-radius: 46px; overflow: hidden; background: #fbfaf6; height: 820px; position: relative; display: flex; flex-direction: column; }
  .notch { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 120px; height: 34px; border-radius: 20px; background: #0f1513; z-index: 3; }
  .status { height: 58px; display: flex; justify-content: space-between; align-items: center; padding: 8px 34px 0; font-size: 16px; font-weight: 700; }
  .hero {
    height: 190px; position: relative; color: #fff; padding: 22px 24px; display: flex; flex-direction: column; justify-content: flex-end;
    background:
      radial-gradient(120% 80% at 85% 10%, rgba(255,214,140,.55), transparent 60%),
      linear-gradient(160deg, #3fa7b5 0%, #2e7a5b 55%, #1f5a43 100%);
  }
  .strip { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 16px; margin-top: 28px; height: 190px; }
  .strip div { border-radius: 22px; background-size: cover; background-position: center; position: relative; overflow: hidden; }
  .strip span { position: absolute; left: 14px; bottom: 12px; color: #fff; font-size: 17px; font-weight: 700; text-shadow: 0 1px 6px rgba(0,0,0,.5); }
  .hero small { font-size: 13px; opacity: .85; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .hero b { font-size: 27px; font-weight: 800; letter-spacing: -.02em; position: relative; z-index: 1; }
  .body { padding: 18px 18px 0; display: flex; flex-direction: column; gap: 12px; flex: 1; }
  .dates { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; font-size: 13px; }
  .dates span { padding: 7px 0; border-radius: 9px; background: #fff; border: 1px solid var(--line); font-weight: 600; }
  .dates span em { display: block; font-style: normal; font-size: 9.5px; color: var(--ink-3); font-weight: 600; }
  .dates .h { background: none; border: none; color: var(--ink-3); font-size: 11px; padding: 0; }
  .dates .full { color: var(--bad); text-decoration: line-through; background: #fbeee9; border-color: #f3d8cf; }
  .dates .sel { background: var(--green); color: #fff; border-color: var(--green); }
  .dates .sel em { color: #cfe6da; }
  .unit { display: flex; gap: 12px; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 10px; }
  .unit.on { border: 2px solid var(--green); padding: 9px; }
  .thumb { width: 74px; height: 66px; border-radius: 11px; flex-shrink: 0; position: relative; overflow: hidden; }
  .unit .tx { flex: 1; min-width: 0; }
  .unit .tx b { display: block; font-size: 16px; font-weight: 700; }
  .unit .tx span { font-size: 12.5px; color: var(--ink-3); }
  .unit .pr { text-align: right; font-size: 17px; font-weight: 800; }
  .unit .pr small { display: block; font-size: 11px; font-weight: 600; color: var(--ink-3); }
  .tag { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: #fff3dc; color: #a86b0f; margin-left: 4px; vertical-align: 2px; }
  .pay { margin-top: auto; background: #fff; border-top: 1px solid var(--line); padding: 16px 20px 26px; }
  .pay .row { display: flex; justify-content: space-between; font-size: 14px; color: var(--ink-2); margin-bottom: 4px; }
  .pay .big { display: flex; justify-content: space-between; align-items: baseline; margin: 6px 0 12px; }
  .pay .big span { font-size: 15px; font-weight: 600; }
  .pay .big b { font-size: 30px; font-weight: 800; letter-spacing: -.02em; }
  .btn { height: 54px; border-radius: 16px; background: var(--green); color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; font-size: 17px; }
  .secure { text-align: center; font-size: 12px; color: var(--ink-3); margin-top: 8px; }

  /* Confirmación */
  .ok { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 26px 26px 0; text-align: center; }
  .ok .check { width: 74px; height: 74px; border-radius: 50%; background: #e3f1e8; display: grid; place-items: center; margin-bottom: 14px; }
  .ok h3 { font-size: 27px; font-weight: 800; letter-spacing: -.02em; }
  .ok p { font-size: 15px; color: var(--ink-2); margin-top: 6px; line-height: 1.45; }
  .ticket { width: 100%; margin-top: 20px; background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 18px; text-align: left; }
  .ticket .row { display: flex; justify-content: space-between; font-size: 14px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
  .ticket .row:last-child { border: 0; }
  .ticket .row span { color: var(--ink-3); }
  .ticket .row b { font-weight: 700; }
  .qr { width: 150px; height: 150px; margin: 18px auto 4px; display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; padding: 10px; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
  .qr i { background: var(--ink); border-radius: 1.5px; }
  .qr i.o { background: transparent; }

  /* Comparativa */
  .vs { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 48px; }
  .vs .col { padding: 40px 36px; }
  .vs .steps { gap: 20px; }
  .vs .steps li { font-size: 25px; }
  .col { border-radius: 30px; padding: 40px 36px; }
  .col.hoy { background: #ece7db; }
  .col.con { background: var(--green); color: #fff; }
  .col h3 { font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 28px; display: flex; align-items: center; gap: 12px; }
  .steps { list-style: none; display: flex; flex-direction: column; gap: 22px; }
  .steps li { display: flex; gap: 16px; font-size: 24px; line-height: 1.35; font-weight: 500; }
  .steps li i { flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 17px; font-weight: 800; }
  .hoy .steps li { color: var(--ink-2); }
  .hoy .steps li i { background: #ddd6c6; color: var(--ink-2); }
  .con .steps li i { background: rgba(255,255,255,.16); color: #fff; }
  .meta { margin-top: 30px; padding-top: 24px; border-top: 1px solid; font-size: 21px; font-weight: 600; }
  .hoy .meta { border-color: #d6cebd; color: var(--ink-3); }
  .con .meta { border-color: rgba(255,255,255,.2); color: #bfe0cf; }

  /* Panel */
  .panel { margin-top: 50px; background: #fff; border-radius: 30px; box-shadow: 0 30px 70px -35px rgba(19,36,29,.35); border: 1px solid var(--line); overflow: hidden; }
  .panel .bar { display: flex; justify-content: space-between; align-items: center; padding: 22px 30px; border-bottom: 1px solid var(--line); }
  .panel .bar b { font-size: 24px; font-weight: 800; }
  .panel .bar span { font-size: 17px; color: var(--ink-3); font-weight: 600; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--line); }
  .kpi { padding: 26px 30px; border-right: 1px solid var(--line); }
  .kpi:last-child { border: 0; }
  .kpi span { font-size: 16px; color: var(--ink-3); font-weight: 600; }
  .kpi b { display: block; font-size: 42px; font-weight: 800; letter-spacing: -.03em; margin-top: 4px; }
  .kpi em { font-style: normal; font-size: 15px; color: var(--green-2); font-weight: 700; }
  .occ { padding: 24px 30px 8px; }
  .occ h4 { font-size: 17px; color: var(--ink-3); font-weight: 600; margin-bottom: 14px; }
  .occ-row { display: grid; grid-template-columns: 190px 1fr 70px; align-items: center; gap: 14px; margin-bottom: 12px; font-size: 18px; font-weight: 600; }
  .occ-row .track { height: 14px; background: #efece3; border-radius: 99px; overflow: hidden; }
  .occ-row .fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--green-2), var(--aqua)); }
  .occ-row span:last-child { text-align: right; color: var(--ink-2); }
  .list { padding: 10px 30px 22px; }
  .li { display: grid; grid-template-columns: 1fr auto auto; gap: 18px; align-items: center; padding: 15px 0; border-top: 1px solid var(--line); font-size: 18px; }
  .li b { font-weight: 700; }
  .li small { display: block; color: var(--ink-3); font-size: 14.5px; margin-top: 2px; }
  .pill { font-size: 14px; font-weight: 700; padding: 5px 12px; border-radius: 99px; }
  .pill.paid { background: #e3f1e8; color: var(--green); }
  .pill.wait { background: #fff3dc; color: #a86b0f; }

  .grid3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 28px; }
  .feat { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 16px 20px; }
  .feat .ic { width: 40px; height: 40px; border-radius: 12px; background: var(--aqua-soft); display: grid; place-items: center; margin-bottom: 10px; }
  .feat b { display: block; font-size: 24px; font-weight: 800; letter-spacing: -.01em; }
  .feat p { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 17px; color: var(--ink-2); margin-top: 6px; line-height: 1.4; }
  .cta { margin-top: 18px; margin-bottom: 20px; background: #0b0b0c; color: #fff; border-radius: 26px; padding: 34px 40px 24px; }
  .cta b { font-size: 32px; font-weight: 800; letter-spacing: -.02em; line-height: 1.12; display: block; }
  .cta p { font-size: 21px; color: #b7c4bd; margin-top: 10px; line-height: 1.4; }
  .contact { display: grid; grid-template-columns: 1fr 1fr; column-gap: 36px; margin-top: 26px; }
  .contact div { display: flex; align-items: baseline; gap: 16px; padding: 13px 0; border-top: 1px solid rgba(255,255,255,.12); font-size: 19px; color: #f3f0e9; }
  .contact span { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); width: 96px; flex-shrink: 0; }
  .ref { margin-top: 16px; display: flex; gap: 20px; align-items: center; padding: 20px 28px; border-radius: 24px; background: var(--aqua-soft); }
  .ref b { font-size: 23px; font-weight: 800; }
  .ref p { font-size: 19px; color: var(--ink-2); margin-top: 3px; }

  /* Portada */
  .cover { padding: 0; }
  .cover-top {
    height: 640px; position: relative; padding: 96px 88px; color: #fff;
    background: linear-gradient(165deg, #46b1bd 0%, #2e7a5b 52%, #173f30 100%);
  }
  .cover-top .kicker { color: #e9efe9; }
  .cover-top h1 { margin-top: 26px; max-width: 500px; font-size: 70px; position: relative; z-index: 1; }
  .cover-bottom { padding: 60px 88px 96px; flex: 1; display: flex; flex-direction: column; }
  .cover-bottom .lead { max-width: 520px; font-size: 32px; }
  .cover .phone { position: absolute; right: 70px; top: 420px; transform: rotate(4deg); width: 380px; }
  .cover .screen { height: 720px; }
  .chips { display: flex; flex-direction: column; gap: 14px; margin-top: 40px; }
  .chip { display: flex; align-items: center; gap: 14px; font-size: 24px; font-weight: 600; }
  .chip i { width: 34px; height: 34px; border-radius: 50%; background: #e3f1e8; display: grid; place-items: center; }

  /* Navegador */
  .browser { margin-top: 44px; border-radius: 22px; background: #fff; border: 1px solid var(--line); box-shadow: 0 36px 80px -40px rgba(19,36,29,.45); overflow: hidden; }
  .bbar { height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 18px; background: #f1eee6; border-bottom: 1px solid var(--line); }
  .bbar i { width: 11px; height: 11px; border-radius: 50%; background: #e0d9c9; }
  .bbar i:nth-child(1) { background: #ec6a5e; } .bbar i:nth-child(2) { background: #f4bf4f; } .bbar i:nth-child(3) { background: #61c554; }
  .url { margin: 0 auto; width: 380px; height: 28px; border-radius: 8px; background: #fff; border: 1px solid var(--line); font-size: 13px; color: var(--ink-2); display: flex; align-items: center; justify-content: center; gap: 6px; }
  .whero { height: 190px; position: relative; color: #fff; padding: 22px 30px; display: flex; flex-direction: column; justify-content: space-between;
    background: linear-gradient(165deg, #46b1bd 0%, #2e7a5b 52%, #173f30 100%); }
  .wnav { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; }
  .wnav nav { display: flex; gap: 22px; opacity: .92; }
  .wnav nav b { border-bottom: 2px solid #fff; padding-bottom: 3px; }
  .wlogo { font-weight: 800; font-size: 17px; letter-spacing: -.01em; }
  .whero h3 { font-size: 34px; font-weight: 800; letter-spacing: -.02em; }
  .whero p { font-size: 14px; opacity: .88; margin-top: 4px; }
  .wbody { display: grid; grid-template-columns: 230px 1fr 250px; gap: 16px; padding: 18px; background: #faf8f2; }
  .wcal { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
  .wcal h5 { font-size: 14px; font-weight: 800; margin-bottom: 8px; display: flex; justify-content: space-between; }
  .wcal h5 span { color: var(--ink-3); font-weight: 600; }
  .wgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; font-size: 11.5px; font-weight: 600; }
  .wgrid span { padding: 5px 0; border-radius: 6px; }
  .wgrid .h { color: var(--ink-3); font-size: 10px; }
  .wgrid .f { color: var(--bad); text-decoration: line-through; background: #fbeee9; }
  .wgrid .s { background: var(--green); color: #fff; }
  .wgrid .r { background: #e3f1e8; color: var(--green); }
  .wleg { margin-top: 10px; font-size: 10.5px; color: var(--ink-3); line-height: 1.5; }
  .wunits { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start; }
  .wu { background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .wu.on { border: 2px solid var(--green); }
  .wu .ph { height: 92px; background-size: cover; background-position: center; position: relative; }
  .wu .ph em { position: absolute; top: 8px; right: 8px; font-style: normal; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: #fff3dc; color: #a86b0f; }
  .wu .ph em.full { background: #fbeee9; color: var(--bad); }
  .wu .in { padding: 9px 10px 11px; }
  .wu .row { gap: 6px; }
  .wu b { font-size: 13.5px; font-weight: 700; display: block; }
  .wu small { font-size: 11px; color: var(--ink-3); }
  .wu .row { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
  .wu .row strong { font-size: 14px; font-weight: 800; white-space: nowrap; }
  .wu .row strong small { font-size: 10.5px; font-weight: 600; }
  .wu .row span { white-space: nowrap; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 8px; background: #f1eee6; color: var(--ink-2); }
  .wu.on .row span { background: var(--green); color: #fff; }
  .wsum { background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
  .wsum .top { background: #0b0b0c; color: #fff; padding: 14px 16px; }
  .wsum .top small { font-size: 11px; opacity: .7; }
  .wsum .top b { display: block; font-size: 16px; font-weight: 800; margin-top: 2px; }
  .wsum .hold { background: #fff3dc; color: #a86b0f; font-size: 11px; font-weight: 700; padding: 7px 16px; display: flex; justify-content: space-between; }
  .wsum .in { padding: 14px 16px; display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; flex: 1; }
  .wsum .in div { display: flex; justify-content: space-between; color: var(--ink-2); }
  .wsum .in .tot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); align-items: baseline; color: var(--ink); font-weight: 600; }
  .wsum .in .tot b { font-size: 24px; font-weight: 800; }
  .wsum .wbtn { margin: 0 16px 8px; height: 40px; border-radius: 10px; background: var(--green); color: #fff; font-size: 13.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .wsum .safe { text-align: center; font-size: 10.5px; color: var(--ink-3); padding-bottom: 12px; }
  .pts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 34px; }
  .pts div { font-size: 19px; line-height: 1.4; color: var(--ink-2); padding-top: 16px; border-top: 3px solid var(--sage); }
  .pts b { display: block; color: var(--ink); font-size: 21px; font-weight: 800; margin-bottom: 4px; }
`;
