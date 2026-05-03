/* Wysta — public site
   Vanilla JS. No deps. Progressive — page works without it. */

(function () {
  'use strict';

  // ── Tweak defaults (host parses this JSON for persistence) ────
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "pairing": "sourceserif",
    "secondary": "terracota",
    "density": "regular",
    "theme": "auto"
  }/*EDITMODE-END*/;

  // Apply tweaks (read from localStorage > defaults)
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('wysta-tweaks') || '{}'); }
    catch (e) { return {}; }
  })();
  const tweaks = Object.assign({}, TWEAK_DEFAULTS, stored);

  // ── Headlines (must be defined before applyTweaks runs) ──────
  const HEADLINES = {
    conversa: `Saúde sexual<br>e reprodutiva, <em>em conversa.</em>`,
    pergunta: `<em>Que pergunta</em><br>tens andado a adiar?`,
    manifesto: `Cuidado de saúde<br>feito de palavras<br><em>e tempo.</em>`
  };

  applyTweaks(tweaks);

  function applyTweaks(t) {
    const root = document.documentElement;
    root.setAttribute('data-pairing', t.pairing);
    root.setAttribute('data-secondary', t.secondary);
    root.setAttribute('data-density', t.density);
    // Theme: 'auto' resolves to the browser preference live; 'light'/'dark' are explicit.
    if (t.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      // Subscribe once to OS-level changes
      if (!window.__wystaThemeBound) {
        window.__wystaThemeBound = true;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', (e) => {
          if (tweaks.theme === 'auto') {
            root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          }
        });
      }
    } else {
      root.setAttribute('data-theme', t.theme);
    }
    // Headline: randomize on each page load
    const headlineEl = document.querySelector('[data-headline]');
    if (headlineEl) {
      const keys = Object.keys(HEADLINES);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      headlineEl.innerHTML = HEADLINES[pick];
    }
  }

  function setTweak(key, value) {
    tweaks[key] = value;
    try { localStorage.setItem('wysta-tweaks', JSON.stringify(tweaks)); } catch(e) {}
    applyTweaks(tweaks);
    // sync UI
    document.querySelectorAll(`.tw-opt[data-tweak="${key}"]`).forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.value === value ? 'true' : 'false');
    });
    // tell host (for persistence in source)
    try { window.parent.postMessage({type: '__edit_mode_set_keys', edits: { [key]: value }}, '*'); } catch(e) {}
  }

  // ── DOM ready ─────────────────────────────────────────────────
  let inited = false;
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') {
    // Defer to next tick so const declarations below are initialized
    queueMicrotask(init);
  }
  function init() {
    if (inited) return;
    inited = true;

    applyTweaks(tweaks);
    initNav();
    initReveal();
    initChatMock();
    initTopics();
    initFAQ();
    initTweaksPanel();
    initSmoothScroll();
  }

  // ── Nav: scroll state ─────────────────────────────────────────
  function initNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 12) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── Reveal on scroll ──────────────────────────────────────────
  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  // ── Smooth scroll for in-page anchors ─────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id === '#' || id.length < 2) return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        const y = t.getBoundingClientRect().top + window.scrollY - 64;
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  }

  // ── Chat mock: multiple scripts (humano / IA), random per load ────
  const CHAT_SCRIPTS = {
    pro: [
      {
        topic: 'Contraceção',
        messages: [
          { role: 'user', text: 'Estou no terceiro dia de atraso. Tomo a pílula combinada há 4 anos. Devo preocupar-me?', meta: 'Quarta · 22:14' },
          { role: 'typing' },
          { role: 'pro', text: 'Atrasos até uma semana, mesmo sob pílula combinada, são frequentes — viagens, stress, mudanças de rotina explicam grande parte. Não é, por si só, sinal de gravidez.', meta: 'Resposta humana · 14 min' },
          { role: 'pro', text: 'Tomaste a pílula com regularidade no último mês? Houve algum esquecimento ou episódio gastrointestinal?' },
          { role: 'user', text: 'Falhei um comprimido há cerca de 12 dias. Tomei-o no dia seguinte de manhã.' },
          { role: 'typing' },
          { role: 'pro', text: 'Como recuperaste o comprimido em menos de 24h, a proteção mantém-se. Sugiro um teste em casa amanhã de manhã, primeira urina. Voltamos a falar com o resultado.', meta: 'Resposta em 6 min' },
        ]
      },
      {
        topic: 'Gravidez',
        messages: [
          { role: 'user', text: '32 semanas. Bebé tem mexido menos hoje à tarde. É para preocupar?', meta: 'Sexta · 18:42' },
          { role: 'typing' },
          { role: 'pro', text: 'Movimentos fetais a diminuir merecem sempre atenção. Faz já a contagem deitada do lado esquerdo, com sumo ou algo doce — devem ser pelo menos 10 movimentos em 2 horas.', meta: 'Resposta humana · 9 min' },
          { role: 'user', text: 'Estou a contar agora. Vou voltar a escrever em 30 minutos.' },
          { role: 'typing' },
          { role: 'pro', text: 'Combinado. Se não chegares a 10 em 2h, ou se sentires que algo não está certo antes disso, vai à urgência obstétrica do teu hospital de referência. Não esperes pela manhã.' },
        ]
      },
      {
        topic: 'Ciclo menstrual',
        messages: [
          { role: 'user', text: 'Há 4 meses que tenho dor pélvica que piora antes da menstruação. Já fui ao centro de saúde, deram-me ibuprofeno. Não está a funcionar.', meta: 'Terça · 09:21' },
          { role: 'typing' },
          { role: 'pro', text: 'Dor cíclica que piora com a menstruação e não responde bem a anti-inflamatórios merece investigação além do sintomático. Endometriose e adenomiose entram no diferencial.', meta: 'Resposta humana · 22 min' },
          { role: 'pro', text: 'Vou pedir-te ecografia transvaginal e marcar conversa com ginecologia. Tens mais alguns sintomas que ainda não mencionaste — dor com relações, com a defecação, fluxo abundante?' },
          { role: 'user', text: 'Sim aos três. Não falei porque achei que era separado.' },
          { role: 'typing' },
          { role: 'pro', text: 'É tudo a mesma conversa. Anota desde quando, intensidade de 0 a 10 em cada um. Vamos preparar o pedido de ecografia hoje.' },
        ]
      }
    ],
    ai: [
      {
        topic: 'Ciclo menstrual',
        messages: [
          { role: 'user', text: 'O meu ciclo costuma ser 28 dias. Este mês foi 22. É preocupante uma única vez?', meta: 'Domingo · 01:47' },
          { role: 'typing' },
          { role: 'ai', text: 'Variações pontuais de ±7 dias são consideradas normais e podem refletir stress, alterações de sono, exercício intenso, viagens ou mudanças hormonais subtis.', meta: 'Resposta IA · imediata' },
          { role: 'ai', text: 'Sinais para acompanhares: se acontecer dois ciclos seguidos, se vier acompanhado de dor invulgar, ou se tiveres mais de 35 anos.' },
          { role: 'user', text: 'Ok. E se acontecer outra vez?' },
          { role: 'typing' },
          { role: 'ai', text: 'Recomendo passar para conversa humana. Posso ajudar-te a preparar o que descrever — sintomas, datas, contexto — para a primeira mensagem ser eficaz.', meta: 'Sugere encaminhamento humano' },
        ]
      },
      {
        topic: 'Contraceção',
        messages: [
          { role: 'user', text: 'Tomei a pílula 5h depois do habitual. Conta como esquecimento?', meta: 'Sábado · 15:33' },
          { role: 'typing' },
          { role: 'ai', text: 'Para pílulas combinadas, atrasos até 12 horas geralmente não comprometem a eficácia — toma o comprimido em falta agora e segue o esquema normal.', meta: 'Resposta IA · imediata' },
          { role: 'ai', text: 'Para pílulas só de progestagénio (mini-pílula), a janela é mais curta — 3 horas para a maioria, 12h só para drospirenona. Sabes qual tomas?' },
          { role: 'user', text: 'Combinada. Obrigada, era só isso.' },
          { role: 'typing' },
          { role: 'ai', text: 'De nada. Se houver outro esquecimento, regista para falarmos com mais contexto. Boa tarde.' },
        ]
      },
      {
        topic: 'Modo anónimo',
        messages: [
          { role: 'user', text: 'Não sei se devo dizer isto a alguém, mas há semanas que penso que não quero estar viva. Não é plano. É cansaço.', meta: 'Quinta · 03:18 · anónimo' },
          { role: 'typing' },
          { role: 'ai', text: 'Obrigada por escreveres. O que descreves — pensamentos passivos sobre não querer existir, sem plano concreto — é sinal sério e merece atenção, mesmo sem urgência imediata.', meta: 'Resposta IA · modo anónimo' },
          { role: 'ai', text: 'Linha SOS Voz Amiga: 213 544 545 (das 15h30 às 00h30). Linha SNS 24, opção saúde mental: 808 24 24 24. Qualquer das duas, agora ou quando estiveres pronta.' },
          { role: 'user', text: 'Posso continuar a falar contigo aqui?' },
          { role: 'typing' },
          { role: 'ai', text: 'Sim. Esta conversa fica anónima e desaparece quando fechares. Mas vou recomendar-te que, em paralelo, marques conversa com profissional humano — o que estás a sentir merece mais do que IA.', meta: 'Sugere encaminhamento humano' },
        ]
      }
    ]
  };

  let chatRunner = { cancelled: false };
  let currentChatMode = 'pro';
  // Random pick at load (kept stable per session per mode)
  const sessionPicks = {
    pro: Math.floor(Math.random() * CHAT_SCRIPTS.pro.length),
    ai: Math.floor(Math.random() * CHAT_SCRIPTS.ai.length)
  };

  function initChatMock() {
    const feed = document.querySelector('[data-chat-feed]');
    if (!feed) return;

    const topicLabel = document.querySelector('[data-chat-topic-label]');
    const toggleBtns = document.querySelectorAll('[data-chat-mode]');

    function start(mode) {
      chatRunner.cancelled = true;
      const runner = { cancelled: false };
      chatRunner = runner;
      currentChatMode = mode;
      const script = CHAT_SCRIPTS[mode][sessionPicks[mode]];
      if (topicLabel) topicLabel.textContent = script.topic;
      toggleBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.chatMode === mode ? 'true' : 'false'));
      run(feed, script.messages, runner);
    }

    toggleBtns.forEach(b => {
      b.addEventListener('click', () => start(b.dataset.chatMode));
    });

    start('pro');
  }

  async function run(feed, messages, runner) {
    while (!runner.cancelled) {
      feed.innerHTML = '';
      for (let i = 0; i < messages.length; i++) {
        if (runner.cancelled) return;
        const item = messages[i];
        appendChatItem(feed, item);
        const delay = item.role === 'typing' ? 1100
                    : item.role === 'user' ? 1500
                    : 2100;
        await sleep(delay);
        if (runner.cancelled) return;
      }
      await sleep(2400);
    }
  }

  function appendChatItem(parent, item) {
    const prevTyping = parent.querySelector('.typing');
    if (prevTyping && item.role !== 'typing') prevTyping.remove();

    if (item.role === 'typing') {
      const el = document.createElement('div');
      el.className = 'typing';
      el.innerHTML = '<span></span><span></span><span></span>';
      parent.appendChild(el);
    } else {
      const el = document.createElement('div');
      el.className = `bubble ${item.role}`;
      const text = document.createElement('div');
      text.textContent = item.text;
      el.appendChild(text);
      if (item.meta) {
        const m = document.createElement('span');
        m.className = 'meta';
        m.textContent = item.meta;
        el.appendChild(m);
      }
      parent.appendChild(el);
      requestAnimationFrame(() => { parent.scrollTop = parent.scrollHeight; });
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Topics toggle ─────────────────────────────────────────────
  const TOPICS = {
    contracecao: {
      glyph: 'C',
      title: 'Contraceção',
      blurb: 'Pílula, DIU, implante, anel, preservativo, contraceção de emergência. Avaliamos histórico, tolerância e estilo de vida — e ajustamos sempre que o teu corpo muda.',
      questions: [
        'Posso mudar de pílula sem ir ao SNS?',
        'Esqueci-me de um comprimido. E agora?',
        'O DIU é compatível com endometriose?'
      ]
    },
    gravidez: {
      glyph: 'G',
      title: 'Gravidez',
      blurb: 'Da suspeita à confirmação, do primeiro trimestre ao pós-parto. Acompanhamento entre consultas presenciais — para as perguntas que aparecem às três da manhã.',
      questions: [
        'Posso continuar a treinar no segundo trimestre?',
        'Que sintomas merecem ida às urgências?',
        'Como diferenciar contrações de Braxton Hicks?'
      ]
    },
    ist: {
      glyph: 'I',
      title: 'Infeções sexualmente transmissíveis',
      blurb: 'Rastreio, sintomas, prevenção, tratamento. Sem julgamento, sem perda de tempo. Encaminhamos para análises sempre que necessário.',
      questions: [
        'Que IST são detetáveis em análises de rotina?',
        'PrEP — sou candidata?',
        'Sintomas após sexo desprotegido — o que fazer?'
      ]
    },
    ciclo: {
      glyph: 'M',
      title: 'Ciclo menstrual',
      blurb: 'Dor, irregularidade, abundância, ausência. Quando é normal e quando não é. Suspeita de SOP, endometriose, perimenopausa — discutimos sintomas e próximos passos.',
      questions: [
        'A minha dor menstrual é normal?',
        'Ciclo de 21 dias — preocupante?',
        'Pode ser perimenopausa aos 38?'
      ]
    },
    geral: {
      glyph: 'S',
      title: 'Saúde geral',
      blurb: 'Sono, peso, libido, saúde mental, infeções urinárias, dúvidas que não cabem nas outras gavetas. Falamos primeiro — encaminhamos quando faz sentido.',
      questions: [
        'Infeção urinária recorrente — o que avaliar?',
        'Quando pedir análises hormonais?',
        'Dor pélvica sem diagnóstico — para onde?'
      ]
    }
  };

  function initTopics() {
    const items = document.querySelectorAll('[data-topic]');
    const detail = document.querySelector('[data-topic-detail]');
    if (!items.length || !detail) return;

    function setActive(key) {
      items.forEach(it => it.classList.toggle('is-active', it.dataset.topic === key));
      const t = TOPICS[key];
      if (!t) return;
      detail.classList.remove('is-changing');
      // force reflow so animation re-runs
      void detail.offsetWidth;
      detail.classList.add('is-changing');
      detail.innerHTML = `
        <div class="topic-art" aria-hidden="true">
          <span class="glyph">${t.glyph}</span>
        </div>
        <h3>${t.title}</h3>
        <p>${t.blurb}</p>
        <div class="questions">
          <span>${t.questions[0]}</span>
          <span>${t.questions[1]}</span>
          <span>${t.questions[2]}</span>
        </div>
      `;
    }

    items.forEach(it => {
      it.addEventListener('mouseenter', () => setActive(it.dataset.topic));
      it.addEventListener('focus', () => setActive(it.dataset.topic));
      it.addEventListener('click', () => setActive(it.dataset.topic));
    });

    // initial
    setActive(items[0].dataset.topic);
  }

  // ── FAQ accordion ─────────────────────────────────────────────
  function initFAQ() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach((item, idx) => {
      const q = item.querySelector('.faq-q');
      const a = item.querySelector('.faq-a');
      if (!q || !a) return;
      const id = `faq-a-${idx}`;
      a.id = id;
      q.setAttribute('aria-controls', id);
      q.setAttribute('aria-expanded', 'false');
      q.addEventListener('click', () => {
        const open = item.classList.toggle('is-open');
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          a.style.maxHeight = a.scrollHeight + 'px';
        } else {
          a.style.maxHeight = '0px';
        }
      });
    });
  }

  // ── Tweaks panel (host protocol) ──────────────────────────────
  function initTweaksPanel() {
    const fab = document.querySelector('.tweaks-fab');
    const panel = document.querySelector('.tweaks-panel');
    if (!fab || !panel) return;

    let activated = false;
    function show() { fab.classList.add('visible'); }
    function hide() { fab.classList.remove('visible'); panel.classList.remove('open'); }
    function togglePanel() { panel.classList.toggle('open'); }

    // Listen first
    window.addEventListener('message', (e) => {
      const data = e.data || {};
      if (data.type === '__activate_edit_mode') { activated = true; show(); }
      if (data.type === '__deactivate_edit_mode') { activated = false; hide(); }
    });

    // Then announce
    try { window.parent.postMessage({type: '__edit_mode_available'}, '*'); } catch(e) {}

    fab.addEventListener('click', togglePanel);
    panel.querySelector('.tw-close')?.addEventListener('click', () => {
      panel.classList.remove('open');
      try { window.parent.postMessage({type: '__edit_mode_dismissed'}, '*'); } catch(e) {}
    });

    // Wire option buttons
    panel.querySelectorAll('.tw-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.tweak;
        const val = btn.dataset.value;
        if (!key) return;
        setTweak(key, val);
      });
      // initial pressed state
      btn.setAttribute('aria-pressed',
        tweaks[btn.dataset.tweak] === btn.dataset.value ? 'true' : 'false'
      );
    });

    // Show fab if running outside host (for direct preview convenience)
    setTimeout(() => { if (!activated) { /* leave hidden by default */ } }, 1000);
  }
})();
