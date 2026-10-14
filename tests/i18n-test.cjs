'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = new Map();
let id, context;
for (const line of fs.readFileSync(path.join(root, 'po/zh_Hans/frpc-own.po'), 'utf8').split('\n')) {
  if (line.startsWith('msgctxt ')) context = JSON.parse(line.slice(8));
  if (line.startsWith('msgid ')) id = JSON.parse(line.slice(6));
  if (line.startsWith('msgstr ') && id && id !== 'FRPC Own') {
    assert.equal(context, 'frpc-own');
    assert(!catalog.has(id), 'Duplicate translation: ' + id);
    catalog.set(id, JSON.parse(line.slice(7)));
  }
}
for (const relative of ['htdocs/luci-static/resources/view/frpc/overview.js', 'htdocs/luci-static/resources/frpc/i18n.js']) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.doesNotMatch(source, /[\u4e00-\u9fff]/);
  for (const match of source.matchAll(/_\(('(?:[^'\\]|\\.)*')(?:, 'frpc-own')?\)/g)) {
    assert(match[0].includes(", 'frpc-own'"), 'Missing private context: ' + match[0]);
    const text = new Function('return ' + match[1])();
    assert(catalog.has(text), 'Missing translation: ' + text);
  }
}
const makeI18n = chinese => {
  const members = new Function('baseclass', '_', fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/frpc/i18n.js'), 'utf8'))(
    {extend: obj => obj}, (text, ctx) => ctx === 'frpc-own' && chinese ? catalog.get(text) || text : text);
  return members;
};
const english = makeI18n(false), chinese = makeI18n(true);
assert.equal(english.translate('Runtime configuration'), 'Runtime configuration');
assert.equal(chinese.translate('Runtime configuration'), '\u8fd0\u884c\u914d\u7f6e');
assert.equal(chinese.translate('Save authentication'), '\u4fdd\u5b58\u8ba4\u8bc1\u4fe1\u606f');
assert.equal(chinese.translate('Installing frpc 0.71.0...'), '\u6b63\u5728\u5b89\u88c5 frpc 0.71.0\u2026');
assert(chinese.translate('Update failed: Failed to download the latest release').includes('\u4e0b\u8f7d\u6700\u65b0\u7248\u5931\u8d25'));
assert(english.logText('2026-10-14 12:00:00 Update started.').endsWith('Update started.'));
assert(chinese.logText('2026-10-14 12:00:00 Update started.').endsWith('\u66f4\u65b0\u4efb\u52a1\u5df2\u542f\u52a8\u3002'));
assert.equal(english.translate('\u5c1a\u672a\u5f00\u59cb\u66f4\u65b0\u3002'), 'No update has started.');
console.log('English fallback, private-context coverage, and Chinese dynamic messages passed');
if (process.argv[2]) {
  const binary=fs.readFileSync(process.argv[2]);
  const index=binary.readUInt32BE(binary.length-4), TR={};
  for(let offset=index;offset<binary.length-4;offset+=16) {
    const hash=binary.readUInt32BE(offset).toString(16).padStart(8,'0');
    const start=binary.readUInt32BE(offset+8), length=binary.readUInt32BE(offset+12);
    TR[hash]=binary.subarray(start,start+length).toString('utf8');
  }
  const cbi=fs.readFileSync(process.argv[3],'utf8');
  const lookup=new Function('window','TR',cbi.slice(cbi.indexOf('function s8('),cbi.indexOf('function N_('))+';return _;')({TR},TR);
  for (const [id,zh] of catalog) assert.equal(lookup(id,'frpc-own'),zh,'Compiled catalog misses '+id);
  console.log('Compiled Chinese catalog verified with the actual LuCI lookup implementation');
}
