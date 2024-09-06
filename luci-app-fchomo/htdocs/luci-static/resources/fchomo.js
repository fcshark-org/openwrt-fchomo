'use strict';
'require baseclass';
'require fs';
'require rpc';
'require ui';

return baseclass.extend({
	dashrepos: [
		['metacubex/metacubexd', _('metacubexd')],
		['metacubex/yacd-meta', _('yacd-meta')],
		['metacubex/razord-meta', _('razord-meta')]
	],

	checkurls: [
		['https://www.baidu.com', _('Baidu')],
		['https://s1.music.126.net/style/favicon.ico', _('163Music')],
		['https://www.google.com/generate_204', _('Google')],
		['https://github.com', _('GitHub')],
		['https://www.youtube.com', _('YouTube')]
	],

	getFeatures: function() {
		var callGetFeatures = rpc.declare({
			object: 'luci.fchomo',
			method: 'get_features',
			expect: { '': {} }
		});

		return L.resolveDefault(callGetFeatures(), {});
	},

	getServiceStatus: function(instance) {
		var conf = 'fchomo';
		var callServiceList = rpc.declare({
			object: 'service',
			method: 'list',
			params: ['name'],
			expect: { '': {} }
		});

		return L.resolveDefault(callServiceList(conf), {})
			.then((res) => {
				var isRunning = false;
				try {
					isRunning = res[conf]['instances'][instance].running;
				} catch (e) {}
				return isRunning;
			});
	},

	getClashAPI: function(instance) {
		var callGetClashAPI = rpc.declare({
			object: 'luci.fchomo',
			method: 'get_clash_api',
			params: ['instance'],
			expect: { '': {} }
		});

		return L.resolveDefault(callGetClashAPI(instance), {});
	},

	handleReload: function(ev, section_id, instance) {
		var instance = instance || '';
		return fs.exec('/etc/init.d/fchomo', ['reload', instance])
			.then((res) => { return window.location = window.location.href.split('#')[0] })
			.catch((e) => {
				ui.addNotification(null, E('p', _('Failed to execute "/etc/init.d/fchomo %s %s" reason: %s').format('reload', instance, e)))
			})
	}
});
