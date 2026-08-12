'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';

var UI_HELPER = '/usr/libexec/frpc-ui';
var CONFIG_UPLOAD = '/tmp/frpc/uploads/config-upload';
var FRPC_UPLOAD = '/tmp/frpc/uploads/frpc-upload.tar.gz';
var UPDATE_POLL_INTERVAL = 1000;
var UPDATE_RETRY_INTERVAL = 1000;

function runCommand(args) {
	return fs.exec(UI_HELPER, args).then(function(res) {
		if (res.code !== 0)
			throw new Error((res.stderr || res.stdout || _('命令执行失败')).trim());
		return res.stdout || '';
	});
}

function parseStatus(output) {
	var fields = (output || '').trim().split('\t');
	return {
		running: fields[0] === '1',
		enabled: fields[1] === '1',
		version: fields[2] || _('未安装'),
		mode: fields[3] === 'raw' ? 'raw' : 'uci'
	};
}

function notifyError(err) {
	ui.addNotification(null, E('p', {}, (err && err.message) || String(err)), 'error');
}

function notify(message) {
	ui.addNotification(null, E('p', {}, message));
}

function validateName(sectionId, value) {
	return /^[A-Za-z0-9._-]{1,64}$/.test(value || '') ||
		_('只能使用 1-64 位字母、数字、点、下划线或横线。');
}

function validateNoWhitespace(sectionId, value) {
	return value && !/[\x00-\x20\x7f]/.test(value) || _('不能为空且不能包含空白字符。');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('frpc'),
			L.resolveDefault(runCommand([ 'status' ]), ''),
			L.resolveDefault(runCommand([ 'read-config' ]), '')
		]);
	},

	refreshStatus: function() {
		return runCommand([ 'status' ]).then(function(output) {
			var status = parseStatus(output);
			var running = document.getElementById('frpc-running-status');
			var enabled = document.getElementById('frpc-enabled-status');
			var version = document.getElementById('frpc-version-status');
			var mode = document.getElementById('frpc-mode-status');
			var serviceButton = document.getElementById('frpc-service-toggle');
			var enableButton = document.getElementById('frpc-enable-toggle');

			if (running) {
				running.textContent = status.running ? _('运行中') : _('已停止');
				running.className = status.running ? 'frpc-ok' : 'frpc-bad';
			}
			if (enabled) {
				enabled.textContent = status.enabled ? _('已启用') : _('未启用');
				enabled.className = status.enabled ? 'frpc-ok' : 'frpc-bad';
			}
			if (version) version.textContent = status.version;
			if (mode) mode.textContent = status.mode === 'raw' ? _('手动 TOML') : _('UCI 自动生成');
			if (serviceButton) {
				serviceButton.dataset.running = status.running ? '1' : '0';
				serviceButton.textContent = status.running ? _('停止服务') : _('启动服务');
				serviceButton.className = status.running ? 'btn cbi-button-negative' : 'btn cbi-button-action important';
			}
			if (enableButton) {
				enableButton.dataset.enabled = status.enabled ? '1' : '0';
				enableButton.textContent = status.enabled ? _('关闭开机自启') : _('启用开机自启');
			}
			return status;
		});
	},

	renderStatusBar: function(initialStatus) {
		var self = this;
		var serviceButton = E('button', {
			'type': 'button',
			'class': initialStatus.running ? 'btn cbi-button-negative' : 'btn cbi-button-action important',
			'id': 'frpc-service-toggle',
			'data-running': initialStatus.running ? '1' : '0',
			'click': function(ev) {
				var button = ev.currentTarget;
				var action = button.dataset.running === '1' ? 'stop' : 'start';
				button.disabled = true;
				return runCommand([ 'service', action ]).then(function() {
					notify(action === 'start' ? _('frpc 已启动。') : _('frpc 已停止。'));
					return self.refreshStatus();
				}).catch(notifyError).finally(function() { button.disabled = false; });
			}
		}, initialStatus.running ? _('停止服务') : _('启动服务'));

		var enableButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button-apply',
			'id': 'frpc-enable-toggle',
			'data-enabled': initialStatus.enabled ? '1' : '0',
			'click': function(ev) {
				var button = ev.currentTarget;
				var action = button.dataset.enabled === '1' ? 'disable' : 'enable';
				button.disabled = true;
				return runCommand([ 'service', action ]).then(function() {
					notify(action === 'enable' ? _('已启用开机自启。') : _('已关闭开机自启。'));
					return self.refreshStatus();
				}).catch(notifyError).finally(function() { button.disabled = false; });
			}
		}, initialStatus.enabled ? _('关闭开机自启') : _('启用开机自启'));

		return E('div', { 'class': 'frpc-status-scroll' }, [
			E('div', { 'class': 'frpc-status-row' }, [
				E('span', {}, [ _('服务状态') + '：', E('strong', {
					'id': 'frpc-running-status',
					'class': initialStatus.running ? 'frpc-ok' : 'frpc-bad'
				}, initialStatus.running ? _('运行中') : _('已停止')) ]),
				E('span', {}, [ _('开机自启') + '：', E('strong', {
					'id': 'frpc-enabled-status',
					'class': initialStatus.enabled ? 'frpc-ok' : 'frpc-bad'
				}, initialStatus.enabled ? _('已启用') : _('未启用')) ]),
				E('span', {}, [ _('版本') + '：', E('strong', { 'id': 'frpc-version-status' }, initialStatus.version) ]),
				E('span', {}, [ _('配置模式') + '：', E('strong', { 'id': 'frpc-mode-status' },
					initialStatus.mode === 'raw' ? _('手动 TOML') : _('UCI 自动生成')) ]),
				serviceButton,
				enableButton
			])
		]);
	},

	renderRawConfig: function(content) {
		var textarea = E('textarea', {
			'id': 'frpc-raw-config',
			'class': 'cbi-input-textarea frpc-config',
			'spellcheck': 'false'
		}, content || '');

		return E('div', {}, [
			E('p', { 'class': 'frpc-note' }, _('保存后会校验 TOML，并切换到手动配置文件模式。日志路径会强制设为 /var/log/frpc.log。')),
			textarea,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply important',
					'click': function(ev) {
						var button = ev.currentTarget;
						var value = textarea.value.replace(/\r\n/g, '\n');
						if (!value.trim()) {
							notifyError(new Error(_('配置文件不能为空。')));
							return;
						}
						button.disabled = true;
						return fs.write(CONFIG_UPLOAD, value, 384).then(function() {
							return runCommand([ 'save-config' ]);
						}).then(function(message) {
							notify(message.trim() || _('配置文件已保存。'));
							return runCommand([ 'read-config' ]);
						}).then(function(normalized) {
							textarea.value = normalized;
						}).catch(notifyError).finally(function() { button.disabled = false; });
					}
				}, _('校验并保存配置文件'))
			])
		]);
	},

	renderLogs: function() {
		var kind = E('select', {
			'id': 'frpc-log-kind',
			'class': 'cbi-input-select',
			'change': function() { return refresh().catch(notifyError); }
		}, [
			E('option', { 'value': 'frpc' }, 'frpc.log'),
			E('option', { 'value': 'update' }, 'update.log')
		]);
		var output = E('pre', { 'id': 'frpc-log-output', 'class': 'frpc-log' }, _('点击“刷新日志”读取日志。'));

		function refresh() {
			return runCommand([ 'read-log', kind.value ]).then(function(content) {
				var normalized = (content || '').replace(/\n$/, '');
				var lines = normalized ? normalized.split('\n').slice(-50) : [];
				output.textContent = lines.length ? lines.join('\n') : _('暂无日志。');
				output.scrollTop = output.scrollHeight;
			});
		}
		this.refreshLogs = refresh;

		return E('div', {}, [
			E('div', { 'class': 'frpc-actions' }, [
				kind,
				E('button', {
					'type': 'button', 'class': 'btn cbi-button-action',
					'click': function() { return refresh().catch(notifyError); }
				}, _('刷新日志')),
				E('button', {
					'type': 'button', 'class': 'btn cbi-button-negative',
					'click': function() {
						if (!confirm(_('确认清空当前日志？'))) return;
						return runCommand([ 'clear-log', kind.value ]).then(function() {
							output.textContent = _('暂无日志。');
							notify(_('日志已清空。'));
						}).catch(notifyError);
					}
				}, _('清空日志'))
			]),
			output
		]);
	},

	renderUpdate: function() {
		var self = this;
		var progressFill = E('div', { 'class': 'frpc-update-progress-fill' });
		var progress = E('div', {
			'id': 'frpc-update-progress',
			'class': 'frpc-update-progress',
			'role': 'progressbar',
			'aria-valuemin': '0',
			'aria-valuemax': '100',
			'aria-valuenow': '0'
		}, [ progressFill ]);
		var progressText = E('span', { 'id': 'frpc-update-progress-text' }, _('尚未开始更新。'));
		var onlineButton;
		var uploadButton;

		function parseUpdateStatus(output) {
			var fields = (output || '').trim().split('\t');
			var percent = Number(fields[1]);
			return {
				state: fields[0] || 'idle',
				percent: isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
				message: fields.slice(2).join('\t') || _('尚未开始更新。')
			};
		}

		function scheduleProgressRefresh(delay) {
			window.clearTimeout(self.updateProgressTimer);
			self.updateProgressTimer = window.setTimeout(function() {
				refreshProgress();
			}, delay);
		}

		function refreshProgress() {
			window.clearTimeout(self.updateProgressTimer);
			return runCommand([ 'update-status' ]).then(function(output) {
				var status = parseUpdateStatus(output);
				progressFill.style.width = status.percent + '%';
				progress.setAttribute('aria-valuenow', String(status.percent));
				progressText.textContent = '%d%% · %s'.format(status.percent, status.message);
				progressText.className = status.state === 'error' ? 'frpc-bad' :
					(status.state === 'success' ? 'frpc-ok' : '');
				if (onlineButton) onlineButton.disabled = status.state === 'running';
				if (uploadButton) uploadButton.disabled = status.state === 'running';

				if (status.state === 'running') {
					self.updateProgressPolling = true;
					scheduleProgressRefresh(UPDATE_POLL_INTERVAL);
				}
				else {
					self.updateProgressPolling = false;
					if (status.state === 'success')
						self.refreshStatus().catch(notifyError);
				}
				return status;
			}).catch(function(err) {
				if (!self.updateProgressPolling)
					throw err;
				progressText.className = '';
				progressText.textContent = _('正在重新读取更新状态…');
				scheduleProgressRefresh(UPDATE_RETRY_INTERVAL);
				return null;
			});
		}

		function handleUpdateStartError(err, button) {
			var message = (err && err.message) || String(err);
			if (/timed?\s*out|timeout/i.test(message)) {
				return L.resolveDefault(refreshProgress(), null).then(function(status) {
					if (status && status.state !== 'idle') return;
					self.updateProgressPolling = false;
					button.disabled = false;
					notifyError(err);
				});
			}
			self.updateProgressPolling = false;
			button.disabled = false;
			notifyError(err);
		}
		this.refreshUpdateProgress = refreshProgress;

		onlineButton = E('button', {
			'type': 'button', 'class': 'btn cbi-button-apply important',
			'click': function(ev) {
				if (!confirm(_('确认启动在线更新检查？'))) return;
				var button = ev.currentTarget;
				button.disabled = true;
				self.updateProgressPolling = true;
				progressFill.style.width = '1%';
				progress.setAttribute('aria-valuenow', '1');
				progressText.className = '';
				progressText.textContent = _('1% · 正在启动在线更新任务…');
				scheduleProgressRefresh(UPDATE_POLL_INTERVAL);
				return runCommand([ 'update-online' ]).then(function(message) {
					notify(message.trim());
					return refreshProgress();
				}).catch(function(err) { return handleUpdateStartError(err, button); });
			}
		}, _('在线更新'));

		uploadButton = E('button', {
			'type': 'button', 'class': 'btn cbi-button-action',
			'click': function(ev) {
				var button = ev.currentTarget;
				button.disabled = true;
				return ui.uploadFile(FRPC_UPLOAD).then(function(reply) {
					if (reply.size > 64 * 1024 * 1024) {
						return fs.remove(FRPC_UPLOAD).then(function() {
							throw new Error(_('上传文件不能超过 64 MiB。'));
						});
					}
					self.updateProgressPolling = true;
					scheduleProgressRefresh(UPDATE_POLL_INTERVAL);
					return runCommand([ 'update-local' ]);
				}).then(function(message) {
					notify(message.trim());
					return refreshProgress();
				}).catch(function(err) {
					if (/cancel/i.test((err && err.message) || '')) {
						self.updateProgressPolling = false;
						button.disabled = false;
						return;
					}
					return handleUpdateStartError(err, button);
				});
			}
		}, _('上传 frpc 或 tar.gz'));

		return E('div', {}, [
			E('p', { 'class': 'frpc-note' }, _('在线更新和本地上传都会比较版本，只有候选版本更高时才会替换。')),
			E('div', { 'class': 'frpc-update-status' }, [ progress, progressText ]),
			E('div', { 'class': 'frpc-actions' }, [
				onlineButton,
				uploadButton
			])
		]);
	},

	render: function(data) {
		var self = this;
		var initialStatus = parseStatus(data[1]);
		var m = new form.Map('frpc', _('frp 客户端'));
		var s, ss, o;
		function validateEntryName(sectionId, value) {
			var valid = validateName(sectionId, value);
			if (valid !== true) return valid;
			var type = this.section.formvalue(sectionId, 'type') || '';
			if (type === 'tcpudp' && value.length > 60)
				return _('TCP + UDP 代理的基础名称不能超过 60 位。');
			var wantedNames = type === 'tcpudp' ? [ value + '_tcp', value + '_udp' ] : [ value ];
			var duplicate = uci.sections('frpc').some(function(section) {
				return section['.name'] !== sectionId &&
					(section['.type'] === 'proxy' || section['.type'] === 'visitor') &&
					wantedNames.indexOf(section.name) !== -1;
			});
			return !duplicate || _('代理和访问者名称不能重复。');
		}

		s = m.section(form.NamedSection, 'main', 'main');
		s.addremove = false;
		s.tab('basic', _('代理设置'));
		s.tab('config', _('配置文件'));
		s.tab('logs', _('日志'));
		s.tab('update', _('更新 frpc'));

		o = s.taboption('basic', form.DummyValue, '_auth_title');
		o.render = function() {
			return E('h3', { 'class': 'cbi-section-title' }, _('认证信息'));
		};

		o = s.taboption('basic', form.Value, 'server_addr', _('服务器地址'));
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = s.taboption('basic', form.Value, 'server_port', _('服务器端口'));
		o.datatype = 'port';
		o.default = '7000';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'user', _('用户'));
		o.rmempty = false;
		o.validate = function(sectionId, value) {
			return value && value.length <= 64 && !/[\x00-\x1f\x7f]/.test(value) || _('不能为空、不能包含控制字符且不能超过 64 位。');
		};

		o = s.taboption('basic', form.ListValue, 'auth_mode', _('认证方式'));
		o.value('metadatas', _('metadatas.token（用户独立密钥）'));
		o.value('auth', _('auth.token（全局 Token）'));
		o.default = 'metadatas';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'token', _('Token'));
		o.password = true;
		o.rmempty = false;
		o.validate = function(sectionId, value) {
			return value && !/[\x00-\x1f\x7f]/.test(value) || _('不能为空且不能包含控制字符。');
		};

		o = s.taboption('basic', form.Flag, 'tls_enable', _('启用 TLS'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'true';
		o.rmempty = false;

		o = s.taboption('basic', form.Flag, 'login_fail_exit', _('登录失败退出'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'true';
		o.rmempty = false;

		o = s.taboption('basic', form.ListValue, 'log_level', _('日志等级'));
	[ 'trace', 'debug', 'info', 'warn', 'error' ].forEach(function(level) { o.value(level, level); });
		o.default = 'info';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'log_max_days', _('日志保留天数'));
		o.datatype = 'range(0,3650)';
		o.default = '3';
		o.rmempty = false;

		o = s.taboption('basic', form.SectionValue, '_proxies', form.GridSection, 'proxy', _('代理管理'));
		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;
		ss.sortable = true;
		ss.addbtntitle = _('添加代理');
		ss.handleAdd = function(ev) {
			var configName = this.uciconfig || this.map.config;
			var sectionId = uci.add(configName, this.sectiontype);
			uci.set(configName, sectionId, 'enabled', '1');
			m.addedSection = sectionId;
			return this.renderMoreOptionsModal(sectionId);
		};

		o = ss.option(form.Value, 'name', _('名称'));
		o.rmempty = false;
		o.validate = validateEntryName;

		o = ss.option(form.ListValue, 'type', _('类型'));
		o.value('tcpudp', 'TCP + UDP');
	[ 'tcp', 'udp', 'http', 'https', 'stcp', 'sudp', 'xtcp', 'tcpmux' ].forEach(function(type) { o.value(type, type.toUpperCase()); });
		o.default = 'tcp';
		o.rmempty = false;

		o = ss.option(form.Value, 'local_ip', _('本地地址'));
		o.default = '127.0.0.1';
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = ss.option(form.Value, 'local_port', _('本地端口'));
		o.datatype = 'port';
		o.rmempty = false;

		o = ss.option(form.Value, 'remote_port', _('远程端口'));
		o.datatype = 'port';
		o.depends('type', 'tcp');
		o.depends('type', 'udp');
		o.depends('type', 'tcpudp');
		o.rmempty = false;

		o = ss.option(form.Value, 'custom_domains', _('自定义域名'));
		o.modalonly = true;
		o.placeholder = _('多个域名用英文逗号分隔');
		o.depends('type', 'http');
		o.depends('type', 'https');
		o.depends('type', 'tcpmux');
		o.validate = function(sectionId, value) {
			var subdomain = this.section.formvalue(sectionId, 'subdomain') || '';
			if (!value && !subdomain) return _('自定义域名和子域名至少填写一项。');
			return !/[\x00-\x20\x7f]/.test(value || '') || _('域名不能包含空白字符。');
		};

		o = ss.option(form.Value, 'subdomain', _('子域名'));
		o.modalonly = true;
		o.depends('type', 'http');
		o.depends('type', 'https');
		o.depends('type', 'tcpmux');
		o.validate = function(sectionId, value) {
			var domains = this.section.formvalue(sectionId, 'custom_domains') || '';
			if (!value && !domains) return _('自定义域名和子域名至少填写一项。');
			return !/[\x00-\x20\x7f]/.test(value || '') || _('子域名不能包含空白字符。');
		};

		o = ss.option(form.Value, 'secret_key', _('预共享密钥'));
		o.modalonly = true;
		o.password = true;
		o.depends('type', 'stcp');
		o.depends('type', 'sudp');
		o.depends('type', 'xtcp');
		o.rmempty = false;
		o.validate = function(sectionId, value) {
			return value && !/[\x00-\x1f\x7f]/.test(value) || _('预共享密钥不能为空且不能包含控制字符。');
		};

		o = ss.option(form.Value, 'allow_users', _('允许用户'));
		o.modalonly = true;
		o.placeholder = 'user1,user2 或 *';
		o.depends('type', 'stcp');
		o.depends('type', 'sudp');
		o.depends('type', 'xtcp');
		o.validate = function(sectionId, value) {
			return !/[\x00-\x20\x7f]/.test(value || '') || _('允许用户应使用英文逗号分隔且不能包含空格。');
		};

		o = ss.option(form.ListValue, 'multiplexer', _('多路复用器'));
		o.modalonly = true;
		o.value('httpconnect', 'HTTP CONNECT');
		o.default = 'httpconnect';
		o.depends('type', 'tcpmux');

		o = ss.option(form.Flag, 'use_encryption', _('加密'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'use_compression', _('压缩'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.HiddenValue, '_split_tcpudp');
		o.modalonly = true;
		o.default = '1';
		o.rmempty = false;
		o.write = function(sectionId) {
			var type = this.section.formvalue(sectionId, 'type');
			if (type !== 'tcpudp')
				return;

			var baseName = this.section.formvalue(sectionId, 'name');
			var localIp = this.section.formvalue(sectionId, 'local_ip') || '127.0.0.1';
			var localPort = this.section.formvalue(sectionId, 'local_port');
			var remotePort = this.section.formvalue(sectionId, 'remote_port');
			var encryption = this.section.formvalue(sectionId, 'use_encryption') || 'false';
			var compression = this.section.formvalue(sectionId, 'use_compression') || 'false';

			uci.set('frpc', sectionId, 'name', baseName + '_tcp');
			uci.set('frpc', sectionId, 'type', 'tcp');
			uci.set('frpc', sectionId, 'local_ip', localIp);
			uci.set('frpc', sectionId, 'local_port', localPort);
			uci.set('frpc', sectionId, 'remote_port', remotePort);
			uci.set('frpc', sectionId, 'use_encryption', encryption);
			uci.set('frpc', sectionId, 'use_compression', compression);
			uci.set('frpc', sectionId, 'enabled', '1');

			var udpSection = uci.add('frpc', 'proxy');
			uci.set('frpc', udpSection, 'name', baseName + '_udp');
			uci.set('frpc', udpSection, 'type', 'udp');
			uci.set('frpc', udpSection, 'local_ip', localIp);
			uci.set('frpc', udpSection, 'local_port', localPort);
			uci.set('frpc', udpSection, 'remote_port', remotePort);
			uci.set('frpc', udpSection, 'use_encryption', encryption);
			uci.set('frpc', udpSection, 'use_compression', compression);
			uci.set('frpc', udpSection, 'enabled', '1');
		};

		o = s.taboption('basic', form.SectionValue, '_visitors', form.GridSection, 'visitor', _('私有协议访问者'));
		ss = o.subsection;
		ss.anonymous = true;
		ss.addremove = true;
		ss.sortable = true;
		ss.addbtntitle = _('添加访问者');
		ss.sectiontitle = function(sectionId) { return uci.get('frpc', sectionId, 'name') || _('未命名访问者'); };

		o = ss.option(form.Value, 'name', _('名称'));
		o.rmempty = false;
		o.validate = validateEntryName;

		o = ss.option(form.ListValue, 'type', _('类型'));
	[ 'stcp', 'sudp', 'xtcp' ].forEach(function(type) { o.value(type, type.toUpperCase()); });
		o.default = 'stcp';
		o.rmempty = false;

		o = ss.option(form.Value, 'server_name', _('服务端代理名称'));
		o.rmempty = false;
		o.validate = validateName;

		o = ss.option(form.Value, 'server_user', _('服务端用户'));
		o.modalonly = true;
		o.validate = function(sectionId, value) {
			return !/[\x00-\x20\x7f]/.test(value || '') || _('服务端用户不能包含空白字符。');
		};

		o = ss.option(form.Value, 'secret_key', _('预共享密钥'));
		o.modalonly = true;
		o.password = true;
		o.rmempty = false;

		o = ss.option(form.Value, 'bind_addr', _('绑定地址'));
		o.default = '127.0.0.1';
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = ss.option(form.Value, 'bind_port', _('绑定端口'));
		o.datatype = 'port';
		o.rmempty = false;

		o = ss.option(form.Flag, 'use_encryption', _('加密'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'use_compression', _('压缩'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'keep_tunnel_open', _('保持 XTCP 隧道'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';
		o.depends('type', 'xtcp');

		o = ss.option(form.Flag, 'enabled', _('启用'));
		o.modalonly = true;
		o.enabled = '1'; o.disabled = '0'; o.default = '1';

		o = s.taboption('config', form.DummyValue, '_raw_config');
		o.render = function() { return self.renderRawConfig(data[2]); };

		o = s.taboption('logs', form.DummyValue, '_logs');
		o.render = function() { return self.renderLogs(); };

		o = s.taboption('update', form.DummyValue, '_update');
		o.render = function() { return self.renderUpdate(); };

		return m.render().then(function(rendered) {
			var statusBar = self.renderStatusBar(initialStatus);
			var title = rendered.querySelector('h2');
			var logsPane = rendered.querySelector('[data-tab="logs"][data-tab-title]');
			var updatePane = rendered.querySelector('[data-tab="update"][data-tab-title]');
			if (title && title.parentNode)
				title.parentNode.insertBefore(statusBar, title.nextSibling);
			else
				rendered.insertBefore(statusBar, rendered.firstChild);
			if (logsPane)
				logsPane.addEventListener('cbi-tab-active', function() {
					if (self.refreshLogs) self.refreshLogs().catch(notifyError);
				});
			if (updatePane)
				updatePane.addEventListener('cbi-tab-active', function() {
					if (self.refreshUpdateProgress) self.refreshUpdateProgress().catch(notifyError);
				});

			return E('div', {}, [
				E('style', {}, [
					'.frpc-status-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:.5em 0 1em}',
					'.frpc-status-row{display:flex;align-items:center;gap:1.2em;flex-wrap:nowrap;white-space:nowrap;width:max-content;min-width:100%;padding:.35em 0}',
					'.frpc-ok{color:#2e7d32}.frpc-bad{color:#d32f2f}',
					'.frpc-config{width:100%;min-height:52vh;box-sizing:border-box;font-family:monospace}',
					'.frpc-log{max-height:55vh;min-height:18em;overflow:auto;white-space:pre-wrap;word-break:break-all;padding:1em;background:rgba(0,0,0,.045);border:1px solid #ddd}',
					'.frpc-note{margin:.7em 0;padding:.7em 1em;background:rgba(22,119,255,.07);border-left:4px solid #1677ff}',
					'.frpc-actions{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;margin:.6em 0 1em}',
					'.frpc-update-status{display:flex;align-items:center;gap:.8em;flex-wrap:wrap;margin:1em 0}',
					'.frpc-update-progress{width:min(34em,100%);height:1.2em;overflow:hidden;border:1px solid #bbb;border-radius:.35em;background:rgba(0,0,0,.08)}',
					'.frpc-update-progress-fill{width:0;height:100%;background:#1677ff;transition:width .3s ease}'
				].join('')),
				rendered
			]);
		});
	},

	handleSave: function(ev) {
		uci.set('frpc', 'main', 'config_mode', 'uci');
		uci.set('frpc', 'main', 'enabled', '1');
		return this.super('handleSave', [ ev ]);
	},

	handleSaveApply: function(ev, mode) {
		var started = false;
		function startAfterApply() {
			if (started) return;
			started = true;
			document.removeEventListener('uci-applied', startAfterApply);
			return runCommand([ 'service', 'start' ]).then(function() {
				notify(_('配置已应用，frpc 已停止后重新启动。'));
			}).catch(notifyError);
		}

		document.addEventListener('uci-applied', startAfterApply);
		return this.handleSave(ev).then(function() {
			return runCommand([ 'service', 'stop' ]);
		}).then(function() {
			ui.changes.apply(mode == '0');
		}).catch(function(err) {
			document.removeEventListener('uci-applied', startAfterApply);
			notifyError(err);
		});
	}
});
