'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const settings = new Function('baseclass', '_', fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/frpc/settings.js'), 'utf8'))({extend: value => value}, value => value);
class Node {
  constructor(tag, attrs = {}, children = []) { this.tag = tag; this.attrs = attrs; this.childNodes = []; (Array.isArray(children) ? children : [children]).forEach(c => this.appendChild(c)); }
  appendChild(c) { if (c && c.parentNode) c.parentNode.childNodes.splice(c.parentNode.childNodes.indexOf(c), 1); this.childNodes.push(c); if (c instanceof Node) c.parentNode = this; }
  insertBefore(c, before) { this.childNodes.splice(this.childNodes.indexOf(before), 0, c); c.parentNode = this; }
  closest(tag) { return this.tag === tag ? this : this.parentNode && this.parentNode.closest(tag); }
  setAttribute(key, value) { this.attrs[key] = value; }
  querySelectorAll() { return this.childNodes.filter(c => c instanceof Node).flatMap(c => (c.attrs['data-frpc-advanced'] ? [c] : []).concat(c.querySelectorAll())); }
}
const E = (tag, attrs, children) => new Node(tag, attrs, children);
class Option {
  constructor(section, key, label) { this.section = section; this.option = key; this.title = label; this.dependencies = []; this.choices = []; }
  value(key) { this.choices.push(key); }
  depends(key, value) { this.dependencies.push([key, value]); }
  render() { return E('div'); }
}
const source = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/frpc/overview.js'), 'utf8');
let uploaded;
const dependencies = {form: {Value: Option, TextValue: Option, ListValue: Option, Flag: Option}, frpcSettings: settings, E, _: v => v,
  rpc: {declare: () => () => Promise.resolve()}, view: {extend: v => v},
  fs: {write: async (_, json) => { uploaded = JSON.parse(json); }, exec: async () => ({code: 0, stdout: ''})},
  frpcI18n: {translate: v => v}, document: {querySelector: () => null}, ui: {showModal() {}},
};
const prefix = source.slice(0, source.indexOf('return view.extend({'));
const {addAdvanced, foldAdvanced} = new Function(...Object.keys(dependencies), prefix + 'return {addAdvanced, foldAdvanced};')(...Object.values(dependencies));
const view = new Function(...Object.keys(dependencies), source)(...Object.values(dependencies));
(async () => {
  for (const group of ['main', 'proxy', 'visitor']) {
    const fields = [];
    const section = {option: (_, key, label) => {const o = new Option(section, key, label); fields.push(o); return o;},
      taboption: (tab, ...args) => section.option(...args), formvalue: () => ''};
    addAdvanced(section, group);
    assert.equal(fields.length, settings[group].length);
    for (const field of fields) assert.equal((await field.render()).attrs['data-frpc-advanced'], group);
    if (group === 'main') {
      assert.equal(fields.find(f => f.option === 'protocol').choices.join(','), ',tcp,kcp,quic,websocket,wss');
      assert.equal(fields.find(f => f.option === 'token_file').dependencies[0][1], 'auth');
    }
    if (group === 'proxy') {
      const headers = fields.find(f => f.option === 'request_headers');
      assert.equal(headers.validate('test', 'X-Name=a=b'), true);
      assert.notEqual(headers.validate('test', 'X-Name=a\nX-Name=b'), true);
      assert.notEqual(headers.validate('test', 'missing-equals'), true);
    }
  }
  const parent = E('div'), ordinary = E('div'), a = E('div', {'data-frpc-advanced': 'main'}), b = E('div', {'data-frpc-advanced': 'main'});
  parent.appendChild(ordinary); parent.appendChild(a); parent.appendChild(b);
  foldAdvanced(parent); foldAdvanced(parent);
  assert.equal(parent.childNodes.length, 2);
  assert.equal(parent.childNodes[1].tag, 'details');
  assert.equal(parent.childNodes[1].childNodes[1], a);
  assert.equal(parent.childNodes[1].childNodes[2], b);
  const option = (key, value, active = true, valid = true, optional = true) => ({option: key, title: key, rmempty: optional,
    formvalue: () => value, isActive: () => active, isValid: () => valid});
  const buttons = ['save', 'edit', 'delete', 'autostart', 'restart', 'update'].map(kind => ({
    kind, dataset: {}, classList: {contains: () => false}, hasAttribute: key => key === 'data-frpc-update' && kind === 'update'
  }));
  const serviceButton = {};
  dependencies.document.querySelectorAll = () => buttons;
  dependencies.document.getElementById = () => serviceButton;
  const controls = {...view, running: true, statusKnown: true};
  controls.updateControls();
  for (const button of buttons) assert.equal(button.disabled, button.kind === 'update', button.kind);
  assert.equal(serviceButton.disabled, false);
  controls.saving = true;
  controls.updateControls();
  assert(buttons.every(button => button.disabled));
  assert.equal(serviceButton.disabled, true);
  const self = {...view, running: true, updateControls() {}, refreshStatus: async () => ({running: true})};
  await self.saveAuthentication([option('server_addr', 'example.org', true, true, false), option('protocol', ''),
    option('oidc_client_secret', 'unused-secret', false, false), option('heartbeat_interval', '-1')]);
  assert.deepEqual(uploaded, {server_addr: 'example.org', protocol: '', oidc_client_secret: '', heartbeat_interval: '-1'});
  let runtimeRefreshes = 0, statusRefreshes = 0;
  const restartView = {...view, updateControls() {},
    refreshRuntimeConfig: async () => { runtimeRefreshes++; },
    refreshStatus: async () => { statusRefreshes++; }
  };
  const row = restartView.renderStatusBar({running: true, enabled: false, version: 'test'}).childNodes[0];
  const stopIndex = row.childNodes.findIndex(node => node.attrs && node.attrs.id === 'frpc-service-toggle');
  const restart = row.childNodes[stopIndex + 1];
  assert.equal(restart.attrs.id, 'frpc-service-restart');
  const commands = [];
  let completeRestart;
  dependencies.fs.exec = async (program, args) => {
    commands.push([program, args]);
    return new Promise(resolve => { completeRestart = resolve; });
  };
  const pending = restart.attrs.click({currentTarget: restart});
  assert.equal(restartView.serviceBusy, true);
  restart.attrs.click({currentTarget: restart});
  assert.equal(commands.length, 1, 'Repeated clicks must not start another restart');
  assert.deepEqual(commands[0], ['/usr/libexec/frpc-ui', ['service', 'restart']]);
  completeRestart({code: 0, stdout: ''});
  await pending;
  assert.equal(runtimeRefreshes, 1);
  assert.equal(statusRefreshes, 1);
  assert.equal(restartView.serviceBusy, false);
  dependencies.fs.exec = async () => ({code: 1, stderr: 'Invalid saved configuration'});
  await restart.attrs.click({currentTarget: restart});
  assert.equal(runtimeRefreshes, 1, 'Failed restarts must not report a refreshed configuration');
  assert.equal(statusRefreshes, 2, 'Service status must update after a failed restart');
  assert.equal(restartView.serviceBusy, false);
  console.log('Restart button placement, latest configuration refresh, repeated clicks and failure recovery passed');
  console.log('Advanced field dependencies, header validation, collapsed DOM and optional authentication save while running passed');
})().catch(e => {console.error(e); process.exitCode = 1;});
