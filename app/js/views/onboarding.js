// Erster Start: Begrüßung, Namen, Beziehungsbeginn – oder mit dem Konto des Partners verbinden.
import { html } from '../ui/dom.js';
import { saveSettings, setDevice, settings, all } from '../store.js';
import { isConfigured, login } from '../sync.js';
import { toast } from '../ui/sheet.js';
import { today } from '../model.js';

export function runOnboarding() {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'onb';
    document.body.appendChild(root);
    const data = { a: '', b: '', startDate: '' };

    const finish = async () => {
      root.style.transition = 'opacity .5s ease';
      root.style.opacity = '0';
      setTimeout(() => { root.remove(); resolve(); }, 500);
    };

    const dots = (n) => html`<div class="dots">${[0, 1, 2].map((i) => html`<span class="${i === n ? 'on' : ''}"></span>`)}</div>`;

    function welcome() {
      root.innerHTML = String(html`
        <div class="step">
          <img class="logo" src="assets/icons/icon-512.png" alt="">
          <h1>Couple <em>Journal</em></h1>
          <p class="lead">Bewertet alles, was ihr zusammen macht – Dates, Essen, Reisen, Rezepte. Mit Fotos, Kalender, Globus und Statistiken.</p>
          <div class="actions">
            <button class="btn primary block" data-go="names">Loslegen</button>
            ${isConfigured() ? html`<button class="btn ghost block" data-go="connect">Mit Partner verbinden</button>` : ''}
          </div>
        </div>`);
    }

    function names() {
      root.innerHTML = String(html`
        <div class="step">
          ${dots(0)}
          <h1>Wie heißt <em>ihr</em>?</h1>
          <p class="lead">Die Namen erscheinen überall in der App – auch bei euren Bewertungen.</p>
          <div class="form" style="margin-top:26px">
            <div class="group">
              <div class="cell"><label>Du</label><input id="n-a" placeholder="Dein Name" autocomplete="given-name" value="${data.a}"></div>
              <div class="cell"><label>Plus eins</label><input id="n-b" placeholder="Name" value="${data.b}"></div>
            </div>
          </div>
          <div class="actions"><button class="btn primary block" data-go="start">Weiter</button></div>
        </div>`);
      setTimeout(() => root.querySelector('#n-a').focus(), 350);
    }

    function start() {
      root.innerHTML = String(html`
        <div class="step">
          ${dots(1)}
          <h1>Seit wann seid ihr <em>zusammen</em>?</h1>
          <p class="lead">Ab diesem Tag zählt die App mit – und eure Timeline beginnt.</p>
          <div class="form" style="margin-top:26px">
            <div class="group">
              <div class="cell"><label>Tag 1</label><input id="sd" type="date" max="${today()}" placeholder="Datum wählen" value="${data.startDate}"></div>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary block" data-go="done">Weiter</button>
            <button class="text-btn" data-go="names">Zurück</button>
          </div>
        </div>`);
    }

    function done() {
      root.innerHTML = String(html`
        <div class="step center">
          ${dots(2)}
          <div class="onb-mark">&amp;</div>
          <h1>Alles bereit, <em>${data.a}</em> &amp; <em>${data.b}</em></h1>
          <p class="lead">Legt euer erstes Erlebnis an, bewertet es – und schaut zu, wie sich euer Globus füllt.</p>
          <div class="actions"><button class="btn primary block" data-go="finish">Los geht's</button></div>
        </div>`);
    }

    function connect(err = '') {
      root.innerHTML = String(html`
        <div class="step">
          <h1>Mit <em>Partner</em> verbinden</h1>
          <p class="lead">Melde dich mit deinem Konto an. Danach werden alle gemeinsamen Einträge geladen.</p>
          <form class="form" id="lf" style="margin-top:26px">
            <div class="group">
              <div class="cell"><label>E-Mail</label><input id="em" type="email" autocomplete="username" inputmode="email" required></div>
              <div class="cell"><label>Passwort</label><input id="pw" type="password" autocomplete="current-password" required></div>
            </div>
            ${err ? html`<p class="center" style="color:var(--danger)">${err}</p>` : ''}
            <button class="btn primary block" type="submit">Anmelden</button>
            <button class="text-btn" type="button" data-go="welcome">Zurück</button>
          </form>
        </div>`);
      root.querySelector('#lf').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = root.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Verbinde …';
        try {
          await login(root.querySelector('#em').value, root.querySelector('#pw').value);
          whoAmI();
        } catch (ex) {
          connect(ex.message);
        }
      });
    }

    function whoAmI() {
      const s = settings();
      const hasData = all('settings').length > 0;
      if (!hasData) {
        toast('Noch keine gemeinsamen Daten gefunden – richtet die App zuerst ein.', { icon: 'info', duration: 4000 });
        names();
        return;
      }
      let pick = null;
      root.innerHTML = String(html`
        <div class="step">
          <h1>Wer bist <em>du</em>?</h1>
          <p class="lead">Damit deine Bewertungen und Briefe richtig zugeordnet werden.</p>
          <div class="who-pick">
            <button data-who="a">${s.names.a}</button>
            <button data-who="b">${s.names.b}</button>
          </div>
          <div class="actions"><button class="btn primary block" data-go="finish-connect" disabled>Fertig</button></div>
        </div>`);
      root.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => {
        pick = b.dataset.who;
        root.querySelectorAll('[data-who]').forEach((x) => x.classList.toggle('active', x === b));
        const go = root.querySelector('[data-go="finish-connect"]');
        go.disabled = false;
        go.onclick = async (e) => {
          e.stopPropagation();
          await setDevice({ me: pick, onboarded: true });
          finish();
        };
      }));
    }

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      const step = b.dataset.go;
      if (step === 'start') {
        data.a = root.querySelector('#n-a').value.trim();
        data.b = root.querySelector('#n-b').value.trim();
        if (!data.a || !data.b) { toast('Bitte beide Namen eintragen', { icon: 'user' }); return; }
        start();
      } else if (step === 'done') {
        data.startDate = root.querySelector('#sd').value;
        if (!data.startDate) { toast('Bitte euren Tag 1 auswählen', { icon: 'calendar' }); return; }
        done();
      } else if (step === 'finish') {
        await saveSettings({ names: { a: data.a, b: data.b }, startDate: data.startDate });
        await setDevice({ me: 'a', onboarded: true });
        finish();
      } else if (step === 'names') names();
      else if (step === 'connect') connect();
      else if (step === 'welcome') welcome();
    });

    welcome();
  });
}

