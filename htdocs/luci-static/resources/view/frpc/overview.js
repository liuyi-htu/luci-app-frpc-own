'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require rpc';
'require poll';
'require frpc.i18n as frpcI18n';
'require frpc.settings as frpcSettings';


function foldAdvanced(container) {
 if (!container) return;
 var rows = Array.from(container.querySelectorAll('[data-frpc-advanced]')).filter(function(row) { return !row.closest('details'); });
 if (!rows.length) return;
 var details = E('details', { 'class': 'frpc-more-settings' }, [ E('summary', {}, _('More settings', 'frpc-own')) ]);
 rows[0].parentNode.insertBefore(details, rows[0]);
 rows.forEach(function(row) { details.appendChild(row); });
}

function addAdvanced(section, group) {
 frpcSettings[group].forEach(function(field) {
  var cls = field.kind === '1,0' ? form.Flag : field.kind.indexOf(',') >= 0 ? form.ListValue : field.kind === 'map' ? form.TextValue : form.Value;
  var option = group === 'main' ? section.taboption('basic', cls, field.key, field.label) : section.option(cls, field.key, field.label);
  option.rmempty = true;
  if (group !== 'main') option.modalonly = true;
  if (field.kind.indexOf(',') >= 0 && field.kind !== '1,0') {
   option.value('', _('Default', 'frpc-own'));
   field.kind.split(',').forEach(function(value) { option.value(value, value); });
  }
  if (field.key === 'enabled') { option.enabled = '1'; option.disabled = '0'; option.default = '1'; option.rmempty = false; }
  if (field.kind === 'password') option.password = true;
  if (field.kind === 'uint') option.datatype = 'range(0,2147483647)';
  if (field.kind === 'interval') option.datatype = 'range(-1,2147483647)';
  if (field.kind === 'array') option.placeholder = _('Separate values with commas', 'frpc-own');
  if (field.kind === 'map') option.rows = 3;
  option.validate = function(sectionId, value) {
   if (!value) {
    if (['oidc_client_id', 'oidc_client_secret', 'oidc_endpoint'].indexOf(field.key) >= 0 && this.section.formvalue(sectionId, 'auth_mode') === 'oidc') return _('This field is required.', 'frpc-own');
    return true;
   }
   if (field.kind === 'map') {
    var keys = {};
    return value.split('\n').every(function(line) {
     if (!line.trim()) return true;
     var pos = line.indexOf('='), key = line.slice(0, pos).trim();
     if (pos < 1 || !/^[A-Za-z0-9_-]+$/.test(key) || keys[key]) return false;
     keys[key] = true; return !/[\x00-\x1f\x7f]/.test(line);
    }) || _('Use unique Name=Value entries, one per line.', 'frpc-own');
   }
   if (/[\x00-\x1f\x7f]/.test(value)) return _('Control characters are not allowed.', 'frpc-own');
   if (field.kind === 'bandwidth') return /^(0|[0-9]+(?:\.[0-9]+)?(?:KB|MB))$/.test(value) || _('Use 0, KB, or MB, for example 1MB.', 'frpc-own');
   if (field.key === 'auth_scopes') return value.split(',').every(function(v) { return ['HeartBeats', 'NewWorkConns'].indexOf(v.trim()) >= 0; }) || _('Use HeartBeats or NewWorkConns.', 'frpc-own');
   return true;
  };
  Object.keys(field.depends).forEach(function(key) {
   var values = field.depends[key];
   (Array.isArray(values) ? values : [values]).forEach(function(value) { option.depends(key, value); });
  });
  var render = option.render;
  option.render = function() { return Promise.resolve(render.apply(this, arguments)).then(function(node) { node.setAttribute('data-frpc-advanced', group); return node; }); };
 });
}

var UI_HELPER = '/usr/libexec/frpc-ui';
var AUTH_UPLOAD = '/tmp/frpc/uploads/auth-upload.json';
var FRPC_UPLOAD = '/tmp/frpc/uploads/frpc-upload.tar.gz';
var UPDATE_POLL_INTERVAL = 1000;
var UPDATE_RETRY_INTERVAL = 1000;
var commitConfig = rpc.declare({
	object: 'uci', method: 'commit', params: [ 'config' ], reject: true
});

function runCommand(args) {
	return fs.exec(UI_HELPER, args).then(function(res) {
		if (res.code !== 0)
			throw new Error(frpcI18n.translate((res.stderr || res.stdout || _('Command failed', 'frpc-own')).trim()));
		return res.stdout || '';
	});
}

function parseStatus(output) {
	var fields = (output || '').trim().split('\t');
	return {
		running: fields[0] === '1',
		enabled: fields[1] === '1',
		version: frpcI18n.translate(fields[2]) || _('Not installed', 'frpc-own')
	};
}

function showMessage(message, error) {
	var editor = document.querySelector('#modal_overlay .modal.cbi-modal');
	var previous = editor && document.body.classList.contains('modal-overlay-active') ? {
		title: editor.querySelector('h4').textContent,
		nodes: Array.prototype.slice.call(editor.childNodes, 1)
	} : null;
	ui.showModal(error ? _('Operation failed', 'frpc-own') : _('Notice', 'frpc-own'), [
		E('p', {}, message),
		E('div', { 'class': 'right' }, [
			E('button', { 'type': 'button', 'class': 'btn cbi-button', 'click': function() {
				if (previous) ui.showModal(previous.title, previous.nodes, 'cbi-modal');
				else ui.hideModal();
			} }, _('Close', 'frpc-own'))
		])
	]);
}

function notifyError(err) {
	if (err && err.frpcNotified) return;
	showMessage(frpcI18n.translate((err && err.message) || String(err)), true);
	if (err && typeof err === 'object') err.frpcNotified = true;
}

function notify(message) {
	showMessage(frpcI18n.translate(message), false);
}

function validateName(sectionId, value) {
	return /^[A-Za-z0-9._-]{1,64}$/.test(value || '') ||
		_('Use 1-64 letters, digits, dots, underscores, or hyphens.', 'frpc-own');
}

function validateNoWhitespace(sectionId, value) {
	return value && !/[\x00-\x20\x7f]/.test(value) || _('This field is required and must not contain whitespace.', 'frpc-own');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('frpc'),
			L.resolveDefault(runCommand([ 'status' ]), ''),
			L.resolveDefault(runCommand([ 'read-runtime-config' ]), '')
		]);
	},

	updateControls: function() {
		var self = this;
		var busy = this.saving || this.mapSaving || this.serviceBusy;
		var blocked = !this.statusKnown || busy || this.formReadonly;
		document.querySelectorAll('[data-frpc-save], #frpc-page button:not([data-frpc-readonly-action]):not(#frpc-service-toggle)').forEach(function(button) {
			button.disabled = !!blocked || (self.running && button.hasAttribute('data-frpc-update')) || button.dataset.frpcBusy === '1' || button.classList.contains('spinning');
			button.title = self.running && button.hasAttribute('data-frpc-update') ? _('Stop frpc before making changes.', 'frpc-own') : '';
		});
		var serviceButton = document.getElementById('frpc-service-toggle');
		if (serviceButton) serviceButton.disabled = !!busy || !!self.formReadonly || !self.statusKnown;
	},

	checkConfigAccess: function() {
		return this.refreshStatus();
	},

	guardMap: function(map) {
		var self = this;
		var save = map.save;
		map.save = function(callback) {
			map.frpcSaved = false;
			if (self.mapSaving || self.serviceBusy) return Promise.reject(new Error(_('An operation is in progress. Try saving again later.', 'frpc-own')));
			self.mapSaving = true;
			self.updateControls();
			return self.checkConfigAccess().then(function() {
				return save.call(map, function() {
					return self.checkConfigAccess().then(function() {
						uci.set('frpc', 'main', 'enabled', '1');
						if (callback) return callback();
					});
				}, true);
			}).then(function() {
				return self.checkConfigAccess();
			}).then(function() {
				return commitConfig('frpc');
			}).then(function() {
				return ui.changes.init();
			}).then(function() {
				return self.refreshStatus();
			}).then(function() {
				map.frpcSaved = true;
				if (!map.parent) notify(_('Proxy configuration saved.', 'frpc-own'));
			}).catch(function(err) { notifyError(err); throw err; }).finally(function() {
				self.mapSaving = false;
				self.updateControls();
			});
		};
	},
	configureGrid: function(grid) {
		var self = this;
		var renderModal = grid.renderMoreOptionsModal;
		var saveModal = grid.handleModalSave;
		var remove = grid.handleRemove;
		grid.handleRemove = function(sectionId, ev) {
			var section = this;
			return self.checkConfigAccess().then(function() { return remove.call(section, sectionId, ev); }).catch(notifyError);
		};
		grid.handleModalSave = function(modalMap, ev) {
			return saveModal.call(this, modalMap, ev).then(function() {
				if (modalMap.frpcSaved) notify(_('Proxy configuration saved.', 'frpc-own'));
			});
		};
		var rowActions = grid.renderRowActions;
		grid.renderRowActions = function() {
			var node = rowActions.apply(this, arguments);
			node.querySelectorAll('.cbi-button-edit').forEach(function(button) {
				button.textContent = _('Edit', 'frpc-own');
				button.title = _('Edit', 'frpc-own');
			});
			return node;
		};
		var headers = grid.renderHeaderRows;
		grid.renderHeaderRows = function() {
			var node = headers.apply(this, arguments);
			if (this.sectiontitle) node.querySelectorAll('.cbi-section-table-titles > th:first-child').forEach(function(cell) {
				cell.textContent = _('Name', 'frpc-own');
			});
			return node;
		};
		grid.renderSectionPlaceholder = function() { return E('em', {}, _('No entries yet', 'frpc-own')); };
		grid.editbtntitle = _('Edit', 'frpc-own');
		grid.delbtntitle = _('Delete', 'frpc-own');
		grid.addModalOptions = function(modalSection) { self.guardMap(modalSection.map); };
		grid.renderMoreOptionsModal = function(sectionId, ev) {
			var section = this;
			return self.checkConfigAccess().then(function() {
				return renderModal.call(section, sectionId, ev);
			}).then(function() {
				foldAdvanced(document.getElementById('modal_overlay'));
				var button = document.querySelector('#modal_overlay .button-row .cbi-button-positive');
				if (button) {
					button.setAttribute('data-frpc-save', 'entry');
					button.textContent = _('Save', 'frpc-own');
				}
				var cancel = document.querySelector('#modal_overlay .button-row > button');
				if (cancel) cancel.textContent = _('Cancel', 'frpc-own');
				self.updateControls();
			});
		};
	},

	saveAuthentication: function(options) {
		var self = this;
		if (self.saving || self.mapSaving || self.serviceBusy) return Promise.resolve();
		self.saving = true;
		self.updateControls();
		return self.checkConfigAccess().then(function() {
			var values = {};
			options.forEach(function(option) {
				var value = option.formvalue('main');
				if ((option.isActive('main') && !option.isValid('main')) || (!option.rmempty && option.isActive('main') && (value == null || value === '')))
					throw new Error(option.title + ': ' + (option.getValidationError('main') || _('This field is required.', 'frpc-own')));
				values[option.option] = option.isActive('main') ? (value == null ? '' : String(value)) : '';
			});
			return fs.write(AUTH_UPLOAD, JSON.stringify(values), 384);
		}).then(function() {
			return runCommand([ 'save-auth' ]);
		}).then(function(message) {
			notify(message.trim() || _('Authentication saved.', 'frpc-own'));
			return self.refreshStatus();
		}).catch(notifyError).finally(function() {
			self.saving = false;
			self.updateControls();
		});
	},

	refreshStatus: function() {
		var self = this;
		return runCommand([ 'status' ]).then(function(output) {
			if (!/^[01]\t[01]\t/.test(output)) throw new Error(_('Unable to read frpc service status.', 'frpc-own'));
			var status = parseStatus(output);
			self.running = status.running;
			self.statusKnown = true;
			self.updateControls();
			var running = document.getElementById('frpc-running-status');
			var enabled = document.getElementById('frpc-enabled-status');
			var version = document.getElementById('frpc-version-status');
			var serviceButton = document.getElementById('frpc-service-toggle');
			var enableButton = document.getElementById('frpc-enable-toggle');

			if (running) {
				running.textContent = status.running ? _('Running', 'frpc-own') : _('Stopped', 'frpc-own');
				running.className = status.running ? 'frpc-ok' : 'frpc-bad';
			}
			if (enabled) {
				enabled.textContent = status.enabled ? _('Enabled', 'frpc-own') : _('Disabled', 'frpc-own');
				enabled.className = status.enabled ? 'frpc-ok' : 'frpc-bad';
			}
			if (version) version.textContent = status.version;
			if (serviceButton) {
				serviceButton.dataset.running = status.running ? '1' : '0';
				serviceButton.textContent = status.running ? _('Stop service', 'frpc-own') : _('Start service', 'frpc-own');
				serviceButton.className = status.running ? 'btn cbi-button-negative' : 'btn cbi-button-action important';
			}
			if (enableButton) {
				enableButton.dataset.enabled = status.enabled ? '1' : '0';
				enableButton.textContent = status.enabled ? _('Disable autostart', 'frpc-own') : _('Enable autostart', 'frpc-own');
			}
			return status;
		}).catch(function(err) {
			self.statusKnown = false;
			self.updateControls();
			throw err;
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
				if (self.saving || self.mapSaving || self.serviceBusy) return;
				self.serviceBusy = true;
				self.updateControls();
				var action = button.dataset.running === '1' ? 'stop' : 'start';
				button.disabled = true;
				return runCommand([ 'service', action ]).then(function() {
					notify(action === 'start' ? _('frpc started.', 'frpc-own') : _('frpc stopped.', 'frpc-own'));
					return self.refreshStatus();
				}).catch(notifyError).finally(function() {
					self.serviceBusy = false;
					self.updateControls();
					button.disabled = false;
				});
			}
		}, initialStatus.running ? _('Stop service', 'frpc-own') : _('Start service', 'frpc-own'));

		var restartButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button-action',
			'id': 'frpc-service-restart',
			'click': function(ev) {
				if (ev.currentTarget.disabled || self.saving || self.mapSaving || self.serviceBusy) return;
				self.serviceBusy = true;
				self.updateControls();
				return runCommand([ 'service', 'restart' ]).then(function() {
					notify(_('frpc restarted with the latest saved configuration.', 'frpc-own'));
					return self.refreshRuntimeConfig();
				}).catch(notifyError).finally(function() {
					return self.refreshStatus().catch(notifyError).finally(function() {
						self.serviceBusy = false;
						self.updateControls();
					});
				});
			}
		}, _('Restart service', 'frpc-own'));

		var enableButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button-apply',
			'id': 'frpc-enable-toggle',
			'data-enabled': initialStatus.enabled ? '1' : '0',
			'click': function(ev) {
				var button = ev.currentTarget;
				if (button.disabled) return;
				button.dataset.frpcBusy = '1';
				var action = button.dataset.enabled === '1' ? 'disable' : 'enable';
				button.disabled = true;
				return runCommand([ 'service', action ]).then(function() {
					notify(action === 'enable' ? _('Autostart enabled.', 'frpc-own') : _('Autostart disabled.', 'frpc-own'));
					return self.refreshStatus();
				}).catch(notifyError).finally(function() {
					button.dataset.frpcBusy = '0';
					self.updateControls();
				});
			}
		}, initialStatus.enabled ? _('Disable autostart', 'frpc-own') : _('Enable autostart', 'frpc-own'));

		return E('div', { 'class': 'frpc-status-scroll' }, [
			E('div', { 'class': 'frpc-status-row' }, [
				E('span', {}, [ _('Service status', 'frpc-own') + ': ', E('strong', {
					'id': 'frpc-running-status',
					'class': initialStatus.running ? 'frpc-ok' : 'frpc-bad'
				}, initialStatus.running ? _('Running', 'frpc-own') : _('Stopped', 'frpc-own')) ]),
				E('span', {}, [ _('Autostart', 'frpc-own') + ': ', E('strong', {
					'id': 'frpc-enabled-status',
					'class': initialStatus.enabled ? 'frpc-ok' : 'frpc-bad'
				}, initialStatus.enabled ? _('Enabled', 'frpc-own') : _('Disabled', 'frpc-own')) ]),
				E('span', {}, [ _('Version', 'frpc-own') + ': ', E('strong', { 'id': 'frpc-version-status' }, initialStatus.version) ]),

				serviceButton,
				restartButton,
				enableButton
			])
		]);
	},

	renderRuntimeConfig: function(content) {
		return E('div', {}, [
			E('p', { 'class': 'cbi-section-descr' }, _('Saved changes take effect the next time the service starts. Runtime configuration shows the last startup snapshot.', 'frpc-own')),
			E('textarea', {
				'id': 'frpc-runtime-config',
				'class': 'cbi-input-textarea frpc-config',
				'readonly': true,
				'spellcheck': 'false',
				'wrap': 'off',
				'aria-label': _('Runtime configuration', 'frpc-own'),
				'placeholder': _('No runtime configuration is available.', 'frpc-own')
			}, this.runtimeConfigContent != null ? this.runtimeConfigContent : (content || ''))
		]);
	},

	refreshRuntimeConfig: function() {
		var self = this;
		var textarea = document.getElementById('frpc-runtime-config');
		if (textarea) {
			textarea.value = '';
			textarea.placeholder = _('Synchronizing runtime configuration...', 'frpc-own');
		}
		return runCommand([ 'read-runtime-config' ]).then(function(content) {
			self.runtimeConfigContent = content;
			var current = document.getElementById('frpc-runtime-config');
			if (current) {
				current.value = content;
				current.placeholder = _('No runtime configuration is available.', 'frpc-own');
			}
		}).catch(function(err) {
			self.runtimeConfigContent = '';
			var current = document.getElementById('frpc-runtime-config');
			if (current) current.placeholder = _('Failed to read runtime configuration.', 'frpc-own');
			throw err;
		});
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
		var output = E('pre', { 'id': 'frpc-log-output', 'class': 'frpc-log' }, _('Click Refresh log to read the log.', 'frpc-own'));

		function refresh() {
			return runCommand([ 'read-log', kind.value ]).then(function(content) {
				var normalized = frpcI18n.logText(content || '').replace(/\n$/, '');
				var lines = normalized ? normalized.split('\n').slice(-50) : [];
				output.textContent = lines.length ? lines.join('\n') : _('No log entries.', 'frpc-own');
				output.scrollTop = output.scrollHeight;
			});
		}
		this.refreshLogs = refresh;

		return E('div', {}, [
			E('div', { 'class': 'frpc-actions' }, [
				kind,
				E('button', {
					'type': 'button', 'class': 'btn cbi-button-action', 'data-frpc-readonly-action': '1',
					'click': function() { return refresh().catch(notifyError); }
				}, _('Refresh log', 'frpc-own')),
				E('button', {
					'type': 'button', 'class': 'btn cbi-button-negative',
					'click': function() {
						var selectedKind = kind.value;
						if (!confirm(_('Clear the selected log?', 'frpc-own'))) return;
						return runCommand([ 'clear-log', selectedKind ]).then(function() {
							if (kind.value === selectedKind) output.textContent = _('No log entries.', 'frpc-own');
							notify(_('Log cleared.', 'frpc-own'));
						}).catch(notifyError);
					}
				}, _('Clear log', 'frpc-own'))
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
		var progressText = E('span', { 'id': 'frpc-update-progress-text' }, _('No update has started.', 'frpc-own'));
		var onlineButton;
		var uploadButton;

		function setUpdateBusy(busy) {
			[ onlineButton, uploadButton ].forEach(function(button) {
				if (button) button.dataset.frpcBusy = busy ? '1' : '0';
			});
			self.updateControls();
		}

		function parseUpdateStatus(output) {
			var fields = (output || '').trim().split('\t');
			var percent = Number(fields[1]);
			return {
				state: fields[0] || 'idle',
				percent: isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
				message: frpcI18n.translate(fields.slice(2).join('\t')) || _('No update has started.', 'frpc-own')
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
				setUpdateBusy(status.state === 'running');

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
				progressText.textContent = _('Reading update status again...', 'frpc-own');
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
					setUpdateBusy(false);
					notifyError(err);
				});
			}
			self.updateProgressPolling = false;
			setUpdateBusy(false);
			notifyError(err);
		}
		this.refreshUpdateProgress = refreshProgress;

		onlineButton = E('button', {
			'type': 'button', 'class': 'btn cbi-button-apply important', 'data-frpc-update': '1',
			'click': function(ev) {
				var button = ev.currentTarget;
				if (!confirm(_('Check for online updates?', 'frpc-own'))) return;
				if (button.disabled) return;
				setUpdateBusy(true);
				self.updateProgressPolling = true;
				progressFill.style.width = '1%';
				progress.setAttribute('aria-valuenow', '1');
				progressText.className = '';
				progressText.textContent = _('1% · Starting online update...', 'frpc-own');
				scheduleProgressRefresh(UPDATE_POLL_INTERVAL);
				return runCommand([ 'update-online' ]).then(function(message) {
					notify(message.trim());
					return refreshProgress();
				}).catch(function(err) { return handleUpdateStartError(err, button); });
			}
		}, _('Online update', 'frpc-own'));

		uploadButton = E('button', {
			'type': 'button', 'class': 'btn cbi-button-action', 'data-frpc-update': '1',
			'click': function(ev) {
				var button = ev.currentTarget;
				if (button.disabled) return;
				setUpdateBusy(true);
				return ui.uploadFile(FRPC_UPLOAD).then(function(reply) {
					if (reply.size > 64 * 1024 * 1024) {
						return fs.remove(FRPC_UPLOAD).then(function() {
							throw new Error(_('The uploaded file must not exceed 64 MiB.', 'frpc-own'));
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
						setUpdateBusy(false);
						return;
					}
					return handleUpdateStartError(err, button);
				});
			}
		}, _('Upload frpc or tar.gz', 'frpc-own'));

		return E('div', {}, [
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
		var m = new form.Map('frpc');
		m.data = Object.create(uci);
		m.data.move = function() {
			if (!self.statusKnown || self.saving || self.mapSaving || self.serviceBusy) {
				notifyError(new Error(_('An operation is in progress. Try saving again later.', 'frpc-own')));
				return false;
			}
			var moved = uci.move.apply(uci, arguments);
			if (moved) {
				window.clearTimeout(self.proxyOrderTimer);
				self.proxyOrderTimer = window.setTimeout(function() { m.save().catch(notifyError); }, 250);
			}
			return moved;
		};
		self.running = initialStatus.running;
		self.statusKnown = /^[01]\t[01]\t/.test(data[1] || '');
		self.guardMap(m);
		var renderContents = m.renderContents;
		m.renderContents = function() {
			return renderContents.call(m).then(function(rendered) {
				foldAdvanced(rendered);
				[ [ 'config', 'refreshRuntimeConfig' ], [ 'logs', 'refreshLogs' ], [ 'update', 'refreshUpdateProgress' ] ].forEach(function(tab) {
					var pane = rendered.querySelector('[data-tab="' + tab[0] + '"][data-tab-title]');
					if (pane) pane.addEventListener('cbi-tab-active', function() {
						if (self[tab[1]]) self[tab[1]]().catch(notifyError);
					});
				});
				self.formReadonly = m.readonly;
				window.requestAnimationFrame(function() { self.updateControls(); });
				return rendered;
			});
		};
		var s, ss, o, proxies, visitors;
		function validateEntryName(sectionId, value) {
			var valid = validateName(sectionId, value);
			if (valid !== true) return valid;
			var type = this.section.formvalue(sectionId, 'type') || '';
			if (type === 'tcpudp' && value.length > 60)
				return _('The base name of a TCP + UDP proxy must not exceed 60 characters.', 'frpc-own');
			var wantedNames = type === 'tcpudp' ? [ value + '_tcp', value + '_udp' ] : [ value ];
			var duplicate = uci.sections('frpc').some(function(section) {
				return section['.name'] !== sectionId &&
					(section['.type'] === 'proxy' || section['.type'] === 'visitor') &&
					wantedNames.indexOf(section.name) !== -1;
			});
			return !duplicate || _('Proxy and visitor names must be unique.', 'frpc-own');
		}

		s = m.section(form.NamedSection, 'main', 'main');
		s.addremove = false;
		s.tab('basic', _('Proxy settings', 'frpc-own'));
		s.tab('config', _('Runtime configuration', 'frpc-own'));
		s.tab('logs', _('Logs', 'frpc-own'));
		s.tab('update', _('Update core', 'frpc-own'));

		o = s.taboption('basic', form.DummyValue, '_auth_title');
		o.render = function() {
			return E('h3', { 'class': 'cbi-section-title' }, _('Authentication', 'frpc-own'));
		};

		o = s.taboption('basic', form.Value, 'server_addr', _('Server address', 'frpc-own'));
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = s.taboption('basic', form.Value, 'server_port', _('Server port', 'frpc-own'));
		o.datatype = 'port';
		o.default = '7000';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'user', _('User', 'frpc-own'));
		o.rmempty = true;
		o.validate = function(sectionId, value) {
			return !value || value.length <= 64 && !/[\x00-\x1f\x7f]/.test(value) || _('This field is required, must not contain control characters, and must not exceed 64 characters.', 'frpc-own');
		};

		o = s.taboption('basic', form.ListValue, 'auth_mode', _('Authentication method', 'frpc-own'));
		o.value('metadatas', _('metadatas.token (per-user key)', 'frpc-own'));
		o.value('auth', _('auth.token (global token)', 'frpc-own'));
		o.value('oidc', 'OIDC');
		o.default = 'metadatas';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'token', _('Token', 'frpc-own'));
		o.depends('auth_mode', 'metadatas');
		o.depends('auth_mode', 'auth');
		o.password = true;
		o.rmempty = true;
		o.validate = function(sectionId, value) {
			return (value || this.section.formvalue(sectionId, 'token_file')) && !/[\x00-\x1f\x7f]/.test(value || '') || _('This field is required and must not contain control characters.', 'frpc-own');
		};

		o = s.taboption('basic', form.Flag, 'tls_enable', _('Enable TLS', 'frpc-own'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'true';
		o.rmempty = false;

		o = s.taboption('basic', form.Flag, 'login_fail_exit', _('Exit on login failure', 'frpc-own'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = 'true';
		o.rmempty = false;

		o = s.taboption('basic', form.ListValue, 'log_level', _('Log level', 'frpc-own'));
	[ 'trace', 'debug', 'info', 'warn', 'error' ].forEach(function(level) { o.value(level, level); });
		o.default = 'info';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'log_max_days', _('Log retention (days)', 'frpc-own'));
		o.datatype = 'range(0,3650)';
		o.default = '3';
		o.rmempty = false;

		addAdvanced(s, 'main');
		var authOptions = s.children.filter(function(option) { return option.option !== '_auth_title'; });
		o = s.taboption('basic', form.DummyValue, '_save_auth');
		o.render = function() {
			return E('div', { 'class': 'frpc-actions frpc-auth-actions' }, [
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button-apply important',
					'data-frpc-save': 'auth',
					'disabled': !self.statusKnown || self.saving || self.mapSaving || self.serviceBusy,
					'click': function() { return self.saveAuthentication(authOptions); }
				}, _('Save authentication', 'frpc-own'))
			]);
		};

		o = s.taboption('basic', form.SectionValue, '_proxies', form.GridSection, 'proxy', _('Proxies', 'frpc-own'));
		ss = o.subsection;
		proxies = ss;
		self.configureGrid(ss);
		ss.anonymous = true;
		ss.addremove = true;
		ss.sortable = true;
		ss.addbtntitle = _('Add proxy', 'frpc-own');
		ss.handleAdd = function(ev) {
			var section = this;
			return self.checkConfigAccess().then(function() {
				var configName = section.uciconfig || section.map.config;
				var sectionId = uci.add(configName, section.sectiontype);
				uci.set(configName, sectionId, 'enabled', '1');
				m.addedSection = sectionId;
				return section.renderMoreOptionsModal(sectionId);
			}).catch(notifyError);
		};

		o = ss.option(form.Value, 'name', _('Name', 'frpc-own'));
		o.rmempty = false;
		o.validate = validateEntryName;

		o = ss.option(form.ListValue, 'type', _('Type', 'frpc-own'));
		o.value('tcpudp', 'TCP + UDP');
	[ 'tcp', 'udp', 'http', 'https', 'stcp', 'sudp', 'xtcp', 'tcpmux' ].forEach(function(type) { o.value(type, type.toUpperCase()); });
		o.default = 'tcp';
		o.rmempty = false;

		o = ss.option(form.Value, 'local_ip', _('Local address', 'frpc-own'));
		o.default = '127.0.0.1';
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = ss.option(form.Value, 'local_port', _('Local port', 'frpc-own'));
		o.datatype = 'port';
		o.rmempty = false;
		o.depends('plugin_type', '');
		o.validate = function(id, value) { return !!value || !!this.section.formvalue(id, 'plugin_type') || _('Local port or client plugin is required.', 'frpc-own'); };

		o = ss.option(form.Value, 'remote_port', _('Remote port', 'frpc-own'));
		o.datatype = 'port';
		o.depends('type', 'tcp');
		o.depends('type', 'udp');
		o.depends('type', 'tcpudp');
		o.rmempty = false;

		o = ss.option(form.Value, 'custom_domains', _('Custom domains', 'frpc-own'));
		o.modalonly = true;
		o.placeholder = _('Separate multiple domains with commas', 'frpc-own');
		o.depends('type', 'http');
		o.depends('type', 'https');
		o.depends('type', 'tcpmux');
		o.validate = function(sectionId, value) {
			var subdomain = this.section.formvalue(sectionId, 'subdomain') || '';
			if (!value && !subdomain) return _('Specify at least one custom domain or subdomain.', 'frpc-own');
			return !/[\x00-\x20\x7f]/.test(value || '') || _('Domains must not contain whitespace.', 'frpc-own');
		};

		o = ss.option(form.Value, 'subdomain', _('Subdomain', 'frpc-own'));
		o.modalonly = true;
		o.depends('type', 'http');
		o.depends('type', 'https');
		o.depends('type', 'tcpmux');
		o.validate = function(sectionId, value) {
			var domains = this.section.formvalue(sectionId, 'custom_domains') || '';
			if (!value && !domains) return _('Specify at least one custom domain or subdomain.', 'frpc-own');
			return !/[\x00-\x20\x7f]/.test(value || '') || _('Subdomains must not contain whitespace.', 'frpc-own');
		};

		o = ss.option(form.Value, 'secret_key', _('Shared secret', 'frpc-own'));
		o.modalonly = true;
		o.password = true;
		o.depends('type', 'stcp');
		o.depends('type', 'sudp');
		o.depends('type', 'xtcp');
		o.rmempty = false;
		o.validate = function(sectionId, value) {
			return value && !/[\x00-\x1f\x7f]/.test(value) || _('The shared secret is required and must not contain control characters.', 'frpc-own');
		};

		o = ss.option(form.Value, 'allow_users', _('Allowed users', 'frpc-own'));
		o.modalonly = true;
		o.placeholder = _('user1,user2 or *', 'frpc-own');
		o.depends('type', 'stcp');
		o.depends('type', 'sudp');
		o.depends('type', 'xtcp');
		o.validate = function(sectionId, value) {
			return !/[\x00-\x20\x7f]/.test(value || '') || _('Separate allowed users with commas and do not use spaces.', 'frpc-own');
		};

		o = ss.option(form.ListValue, 'multiplexer', _('Multiplexer', 'frpc-own'));
		o.modalonly = true;
		o.value('httpconnect', 'HTTP CONNECT');
		o.default = 'httpconnect';
		o.depends('type', 'tcpmux');

		o = ss.option(form.Flag, 'use_encryption', _('Encryption', 'frpc-own'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'use_compression', _('Compression', 'frpc-own'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		addAdvanced(ss, 'proxy');

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

			var advanced = {};
			frpcSettings.proxy.forEach(function(field) {
				var option = proxies.children.find(function(child) { return child.option === field.key; });
				if (option && option.isActive(sectionId)) advanced[field.key] = option.formvalue(sectionId);
			});
			uci.set('frpc', sectionId, 'name', baseName + '_tcp');
			uci.set('frpc', sectionId, 'type', 'tcp');
			uci.set('frpc', sectionId, 'local_ip', localIp);
			uci.set('frpc', sectionId, 'local_port', localPort);
			uci.set('frpc', sectionId, 'remote_port', remotePort);
			uci.set('frpc', sectionId, 'use_encryption', encryption);
			uci.set('frpc', sectionId, 'use_compression', compression);
			uci.set('frpc', sectionId, 'enabled', advanced.enabled || '1');

			var udpSection = uci.add('frpc', 'proxy');
			uci.set('frpc', udpSection, 'name', baseName + '_udp');
			uci.set('frpc', udpSection, 'type', 'udp');
			uci.set('frpc', udpSection, 'local_ip', localIp);
			uci.set('frpc', udpSection, 'local_port', localPort);
			uci.set('frpc', udpSection, 'remote_port', remotePort);
			uci.set('frpc', udpSection, 'use_encryption', encryption);
			uci.set('frpc', udpSection, 'use_compression', compression);
			Object.keys(advanced).forEach(function(key) { if (advanced[key] != null && advanced[key] !== '') uci.set('frpc', udpSection, key, advanced[key]); });
			uci.set('frpc', udpSection, 'enabled', advanced.enabled || '1');
		};

		o = s.taboption('basic', form.SectionValue, '_visitors', form.GridSection, 'visitor', _('Private protocol visitors', 'frpc-own'));
		ss = o.subsection;
		visitors = ss;
		self.configureGrid(ss);
		ss.anonymous = true;
		ss.addremove = true;
		ss.sortable = true;
		ss.addbtntitle = _('Add visitor', 'frpc-own');
		ss.sectiontitle = function(sectionId) { return uci.get('frpc', sectionId, 'name') || _('Unnamed visitor', 'frpc-own'); };

		o = ss.option(form.Value, 'name', _('Name', 'frpc-own'));
		o.rmempty = false;
		o.validate = validateEntryName;

		o = ss.option(form.ListValue, 'type', _('Type', 'frpc-own'));
	[ 'stcp', 'sudp', 'xtcp' ].forEach(function(type) { o.value(type, type.toUpperCase()); });
		o.default = 'stcp';
		o.rmempty = false;

		o = ss.option(form.Value, 'server_name', _('Server proxy name', 'frpc-own'));
		o.rmempty = false;
		o.validate = validateName;

		o = ss.option(form.Value, 'server_user', _('Server user', 'frpc-own'));
		o.modalonly = true;
		o.validate = function(sectionId, value) {
			return !/[\x00-\x20\x7f]/.test(value || '') || _('The server user must not contain whitespace.', 'frpc-own');
		};

		o = ss.option(form.Value, 'secret_key', _('Shared secret', 'frpc-own'));
		o.modalonly = true;
		o.password = true;
		o.rmempty = false;

		o = ss.option(form.Value, 'bind_addr', _('Bind address', 'frpc-own'));
		o.default = '127.0.0.1';
		o.rmempty = false;
		o.validate = validateNoWhitespace;

		o = ss.option(form.Value, 'bind_port', _('Bind port', 'frpc-own'));
		o.datatype = 'or(port,"-1")';
		o.rmempty = false;

		o = ss.option(form.Flag, 'use_encryption', _('Encryption', 'frpc-own'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'use_compression', _('Compression', 'frpc-own'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';

		o = ss.option(form.Flag, 'keep_tunnel_open', _('Keep XTCP tunnel open', 'frpc-own'));
		o.modalonly = true;
		o.enabled = 'true'; o.disabled = 'false'; o.default = 'false';
		o.depends('type', 'xtcp');

		addAdvanced(ss, 'visitor');

		o = ss.option(form.Flag, 'enabled', _('Enable', 'frpc-own'));
		o.modalonly = true;
		o.enabled = '1'; o.disabled = '0'; o.default = '1';

		m.parse = function() { return Promise.all([ proxies.parse(), visitors.parse() ]); };

		o = s.taboption('config', form.DummyValue, '_runtime_config');
		o.render = function() { return self.renderRuntimeConfig(data[2]); };

		o = s.taboption('logs', form.DummyValue, '_logs');
		o.render = function() { return self.renderLogs(); };

		o = s.taboption('update', form.DummyValue, '_update');
		o.render = function() { return self.renderUpdate(); };

		return m.render().then(function(rendered) {
			var statusBar = self.renderStatusBar(initialStatus);
			poll.add(function() { return self.refreshStatus().catch(function() {}); }, 3);

			window.requestAnimationFrame(function() { self.updateControls(); });
			return E('div', { 'id': 'frpc-page' }, [
				E('style', {}, [
					'.frpc-auth-actions{justify-content:flex-end}',
					'.frpc-more-settings{margin:.8em 0;padding:.6em;border:1px solid #ddd}.frpc-more-settings>summary{cursor:pointer;font-weight:bold;padding:.4em}',
					'.frpc-status-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;margin:.5em 0 1em}',
					'.frpc-status-row{display:flex;align-items:center;gap:1.2em;flex-wrap:nowrap;white-space:nowrap;width:max-content;min-width:100%;padding:.35em 0}',
					'.frpc-ok{color:#2e7d32}.frpc-bad{color:#d32f2f}',
					'.frpc-config{width:100%;min-height:52vh;box-sizing:border-box;font-family:monospace}',
					'.frpc-config,.frpc-log{scrollbar-width:none;-ms-overflow-style:none}.frpc-config::-webkit-scrollbar,.frpc-log::-webkit-scrollbar{display:none;width:0;height:0}',
					'.frpc-log{max-height:55vh;min-height:18em;overflow:auto;white-space:pre-wrap;word-break:break-all;padding:1em;background:rgba(0,0,0,.045);border:1px solid #ddd}',
					'.frpc-note{margin:.7em 0;padding:.7em 1em;background:rgba(22,119,255,.07);border-left:4px solid #1677ff}',
					'.frpc-actions{display:flex;gap:.6em;align-items:center;flex-wrap:wrap;margin:.6em 0 1em}',
					'.frpc-update-status{display:flex;align-items:center;gap:.8em;flex-wrap:wrap;margin:1em 0}',
					'.frpc-update-progress{width:min(34em,100%);height:1.2em;overflow:hidden;border:1px solid #bbb;border-radius:.35em;background:rgba(0,0,0,.08)}',
					'.frpc-update-progress-fill{width:0;height:100%;background:#1677ff;transition:width .3s ease}'
				].join('')),
				E('h2', {}, _('FRP client', 'frpc-own')),
				statusBar,
				rendered
			]);
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
