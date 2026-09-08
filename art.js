/* CoffeeHouse shared pixel-art engine + day/night theme. */
(function (global) {
  'use strict';

  var PAL = {
    light: {
      K: '#2a1708', B: '#141f3d', P: '#ee9ab4', P2: '#f6c4d8',
      C: '#7a4a24', C2: '#a06a3c', W: '#fdf3d7', S: '#f0c49a',
      H: '#33221a', G: '#6b8f49', N: '#40517e', L: '#f0b45a',
      T: '#4a2c17', M: '#6b8f49', E: '#273022'
    },
    dark: {
      K: '#0b0a1e', B: '#05070f', P: '#f093b5', P2: '#ffc2d8',
      C: '#5a3a2a', C2: '#8a5f38', W: '#f8eef2', S: '#efc297',
      H: '#2a1f38', G: '#b35c82', N: '#2b3a6b', L: '#ffd98a',
      T: '#3a2415', M: '#7fae8d', E: '#171c36'
    }
  };

  function g(light, key) { return (light ? PAL.light : PAL.dark)[key]; }

  function ctx(id, w, h) {
    var c = document.getElementById(id);
    if (!c) return null;
    c.width = w; c.height = h;
    return c.getContext('2d');
  }

  function r(c, x, y, w, h, col) { if (!c) return; c.fillStyle = col; c.fillRect(x, y, w, h); }

  function drawCup(id, light) {
    var c = ctx(id, 16, 16); if (!c) return;
    var K = g(light, 'K'), C = g(light, 'C'), C2 = g(light, 'C2'), W = g(light, 'W'), P = g(light, 'P');
    r(c, 7, 0, 1, 1, W); r(c, 8, 1, 2, 1, W); r(c, 5, 1, 1, 1, W);
    r(c, 12, 5, 3, 1, K); r(c, 12, 9, 3, 1, K); r(c, 12, 5, 1, 5, K); r(c, 14, 5, 1, 5, K);
    r(c, 13, 6, 1, 3, W);
    r(c, 3, 4, 9, 8, C);
    r(c, 3, 4, 9, 1, K); r(c, 3, 4, 1, 8, K); r(c, 11, 4, 1, 8, K); r(c, 3, 11, 9, 1, K);
    r(c, 4, 4, 7, 1, W);
    r(c, 5, 6, 2, 2, P); r(c, 7, 6, 2, 2, P); r(c, 6, 8, 2, 1, P);
    r(c, 4, 6, 1, 2, C2);
  }

  function drawStudent(id, light) {
    var c = ctx(id, 16, 16); if (!c) return;
    var K = g(light, 'K'), P = g(light, 'P'), S = g(light, 'S'), H = g(light, 'H'), G = g(light, 'G'), N = g(light, 'N'), C2 = g(light, 'C2');
    r(c, 6, 0, 3, 1, H); r(c, 7, 1, 1, 1, H);
    r(c, 5, 2, 6, 5, S);
    r(c, 5, 2, 6, 1, H); r(c, 4, 3, 1, 4, H); r(c, 10, 3, 1, 4, H);
    r(c, 6, 3, 3, 1, H); r(c, 5, 4, 2, 1, H);
    r(c, 6, 5, 1, 1, K); r(c, 9, 5, 1, 1, K);
    r(c, 7, 6, 2, 1, C2);
    r(c, 7, 7, 2, 1, S);
    r(c, 4, 8, 8, 5, G);
    r(c, 7, 8, 2, 1, W());
    r(c, 10, 9, 3, 4, P); r(c, 9, 9, 1, 3, P); r(c, 13, 10, 1, 3, P);
    r(c, 11, 10, 1, 2, W());
    r(c, 5, 13, 6, 1, N);
    r(c, 5, 14, 2, 2, N); r(c, 9, 14, 2, 2, N);
    r(c, 4, 15, 3, 1, K); r(c, 9, 15, 3, 1, K);
    function W() { return g(light, 'W'); }
  }

  function drawTree(id, light) {
    var c = ctx(id, 24, 24); if (!c) return;
    var K = g(light, 'K'), T = g(light, 'T'), P = g(light, 'P'), P2 = g(light, 'P2'), E = g(light, 'E');
    r(c, 0, 22, 24, 2, E);
    r(c, 10, 15, 4, 8, T);
    r(c, 9, 21, 6, 2, T);
    r(c, 8, 16, 3, 2, T); r(c, 13, 16, 3, 2, T);
    r(c, 9, 13, 2, 2, T); r(c, 13, 13, 2, 2, T);
    r(c, 3, 11, 6, 5, P);
    r(c, 12, 10, 7, 5, P);
    r(c, 8, 9, 6, 4, P2);
    r(c, 5, 7, 5, 3, P2);
    r(c, 13, 6, 6, 2, P2);
    r(c, 9, 13, 8, 3, P);
    r(c, 11, 7, 4, 2, P);
    r(c, 4, 9, 1, 1, K); r(c, 6, 12, 1, 1, K); r(c, 14, 11, 1, 1, K); r(c, 10, 12, 1, 1, K);
    r(c, 7, 10, 1, 1, P2); r(c, 15, 7, 1, 1, P2);
    r(c, 1, 6, 1, 1, P); r(c, 20, 8, 1, 1, P); r(c, 2, 14, 1, 1, P); r(c, 22, 12, 1, 1, P);
    r(c, 18, 4, 1, 1, P); r(c, 5, 3, 1, 1, P2); r(c, 16, 2, 1, 1, P); r(c, 3, 17, 1, 1, P2); r(c, 21, 16, 1, 1, P);
    r(c, 10, 16, 4, 1, K);
  }

  function drawBook(id, light) {
    var c = ctx(id, 16, 12); if (!c) return;
    var K = g(light, 'K'), C2 = g(light, 'C2'), W = g(light, 'W');
    r(c, 2, 2, 12, 8, C2);
    r(c, 2, 2, 12, 1, K); r(c, 2, 2, 1, 8, K); r(c, 13, 2, 1, 8, K); r(c, 2, 9, 12, 1, K);
    r(c, 3, 3, 5, 6, W); r(c, 8, 3, 5, 6, W);
    r(c, 7, 3, 2, 1, K);
    r(c, 4, 5, 3, 1, K); r(c, 8, 5, 3, 1, K); r(c, 4, 7, 3, 1, K); r(c, 8, 7, 3, 1, K);
  }

  function drawLaptop(id, light) {
    var c = ctx(id, 20, 14); if (!c) return;
    var K = g(light, 'K'), W = g(light, 'W'), E = g(light, 'E'), C2 = g(light, 'C2');
    r(c, 1, 1, 18, 9, E);
    r(c, 1, 1, 18, 1, K); r(c, 1, 1, 1, 9, K); r(c, 18, 1, 1, 9, K); r(c, 1, 9, 18, 1, K);
    r(c, 2, 2, 16, 7, W);
    r(c, 3, 3, 5, 1, K); r(c, 3, 5, 5, 1, K);
    r(c, 10, 3, 6, 1, K); r(c, 10, 5, 6, 1, K);
    r(c, 1, 10, 18, 1, K);
    r(c, 3, 10, 14, 2, C2);
    r(c, 4, 11, 3, 1, K); r(c, 8, 11, 3, 1, K); r(c, 12, 11, 3, 1, K);
    r(c, 2, 12, 16, 1, K); r(c, 1, 13, 18, 1, K);
  }

  function drawLantern(id, light) {
    var c = ctx(id, 14, 18); if (!c) return;
    var K = g(light, 'K'), L = g(light, 'L'), P2 = g(light, 'P2');
    r(c, 5, 0, 4, 1, K);
    r(c, 6, 1, 2, 2, K);
    r(c, 4, 3, 6, 3, K);
    r(c, 2, 5, 10, 10, L);
    r(c, 1, 6, 12, 8, L);
    r(c, 2, 5, 10, 1, K); r(c, 2, 5, 1, 10, K); r(c, 11, 5, 1, 10, K); r(c, 2, 14, 10, 1, K);
    r(c, 5, 5, 1, 10, K); r(c, 8, 5, 1, 10, K);
    r(c, 1, 6, 1, 8, P2); r(c, 12, 6, 1, 8, P2);
    r(c, 4, 14, 6, 3, K);
  }

  function drawMoon(id, light) {
    var c = ctx(id, 24, 16); if (!c) return;
    var B = g(light, 'B'), W = g(light, 'W'), L = g(light, 'L');
    r(c, 0, 0, 24, 16, B);
    r(c, 2, 2, 1, 1, W); r(c, 6, 4, 1, 1, W); r(c, 11, 1, 1, 1, W); r(c, 16, 8, 1, 1, W);
    r(c, 5, 10, 1, 1, W); r(c, 21, 3, 1, 1, W); r(c, 20, 12, 1, 1, W); r(c, 8, 12, 1, 1, W);
    r(c, 11, 0, 3, 1, L);
    r(c, 9, 1, 7, 1, L);
    r(c, 8, 2, 9, 1, L);
    r(c, 7, 3, 11, 1, L);
    r(c, 7, 4, 11, 2, L);
    r(c, 7, 6, 11, 2, L);
    r(c, 7, 8, 11, 1, L);
    r(c, 8, 9, 9, 1, L);
    r(c, 9, 10, 7, 1, L);
    r(c, 11, 11, 3, 1, L);
    r(c, 12, 3, 6, 1, B); r(c, 12, 4, 6, 2, B); r(c, 13, 6, 5, 1, B);
    r(c, 14, 7, 4, 1, B); r(c, 15, 8, 3, 1, B); r(c, 16, 9, 2, 1, B);
  }

  var FNS = {
    Cup: drawCup, Student: drawStudent, Tree: drawTree,
    Book: drawBook, Laptop: drawLaptop, Lantern: drawLantern, Moon: drawMoon
  };

  function refreshAll() {
    var light = document.body.getAttribute('data-theme') !== 'dark';
    var els = document.querySelectorAll('canvas[data-art]');
    for (var i = 0; i < els.length; i++) {
      var fn = FNS[els[i].getAttribute('data-art')];
      if (fn) fn(els[i].id, light);
    }
  }

  function apply(theme) {
    document.body.setAttribute('data-theme', theme);
    var dark = theme === 'dark';
    var togglers = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < togglers.length; i++) {
      var ic = togglers[i].querySelector('.tb-ic');
      var lb = togglers[i].querySelector('.tb-lb');
      if (ic) ic.textContent = dark ? '\u2600' : '\u263E';
      if (lb) lb.textContent = dark ? 'DAY' : 'NIGHT';
    }
    refreshAll();
  }

  function initTheme() {
    var saved = 'light';
    try { saved = localStorage.getItem('ch-theme') || 'light'; } catch (e) { saved = 'light'; }
    apply(saved);
    var togglers = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < togglers.length; i++) {
      togglers[i].addEventListener('click', function () {
        var cur = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(cur);
        try { localStorage.setItem('ch-theme', cur); } catch (e) {}
      });
    }
  }

  global.Art = {
    initTheme: initTheme,
    refreshAll: refreshAll,
    draw: FNS
  };
})(window);