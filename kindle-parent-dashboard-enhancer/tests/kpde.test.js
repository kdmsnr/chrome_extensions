const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadKpdeExports(overrides) {
  const scriptPath = path.resolve(__dirname, '..', 'kindle-parent-dashboard-enhancer.user.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    __KPDE_TEST_EXPORTS__: {}
  };
  if (overrides && typeof overrides === 'object') {
    Object.assign(context, overrides);
  }
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });
  return context.__KPDE_TEST_EXPORTS__;
}

const kpde = loadKpdeExports();

test('normalizeDigits converts full-width digits to half-width', () => {
  assert.equal(kpde.normalizeDigits('１２３abc４５６'), '123abc456');
});

test('searchNorm normalizes spaces, digits and case', () => {
  assert.equal(kpde.searchNorm('  COSMOS　（８）  '), 'cosmos （8）');
});

test('sanitizeStringMap keeps only non-empty string pairs', () => {
  const got = kpde.sanitizeStringMap({
    ok: 'value',
    emptyValue: '',
    nonStringValue: 1,
    another: 'x',
    '': 'ignored'
  });
  assert.deepEqual(toPlain(got), { ok: 'value', another: 'x' });
});

test('sanitizeAsinStatusMap keeps only ADDED/NOT_ADDED', () => {
  const got = kpde.sanitizeAsinStatusMap({
    B000000001: 'ADDED',
    B000000002: 'NOT_ADDED',
    B000000003: 'UNKNOWN',
    '': 'ADDED'
  });
  assert.deepEqual(toPlain(got), {
    B000000001: 'ADDED',
    B000000002: 'NOT_ADDED'
  });
});

test('normalizePersistedState drops unexpected keys and sanitizes maps', () => {
  const got = kpde.normalizePersistedState({
    titleToAsin: {
      'COSMOS（８）': 'B000000001',
      bad: '',
      ng: 100
    },
    asinStatus: {
      B000000001: 'ADDED',
      B000000002: 'BROKEN'
    },
    csrfToken: 'sensitive',
    childDirectedId: 'amzn1.account.x'
  });
  assert.deepEqual(toPlain(got), {
    titleToAsin: {
      'COSMOS（８）': 'B000000001'
    },
    asinStatus: {
      B000000001: 'ADDED'
    }
  });
});

test('getFilteredHits supports AND search and full/half width digits', () => {
  const db = [
    { title: 'COSMOS（８）' },
    { title: '婚活ストラテジー（1）' },
    { title: '別タイトル（3）' }
  ];
  assert.deepEqual(toPlain(kpde.getFilteredHits(db, '')), []);
  assert.deepEqual(toPlain(kpde.getFilteredHits(db, '   ')), []);
  assert.deepEqual(
    kpde.getFilteredHits(db, 'cosmos 8').map((x) => x.title),
    ['COSMOS（８）']
  );
  assert.deepEqual(
    kpde.getFilteredHits(db, '婚活 １').map((x) => x.title),
    ['婚活ストラテジー（1）']
  );
});

test('sortByTitle uses locale-aware numeric order', () => {
  const items = [
    { title: '巻10' },
    { title: '巻2' },
    { title: '巻1' }
  ];
  assert.deepEqual(
    kpde.sortByTitle(items).map((x) => x.title),
    ['巻1', '巻2', '巻10']
  );
});

test('clearPersistedData removes DB and state keys', () => {
  const removed = [];
  const store = {
    removeItem(key) {
      removed.push(key);
    }
  };
  kpde.clearPersistedData(store);
  assert.deepEqual(removed, [kpde.DB_KEY, kpde.STATE_KEY]);
});

test('isTargetPage requires add-content path and isChildSelected=true', () => {
  assert.equal(
    kpde.isTargetPage('https://parents.amazon.co.jp/settings/add-content?isChildSelected=true'),
    true
  );
  assert.equal(
    kpde.isTargetPage('https://parents.amazon.co.jp/settings/add-content?isChildSelected=false'),
    false
  );
  assert.equal(
    kpde.isTargetPage('https://parents.amazon.co.jp/settings/add-content'),
    false
  );
  assert.equal(
    kpde.isTargetPage('https://parents.amazon.co.jp/settings/child-settings'),
    false
  );
});

test('discoverChildCandidatesFromPage collects ids from URL, data attrs, and scripts', () => {
  const mockWindow = {
    location: {
      href: 'https://parents.amazon.co.jp/settings/add-content?isChildSelected=true&childDirectedId=amzn1.account.ABC123'
    }
  };
  const dataNodes = [
    {
      getAttribute(name) {
        if (name === 'data-child-directed-id') return 'amzn1.account.DEF456';
        return '';
      }
    }
  ];
  const mockDocument = {
    querySelectorAll(selector) {
      if (selector === '[data-directed-id]') return [];
      if (selector === '[data-child-directed-id]') return dataNodes;
      if (selector === '[data-child-id]') return [];
      return [];
    },
    scripts: [
      {
        textContent: 'window.__STATE__={"selectedChild":"amzn1.account.GHI789"};'
      }
    ]
  };
  const exportsWithDom = loadKpdeExports({ window: mockWindow, document: mockDocument });
  const added = exportsWithDom.discoverChildCandidatesFromPage();
  const snapshot = toPlain(exportsWithDom.getSessionStateSnapshot());

  assert.equal(added >= 1, true);
  assert.equal(snapshot.childDirectedId, 'amzn1.account.ABC123');
  assert.deepEqual(
    snapshot.childDirectedIdCandidates,
    ['amzn1.account.ABC123', 'amzn1.account.DEF456', 'amzn1.account.GHI789']
  );
});
