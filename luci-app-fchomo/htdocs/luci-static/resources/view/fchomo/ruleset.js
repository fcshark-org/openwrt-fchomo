'use strict';
'require form';
'require uci';
'require ui';
'require view';

'require fchomo as hm';

const rulefilesuffix = '.rule';

function parseRulesetLink(uri) {
	var config,
		filefmt = new RegExp(/^(text|yaml|mrs)$/),
		filebehav = new RegExp(/^(domain|ipcidr|classical)$/),
		unuciname = new RegExp(/[^a-zA-Z0-9_]+/, "g");

	uri = uri.split('://');
	if (uri[0] && uri[1]) {
		switch (uri[0]) {
		case 'http':
		case 'https':
			var url = new URL('http://' + uri[1]);
			var format = url.searchParams.get('fmt');
			var behavior = url.searchParams.get('behav');
			var interval = url.searchParams.get('sec');
			var rawquery = url.searchParams.get('rawq');
			var name = decodeURI(url.pathname).split('/').pop()
				.replace(/[\s\.-]/g, '_').replace(unuciname, '');

			if (filefmt.test(format) && filebehav.test(behavior)) {
				var fullpath = (url.username ? url.username + '@' : '') + url.host + url.pathname + (rawquery ? '?' + decodeURIComponent(rawquery) : '');
				config = {
					label: url.hash ? decodeURIComponent(url.hash.slice(1)) : name ? name : null,
					type: 'http',
					format: format,
					behavior: behavior,
					url: String.format('%s://%s', uri[0], fullpath),
					interval: interval,
					href: String.format('http://%s', fullpath)
				};
			}

			break;
		case 'file':
			var url = new URL('file://' + uri[1]);
			var format = url.searchParams.get('fmt');
			var behavior = url.searchParams.get('behav');
			var filler = url.searchParams.get('fill');
			var path = decodeURI(url.pathname);
			var name = path.split('/').pop()
				.replace(/[\s\.-]/g, '_').replace(unuciname, '');

			if (filefmt.test(format) && filebehav.test(behavior)) {
				config = {
					label: url.hash ? decodeURIComponent(url.hash.slice(1)) : name ? name : null,
					type: 'file',
					format: format,
					behavior: behavior,
					href: String.format('file://%s%s', url.host, url.pathname)
				};
				if (filler.match(/^H4sI/)) {
					hm.fetchGZ('data:application/octet-stream;base64,' + filler, (resp) => {
						hm.writeFile('ruleset', hm.calcStringMD5(config.href) + rulefilesuffix, resp);
					});
				} else
					hm.writeFile('ruleset', hm.calcStringMD5(config.href) + rulefilesuffix, hm.decodeBase64Str(filler));
			}

			break;
		}
	}

	if (config) {
		if (!config.type || !config.href)
			return null;
		else if (!config.label)
			config.label = hm.calcStringMD5(config.href);
	}

	return config;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('fchomo')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('fchomo', _('Edit ruleset'));

		/* Rule set START */
		/* Rule set settings */
		var prefix = 'rule_';
		s = m.section(form.GridSection, 'ruleset');
		s.addremove = true;
		s.rowcolors = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = L.bind(hm.loadModalTitle, this, _('Rule set'), _('Add a rule set'), data[0]);
		s.sectiontitle = L.bind(hm.loadDefaultLabel, this, data[0]);
		/* Import rule-set links start */
		s.handleLinkImport = function() {
			var textarea = new ui.Textarea('', {
				'placeholder': 'http(s)://github.com/ACL4SSR/ACL4SSR/raw/refs/heads/master/Clash/Providers/BanAD.yaml?fmt=yaml&behav=classical&rawq=good%3Djob#BanAD\n' +
							   'file:///example.txt?fmt=text&behav=domain&fill=LmNuCg#CN%20TLD\n'
			});
			ui.showModal(_('Import rule-set links'), [
				E('p', _('Supports rule-set links of type: <code>file, http</code> and format: <code>text, yaml, mrs</code>.</br>') +
							_('Please refer to <a href="%s" target="_blank">%s</a> for link format standards.')
								.format(hm.rulesetdoc, _('Ruleset-URI-Scheme'))),
				textarea.render(),
				E('div', { class: 'right' }, [
					E('button', {
						class: 'btn',
						click: ui.hideModal
					}, [ _('Cancel') ]),
					'',
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, function() {
							var input_links = textarea.getValue().trim().split('\n');
							if (input_links && input_links[0]) {
								/* Remove duplicate lines */
								input_links = input_links.reduce((pre, cur) =>
									(!pre.includes(cur) && pre.push(cur), pre), []);

								var imported_ruleset = 0;
								input_links.forEach((l) => {
									var config = parseRulesetLink(l);
									if (config) {
										var hrefHash = hm.calcStringMD5(config.href);
										config.href = null;
										var sid = uci.add(data[0], 'ruleset', hrefHash);
										Object.keys(config).forEach((k) => {
											uci.set(data[0], sid, k, config[k] || '');
										});
										imported_ruleset++;
									}
								});

								if (imported_ruleset === 0)
									ui.addNotification(null, E('p', _('No valid rule-set link found.')));
								else
									ui.addNotification(null, E('p', _('Successfully imported %s rule-set of total %s.').format(
										imported_ruleset, input_links.length)));

								return uci.save()
									.then(L.bind(this.map.load, this.map))
									.then(L.bind(this.map.reset, this.map))
									.then(L.ui.hideModal)
									.catch(function() {});
							} else {
								return ui.hideModal();
							}
						})
					}, [ _('Import') ])
				])
			])
		}
		s.renderSectionAdd = function(/* ... */) {
			var el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments),
				nameEl = el.querySelector('.cbi-section-create-name');

			ui.addValidator(nameEl, 'uciname', true, (v) => {
				var button = el.querySelector('.cbi-section-create > .cbi-button-add');
				var uciconfig = this.uciconfig || this.map.config;

				if (!v) {
					button.disabled = true;
					return true;
				} else if (uci.get(uciconfig, v)) {
					button.disabled = true;
					return _('Expecting: %s').format(_('unique UCI identifier'));
				} else if (uci.get(uciconfig, prefix + v)) {
					button.disabled = true;
					return _('Expecting: %s').format(_('unique label'));
				} else {
					button.disabled = null;
					return true;
				}
			}, 'blur', 'keyup');

			el.appendChild(E('button', {
				'class': 'cbi-button cbi-button-add',
				'title': _('Import rule-set links'),
				'click': ui.createHandlerFn(this, 'handleLinkImport')
			}, [ _('Import rule-set links') ]));

			return el;
		}
		s.handleAdd = function(ev, name) {
			return form.GridSection.prototype.handleAdd.apply(this, [ ev, prefix + name ]);
		}
		/* Import rule-set links end */

		o = s.option(form.Value, 'label', _('Label'));
		o.load = L.bind(hm.loadDefaultLabel, this, data[0]);
		o.validate = L.bind(hm.validateUniqueValue, this, data[0], 'ruleset', 'label');
		o.modalonly = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.ListValue, 'type', _('Type'));
		o.value('file', _('Local'));
		o.value('http', _('Remote'));
		o.default = 'http';

		o = s.option(form.ListValue, 'format', _('Format'));
		o.value('text', _('Plain text'));
		o.value('yaml', _('Yaml text'));
		o.value('mrs', _('Binary file'));
		o.default = 'mrs';
		o.validate = function(section_id, value) {
			var behavior = this.section.getUIElement(section_id, 'behavior').getValue();

			if (value === 'mrs' && behavior === 'classical')
				return _('Expecting: %s').format(_('Binary format only supports domain / ipcidr'));

			return true;
		}

		o = s.option(form.ListValue, 'behavior', _('Behavior'));
		o.value('classical');
		o.value('domain');
		o.value('ipcidr');
		o.default = 'classical';
		o.validate = function(section_id, value) {
			var format = this.section.getUIElement(section_id, 'format').getValue();

			if (value === 'classical' && format === 'mrs')
				return _('Expecting: %s').format(_('Binary format only supports domain / ipcidr'));

			return true;
		}

		o = s.option(form.DummyValue, '_value', _('Value'));
		o.load = function(section_id) {
			var option = uci.get(data[0], section_id, 'type');

			switch (option) {
				case 'file':
					return uci.get(data[0], section_id, '.name').replace(new RegExp("^[^_]+_"), '') + rulefilesuffix;
				case 'http':
					return uci.get(data[0], section_id, 'url');
				default:
					return null;
			}
		}
		o.modalonly = false;

		o = s.option(form.TextValue, '_editer', _('Editer'),
			_('Please type <a target="_blank" href="https://wiki.metacubex.one/config/rule-providers/content/">Contents</a>.'));
		o.renderWidget = function(/* ... */) {
			var frameEl = form.TextValue.prototype.renderWidget.apply(this, arguments);

			frameEl.firstChild.style.fontFamily = hm.monospacefonts.join(',');

			return frameEl;
		}
		o.placeholder = _('Content will not be verified, Please make sure you enter it correctly.');
		o.rmempty = false;
		o.load = function(section_id) {
			return L.resolveDefault(hm.readFile('ruleset', section_id + rulefilesuffix), '');
		}
		o.write = function(section_id, formvalue) {
			return hm.writeFile('ruleset', section_id + rulefilesuffix, formvalue);
		}
		o.remove = function(section_id, formvalue) {
			return hm.writeFile('ruleset', section_id + rulefilesuffix, '');
		}
		o.retain = true;
		o.depends({'type': 'file', 'format': /^(text|yaml)$/});
		o.modalonly = true;

		o = s.option(form.Value, 'url', _('Rule set URL'));
		o.validate = function(section_id, value) {
			try {
				var url = new URL(value);
				if (!url.hostname)
					return _('Expecting: %s').format(_('valid URL'));
			}
			catch(e) {
				return _('Expecting: %s').format(_('valid URL'));
			}

			return true;
		}
		o.rmempty = false;
		o.depends('type', 'http');
		o.modalonly = true;

		o = s.option(form.ListValue, 'proxy', _('Proxy group'),
			_('Name of the Proxy group to download rule set.'));
		o.load = function(section_id) {
			var preadds = [
				['', _('null')],
				['DIRECT', _('DIRECT')]
			];

			return hm.loadProxyGroupLabel(this, preadds, data[0], section_id);
		}
		//o.editable = true;
		o.depends('type', 'http');

		o = s.option(form.Value, 'interval', _('Update interval'),
			_('In seconds. <code>259200</code> will be used if empty.'));
		o.datatype = 'uinteger';
		o.placeholder = '259200';
		o.depends('type', 'http');

		o = s.option(form.Button, '_update');
		o.inputtitle = _('🡇'); //🗘
		o.inputstyle = 'apply';
		o.onclick = function(ev, section_id) {
			return hm.fetchGZ(hm.rulesetdoc, (resp) => {
				alert(resp);
			});
			var type = uci.get(data[0], section_id, 'type');
			var url = uci.get(data[0], section_id, 'url');
			if (type === 'http') {
				return hm.downloadFile('ruleset', section_id + rulefilesuffix, url).then((res) => {
					ui.addNotification(null, E('p', _('Download successful.')));
				}).catch((e) => {
					ui.addNotification(null, E('p', _('Download failed: %s').format(e)));
				});
			} else
				return ui.addNotification(null, E('p', _('Unable to download unsupported type: %s').format(type)));
		};
		o.editable = true;
		o.modalonly = false;
		/* Rule set END */

		return m.render();
	}
});
