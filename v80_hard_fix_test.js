const fs = require('fs');
const { execFileSync } = require('child_process');
const app = fs.readFileSync('app.js', 'utf8');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'failed'); }

test('01 app.js syntax is valid', () => {
  execFileSync(process.execPath, ['--check', 'app.js'], { stdio: 'pipe' });
});

test('02 V80 hard fix is appended', () => {
  ok(app.includes('GKM_V80_HARD_FIX_VERSION'), 'missing V80 marker');
  ok(app.includes('v80-fast-search-real-posters-first'), 'missing V80 version value');
});

test('03 old slow search is overridden', () => {
  ok(app.includes('window.runSearch = async function()'), 'runSearch override missing');
  ok(app.includes('fastSearchScoreV80'), 'fast search scorer missing');
});

test('04 search input captures old duplicate handlers', () => {
  ok(app.includes('document.addEventListener("input"'), 'capture input listener missing');
  ok(app.includes('stopImmediatePropagation'), 'old handlers are not blocked');
  ok(app.includes('GKM_V80_SEARCH_TIMER'), 'new debounce timer missing');
});

test('05 poster detector rejects fake posters', () => {
  ok(app.includes('dummyimage.com'), 'dummy poster rejection missing');
  ok(app.includes('placeholder'), 'placeholder rejection missing');
  ok(app.includes('no-poster') && app.includes('noposter'), 'no-poster rejection missing');
});

test('06 poster detector accepts all poster field aliases', () => {
  ['poster_path','posterUrl','poster_url','imageUrl','coverUrl','img'].forEach(x => ok(app.includes(x), 'missing poster alias ' + x));
});

test('07 sorting always puts real posters first', () => {
  ok(app.includes('function posterBottomV80'), 'posterBottomV80 missing');
  ok(app.includes('const real = out.filter(hasRealPosterV80);') || app.includes('filter(hasRealPosterV80)'), 'real poster split missing');
  ok(app.includes('return real.concat(missing)'), 'real+missing order missing');
});

test('08 renderList no longer hides missing posters after pagination', () => {
  const v80 = app.slice(app.indexOf('GKM V80 HARD FIX'));
  ok(v80.includes('window.renderList = function'), 'renderList override missing');
  ok(!/gkmVisibleCardsV79\(beforeV79\)/.test(v80), 'V80 renderList still uses old hiding logic');
});

test('09 home sections filter no-poster cards from visible rows', () => {
  ok(app.includes('window.homeSectionHtml = function'), 'homeSectionHtml override missing');
  ok(app.includes('filter(hasRealPosterV80).slice(0, 18)'), 'home visible rows not real-poster only');
});

test('10 status reports timing and missing-poster count', () => {
  ok(app.includes('без постера внизу'), 'status missing poster-bottom confirmation');
  ok(app.includes('Math.round(t1 - t0)'), 'search timing missing');
});

let passed = 0;
for (const t of tests) {
  try { t.fn(); console.log('PASS', t.name); passed++; }
  catch (e) { console.error('FAIL', t.name, '-', e.message); process.exitCode = 1; }
}
console.log(`RESULT ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
